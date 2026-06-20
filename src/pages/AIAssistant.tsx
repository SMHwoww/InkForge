import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChatStore } from '@/stores/chatStore';
import { useProjectStore } from '@/stores/projectStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { getBaseUrl } from '@/lib/tauri-env';
import { streamChatCompletion, type ToolCall, type ToolProgress, type ToolResult } from '@/lib/chat';
import {
  type ToolCallDisplay,
  TOOL_LABELS,
  buildAIdoSystemPrompt,
} from '@/lib/aido';
import type { ChatMessage } from '@/types';
import type { ToolCallRecord } from '@/types';
import { marked } from 'marked';
import { Send, Sparkles, Lightbulb, FileText, Pencil, Wand2, Zap, Trash2, Loader2, Copy, RefreshCw, Image as ImageIcon, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

// Configure marked
marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

const quickActions = [
  { label: '续写', icon: Pencil, prompt: '请根据以上内容，续写下一段剧情' },
  { label: '润色', icon: Wand2, prompt: '请帮我润色以下文字，使其更加流畅优美' },
  { label: '大纲', icon: FileText, prompt: '请帮我生成一个详细的章节大纲' },
  { label: '灵感', icon: Lightbulb, prompt: '请给我一些剧情发展的灵感建议' },
  { label: '扩写', icon: Zap, prompt: '请帮我扩写以下内容，增加细节描写' },
];

export default function AIAssistant() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { messages, isStreaming, addMessage, setStreaming, clearMessages, updateLastAssistant, setLastAssistantToolCalls, removeMessage } = useChatStore();
  const {
    fetchCharacters, fetchWorldbuilding, fetchChapters,
    fetchTimeline, fetchOutlines,
  } = useProjectStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // MCP 工具调用追踪
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCallDisplay>>(new Map());
  const [builtinEnabled, setBuiltinEnabled] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<'chat' | 'image'>('chat');

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageNegativePrompt, setImageNegativePrompt] = useState('');
  const [imageSize, setImageSize] = useState('1280*1280');
  const [imageCount, setImageCount] = useState(1);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageResults, setImageResults] = useState<string[]>([]);
  const [imageTaskId, setImageTaskId] = useState('');
  const [imagePollingStatus, setImagePollingStatus] = useState('');
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchCharacters(projectId);
      fetchWorldbuilding(projectId);
      fetchChapters(projectId);
      fetchTimeline(projectId);
      fetchOutlines(projectId);
    }
  }, [projectId]);

  // Fetch MCP config to check builtinEnabled status
  useEffect(() => {
    getBaseUrl().then(base => {
      const url = base ? `${base}/api/mcp/config` : '/api/mcp/config';
      return fetch(url);
    })
      .then(r => r.json())
      .then(d => {
        if (d.code === 0 && d.data) {
          setBuiltinEnabled(d.data.builtinEnabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isStreaming) return;

    const systemPrompt = buildAIdoSystemPrompt(projectId, builtinEnabled);

    const userMsg: ChatMessage = { role: 'user', content };
    addMessage(userMsg);
    setInput('');
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    addMessage(assistantMsg);

    // 重置工具调用追踪
    setToolCalls(new Map());

    await streamChatCompletion({
      projectId,
      messages: [...messages, { role: 'user', content: systemPrompt + '\n\n用户请求：' + content }],
      onDelta: (fullText) => updateLastAssistant(fullText),
      onError: (err) => updateLastAssistant(err),
      onToolCalls: (calls: ToolCall[]) => {
        setToolCalls(prev => {
          const next = new Map(prev);
          for (const tc of calls) {
            let parsedArgs = tc.arguments;
            try { parsedArgs = JSON.stringify(JSON.parse(tc.arguments), null, 2); } catch {}
            next.set(tc.id, {
              id: tc.id,
              name: tc.name,
              args: parsedArgs,
              status: 'running',
              label: TOOL_LABELS[tc.name] || tc.name,
            });
          }
          return next;
        });
      },
      onToolProgress: (progress: ToolProgress) => {
        setToolCalls(prev => {
          const next = new Map(prev);
          const existing = next.get(progress.id);
          if (existing) {
            next.set(progress.id, { ...existing, status: progress.status === 'running' ? 'running' : existing.status });
          }
          return next;
        });
      },
      onToolResult: (result: ToolResult) => {
        setToolCalls(prev => {
          const next = new Map(prev);
          const existing = next.get(result.id);
          if (existing) {
            const isError = result.result.startsWith('Error');
            next.set(result.id, {
              ...existing,
              status: isError ? 'error' : 'done',
              result: result.result,
            });
          }
          // 持久化工具调用记录到消息
          const records: ToolCallRecord[] = [];
          next.forEach(tc => {
            records.push({
              id: tc.id,
              name: tc.name,
              args: tc.args,
              result: tc.result,
              status: tc.status,
            });
          });
          setLastAssistantToolCalls(records);
          return next;
        });
      },
    });

    setStreaming(false);
  };

  // Image generation
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || imageLoading) return;
    setImageLoading(true);
    setImageError('');
    setImageResults([]);
    setImageTaskId('');
    setImagePollingStatus('');

    try {
      const result = await api.generateImage({
        prompt: imagePrompt.trim(),
        negativePrompt: imageNegativePrompt.trim() || undefined,
        size: imageSize,
        n: imageCount,
        projectId: projectId || undefined,
      });

      if (result.provider === 'bailian' && result.taskId) {
        setImageTaskId(result.taskId);
        setImagePollingStatus('PENDING');
      } else if (result.images) {
        setImageResults(result.images);
        setImageLoading(false);
      } else {
        setImageError('服务器返回了异常响应，请检查 AI 生图配置（模型名称、API Key 等）');
        setImageLoading(false);
      }
    } catch (e: any) {
      setImageError(e.message || '生成失败');
      setImageLoading(false);
    }
  };

  // Poll bailian task status
  useEffect(() => {
    if (!imageTaskId || imagePollingStatus === 'SUCCEEDED' || imagePollingStatus === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const result = await api.getImageTask(imageTaskId);
        setImagePollingStatus(result.status);

        if (result.status === 'SUCCEEDED') {
          setImageResults(result.images || []);
          setImageLoading(false);
          clearInterval(interval);
        } else if (result.status === 'FAILED') {
          setImageError(result.error || '任务失败');
          setImageLoading(false);
          clearInterval(interval);
        }
      } catch (e: any) {
        setImageError(e.message || '查询任务状态失败');
        setImagePollingStatus('FAILED');
        setImageLoading(false);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [imageTaskId, imagePollingStatus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleRegenerate = () => {
    const msgs = [...useChatStore.getState().messages];
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    const lastUserContent = msgs[lastUserIdx].content;
    const newMessages = msgs.slice(0, lastUserIdx);
    useChatStore.setState({ messages: newMessages });
    handleSend(lastUserContent);
  };

  const handleDeleteMessage = (index: number) => {
    removeMessage(index);
  };

  // Render message content with markdown and tool call display
  const renderMessageContent = (msg: ChatMessage, msgIndex: number) => {
    const isLastAssistant = msg.role === 'assistant' && isStreaming && msgIndex === messages.length - 1;

    if (isLastAssistant && !msg.content) {
      return (
        <span className="inline-flex items-center gap-1">
          <Loader2 size={14} className="animate-spin" />
          思考中...
        </span>
      );
    }

    // 流式传输中：使用实时 toolCalls Map；非流式：使用消息中持久化的 tool_calls
    const msgToolCalls = isStreaming && isLastAssistant
      ? Array.from(toolCalls.values())
      : (msg.tool_calls || []).map(tc => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
          status: tc.status as 'running' | 'done' | 'error',
          result: tc.result,
          label: TOOL_LABELS[tc.name] || tc.name,
        }));

    return (
      <div className="space-y-3">
        {/* Render markdown */}
        <div
          className="text-sm leading-relaxed prose-aido prose-strong:text-[#f5f0e8] prose-code:text-[#c9a96e] prose-code:bg-[#c9a96e]/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded break-words"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />

        {/* MCP 工具调用状态 */}
        {msgToolCalls.length > 0 && msg.role === 'assistant' && (
          <div className="border-t border-[#c9a96e]/10 pt-2 space-y-1.5">
            <p className="text-[10px] text-[#c9a96e]/40 uppercase tracking-wider flex items-center gap-1">
              <Wrench size={10} /> MCP 工具调用
            </p>
            {msgToolCalls.map((tc) => (
              <div
                key={tc.id}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-3 py-2',
                  tc.status === 'running' && 'bg-[#c9a96e]/10',
                  tc.status === 'done' && 'bg-[#7dc9a9]/10',
                  tc.status === 'error' && 'bg-red-900/10',
                )}
              >
                <span className={clsx(
                  'flex-shrink-0',
                  tc.status === 'running' && 'text-[#c9a96e]/70',
                  tc.status === 'done' && 'text-[#7dc9a9]',
                  tc.status === 'error' && 'text-red-400',
                )}>
                  {tc.status === 'running' ? <Loader2 size={12} className="animate-spin" /> :
                   tc.status === 'done' ? <CheckCircle size={12} /> :
                   <XCircle size={12} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#f5f0e8]/70 truncate">
                    {tc.label || tc.name}
                  </p>
                  {tc.status === 'done' && tc.result && (
                    <p className="text-[10px] text-[#f5f0e8]/40 truncate mt-0.5">
                      {tc.result.length > 100 ? tc.result.slice(0, 100) + '...' : tc.result}
                    </p>
                  )}
                  {tc.status === 'error' && tc.result && (
                    <p className="text-[10px] text-red-400/60 truncate mt-0.5">
                      {tc.result}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#c9a96e]/10 bg-[#1a1a2e]/80">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-[#f5f0e8] flex items-center gap-2">
              AI 写作助手
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeTab === 'chat'
                  ? 'bg-[#c9a96e]/20 text-[#c9a96e] border border-[#c9a96e]/30'
                  : 'text-[#f5f0e8]/50 hover:text-[#f5f0e8]/80 hover:bg-[#f5f0e8]/5'
              }`}
            >
              <Sparkles size={14} />
              AI 对话
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeTab === 'image'
                  ? 'bg-[#c9a96e]/20 text-[#c9a96e] border border-[#c9a96e]/30'
                  : 'text-[#f5f0e8]/50 hover:text-[#f5f0e8]/80 hover:bg-[#f5f0e8]/5'
              }`}
            >
              <ImageIcon size={14} />
              真珠生图
            </button>
          </div>
          <div className="flex items-center gap-2 w-[120px] justify-end">
            {activeTab === 'chat' && (
              <Button variant="ghost" size="sm" onClick={clearMessages}>
                <Trash2 size={14} />
                清空对话
              </Button>
            )}
          </div>
        </div>

        {activeTab === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles size={48} className="text-[#c9a96e]/20 mb-4" />
                <h2 className="text-lg font-semibold text-[#f5f0e8]/60 mb-2">AI 写作助手</h2>
                <p className="text-sm text-[#f5f0e8]/30 max-w-md mb-6">
                  我可以帮你续写剧情、润色文字、生成大纲、激发灵感等。AI 可以通过内置工具自主查询和操作你的创作内容，包括创建章节、大纲、世界观条目、角色、星图节点和时间轴事件。
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {quickActions.map(action => (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.prompt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2d4a3e]/60 border border-[#c9a96e]/10 text-sm text-[#f5f0e8]/60 hover:text-[#c9a96e] hover:border-[#c9a96e]/30 transition-colors"
                    >
                      <action.icon size={14} />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                      msg.role === 'user'
                        ? 'bg-[#c9a96e]/20 text-[#f5f0e8] border border-[#c9a96e]/30'
                        : 'bg-[#2d4a3e]/60 text-[#f5f0e8] border border-[#c9a96e]/10'
                    }`}
                  >
                    {renderMessageContent(msg, i)}
                    {msg.role === 'assistant' && msg.content && !isStreaming && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#c9a96e]/10">
                        <button
                          onClick={() => handleCopy(msg.content)}
                          className="p-1 rounded-md text-[#f5f0e8]/30 hover:text-[#c9a96e] hover:bg-[#c9a96e]/10 transition-colors"
                          title="复制"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={handleRegenerate}
                          className="p-1 rounded-md text-[#f5f0e8]/30 hover:text-[#c9a96e] hover:bg-[#c9a96e]/10 transition-colors"
                          title="重新生成"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(i)}
                          className="p-1 rounded-md text-[#f5f0e8]/30 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-[#c9a96e]/10 bg-[#1a1a2e]/80">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述你想让AI帮你做的操作..."
                rows={2}
                className="flex-1 bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-xl px-4 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none"
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
              >
                <Send size={16} />
              </Button>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {quickActions.map(action => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  disabled={isStreaming}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-[#f5f0e8]/40 hover:text-[#c9a96e] hover:bg-[#c9a96e]/5 transition-colors whitespace-nowrap disabled:opacity-30"
                >
                  <action.icon size={12} />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'image' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <ImageIcon size={36} className="text-[#c9a96e]/30 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-[#f5f0e8]/80">真珠生图</h2>
              <p className="text-sm text-[#f5f0e8]/30 mt-1">输入提示词，AI 为你生成图像</p>
            </div>

            {/* Prompt */}
            <div>
              <label className="text-xs text-[#f5f0e8]/50 mb-2 block">提示词</label>
              <textarea
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                placeholder="描述你想生成的图像内容..."
                rows={3}
                className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-xl px-4 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none"
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <label className="text-xs text-[#f5f0e8]/50 mb-2 block">负面提示词（可选）</label>
              <textarea
                value={imageNegativePrompt}
                onChange={e => setImageNegativePrompt(e.target.value)}
                placeholder="描述你不想在图像中看到的内容..."
                rows={2}
                className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-xl px-4 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none"
              />
            </div>

            {/* Size & Count */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-[#f5f0e8]/50 mb-2 block">尺寸</label>
                <select
                  value={imageSize}
                  onChange={e => setImageSize(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                >
                  <option value="1024*1024">1024x1024 (1:1)</option>
                  <option value="1280*1280">1280x1280 (1:1)</option>
                  <option value="1280*720">1280x720 (16:9)</option>
                  <option value="720*1280">720x1280 (9:16)</option>
                  <option value="1024*768">1024x768 (4:3)</option>
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-[#f5f0e8]/50 mb-2 block">数量</label>
                <select
                  value={imageCount}
                  onChange={e => setImageCount(Number(e.target.value))}
                  className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                >
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerateImage}
              disabled={!imagePrompt.trim() || imageLoading}
              className="w-full"
            >
              {imageLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {imagePollingStatus ? `生成中... (${imagePollingStatus === 'PENDING' ? '排队中' : imagePollingStatus === 'RUNNING' ? '处理中' : imagePollingStatus})` : '生成中...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ImageIcon size={16} />
                  生成图像
                </span>
              )}
            </Button>

            {/* Error */}
            {imageError && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-sm text-red-400">
                {imageError}
              </div>
            )}

            {/* Results */}
            {imageResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#f5f0e8]/60">生成结果</h3>
                <div className="grid grid-cols-2 gap-3">
                  {imageResults.map((url, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border border-[#c9a96e]/10 bg-[#0f0f1a]">
                      <img
                        src={url}
                        alt={`生成图像 ${i + 1}`}
                        className="w-full h-auto object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        查看原图
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

    </div>
  );
}