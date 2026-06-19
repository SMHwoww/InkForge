import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, X, Loader2, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { streamChatCompletion, type ToolCall, type ToolProgress, type ToolResult } from '@/lib/chat';
import {
  type ToolCallDisplay,
  TOOL_LABELS,
  buildAIdoSystemPrompt,
} from '@/lib/aido';
import type { ChatMessage, ToolCallRecord } from '@/types';

interface AIPanelProps {
  projectId: number;
  contextPrompt: string;
  title: string;
  onClose: () => void;
}

const quickActions = [
  { label: '补充', prompt: '请根据以上上下文，帮我补充完善内容' },
  { label: '建议', prompt: '请针对以上内容，给我一些改进建议' },
  { label: '润色', prompt: '请帮我润色以上内容，使其更加流畅优美' },
  { label: '分析', prompt: '请分析以上内容的逻辑和结构' },
];

export default function AIPanel({ projectId, contextPrompt, title, onClose }: AIPanelProps) {
  const { messages, isStreaming, setProjectId, addMessage, setStreaming, clearMessages, updateLastAssistant, setLastAssistantToolCalls } = useChatStore();
  const [input, setInput] = useState('');
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCallDisplay>>(new Map());
  const [builtinEnabled, setBuiltinEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProjectId(projectId);
    return () => { clearMessages(); setProjectId(null); };
  }, [projectId]);

  useEffect(() => {
    fetch('/api/mcp/config')
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

  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || isStreaming) return;

    const systemPrompt = buildAIdoSystemPrompt(projectId, builtinEnabled);

    const userMsg: ChatMessage = { role: 'user', content };
    addMessage(userMsg);
    setInput('');
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    addMessage(assistantMsg);

    setToolCalls(new Map());

    await streamChatCompletion({
      projectId,
      messages: [...messages, { role: 'user', content: `${systemPrompt}\n\n用户请求：${content}` }],
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
  }, [input, isStreaming, projectId, contextPrompt, messages, builtinEnabled]);

  const renderMessage = (msg: ChatMessage, idx: number) => {
    const isLastAssistant = msg.role === 'assistant' && isStreaming && idx === messages.length - 1;
    if (isLastAssistant && !msg.content) {
      return <span className="inline-flex items-center gap-1"><Loader2 size={14} className="animate-spin" />思考中...</span>;
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
      <div className="space-y-2">
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content || ''}</p>

        {/* MCP 工具调用状态 */}
        {builtinEnabled && msgToolCalls.length > 0 && msg.role === 'assistant' && (
          <div className="border-t border-[#c9a96e]/10 pt-2 space-y-1">
            <p className="text-[10px] text-[#c9a96e]/40 uppercase tracking-wider flex items-center gap-1">
              <Wrench size={10} /> MCP 工具调用
            </p>
            {msgToolCalls.map((tc) => (
              <div
                key={tc.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                  tc.status === 'running' ? 'bg-[#c9a96e]/10' :
                  tc.status === 'done' ? 'bg-[#7dc9a9]/10' :
                  'bg-red-900/10'
                }`}
              >
                <span className={`flex-shrink-0 ${
                  tc.status === 'running' ? 'text-[#c9a96e]/70' :
                  tc.status === 'done' ? 'text-[#7dc9a9]' :
                  'text-red-400'
                }`}>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 shrink-0 border-l border-[#c9a96e]/10 bg-[#1a1a2e]/95 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a96e]/10 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#c9a96e]" />
          <span className="text-sm font-semibold text-[#f5f0e8]">{title}</span>
        </div>
        <button onClick={onClose} className="text-[#f5f0e8]/30 hover:text-[#f5f0e8]">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles size={28} className="text-[#c9a96e]/20 mx-auto mb-3" />
            <p className="text-xs text-[#f5f0e8]/30">AI 助手可以帮你补充、润色、分析当前内容</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {quickActions.map(a => (
                <button key={a.label} onClick={() => handleSend(a.prompt)} className="px-2 py-1 rounded-md text-[10px] bg-[#c9a96e]/10 text-[#c9a96e]/70 hover:text-[#c9a96e] hover:bg-[#c9a96e]/20 transition-colors">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user' ? 'bg-[#c9a96e]/15 text-[#f5f0e8] border border-[#c9a96e]/20' : 'bg-[#2d4a3e]/40 text-[#f5f0e8] border border-[#c9a96e]/5'
              }`}>
                {renderMessage(msg, i)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-3 border-t border-[#c9a96e]/10 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="输入指令..."
            className="flex-1 bg-[#0f0f1a] border border-[#c9a96e]/15 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className="p-2 rounded-lg bg-[#c9a96e]/20 text-[#c9a96e] hover:bg-[#c9a96e]/30 disabled:opacity-30 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}