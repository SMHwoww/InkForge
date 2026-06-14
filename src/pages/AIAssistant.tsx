import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChatStore } from '@/stores/chatStore';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { streamChatCompletion } from '@/lib/chat';
import {
  type AIdoAction,
  AIDO_TYPE_META,
  stripAIdoInstructions,
  parseAIdoInstructions,
  buildAIdoSystemPrompt,
} from '@/lib/aido';
import type { ChatMessage } from '@/types';
import { marked } from 'marked';
import { Send, Sparkles, Lightbulb, FileText, Pencil, Wand2, Zap, Trash2, Loader2, CheckSquare, Square, ChevronDown, ChevronRight, Bot, Globe, BookOpen, ListTree, Play, Stars } from 'lucide-react';

// Configure marked
marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

function renderMarkdownToHtml(text: string): string {
  return marked.parse(text) as string;
}

const quickActions = [
  { label: '续写', icon: Pencil, prompt: '请根据以上内容，续写下一段剧情' },
  { label: '润色', icon: Wand2, prompt: '请帮我润色以下文字，使其更加流畅优美' },
  { label: '大纲', icon: FileText, prompt: '请帮我生成一个详细的章节大纲' },
  { label: '灵感', icon: Lightbulb, prompt: '请给我一些剧情发展的灵感建议' },
  { label: '扩写', icon: Zap, prompt: '请帮我扩写以下内容，增加细节描写' },
];

const aidoIconMap: Record<string, React.ReactNode> = {
  EDIT: <BookOpen size={12} />,
  OUTLINE: <ListTree size={12} />,
  WORLDBUILD: <Globe size={12} />,
  STARCHART: <Stars size={12} />,
  PLACEHOLDER: <Bot size={12} />,
};

interface SelectableItem {
  id: string;
  label: string;
  description: string;
  type: string;
}

export default function AIAssistant() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { messages, isStreaming, addMessage, setStreaming, clearMessages, updateLastAssistant } = useChatStore();
  const {
    characters, worldbuilding, chapters,
    fetchCharacters, fetchWorldbuilding, fetchChapters,
    createChapter, createOutline, createWorldbuilding,
  } = useProjectStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // AIdo is always on
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Context selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['characters', 'worldbuilding', 'chapters']));

  // Star chart data for context
  const [starChartData, setStarChartData] = useState<{ nodes: any[]; edges: any[] } | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchCharacters(projectId);
      fetchWorldbuilding(projectId);
      fetchChapters(projectId);
      // Load star chart data for context
      fetch('/api/projects/' + projectId + '/starchart')
        .then(r => r.json())
        .then(d => {
          if (d.code === 0 && d.data) {
            setStarChartData(d.data);
          }
        })
        .catch(() => {});
    }
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build all selectable items including star chart
  const allItems: { group: string; groupLabel: string; items: SelectableItem[] }[] = [
    {
      group: 'characters',
      groupLabel: '角色',
      items: characters.map(c => ({ id: `char-${c.id}`, label: c.name, description: c.role || '', type: '角色' })),
    },
    {
      group: 'worldbuilding',
      groupLabel: '世界观',
      items: worldbuilding.map(w => ({ id: `wb-${w.id}`, label: w.title, description: w.category || '', type: '世界观' })),
    },
    {
      group: 'chapters',
      groupLabel: '章节',
      items: chapters.map(c => ({ id: `ch-${c.id}`, label: c.title, description: `${c.wordCount || 0}字`, type: '章节' })),
    },
    {
      group: 'starchart',
      groupLabel: '星图',
      items: starChartData ? [
        ...(starChartData.nodes || []).map((n: any) => ({
          id: `star-${n.id}`,
          label: n.name,
          description: n.entityType === 'character' ? '角色节点' : n.entityType === 'worldbuilding' ? '世界观节点' : '自定义节点',
          type: '星图节点',
        })),
        ...(starChartData.edges || []).map((e: any, i: number) => {
          const src = starChartData.nodes?.find((n: any) => n.id === e.sourceNodeId);
          const tgt = starChartData.nodes?.find((n: any) => n.id === e.targetNodeId);
          return {
            id: `star-edge-${e.id || i}`,
            label: `${src?.name || '?'} → ${tgt?.name || '?'}`,
            description: `${e.relationType}: ${e.label || ''}`,
            type: '星图连线',
          };
        }),
      ] : [],
    },
  ];

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleGroup = (group: string, items: SelectableItem[]) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      const allSelected = items.every(i => next.has(i.id));
      if (allSelected) {
        items.forEach(i => next.delete(i.id));
      } else {
        items.forEach(i => next.add(i.id));
      }
      return next;
    });
  };

  const toggleExpand = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const buildContextPrompt = (): string => {
    const parts: string[] = [];
    for (const group of allItems) {
      const selected = group.items.filter(i => selectedItems.has(i.id));
      if (selected.length === 0) continue;
      parts.push(`\n【${group.groupLabel}】`);
      for (const item of selected) {
        parts.push(`- ${item.label}${item.description ? ` (${item.description})` : ''}`);
      }
      // For star chart, also include edge relationships
      if (group.group === 'starchart' && starChartData) {
        const selectedStarIds = new Set(selected.map(s => s.id.replace('star-', '')));
        const relevantEdges = (starChartData.edges || []).filter((e: any) => {
          const srcId = String(starChartData.nodes?.find((n: any) => n.id === e.sourceNodeId)?.id);
          const tgtId = String(starChartData.nodes?.find((n: any) => n.id === e.targetNodeId)?.id);
          return selectedStarIds.has(srcId) || selectedStarIds.has(tgtId);
        });
        if (relevantEdges.length > 0) {
          parts.push('  星图连线关系：');
          for (const e of relevantEdges) {
            const src = starChartData.nodes?.find((n: any) => n.id === e.sourceNodeId);
            const tgt = starChartData.nodes?.find((n: any) => n.id === e.targetNodeId);
            if (src && tgt) {
              parts.push(`  · ${src.name} → ${tgt.name}：${e.relationType}${e.label ? ` (${e.label})` : ''}`);
            }
          }
        }
      }
    }
    return parts.length > 0 ? `\n\n当前创作上下文：${parts.join('\n')}` : '';
  };

  // Execute an AIdo action
  const executeAIdoAction = async (action: AIdoAction) => {
    setExecutingAction(`${action.type}-${action.title}`);
    try {
      if (action.type === 'EDIT') {
        // Convert markdown to HTML for Tiptap editor
        const htmlContent = renderMarkdownToHtml(action.content || '');
        await createChapter(projectId, { title: action.title, content: htmlContent, orderNum: chapters.length });
        await fetchChapters(projectId);
      } else if (action.type === 'OUTLINE') {
        await createOutline(projectId, { title: action.title, description: action.content });
      } else if (action.type === 'WORLDBUILD') {
        await createWorldbuilding(projectId, { title: action.title, content: action.content, category: '通用' });
        await fetchWorldbuilding(projectId);
      } else if (action.type === 'STARCHART') {
        if (action.action === 'add' && action.title) {
          await fetch('/api/projects/' + projectId + '/starchart/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entityType: 'custom',
              name: action.title,
              description: action.content,
              x: Math.random() * 200 - 100,
              y: Math.random() * 200 - 100,
            }),
          });
        } else if (action.action === 'connect' && action.title) {
          // action.title = "nodeA->nodeB", action.content = relationType|label
          const [aName, bName] = action.title.split('->').map(s => s.trim());
          const relationParts = (action.content || 'other|').split('|');
          const relationType = relationParts[0] || 'other';
          const label = relationParts[1] || '';
          // Find node dbIds by name in star chart data
          if (starChartData && aName && bName) {
            const nodeA = starChartData.nodes?.find((n: any) => n.name === aName);
            const nodeB = starChartData.nodes?.find((n: any) => n.name === bName);
            if (nodeA && nodeB) {
              await fetch('/api/projects/' + projectId + '/starchart/edges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sourceNodeId: nodeA.id,
                  targetNodeId: nodeB.id,
                  relationType,
                  label,
                  description: '',
                }),
              });
            }
          }
        }
      } else if (action.type === 'PLACEHOLDER') {
        // Placeholder: send a follow-up request to AI to actually execute
        executePlaceholder(action);
        return; // Don't clear executingAction yet
      }
    } catch (e) {
      console.error('AIdo action failed:', e);
    }
    setExecutingAction(null);
  };

  // Execute a placeholder (deferred task)
  const executePlaceholder = async (action: AIdoAction) => {
    const contextPrompt = buildContextPrompt();
    const prompt = `请执行以下任务：${action.title}\n\n${action.content ? '任务描述：' + action.content : ''}`;
    const fullContent = contextPrompt ? `${prompt}\n\n[上下文]\n${contextPrompt}` : prompt;

    const userMsg: ChatMessage = { role: 'user', content: `[执行任务] ${action.title}` };
    addMessage(userMsg);
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    addMessage(assistantMsg);

    await streamChatCompletion({
      projectId,
      messages: [...messages, { role: 'user', content: fullContent }],
      context: { selectedCount: selectedItems.size },
      onDelta: (fullText) => updateLastAssistant(fullText),
      onError: (err) => updateLastAssistant(err),
    });
    setStreaming(false);
    setExecutingAction(null);
  };

  const handleSend = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isStreaming) return;

    const contextPrompt = buildContextPrompt();
    const extraContext = contextPrompt ? `\n\n当前创作上下文：${contextPrompt}` : '';
    const fullContent = buildAIdoSystemPrompt(`${content}${extraContext}`);

    const userMsg: ChatMessage = { role: 'user', content };
    addMessage(userMsg);
    setInput('');
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    addMessage(assistantMsg);

    await streamChatCompletion({
      projectId,
      messages: [...messages, { role: 'user', content: fullContent }],
      context: { selectedCount: selectedItems.size },
      onDelta: (fullText) => updateLastAssistant(fullText),
      onError: (err) => updateLastAssistant(err),
    });

    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render message content with markdown and AIdo actions
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

    // Parse AIdo instructions
    const aidoActions = parseAIdoInstructions(msg.content);
    const cleanContent = stripAIdoInstructions(msg.content);

    return (
      <div className="space-y-3">
        {/* Render markdown */}
        <div
          className="text-sm leading-relaxed prose-aido prose-strong:text-[#f5f0e8] prose-code:text-[#c9a96e] prose-code:bg-[#c9a96e]/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(cleanContent) }}
        />

        {/* AIdo action buttons */}
        {aidoActions.length > 0 && (
          <div className="border-t border-[#c9a96e]/10 pt-2 space-y-1.5">
            <p className="text-[10px] text-[#c9a96e]/40 uppercase tracking-wider">AIdo 指令</p>
            {aidoActions.map((action, i) => {
              const isExecuting = executingAction === `${action.type}-${action.title}`;
              const meta = AIDO_TYPE_META[action.type] || { label: action.type, color: 'bg-[#c9a96e]/5' };
              const colorMap: Record<string, string> = {
                EDIT: 'bg-[#c9a96e]/5',
                OUTLINE: 'bg-[#7dc9a9]/5',
                WORLDBUILD: 'bg-[#7da8c9]/5',
                STARCHART: 'bg-[#e8a8c9]/5',
                PLACEHOLDER: 'bg-orange-900/15 border border-orange-400/15',
              };
              return (
                <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${colorMap[action.type] || 'bg-[#c9a96e]/5'}`}>
                  <span className="text-[#c9a96e]/70">{aidoIconMap[action.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#f5f0e8]/70 truncate">
                      <span className="text-[#c9a96e]/40">{meta.label}</span> — {action.title}
                    </p>
                    {action.content && (
                      <p className="text-[10px] text-[#f5f0e8]/30 truncate">{action.content.slice(0, 60)}</p>
                    )}
                  </div>
                  <button
                    onClick={() => executeAIdoAction(action)}
                    disabled={isExecuting}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors disabled:opacity-50 ${
                      action.type === 'PLACEHOLDER'
                    ? 'bg-orange-900/30 text-orange-400 hover:bg-orange-900/50'
                    : 'bg-[#c9a96e]/20 text-[#c9a96e] hover:bg-[#c9a96e]/30'
                }`}
              >
                {isExecuting ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                {action.type === 'PLACEHOLDER' ? '执行任务' : '执行'}
                  </button>
                </div>
              );
            })}
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
            {selectedItems.size > 0 && (
              <span className="text-xs text-[#c9a96e]/60 bg-[#c9a96e]/10 px-2 py-0.5 rounded-full">
                已选 {selectedItems.size} 项上下文
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearMessages}>
              <Trash2 size={14} />
              清空对话
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles size={48} className="text-[#c9a96e]/20 mb-4" />
              <h2 className="text-lg font-semibold text-[#f5f0e8]/60 mb-2">AI 写作助手</h2>
              <p className="text-sm text-[#f5f0e8]/30 max-w-md mb-6">
                我可以帮你续写剧情、润色文字、生成大纲、激发灵感等。在右侧面板选择要提交的上下文信息。AI 可以直接操作你的创作内容，回复中会包含可执行指令，用于创建正文、大纲、世界观条目或星图节点。
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
      </div>

      {/* Context Selection Panel */}
      <div className="w-72 bg-[#1a1a2e]/95 border-l border-[#c9a96e]/10 overflow-y-auto flex-shrink-0">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#f5f0e8]">选择上下文</h3>
            <button
              onClick={() => setSelectedItems(new Set())}
              className="text-xs text-[#f5f0e8]/30 hover:text-[#f5f0e8]/60"
            >
              清空
            </button>
          </div>
          <p className="text-xs text-[#f5f0e8]/30 mb-4">
            勾选要提交给AI的上下文信息，未勾选的不会被发送。
          </p>
        </div>

        <div className="space-y-1 px-2">
          {allItems.map(group => {
            const groupSelected = group.items.filter(i => selectedItems.has(i.id)).length;
            if (group.items.length === 0) return null;
            return (
              <div key={group.group} className="mb-1">
                <button
                  onClick={() => toggleExpand(group.group)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#f5f0e8]/5 transition-colors"
                >
                  {expandedGroups.has(group.group) ? (
                    <ChevronDown size={14} className="text-[#f5f0e8]/30" />
                  ) : (
                    <ChevronRight size={14} className="text-[#f5f0e8]/30" />
                  )}
                  <span className="text-xs text-[#f5f0e8]/50 flex-1 text-left">
                    {group.groupLabel}
                  </span>
                  <span className="text-[10px] text-[#f5f0e8]/25">
                    {groupSelected}/{group.items.length}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleGroup(group.group, group.items); }}
                    className="p-0.5 rounded hover:bg-[#f5f0e8]/10"
                  >
                    {groupSelected === group.items.length && group.items.length > 0 ? (
                      <CheckSquare size={14} className="text-[#c9a96e]/60" />
                    ) : (
                      <Square size={14} className="text-[#f5f0e8]/20" />
                    )}
                  </button>
                </button>

                {expandedGroups.has(group.group) && (
                  <div className="ml-5 space-y-0.5 mb-1">
                    {group.items.slice(0, 20).map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#f5f0e8]/5 transition-colors"
                      >
                        {selectedItems.has(item.id) ? (
                          <CheckSquare size={13} className="text-[#c9a96e] flex-shrink-0" />
                        ) : (
                          <Square size={13} className="text-[#f5f0e8]/15 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-xs text-[#f5f0e8]/60 block truncate">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="text-[10px] text-[#f5f0e8]/25 block truncate">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                    {group.items.length > 20 && (
                      <p className="text-[10px] text-[#f5f0e8]/20 px-2 py-1">
                        还有 {group.items.length - 20} 项...
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}