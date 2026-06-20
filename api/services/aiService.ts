import OpenAI from 'openai';
import type { Response } from 'express';
import { toolsToOpenAI, executeToolCall } from './mcpClient.js';
import { getAiConfig } from './mcpConfig.js';

let _client: OpenAI | null = null;
let _lastConfig: string = '';

function getClient(): OpenAI {
  const aiConfig = getAiConfig();
  const configKey = `${aiConfig.apiKey}|${aiConfig.baseUrl}`;
  if (!_client || configKey !== _lastConfig) {
    _client = new OpenAI({
      apiKey: aiConfig.apiKey || 'sk-placeholder',
      baseURL: aiConfig.baseUrl || 'https://api.openai.com/v1',
    });
    _lastConfig = configKey;
  }
  return _client;
}

function formatError(error: unknown): string {
  const aiConfig = getAiConfig();
  const baseURL = aiConfig.baseUrl || 'https://api.openai.com/v1';
  const model = aiConfig.model || 'gpt-4o-mini';

  if (error instanceof OpenAI.APIConnectionError) {
    return `AI 连接失败：无法连接到 API 服务\n服务地址: ${baseURL}\n模型: ${model}\n\n可能原因：\n1. 网络连接问题\n2. 服务地址配置错误\n3. 服务端不可用或防火墙拦截\n\n原始错误: ${error.message}`;
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return `AI 认证失败：API Key 无效或已过期\n请在设置中检查 AI API Key 配置\n原始错误: ${error.message}`;
  }
  if (error instanceof OpenAI.RateLimitError) {
    return `AI 请求频率超限：API 调用次数已达上限\n请稍后重试或检查账户配额\n原始错误: ${error.message}`;
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

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function writeSSE(res: Response, data: Record<string, any>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Stream Chat ─────────────────────────────────────────────────────────────

export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  res: Response,
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const aiConfig = getAiConfig();
  const model = aiConfig.model || 'gpt-4o-mini';
  const apiKey = aiConfig.apiKey;

  if (!apiKey || apiKey === 'sk-placeholder') {
    const errMsg = 'AI 服务未配置：请在设置中配置 AI API Key';
    console.warn('[AI] API Key not configured');
    writeSSE(res, { error: errMsg, done: true });
    res.end();
    return;
  }

  try {
    const mcpTools = toolsToOpenAI();
    const hasMcpTools = mcpTools.length > 0;

    const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    ];

    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model,
        messages: history,
        stream: true,
        temperature: 0.8,
        max_tokens: 2048,
      };

      if (hasMcpTools && round === 0) {
        requestParams.tools = mcpTools as any;
        requestParams.tool_choice = 'auto';
      }

      const stream = await getClient().chat.completions.create(requestParams);

      let contentBuffer = '';
      let toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          contentBuffer += delta.content;
          writeSSE(res, { delta: delta.content, done: false });
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: tc.id || '', name: tc.function?.name || '', args: '' });
            }
            const entry = toolCalls.get(idx)!;
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.args += tc.function.arguments;
          }
        }
      }

      if (toolCalls.size === 0) {
        writeSSE(res, { delta: '', done: true });
        res.end();
        return;
      }

      const toolCallEntries = Array.from(toolCalls.values());

      // 确保 arguments 是合法 JSON，防止 qwen 等模型报错
      const normalizedEntries = toolCallEntries.map(tc => {
        let args = tc.args;
        try { JSON.parse(args); } catch { args = '{}'; }
        return { ...tc, args };
      });

      writeSSE(res, { tool_calls: normalizedEntries.map(tc => ({ id: tc.id, name: tc.name, arguments: tc.args })), done: false });

      const assistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: contentBuffer || null,
        tool_calls: normalizedEntries.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      };
      history.push(assistantMsg);

      for (const tc of normalizedEntries) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.args); } catch { /* ignore */ }

        writeSSE(res, { tool_progress: { id: tc.id, name: tc.name, status: 'running' }, done: false });

        const result = await executeToolCall(tc.name, args);

        writeSSE(res, { tool_result: { id: tc.id, name: tc.name, result }, done: false });

        history.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
    }

    writeSSE(res, { delta: '', done: true });
    res.end();
  } catch (error) {
    const errMsg = formatError(error);
    console.error('[AI] Chat stream error:', errMsg);
    writeSSE(res, { error: errMsg, done: true });
    res.end();
  }
}

// ─── Generate Content (non-streaming) ────────────────────────────────────────

export async function generateContent(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; error?: string }> {
  const aiConfig = getAiConfig();
  const model = aiConfig.model || 'gpt-4o-mini';
  const apiKey = aiConfig.apiKey;

  if (!apiKey || apiKey === 'sk-placeholder') {
    return { content: '', error: 'AI 服务未配置：请在设置中配置 AI API Key' };
  }

  try {
    const mcpTools = toolsToOpenAI();
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model,
      messages,
      temperature: 0.8,
      max_tokens: 2048,
    };

    if (mcpTools.length > 0) {
      (requestParams as any).tools = mcpTools;
      (requestParams as any).tool_choice = 'auto';
    }

    let response = await getClient().chat.completions.create(requestParams);
    const choice = response.choices[0];

    if (choice?.message?.tool_calls?.length) {
      messages.push(choice.message);

      for (const tc of choice.message.tool_calls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
        const result = await executeToolCall(tc.function.name, args);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      response = await getClient().chat.completions.create({
        model,
        messages,
        temperature: 0.8,
        max_tokens: 2048,
      });
    }

    return { content: response.choices[0]?.message?.content || '' };
  } catch (error) {
    const errMsg = formatError(error);
    console.error('[AI] generateContent error:', errMsg);
    return { content: '', error: errMsg };
  }
}