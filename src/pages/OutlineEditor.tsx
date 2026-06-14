import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { useToastStore } from '@/stores/toastStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import AIPanel from '@/components/ai/AIPanel';
import type { OutlineItem } from '@/types';
import {
  Plus, Trash2, ChevronDown, ChevronRight, GripVertical,
  ListTree, Edit3, CheckCircle, Circle, Clock, Save,
  ArrowUp, ArrowDown, ArrowRight, MoveHorizontal, Sparkles,
} from 'lucide-react';

export default function OutlineEditor() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const {
    outlines, chapters,
    fetchOutlines, createOutline, updateOutline, deleteOutline,
    fetchChapters,
  } = useProjectStore();
  const addToast = useToastStore(s => s.addToast);

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', description: '', parentId: null as number | null, level: 0 });
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchOutlines(projectId);
      fetchChapters(projectId);
    }
  }, [projectId]);

  // Auto-expand all items when loaded
  useEffect(() => {
    const expandAll = (items: OutlineItem[]) => {
      const ids = new Set<number>();
      const walk = (list: OutlineItem[]) => {
        for (const item of list) {
          ids.add(item.id);
          if (item.children?.length) walk(item.children);
        }
      };
      walk(items);
      setExpandedItems(ids);
    };
    if (outlines.length > 0) expandAll(outlines);
  }, [outlines]);

  const toggleExpand = (id: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newForm.title.trim()) return;
    setSaving(true);
    try {
      await createOutline(projectId, {
        title: newForm.title.trim(),
        description: newForm.description.trim(),
        parentId: newForm.parentId,
        level: newForm.level,
      });
      setShowCreate(false);
      setNewForm({ title: '', description: '', parentId: null, level: 0 });
      addToast('大纲条目创建成功');
    } catch (e: any) {
      addToast(e.message || '创建大纲失败', 'error');
    }
    setSaving(false);
  };

  const handleUpdate = async (itemId: number) => {
    if (!editForm.title.trim()) return;
    setSaving(true);
    try {
      await updateOutline(projectId, itemId, editForm);
      setEditingItem(null);
    } catch (e) {
      console.error('更新大纲失败:', e);
    }
    setSaving(false);
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('确定要删除此大纲条目吗？子条目也会被取消嵌套。')) return;
    await deleteOutline(projectId, itemId);
    addToast('大纲条目已删除');
  };

  const handleStatusToggle = async (item: OutlineItem) => {
    const nextStatus = item.status === 'completed' ? 'planning' : item.status === 'planning' ? 'writing' : 'completed';
    await updateOutline(projectId, item.id, { status: nextStatus });
  };

  const handleMoveLevel = async (item: OutlineItem, direction: 'up' | 'down') => {
    const newLevel = direction === 'up' ? Math.max(0, item.level - 1) : item.level + 1;
    const newParentId = direction === 'up' ? null : item.parentId;
    await updateOutline(projectId, item.id, { level: newLevel, parentId: newParentId });
  };

  const handleLinkChapter = async (item: OutlineItem, chapterId: number | null) => {
    await updateOutline(projectId, item.id, { chapterId });
  };

  const startEdit = (item: OutlineItem) => {
    setEditingItem(item.id);
    setEditForm({ title: item.title, description: item.description });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="text-green-400" />;
      case 'writing': return <Clock size={14} className="text-blue-400" />;
      default: return <Circle size={14} className="text-[#f5f0e8]/20" />;
    }
  };

  const renderOutlineItem = (item: OutlineItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    return (
      <div key={item.id}>
        {editingItem === item.id ? (
          <div className="ml-4 my-1 p-3 bg-[#1a1a2e] border border-[#c9a96e]/20 rounded-xl">
            <div className="space-y-3">
              <Input
                value={editForm.title}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="大纲标题"
                className="!py-1.5 !text-sm"
              />
              <textarea
                className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none h-16"
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="简要描述..."
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingItem(null)}>取消</Button>
                <Button size="sm" onClick={() => handleUpdate(item.id)} disabled={saving}>保存</Button>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="group flex items-center gap-1 py-1.5 pr-2 rounded-lg hover:bg-[#f5f0e8]/3 transition-colors"
            style={{ paddingLeft: `${depth * 20 + 4}px` }}
          >
            <GripVertical size={12} className="text-[#f5f0e8]/10 flex-shrink-0 cursor-grab" />

            {/* Expand/collapse */}
            {hasChildren ? (
              <button onClick={() => toggleExpand(item.id)} className="p-0.5 text-[#f5f0e8]/30 hover:text-[#f5f0e8]">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-5" />
            )}

            {/* Status */}
            <button
              onClick={() => handleStatusToggle(item)}
              className="p-0.5 flex-shrink-0"
              title={item.status === 'completed' ? '已完成' : item.status === 'writing' ? '写作中' : '规划中'}
            >
              {statusIcon(item.status)}
            </button>

            {/* Title */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className={`text-sm truncate ${item.status === 'completed' ? 'text-[#f5f0e8]/40 line-through' : 'text-[#f5f0e8]/80'}`}>
                {item.title}
              </span>
              {item.description && (
                <span className="text-xs text-[#f5f0e8]/25 truncate hidden md:inline">
                  — {item.description}
                </span>
              )}
            </div>

            {/* Connected chapter */}
            {item.chapterId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c9a96e]/10 text-[#c9a96e]/50 flex-shrink-0">
                {chapters.find(c => c.id === item.chapterId)?.title || `章${item.chapterId}`}
              </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {chapters.length > 0 && (
                <select
                  className="bg-[#0f0f1a] border border-[#c9a96e]/10 rounded text-[10px] text-[#f5f0e8]/50 py-0.5 px-1 focus:outline-none"
                  value={item.chapterId || ''}
                  onChange={e => handleLinkChapter(item, e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">关联章节</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => handleMoveLevel(item, 'up')}
                className="p-0.5 text-[#f5f0e8]/20 hover:text-[#f5f0e8]/60"
                title="提升层级"
              >
                <MoveHorizontal size={12} />
              </button>
              <button
                onClick={() => startEdit(item)}
                className="p-0.5 text-[#f5f0e8]/20 hover:text-[#c9a96e]"
              >
                <Edit3 size={12} />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-0.5 text-[#f5f0e8]/20 hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {item.children!.map(child => renderOutlineItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getFlatItems = (items: OutlineItem[]): { id: number; title: string; level: number }[] => {
    const result: { id: number; title: string; level: number }[] = [];
    const walk = (list: OutlineItem[]) => {
      for (const item of list) {
        result.push({ id: item.id, title: item.title, level: item.level });
        if (item.children?.length) walk(item.children);
      }
    };
    walk(items);
    return result;
  };

  const flatItems = getFlatItems(outlines);

  // Build context prompt for AI
  const outlineContext = useMemo(() => {
    const lines = ['以下是大纲数据。你应当直接使用[OUTLINE|||...]指令来回复，放在回复末尾。'];
    lines.push(`共有 ${flatItems.length} 个大纲条目：`);
    for (const item of flatItems) {
      lines.push(`- ${'  '.repeat(item.level)}${item.title}`);
    }
    return lines.join('\n');
  }, [flatItems]);

  const handleAIdoAction = async (action: { type: string; action: string; title: string; content: string }) => {
    if (action.type === 'outline') {
      await createOutline(projectId, { title: action.title, description: action.content, level: 0, parentId: null });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#c9a96e]/10 bg-[#1a1a2e]/90">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[#cad9e8]">大纲编辑器</h1>
          <span className="text-xs text-[#f5f0e8]/30">
            {flatItems.length} 个条目
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAI(!showAI)} className={showAI ? 'text-[#c9a96e]' : ''}>
            <Sparkles size={14} /> {showAI ? '关闭AI' : 'AI助手'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => {
            setNewForm({ title: '', description: '', parentId: null, level: 0 });
            setShowCreate(true);
          }}>
            <Plus size={14} />新建条目
          </Button>
          {flatItems.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => {
              const lastItem = flatItems[flatItems.length - 1];
              setNewForm({ title: '', description: '', parentId: lastItem.id, level: lastItem.level + 1 });
              setShowCreate(true);
            }}>
              <ArrowRight size={14} />子条目
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 bg-[#0f0f1a]">
          {outlines.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ListTree size={48} className="text-[#f5f0e8]/10 mx-auto mb-4" />
              <p className="text-[#f5f0e8]/30 text-lg">暂无大纲</p>
              <p className="text-[#f5f0e8]/15 text-sm mt-2">
                点击右上角新建第一条大纲
              </p>
              <div className="mt-6 p-4 bg-[#1a1a2e]/50 rounded-xl border border-[#c9a96e]/8 max-w-md mx-auto">
                <p className="text-xs text-[#f5f0e8]/40 mb-2">大纲功能</p>
                <ul className="text-xs text-[#f5f0e8]/30 space-y-1.5 text-left">
                  <li>- 支持多层级结构（卷{'>'}章{'>'}节）</li>
                  <li>- 可关联已有章节</li>
                  <li>- 标记状态：规划中 / 写作中 / 已完成</li>
                  <li>- 拖拽调整顺序和层级</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {outlines.map(item => renderOutlineItem(item))}
          </div>
        )}
      </div>
        {showAI && (
          <AIPanel
            projectId={projectId}
            contextPrompt={outlineContext}
            title="大纲AI助手"
            onAIdoAction={handleAIdoAction}
            onClose={() => setShowAI(false)}
          />
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="新建大纲条目">
        <div className="space-y-4">
          <Input
            label="标题"
            value={newForm.title}
            onChange={e => setNewForm({ ...newForm, title: e.target.value })}
            placeholder="如：第一卷·初入江湖"
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          />
          <div>
            <label className="text-sm text-[#f5f0e8]/70 mb-1 block">描述</label>
            <textarea
              className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none h-20"
              value={newForm.description}
              onChange={e => setNewForm({ ...newForm, description: e.target.value })}
              placeholder="简要描述此大纲节点..."
            />
          </div>
          {flatItems.length > 0 && (
            <div>
              <label className="text-sm text-[#f5f0e8]/70 mb-1 block">父级条目</label>
              <select
                className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                value={newForm.parentId || ''}
                onChange={e => {
                  const pid = e.target.value ? Number(e.target.value) : null;
                  const parent = flatItems.find(i => i.id === pid);
                  setNewForm({ ...newForm, parentId: pid, level: parent ? parent.level + 1 : 0 });
                }}
              >
                <option value="">无（顶级条目）</option>
                {flatItems.map(i => (
                  <option key={i.id} value={i.id}>
                    {'  '.repeat(i.level)}{i.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {chapters.length > 0 && (
            <div>
              <label className="text-sm text-[#f5f0e8]/70 mb-1 block">关联章节</label>
              <select
                className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-3 py-2 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                value=""
                onChange={e => {
                  if (e.target.value) {
                    setNewForm({ ...newForm, title: newForm.title || chapters.find(c => c.id === Number(e.target.value))?.title || '' });
                  }
                }}
              >
                <option value="">不关联</option>
                {chapters.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newForm.title.trim() || saving}>
              {saving ? '创建中...' : '创建条目'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}