import { useEffect, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import { type SuggestionProps } from '@tiptap/suggestion';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Plus, Trash2, FileText, Save, Clock, Edit3, ChevronRight,
  User, Eye, ExternalLink,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';

interface ReferenceItem {
  id: string;
  label: string;
  type: string;
  description: string;
}

const iconMap: Record<string, React.ReactNode> = {
  character: <User size={14} />,
};

// Tooltip component for mention hover
function MentionTooltip({ item, onNavigate }: { item: ReferenceItem; onNavigate: (item: ReferenceItem) => void }) {
  return (
    <div
      className="bg-[#1a1a2e] border rounded-lg shadow-xl p-3 min-w-[200px] max-w-[300px] pointer-events-auto"
      style={{ borderColor: '#c9a96e40' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#c9a96e20', color: '#c9a96e' }}
        >
          {iconMap[item.type]}
        </span>
        <span className="text-sm font-semibold text-[#f5f0e8]">{item.label}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto"
          style={{ background: '#c9a96e15', color: '#c9a96e' }}
        >
          角色
        </span>
      </div>
      {item.description && (
        <p className="text-xs text-[#f5f0e8]/50 leading-relaxed mb-2">{item.description}</p>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onNavigate(item); }}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors w-full justify-center"
        style={{ background: '#c9a96e15', color: '#c9a96e' }}
      >
        <ExternalLink size={11} />
        跳转到角色
      </button>
    </div>
  );
}

function MentionList(props: SuggestionProps<ReferenceItem>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { items, command } = props;

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.id, label: item.label, type: item.type, description: item.description });
      }
    },
    [command, items],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="bg-[#1a1a2e] border border-[#c9a96e]/20 rounded-lg shadow-xl p-2 min-w-[200px]">
        <p className="text-xs text-[#f5f0e8]/40 px-3 py-2">没有找到可引用的条目</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] border border-[#c9a96e]/20 rounded-lg shadow-xl p-1 min-w-[240px] max-h-[300px] overflow-y-auto mention-suggestion-list" data-selected={selectedIndex}>
      {items.map((item, index) => {
        const color = '#c9a96e';
        return (
          <button
            key={item.id}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors text-sm ${
              index === selectedIndex
                ? 'bg-[#c9a96e]/15'
                : 'hover:bg-[#f5f0e8]/5'
            }`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}20`, color }}
            >
              {iconMap[item.type]}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[#f5f0e8] block truncate">{item.label}</span>
              {item.description && (
                <span className="text-[#f5f0e8]/30 text-xs block truncate">{item.description}</span>
              )}
            </div>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${color}15`, color }}
            >
              角色
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function ChapterEditor() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const {
    chapters, characters,
    fetchChapters, createChapter, updateChapter, deleteChapter,
    fetchCharacters,
  } = useProjectStore();
  const addToast = useToastStore(s => s.addToast);

  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const selectedChapterIdRef = useRef<number | null>(null);
  const projectIdRef = useRef<number>(projectId);
  const updateChapterRef = useRef(updateChapter);
  const referenceItemsRef = useRef<ReferenceItem[]>([]);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<{ root: any; el: HTMLElement } | null>(null);

  // Keep refs updated
  useEffect(() => { selectedChapterIdRef.current = selectedChapterId; }, [selectedChapterId]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { updateChapterRef.current = updateChapter; }, [updateChapter]);

  useEffect(() => {
    if (projectId) {
      fetchChapters(projectId);
      fetchCharacters(projectId);
    }
  }, [projectId]);

  // Build reference items from characters
  useEffect(() => {
    referenceItemsRef.current = [
      ...characters.map(c => ({
        id: `char-${c.id}`,
        label: c.name,
        type: 'character',
        description: c.role || '',
      })),
    ];
  }, [characters]);

  // Navigate to the source of a reference
  const navigateToReference = useCallback((item: ReferenceItem) => {
    if (item.id.startsWith('char-')) {
      const charId = item.id.replace('char-', '');
      navigate(`/projects/${projectId}/characters/${charId}`);
    }
  }, [navigate, projectId]);

  // Show tooltip on mention hover
  const showTooltip = useCallback((el: HTMLElement, item: ReferenceItem) => {
    hideTooltip();
    tooltipRef.current?.root?.unmount();
    tooltipRef.current?.el?.remove();

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'mention-tooltip-container';
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.zIndex = '99999';
    tooltipEl.style.pointerEvents = 'auto';
    document.body.appendChild(tooltipEl);

    const root = createRoot(tooltipEl);
    tooltipRef.current = { root, el: tooltipEl };

    root.render(<MentionTooltip item={item} onNavigate={navigateToReference} />);

    // Position after render
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = rect.left;
      if (left + tooltipRect.width > window.innerWidth - 16) {
        left = window.innerWidth - tooltipRect.width - 16;
      }
      if (left < 16) left = 16;
      if (top + tooltipRect.height > window.innerHeight - 16) {
        top = rect.top - tooltipRect.height - 8;
      }
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
    });
  }, [navigateToReference]);

  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.root.unmount();
      tooltipRef.current.el.remove();
      tooltipRef.current = null;
    }
  }, []);

  // Handle mention hover/click interactions
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const mentionEl = target.closest('.reference-mention') as HTMLElement;
      if (!mentionEl) { hideTooltip(); return; }

      const mentionId = mentionEl.getAttribute('data-id');
      const mentionLabel = mentionEl.getAttribute('data-label');
      const mentionType = mentionEl.getAttribute('data-type') || 'character';
      const mentionDesc = mentionEl.getAttribute('data-description') || '';

      if (mentionId && mentionLabel && mentionType) {
        showTooltip(mentionEl, { id: mentionId, label: mentionLabel, type: mentionType, description: mentionDesc });
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const mentionEl = target.closest('.reference-mention') as HTMLElement;
      if (!mentionEl) return;

      const mentionId = mentionEl.getAttribute('data-id');
      const mentionLabel = mentionEl.getAttribute('data-label');
      const mentionType = mentionEl.getAttribute('data-type') || 'character';
      const mentionDesc = mentionEl.getAttribute('data-description') || '';

      if (mentionId && mentionLabel && mentionType) {
        hideTooltip();
        navigateToReference({ id: mentionId, label: mentionLabel, type: mentionType, description: mentionDesc });
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('click', handleClick);
      hideTooltip();
    };
  }, [showTooltip, hideTooltip, navigateToReference, characters]);

  const selectedChapter = chapters.find(c => c.id === selectedChapterId) || null;

  // Auto-save function using refs
  const handleAutoSave = useCallback(async (content: string) => {
    const cid = selectedChapterIdRef.current;
    const pid = projectIdRef.current;
    if (!cid || !pid) return;
    setSaving(true);
    try {
      await updateChapterRef.current(pid, cid, { content });
      setLastSaved(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
    setSaving(false);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: '开始书写你的故事... 输入 @ 可以引用角色、地点、事件等概念',
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'reference-mention',
        },
        renderHTML({ options, node }) {
          return [
            'span',
            {
              class: 'reference-mention',
              'data-type': node.attrs.type || 'character',
              'data-id': node.attrs.id,
              'data-label': node.attrs.label,
              'data-description': node.attrs.description || '',
            },
            `@${node.attrs.label ?? node.attrs.id}`,
          ];
        },
        renderLabel({ options, node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: {
          char: '@',
          items: ({ query }) => {
            const items = referenceItemsRef.current;
            if (!query || query.length < 1) return items.slice(0, 20);
            const q = query.toLowerCase();
            return items
              .filter(item =>
                item.label.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q) ||
                item.type.toLowerCase().includes(q),
              )
              .slice(0, 20);
          },
          render: () => {
            let component: { update: (props: SuggestionProps<ReferenceItem>) => void; destroy: () => void } | null = null;
            let popup: HTMLElement | null = null;
            let selectedIndex = 0;
            let itemsLength = 0;

            const selectItem = (index: number) => {
              const btn = popup?.querySelectorAll('button')[index] as HTMLElement | undefined;
              if (btn) btn.click();
            };

            const updateSelection = (delta: number) => {
              selectedIndex = (selectedIndex + delta + itemsLength) % itemsLength;
              // Update DOM directly to highlight the selected item
              if (popup) {
                const buttons = popup.querySelectorAll('button');
                buttons.forEach((b, i) => {
                  if (i === selectedIndex) {
                    b.classList.add('bg-[#c9a96e]/15');
                    b.classList.remove('hover:bg-[#f5f0e8]/5');
                  } else {
                    b.classList.remove('bg-[#c9a96e]/15');
                    b.classList.add('hover:bg-[#f5f0e8]/5');
                  }
                });
                // Scroll into view
                buttons[selectedIndex]?.scrollIntoView({ block: 'nearest' });
              }
            };

            return {
              onStart: (props: SuggestionProps<ReferenceItem>) => {
                popup = document.createElement('div');
                popup.className = 'mention-popup-container';
                document.body.appendChild(popup);
                selectedIndex = 0;
                itemsLength = props.items.length;

                const root = createRoot(popup);
                component = {
                  update: (p: SuggestionProps<ReferenceItem>) => {
                    itemsLength = p.items.length;
                    if (selectedIndex >= itemsLength) selectedIndex = Math.max(0, itemsLength - 1);
                    root.render(<MentionList {...p} />);
                  },
                  destroy: () => {
                    root.unmount();
                    popup?.remove();
                  },
                };
                component.update(props);
              },
              onUpdate: (props: SuggestionProps<ReferenceItem>) => {
                component?.update(props);
              },
              onKeyDown: (props: { event: KeyboardEvent }) => {
                const { event } = props;
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  updateSelection(-1);
                  return true;
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  updateSelection(1);
                  return true;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  selectItem(selectedIndex);
                  return true;
                }
                if (event.key === 'Escape') {
                  component?.destroy();
                  return true;
                }
                return false;
              },
              onExit: () => {
                component?.destroy();
              },
            } as any;
          },
        },
      }),
    ],
    content: selectedChapter?.content || '',
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-6 text-[#f5f0e8] leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        handleAutoSave(editor.getHTML());
      }, 2000);
    },
  });

  // Update editor content when selected chapter changes
  useEffect(() => {
    if (editor && selectedChapter) {
      editor.commands.setContent(selectedChapter.content || '');
    }
  }, [selectedChapterId]);

  const handleManualSave = async () => {
    if (!editor || !selectedChapterId || !projectId) return;
    setSaving(true);
    try {
      await updateChapter(projectId, selectedChapterId, { content: editor.getHTML() });
      setLastSaved(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(false);
  };

  const handleCreateChapter = async () => {
    if (!newTitle.trim()) return;
    try {
      const chapter = await createChapter(projectId, { title: newTitle.trim(), orderNum: chapters.length });
      setShowCreate(false);
      setNewTitle('');
      setSelectedChapterId(chapter.id);
      addToast('章节创建成功');
    } catch (e: any) {
      addToast(e.message || '创建章节失败', 'error');
    }
  };

  const handleDeleteChapter = async (chapterId: number) => {
    if (!confirm('确定要删除这个章节吗？')) return;
    await deleteChapter(projectId, chapterId);
    addToast('章节已删除');
    if (selectedChapterId === chapterId) {
      setSelectedChapterId(null);
    }
  };

  const handleSelectChapter = (chapterId: number) => {
    if (editor && selectedChapterId) {
      updateChapter(projectId, selectedChapterId, { content: editor.getHTML() });
    }
    setSelectedChapterId(chapterId);
    setIsPreview(false);
  };

  const wordCount = (text: string) => {
    return text.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
  };

  const currentHTML = editor?.getHTML() || '';

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#c9a96e]/10 bg-[#1a1a2e]/90">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[#cad9e8]">正文编辑器</h1>
          {selectedChapter && (
            <span className="text-sm text-[#f5f0e8]/40 flex items-center gap-1">
              <Edit3 size={14} />
              {selectedChapter.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-xs text-[#c9a96e]/60 flex items-center gap-1">
              <Clock size={12} className="animate-pulse" />保存中...
            </span>
          )}
          {lastSaved && !saving && (
            <span className="text-xs text-[#f5f0e8]/30">
              已保存 {lastSaved}
            </span>
          )}
          {selectedChapter && (
            <>
              <span className="text-xs text-[#f5f0e8]/30 px-2 py-0.5 rounded bg-[#f5f0e8]/5">
                {wordCount(currentHTML)} 字
              </span>
              <Button
                variant={isPreview ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
                title={isPreview ? '切换到编辑模式' : '切换到预览模式'}
              >
                {isPreview ? <Edit3 size={14} /> : <Eye size={14} />}
                {isPreview ? '编辑' : '预览'}
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={handleManualSave} disabled={saving || !selectedChapter}>
            <Save size={14} />保存
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />新建章节
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Chapter List Sidebar */}
        <div className="w-64 border-r border-[#c9a96e]/10 bg-[#1a1a2e]/50 overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-[#c9a96e]/8">
            <p className="text-xs text-[#f5f0e8]/30 uppercase tracking-wider">章节列表</p>
          </div>
          {chapters.length === 0 ? (
            <div className="p-6 text-center">
              <FileText size={32} className="text-[#f5f0e8]/15 mx-auto mb-3" />
              <p className="text-sm text-[#f5f0e8]/30">暂无章节</p>
              <p className="text-xs text-[#f5f0e8]/20 mt-1">点击右上角新建章节</p>
            </div>
          ) : (
            <div className="py-1">
              {chapters.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${
                    selectedChapterId === chapter.id
                      ? 'bg-[#c9a96e]/15 text-[#c9a96e]'
                      : 'text-[#f5f0e8]/60 hover:bg-[#f5f0e8]/5 hover:text-[#f5f0e8]'
                  }`}
                  onClick={() => handleSelectChapter(chapter.id)}
                >
                  <ChevronRight
                    size={14}
                    className={`flex-shrink-0 transition-transform ${
                      selectedChapterId === chapter.id ? 'text-[#c9a96e]' : 'text-[#f5f0e8]/20'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {index + 1}. {chapter.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#f5f0e8]/25">
                        {chapter.wordCount || 0}字
                      </span>
                      {chapter.status === 'completed' && (
                        <span className="text-[10px] px-1 rounded bg-green-900/30 text-green-400/70">已完</span>
                      )}
                      {chapter.status === 'writing' && (
                        <span className="text-[10px] px-1 rounded bg-blue-900/30 text-blue-400/70">写作中</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chapter.id); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-[#f5f0e8]/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor / Preview Area */}
        <div className="flex-1 overflow-y-auto bg-[#0f0f1a]" ref={editorContainerRef}>
          {selectedChapter ? (
            isPreview ? (
              /* Preview Mode */
              <div className="max-w-3xl mx-auto">
                <div
                  className="tiptap prose prose-invert max-w-none min-h-[400px] px-8 py-6 text-[#f5f0e8] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: currentHTML }}
                />
              </div>
            ) : (
              /* Edit Mode */
              <div className="max-w-3xl mx-auto">
                <EditorContent editor={editor} />
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Edit3 size={48} className="text-[#f5f0e8]/10 mx-auto mb-4" />
                <p className="text-[#f5f0e8]/30 text-lg">选择一个章节开始编辑</p>
                <p className="text-[#f5f0e8]/15 text-sm mt-2">
                  或点击右上角新建章节
                </p>
                <div className="mt-6 p-4 bg-[#1a1a2e]/50 rounded-xl border border-[#c9a96e]/8 max-w-md mx-auto">
                  <p className="text-xs text-[#f5f0e8]/40 mb-2">编辑器功能</p>
                  <ul className="text-xs text-[#f5f0e8]/30 space-y-1.5 text-left">
                    <li>- 输入 <code className="text-[#c9a96e]/60 bg-[#c9a96e]/5 px-1 rounded">@</code> 快速引用角色、地点、事件等</li>
                    <li>- 悬浮在引用上查看详情，点击可跳转到源页面</li>
                    <li>- 支持编辑/预览模式切换</li>
                    <li>- 支持 Markdown 快捷语法（# 标题, **粗体** 等）</li>
                    <li>- 自动保存，无需手动操作</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Chapter Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="新建章节">
        <div className="space-y-4">
          <Input
            label="章节标题"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="如：第一章 觉醒"
            onKeyDown={e => { if (e.key === 'Enter') handleCreateChapter(); }}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreateChapter} disabled={!newTitle.trim()}>创建章节</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}