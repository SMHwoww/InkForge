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
import { getDb } from '../db/index.js';
import { mediaAssets } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { projectIdParam, projectIdAndMediaIdParam, createMediaBody, updateMediaBody } from '../schemas/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEDIA_ROOT = path.join(__dirname, '..', '..', 'media');

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

// 辅助：根据 MIME 类型猜测媒体类型
function guessType(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'image';
}

// ─── GET /api/projects/:projectId/media ─────────────────────────────────────

router.get('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const db = getDb();
  const result = db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.projectId, projectId))
    .orderBy(sql`created_at DESC`)
    .all();
  res.json({ code: 0, data: result, message: 'ok' });
}));

// ─── POST /api/projects/:projectId/media/upload ─────────────────────────────

router.post('/upload', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);

  const file = req.file;
  if (!file) {
    res.status(400).json({ code: 400, message: '请选择文件' });
    return;
  }

  const name = req.body.name || file.originalname;
  const type = req.body.type || guessType(file.mimetype);
  const prompt = req.body.prompt || '';
  const source = req.body.source || 'upload';

  const localFilename = file.filename;
  const url = `/media/${projectId}/${localFilename}`;

  const db = getDb();
  const result = db.insert(mediaAssets).values({
    projectId,
    name,
    type: type as any,
    url,
    thumbnailUrl: null,
    prompt,
    source: source as any,
  } as any).returning().get();

  res.json({ code: 0, data: { id: result.id, url }, message: 'ok' });
}));

// ─── POST /api/projects/:projectId/media ────────────────────────────────────

router.post('/', validateRequest({ params: projectIdParam, body: createMediaBody }), asyncHandler(async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { name, type, url, prompt, source } = req.body;

  const mediaType = type || 'image';
  let finalUrl = url;
  let localFilename: string | null = null;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      localFilename = await downloadToLocal(url, projectId, mediaType);
      finalUrl = `/media/${projectId}/${localFilename}`;
    } catch (e: any) {
      console.warn('[Media] Failed to download backup:', e.message);
    }
  }

  const db = getDb();
  const result = db.insert(mediaAssets).values({
    projectId,
    name,
    type: mediaType as any,
    url: finalUrl,
    thumbnailUrl: null,
    prompt: prompt || '',
    source: (source || 'upload') as any,
  } as any).returning().get();

  res.json({ code: 0, data: { id: result.id, url: finalUrl }, message: 'ok' });
}));

// ─── PUT /api/projects/:projectId/media/:id ─────────────────────────────────

router.put('/:id', validateRequest({ params: projectIdAndMediaIdParam, body: updateMediaBody }), asyncHandler(async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const id = Number(req.params.id);

  const { name, prompt } = req.body;
  const updateData: any = {};

  if (name !== undefined) updateData.name = name;
  if (prompt !== undefined) updateData.prompt = prompt;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ code: 400, message: '没有需要更新的字段' });
    return;
  }

  const db = getDb();
  db.update(mediaAssets)
    .set(updateData)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)))
    .run();

  res.json({ code: 0, data: null, message: 'ok' });
}));

// ─── DELETE /api/projects/:projectId/media/:id ──────────────────────────────

router.delete('/:id', validateRequest({ params: projectIdAndMediaIdParam }), asyncHandler(async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const id = Number(req.params.id);

  const db = getDb();

  const row = db
    .select({ url: mediaAssets.url })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)))
    .get();

  db.delete(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)))
    .run();

  if (row?.url && row.url.startsWith('/media/')) {
    const filepath = path.join(MEDIA_ROOT, row.url.replace('/media/', ''));
    try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch (e) { /* ignore */ }
  }

  res.json({ code: 0, data: null, message: 'ok' });
}));

export default router;