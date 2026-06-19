import { Router } from 'express';
import * as aiService from '../services/aiService.js';

const router = Router();

// AI 对话流式接口
router.post('/chat', async (req, res) => {
  const { messages, context } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ code: 400, message: '消息不能为空' });
    return;
  }

  // 剥离前端的自定义 tool_calls 字段（UI 展示用，非 OpenAI 格式，会导致 400 错误）
  const cleanMessages = messages.map((m: any) => {
    const { tool_calls, ...rest } = m;
    return rest;
  });

  // 前端已经在消息中包含了 system prompt，直接传递
  await aiService.streamChat(cleanMessages, res);
});

// AI 生成世界观
router.post('/generate-worldbuilding', async (req, res) => {
  const { category, prompt } = req.body;
  if (!category || !prompt) {
    res.status(400).json({ code: 400, message: '分类和提示词不能为空' });
    return;
  }

  const systemPrompt = `你是一位世界观构建专家。请根据用户提供的类别和描述，生成详细的世界观设定内容。类别：${category}。请用中文输出，内容结构化，包含标题和详细描述。`;
  const content = await aiService.generateContent(systemPrompt, prompt);
  res.json({ code: 0, data: { content }, message: 'ok' });
});

// AI 生成角色
router.post('/generate-character', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    res.status(400).json({ code: 400, message: '提示词不能为空' });
    return;
  }

  const systemPrompt = '你是一位角色设计专家。请根据用户描述，生成一个详细的角色设定，包含：姓名、性别、年龄、外貌、性格、背景故事。请用中文输出，结构化呈现。';
  const content = await aiService.generateContent(systemPrompt, prompt);
  res.json({ code: 0, data: { content }, message: 'ok' });
});

export default router;