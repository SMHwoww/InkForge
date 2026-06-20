/**
 * 设定集 (Media Assets) API
 *
 * GET    /api/projects/:projectId/media          — 获取媒体列表
 * POST   /api/projects/:projectId/media          — 添加媒体资产 (URL)
 * POST   /api/projects/:projectId/media/upload   — 上传文件
 * PUT    /api/projects/:projectId/media/:id      — 更新媒体资产
 * DELETE /api/projects/:projectId/media/:id      — 删除媒体资产
 */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb, saveDb } from '../db/index.js';

// INKFORGE_BUNDLED is injected by esbuild define at build time.
// When bundled to CJS, __dirname is out of scope (esbuild wraps each file
// in __commonJS) and import.meta is empty in cjs format.  Derive directories
// from process.execPath or INKFORGE_DATA_DIR instead.
declare const INKFORGE_BUNDLED: boolean | undefined;

const MEDIA_ROOT = (() => {
  if (process.env.INKFORGE_DATA_DIR) {
    return path.join(process.env.INKFORGE_DATA_DIR, 'media');
  }
  if (typeof INKFORGE_BUNDLED !== 'undefined') {
    return path.join(path.dirname(process.execPath), 'media');
  }
  // ESM dev fallback
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'media');
})();

const router = Router({ mergeParams: true });

// 确保 media 目录存在
if (!fs.existsSync(MEDIA_ROOT)) {
  fs.mkdirSync(MEDIA_ROOT, { recursive: true });
}

// 配置 multer：文件上传到 media/{projectId}/
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const projectId = req.params.projectId || 'default';
    const dir = path.join(MEDIA_ROOT, projectId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// 辅助：确保项目目录存在
function ensureProjectDir(projectId: string | number): string {
  const dir = path.join(MEDIA_ROOT, String(projectId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 辅助：从 URL 下载文件到本地
async function downloadToLocal(url: string, projectId: string | number, type: string): Promise<string> {
  const dir = ensureProjectDir(projectId);
  const timestamp = Date.now();
  const ext = type === 'image' ? '.png' : type === 'video' ? '.mp4' : '.mp3';
  const filename = `${timestamp}_download${ext}`;
  const filepath = path.join(dir, filename);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载失败: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  return filename;
}

// ─── GET /api/projects/:projectId/media ─────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ code: 400, message: 'projectId 无效' });
      return;
    }

    const db = await getDb();
    const rows = db.exec(
      `SELECT * FROM media_assets WHERE project_id = ? ORDER BY created_at DESC`,
      [projectId],
    );

    const columns = rows[0]?.columns || [];
    const values = rows[0]?.values || [];
    const result = values.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
      return obj;
    });

    res.json({ code: 0, data: result, message: 'ok' });
  } catch (e: any) {
    console.error('[Media] List error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

// ─── POST /api/projects/:projectId/media/upload ─────────────────────────────

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ code: 400, message: 'projectId 无效' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ code: 400, message: '请选择文件' });
      return;
    }

    const name = req.body.name || file.originalname;
    const type = req.body.type || guessType(file.mimetype);
    const prompt = req.body.prompt || '';
    const source = req.body.source || 'upload';

    // 本地路径
    const localFilename = file.filename;
    const url = `/media/${projectId}/${localFilename}`;

    const db = await getDb();
    db.run(
      `INSERT INTO media_assets (project_id, name, type, url, thumbnail_url, prompt, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, name, type, url, null, prompt, source],
    );
    saveDb();

    const lastId = (db.exec('SELECT last_insert_rowid() as id')[0]?.values?.[0]?.[0]) as number;

    res.json({ code: 0, data: { id: lastId, url }, message: 'ok' });
  } catch (e: any) {
    console.error('[Media] Upload error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

// ─── POST /api/projects/:projectId/media ────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ code: 400, message: 'projectId 无效' });
      return;
    }

    const { name, type, url, prompt, source } = req.body;

    if (!name || !url) {
      res.status(400).json({ code: 400, message: 'name 和 url 不能为空' });
      return;
    }

    const mediaType = type || 'image';
    let finalUrl = url;
    let localFilename: string | null = null;

    // 如果是外部 URL，下载到本地备份
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        localFilename = await downloadToLocal(url, projectId, mediaType);
        finalUrl = `/media/${projectId}/${localFilename}`;
      } catch (e: any) {
        console.warn('[Media] Failed to download backup:', e.message);
        // 下载失败不阻塞，仍使用原始 URL
      }
    }

    const db = await getDb();
    db.run(
      `INSERT INTO media_assets (project_id, name, type, url, thumbnail_url, prompt, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, name, mediaType, finalUrl, null, prompt || '', source || 'upload'],
    );
    saveDb();

    const lastId = (db.exec('SELECT last_insert_rowid() as id')[0]?.values?.[0]?.[0]) as number;

    res.json({ code: 0, data: { id: lastId, url: finalUrl }, message: 'ok' });
  } catch (e: any) {
    console.error('[Media] Create error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

// ─── PUT /api/projects/:projectId/media/:id ─────────────────────────────────

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    if (!projectId || !id) {
      res.status(400).json({ code: 400, message: '参数无效' });
      return;
    }

    const { name, prompt } = req.body;
    const db = await getDb();

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (prompt !== undefined) {
      updates.push('prompt = ?');
      values.push(prompt);
    }

    if (updates.length === 0) {
      res.status(400).json({ code: 400, message: '没有需要更新的字段' });
      return;
    }

    values.push(id, projectId);
    db.run(
      `UPDATE media_assets SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
      values,
    );
    saveDb();

    res.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    console.error('[Media] Update error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

// ─── DELETE /api/projects/:projectId/media/:id ──────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    const id = Number(req.params.id);
    if (!projectId || !id) {
      res.status(400).json({ code: 400, message: '参数无效' });
      return;
    }

    const db = await getDb();

    // 先查 URL 是否为本地文件
    const rows = db.exec('SELECT url FROM media_assets WHERE id = ? AND project_id = ?', [id, projectId]);
    const url = rows[0]?.values?.[0]?.[0] as string | undefined;

    db.run('DELETE FROM media_assets WHERE id = ? AND project_id = ?', [id, projectId]);
    saveDb();

    // 删除本地文件
    if (url && url.startsWith('/media/')) {
      const filepath = path.join(MEDIA_ROOT, url.replace('/media/', ''));
      try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch (e) { /* ignore */ }
    }

    res.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    console.error('[Media] Delete error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

// 辅助：根据 MIME 类型猜测媒体类型
function guessType(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'image';
}

export default router;