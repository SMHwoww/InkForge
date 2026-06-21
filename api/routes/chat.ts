import { Router } from 'express';
import { getDb } from '../db/index.js';
import { chatMessages } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { projectIdParam, saveChatMessagesBody } from '../schemas/index.js';

const router = Router();

router.get('/:projectId', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const projectId = Number(req.params.projectId);
  const db = getDb();
  const rows = db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      toolCalls: chatMessages.toolCalls,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(sql`id ASC`)
    .all();

  const messages = rows.map(row => {
    const msg: any = {
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
    };
    if (row.toolCalls) {
      try { msg.tool_calls = JSON.parse(String(row.toolCalls)); } catch { /* ignore */ }
    }
    return msg;
  });

  res.json({ code: 0, data: messages, message: 'ok' });
}));

router.post('/:projectId', validateRequest({ params: projectIdParam, body: saveChatMessagesBody }), asyncHandler(async (req, res) => {
  const projectId = Number(req.params.projectId);
  const { messages } = req.body;
  const db = getDb();

  db.delete(chatMessages).where(eq(chatMessages.projectId, projectId)).run();

  for (const msg of messages) {
    if (msg.role && (msg.content || msg.tool_calls)) {
      const toolCallsJson = msg.tool_calls ? JSON.stringify(msg.tool_calls) : null;
      db.insert(chatMessages).values({
        projectId,
        role: msg.role,
        content: msg.content || '',
        toolCalls: toolCallsJson,
      } as any).run();
    }
  }

  res.json({ code: 0, data: null, message: '保存成功' });
}));

router.delete('/:projectId', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const projectId = Number(req.params.projectId);
  const db = getDb();
  db.delete(chatMessages).where(eq(chatMessages.projectId, projectId)).run();
  res.json({ code: 0, data: null, message: '清除成功' });
}));

export default router;