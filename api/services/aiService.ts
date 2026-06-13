import OpenAI from 'openai';
import type { Response } from 'express';

// OpenAI client is lazily initialized so that dotenv.config() has time
// to load .env before the client reads OPENAI_API_KEY / OPENAI_BASE_URL.
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    });
  }
  return _client;
}

function formatError(error: unknown): string {
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Specific error types must be checked before generic APIError since they all extend it
  if (error instanceof OpenAI.APIConnectionError) {
    return `AI 连接失败：无法连接到 API 服务\n服务地址: ${baseURL}\n模型: ${model}\n\n可能原因：\n1. 网络连接问题，请检查网络是否正常\n2. OPENAI_BASE_URL 配置错误，请检查 .env 文件\n3. 服务端不可用或防火墙拦截\n\n原始错误: ${error.message}`;
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return `AI 认证失败：API Key 无效或已过期\n请检查 .env 文件中的 OPENAI_API_KEY 配置\n原始错误: ${error.message}`;
  }
  if (error instanceof OpenAI.RateLimitError) {
    return `AI 请求频率超限：API 调用次数已达上限\n请稍后重试或检查账户配额\n服务地址: ${baseURL}\n原始错误: ${error.message}`;
  }
  if (error instanceof OpenAI.PermissionDeniedError) {
    return `AI 权限不足：API 账户没有访问该模型的权限\n请检查模型 ${model} 是否在账户中可用\n原始错误: ${error.message}`;
  }
  if (error instanceof OpenAI.BadRequestError) {
    return `AI 请求参数错误\n模型: ${model}\n原始错误: ${error.message}`;
  }
  if (error instanceof OpenAI.APIError) {
    return `AI API 错误 [状态码: ${error.status || '未知'}]\n类型: ${error.type || '未知'}\n代码: ${error.code || '未知'}\n原始错误: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (error instanceof Error) {
    return `AI 服务异常: ${error.message}\n${error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : ''}`;
  }
  return `AI 服务未知错误: ${String(error)}`;
}

export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  res: Response,
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sk-placeholder') {
    const errMsg = 'AI 服务未配置：请在项目根目录创建 .env 文件并设置 OPENAI_API_KEY=你的API密钥';
    console.warn('[AI] API Key not configured');
    res.write(`data: ${JSON.stringify({ error: errMsg, done: true })}\n\n`);
    res.end();
    return;
  }

  try {
    const stream = await getClient().chat.completions.create({
      model,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: true,
      temperature: 0.8,
      max_tokens: 2048,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ delta: content, done: false })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ delta: '', done: true })}\n\n`);
    res.end();
  } catch (error) {
    const errMsg = formatError(error);
    console.error('[AI] Chat stream error:', errMsg);
    res.write(`data: ${JSON.stringify({ error: errMsg, done: true })}\n\n`);
    res.end();
  }
}

export async function generateContent(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; error?: string }> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sk-placeholder') {
    const errMsg = 'AI 服务未配置：请在项目根目录创建 .env 文件并设置 OPENAI_API_KEY=你的API密钥\n获取免费API Key: https://platform.openai.com/api-keys';
    console.warn('[AI] generateContent - API Key not configured');
    return { content: '', error: errMsg };
  }

  try {
    const response = await getClient().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2048,
    });
    return { content: response.choices[0]?.message?.content || '' };
  } catch (error) {
    const errMsg = formatError(error);
    console.error('[AI] generateContent error:', errMsg);
    return { content: '', error: errMsg };
  }
}