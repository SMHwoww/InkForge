/**
 * 设定集 (Media Assets) API
 *
 * GET    /api/projects/:projectId/media        — 获取媒体列表
 * POST   /api/projects/:projectId/media        — 添加媒体资产
 * PUT    /api/projects/:projectId/media/:id    — 更新媒体资产
 * DELETE /api/projects/:projectId/media/:id    — 删除媒体资产
 */

import { Router, type Request, type Response } from 'express';
import { getDb, saveDb } from '../db/index.js';

const router = Router({ mergeParams: true });

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

// ─── POST /api/projects/:projectId/media ────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) {
      res.status(400).json({ code: 400, message: 'projectId 无效' });
      return;
    }

    const { name, type, url, thumbnailUrl, prompt, source } = req.body;

    if (!name || !url) {
      res.status(400).json({ code: 400, message: 'name 和 url 不能为空' });
      return;
    }

    const db = await getDb();
    db.run(
      `INSERT INTO media_assets (project_id, name, type, url, thumbnail_url, prompt, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        name,
        type || 'image',
        url,
        thumbnailUrl || null,
        prompt || '',
        source || 'upload',
      ],
    );
    saveDb();

    const lastId = (db.exec('SELECT last_insert_rowid() as id')[0]?.values?.[0]?.[0]) as number;

    res.json({ code: 0, data: { id: lastId }, message: 'ok' });
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
    db.run(
      `DELETE FROM media_assets WHERE id = ? AND project_id = ?`,
      [id, projectId],
    );
    saveDb();

    res.json({ code: 0, data: null, message: 'ok' });
  } catch (e: any) {
    console.error('[Media] Delete error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

export default router;