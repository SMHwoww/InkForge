import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// GET /api/chat/:projectId - get all messages for a project
router.get('/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const db = await getDb();
    const rows = db.exec(
      `SELECT id, role, content, tool_calls, created_at FROM chat_messages WHERE project_id = ? ORDER BY id ASC`,
      [projectId],
    );
    if (!rows.length) {
      res.json({ code: 0, data: [], message: 'ok' });
      return;
    }
    const messages = rows[0].values.map(row => {
      const msg: any = {
        id: row[0],
        role: row[1],
        content: row[2],
        createdAt: row[4],
      };
      if (row[3]) {
        try { msg.tool_calls = JSON.parse(String(row[3])); } catch { /* ignore */ }
      }
      return msg;
    });
    res.json({ code: 0, data: messages, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取聊天记录失败' });
  }
});

// POST /api/chat/:projectId - batch replace all messages for a project
router.post('/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      res.status(400).json({ code: 400, message: '消息格式不正确' });
      return;
    }
    const db = await getDb();
    db.run('DELETE FROM chat_messages WHERE project_id = ?', [projectId]);
    const stmt = db.prepare(
      'INSERT INTO chat_messages (project_id, role, content, tool_calls) VALUES (?, ?, ?, ?)',
    );
    for (const msg of messages) {
      if (msg.role && (msg.content || msg.tool_calls)) {
        const toolCallsJson = msg.tool_calls ? JSON.stringify(msg.tool_calls) : null;
        stmt.run([projectId, msg.role, msg.content || '', toolCallsJson]);
      }
    }
    stmt.free();
    saveDb();
    res.json({ code: 0, data: null, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '保存聊天记录失败' });
  }
});

// DELETE /api/chat/:projectId - clear all messages for a project
router.delete('/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const db = await getDb();
    db.run('DELETE FROM chat_messages WHERE project_id = ?', [projectId]);
    saveDb();
    res.json({ code: 0, data: null, message: '清除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '清除聊天记录失败' });
  }
});

export default router;