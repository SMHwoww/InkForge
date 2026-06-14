/**
 * Unified SSE streaming chat utility.
 *
 * All AI-related pages use this single function for /api/ai/chat streaming.
 */

export interface ChatStreamOptions {
  projectId: number;
  messages: Array<{ role: string; content: string }>;
  context?: Record<string, any>;
  onDelta: (fullText: string, delta: string) => void;
  onError: (errorMessage: string) => void;
  onDone?: () => void;
  signal?: AbortSignal;
}

/**
 * Stream chat completion from /api/ai/chat.
 * Calls `onDelta(fullText, deltaChunk)` for each token,
 * `onError(errorMessage)` on failure,
 * `onDone()` when streaming completes.
 */
export async function streamChatCompletion(options: ChatStreamOptions): Promise<void> {
  const { projectId, messages, context, onDelta, onError, onDone, signal } = options;

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
              if (data.delta) {
                fullText += data.delta;
                onDelta(fullText, data.delta);
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