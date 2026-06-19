/**
 * Unified SSE streaming chat utility.
 *
 * All AI-related pages use this single function for /api/ai/chat streaming.
 */

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolProgress {
  id: string;
  name: string;
  status: string;
}

export interface ToolResult {
  id: string;
  name: string;
  result: string;
}

export interface ChatStreamOptions {
  projectId: number;
  messages: Array<{ role: string; content: string }>;
  context?: Record<string, any>;
  onDelta: (fullText: string, delta: string) => void;
  onError: (errorMessage: string) => void;
  onDone?: () => void;
  /** MCP: 模型决定调用工具时触发 */
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  /** MCP: 工具执行进度 */
  onToolProgress?: (progress: ToolProgress) => void;
  /** MCP: 工具执行结果 */
  onToolResult?: (result: ToolResult) => void;
  signal?: AbortSignal;
}

/**
 * Stream chat completion from /api/ai/chat.
 * Calls `onDelta(fullText, deltaChunk)` for each token,
 * `onError(errorMessage)` on failure,
 * `onDone()` when streaming completes.
 */
export async function streamChatCompletion(options: ChatStreamOptions): Promise<void> {
  const { projectId, messages, context, onDelta, onError, onDone, signal,
    onToolCalls, onToolProgress, onToolResult } = options;

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, messages, context: context || {} }),
      signal,
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                onError(data.error);
                return;
              }

              // MCP: tool_calls 事件
              if (data.tool_calls) {
                onToolCalls?.(data.tool_calls);
                continue;
              }

              // MCP: tool_progress 事件
              if (data.tool_progress) {
                onToolProgress?.(data.tool_progress);
                continue;
              }

              // MCP: tool_result 事件
              if (data.tool_result) {
                onToolResult?.(data.tool_result);
                continue;
              }

              // 正常文本 delta
              if (data.delta) {
                fullText += data.delta;
                // 部分 AI 模型输出字面量 \n 而非真正的换行符，需要还原
                const cooked = fullText.replace(/\\n/g, '\n');
                onDelta(cooked, data.delta);
              }
            } catch { /* ignore malformed JSON */ }
          }
        }
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
    onError(e?.message || 'AI 服务暂时不可用');
    return;
  }

  onDone?.();
}