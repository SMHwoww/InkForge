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

  const systemMessage = {
    role: 'system',
    content: '你是一位专业的小说创作助手，擅长帮助作者进行角色设计、世界观构建、情节构思和文字润色。请用中文回答，语气友好专业。' +
      (context ? `\n\n当前创作上下文：${JSON.stringify(context)}` : ''),
  };

  await aiService.streamChat([systemMessage, ...messages], res);
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