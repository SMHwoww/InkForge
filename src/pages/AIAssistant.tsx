import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChatStore } from '@/stores/chatStore';
import { useProjectStore } from '@/stores/projectStore';
import { api } from '@/api/client';
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
import { Send, Sparkles, Lightbulb, FileText, Pencil, Wand2, Zap, Trash2, Loader2, CheckSquare, Square, ChevronDown, ChevronRight, Bot, Globe, BookOpen, ListTree, Play, Stars, Timer, Copy, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';

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
  TIMELINE: <Timer size={12} />,
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
  const { messages, isStreaming, addMessage, setStreaming, clearMessages, updateLastAssistant, removeMessage } = useChatStore();
  const {
    characters, worldbuilding, chapters,
    timelineEvents, outlines,
    fetchCharacters, fetchWorldbuilding, fetchChapters,
    fetchTimeline, fetchOutlines,
    createChapter, createOutline, createWorldbuilding, createTimelineEvent,
  } = useProjectStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // AIdo is always on
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Star chart: pending connect action when target node doesn't exist
  const [pendingConnect, setPendingConnect] = useState<{
    nodeName: string;
    nodeType: 'source' | 'target';
    action: any;
    projectId: number;
  } | null>(null);
  const [creatingNodeName, setCreatingNodeName] = useState('');
  const [creatingNodeDesc, setCreatingNodeDesc] = useState('');
  const [creatingNodeLoading, setCreatingNodeLoading] = useState(false);

  // Context selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['characters', 'worldbuilding', 'chapters']));
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const contextPanelRef = useRef<HTMLDivElement>(null);

  // Star chart data for context
  const [starChartData, setStarChartData] = useState<{ nodes: any[]; edges: any[] } | null>(null);

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

  // Context panel edge detection: show when mouse is near the right screen edge
  useEffect(() => {
    const EDGE_THRESHOLD = 30; // px from right edge
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX >= window.innerWidth - EDGE_THRESHOLD) {
        setContextPanelOpen(true);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto-hide context panel when mouse leaves it
  const handleContextPanelLeave = () => {
    setContextPanelOpen(false);
  };

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
    {
      group: 'timeline',
      groupLabel: '时间轴',
      items: timelineEvents.map(e => ({ id: `tl-${e.id}`, label: e.title, description: e.category || '', type: '时间轴事件' })),
    },
    {
      group: 'outlines',
      groupLabel: '大纲',
      items: outlines.map(o => ({ id: `ol-${o.id}`, label: o.title, description: `层级: ${o.level}`, type: '大纲条目' })),
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
          if (aName && bName) {
            const nodeA = starChartData?.nodes?.find((n: any) => n.name === aName);
            const nodeB = starChartData?.nodes?.find((n: any) => n.name === bName);

            if (!nodeA || !nodeB) {
              // Show prompt to create missing node
              const missingName = !nodeA ? aName : bName;
              const missingType: 'source' | 'target' = !nodeA ? 'source' : 'target';
              setPendingConnect({
                nodeName: missingName,
                nodeType: missingType,
                action,
                projectId,
              });
              setCreatingNodeName(missingName);
              setCreatingNodeDesc('');
              setExecutingAction(null);
              return;
            }

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
      } else if (action.type === 'TIMELINE') {
        await createTimelineEvent(projectId, { title: action.title, content: action.content, category: '重大事件', placed: 0 });
        await fetchTimeline(projectId);
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

  // Create missing node and complete the pending connection
  const handleCreateMissingNode = async () => {
    if (!pendingConnect || !creatingNodeName.trim()) return;
    setCreatingNodeLoading(true);
    try {
      // Create the node
      const res = await fetch('/api/projects/' + pendingConnect.projectId + '/starchart/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'custom',
          name: creatingNodeName.trim(),
          description: creatingNodeDesc.trim(),
          x: Math.random() * 200 - 100,
          y: Math.random() * 200 - 100,
        }),
      });
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.message || '创建节点失败');

      // Refresh star chart data
      const starRes = await fetch('/api/projects/' + pendingConnect.projectId + '/starchart');
      const starJson = await starRes.json();
      if (starJson.code === 0 && starJson.data) {
        setStarChartData(starJson.data);

        // Now execute the connect action again with fresh data
        const action = pendingConnect.action;
        const [aName, bName] = action.title.split('->').map((s: string) => s.trim());
        const relationParts = (action.content || 'other|').split('|');
        const relationType = relationParts[0] || 'other';
        const label = relationParts[1] || '';

        const nodeA = starJson.data.nodes?.find((n: any) => n.name === aName);
        const nodeB = starJson.data.nodes?.find((n: any) => n.name === bName);

        if (nodeA && nodeB) {
          await fetch('/api/projects/' + pendingConnect.projectId + '/starchart/edges', {
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
    } catch (e: any) {
      console.error('Create missing node failed:', e);
    }
    setPendingConnect(null);
    setCreatingNodeLoading(false);
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
                TIMELINE: 'bg-[#d4a87d]/5',
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
            {activeTab === 'chat' && selectedItems.size > 0 && (
              <span className="text-xs text-[#c9a96e]/60 bg-[#c9a96e]/10 px-2 py-0.5 rounded-full">
                已选 {selectedItems.size} 项上下文
              </span>
            )}
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
                    {msg.role === 'assistant' && msg.content && !isStreaming && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#c9a96e]/10">
                        <button
                          onClick={() => handleCopy(stripAIdoInstructions(msg.content))}
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
        <div className="flex-1 overflow-y-auto px-6 py-4">
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

      {/* Context Selection Panel — slides in from right edge, hides on leave */}
      {activeTab === 'chat' && (
        <div
          ref={contextPanelRef}
          onMouseLeave={handleContextPanelLeave}
          className={clsx(
            'bg-[#1a1a2e]/95 border-l border-[#c9a96e]/10 overflow-y-auto overflow-x-hidden shrink-0 transition-all duration-300 ease-in-out',
            contextPanelOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-l-0',
          )}
        >
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
      )}

      {/* Modal: Create missing star chart node for connection */}
      {pendingConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#c9a96e]/20 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#f5f0e8] mb-2">
              <Stars size={18} className="inline mr-2 text-[#c9a96e]" />
              目标星辰不存在
            </h3>
            <p className="text-sm text-[#f5f0e8]/50 mb-4">
              星图连线需要指向「<span className="text-[#c9a96e]">{pendingConnect.nodeName}</span>」，但该星辰尚未创建。是否创建此星辰并完成连线？
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-[#f5f0e8]/50 mb-1 block">星辰名称</label>
                <input
                  value={creatingNodeName}
                  onChange={e => setCreatingNodeName(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60"
                  placeholder="输入星辰名称..."
                />
              </div>
              <div>
                <label className="text-xs text-[#f5f0e8]/50 mb-1 block">描述（可选）</label>
                <textarea
                  value={creatingNodeDesc}
                  onChange={e => setCreatingNodeDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none"
                  placeholder="简要描述..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setPendingConnect(null); setCreatingNodeName(''); setCreatingNodeDesc(''); }}
                className="px-4 py-2 rounded-lg text-sm text-[#f5f0e8]/50 hover:text-[#f5f0e8] hover:bg-[#f5f0e8]/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateMissingNode}
                disabled={!creatingNodeName.trim() || creatingNodeLoading}
                className="px-4 py-2 rounded-lg bg-[#c9a96e]/20 border border-[#c9a96e]/30 text-sm text-[#c9a96e] hover:bg-[#c9a96e]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creatingNodeLoading ? (
                  <><Loader2 size={14} className="animate-spin" /> 创建中...</>
                ) : (
                  <>创建星辰并连线</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}