import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TimelineCategories } from '@/types';
import type { TimelineEvent } from '@/types';
import { Plus, Trash2, Pencil, X, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';

const X_COLUMNS = 10;
const CELL_H = 88;
const LABEL_W = 100;

export default function Timeline() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const {
    timelineEvents, timelinePerspectives, xLabels,
    fetchTimeline, createTimelineEvent, updateTimelineEvent, deleteTimelineEvent,
    fetchPerspectives, createPerspective, updatePerspective, deletePerspective,
    fetchTimelineConfig, updateTimelineConfig,
  } = useProjectStore();
  const addToast = useToastStore(s => s.addToast);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [form, setForm] = useState({ title: '', content: '', eventDate: '', category: '重大事件' });
  const [dragEventId, setDragEventId] = useState<number | null>(null);
  const [showPerspectiveMgr, setShowPerspectiveMgr] = useState(false);
  const [newPerspName, setNewPerspName] = useState('');
  const [editingPerspId, setEditingPerspId] = useState<number | null>(null);
  const [editingPerspName, setEditingPerspName] = useState('');
  const [poolOpen, setPoolOpen] = useState(true);
  const [editingXIndex, setEditingXIndex] = useState<number | null>(null);
  const [editingXValue, setEditingXValue] = useState('');

  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) { fetchTimeline(projectId); fetchPerspectives(projectId); fetchTimelineConfig(projectId); }
  }, [projectId]);

  const resetForm = () => setForm({ title: '', content: '', eventDate: '', category: '重大事件' });

  // --- Event CRUD ---
  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      await createTimelineEvent(projectId, { ...form, sortOrder: timelineEvents.length, placed: 0 });
      setShowCreate(false);
      resetForm();
      addToast('时间轴事件已加入事件池');
    } catch (e: any) {
      addToast(e.message || '创建事件失败', 'error');
    }
    setCreating(false);
  };

  const handleUpdate = async () => {
    if (!form.title.trim() || !editing) return;
    try {
      await updateTimelineEvent(projectId, editing.id, form);
      setEditing(null);
      resetForm();
      addToast('事件已更新');
    } catch (e: any) {
      addToast(e.message || '更新事件失败', 'error');
    }
  };

  const handleDelete = async (eventId: number) => {
    if (confirm('确定要删除这个时间轴事件吗？')) {
      await deleteTimelineEvent(projectId, eventId);
      addToast('事件已删除');
    }
  };

  const openEdit = (event: TimelineEvent) => {
    setForm({ title: event.title, content: event.content, eventDate: event.eventDate, category: event.category || '重大事件' });
    setEditing(event);
  };

  // --- Place/Unplace ---
  const placeEvent = useCallback(async (eventId: number, x: number, y: number) => {
    const perspective = timelinePerspectives[y];
    if (!perspective) return;
    await updateTimelineEvent(projectId, eventId, { placed: 1, posX: x, posY: perspective.id });
  }, [projectId, timelinePerspectives, updateTimelineEvent]);

  const unplaceEvent = useCallback(async (eventId: number) => {
    await updateTimelineEvent(projectId, eventId, { placed: 0, posX: null, posY: null });
  }, [projectId, updateTimelineEvent]);

  // --- Reposition on workspace ---
  const moveOnWorkspace = useCallback(async (eventId: number, x: number, y: number) => {
    const perspective = timelinePerspectives[y];
    if (!perspective) return;
    await updateTimelineEvent(projectId, eventId, { posX: x, posY: perspective.id });
  }, [projectId, timelinePerspectives, updateTimelineEvent]);

  // --- Drag ---
  const onDragStart = (e: React.DragEvent, eventId: number) => {
    setDragEventId(eventId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(eventId));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropWorkspace = async (e: React.DragEvent) => {
    e.preventDefault();
    if (dragEventId === null || !workspaceRef.current || timelinePerspectives.length === 0) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const colW = (rect.width - LABEL_W) / X_COLUMNS;
    const x = Math.min(X_COLUMNS - 1, Math.max(0, Math.floor((relX - LABEL_W) / colW)));
    const y = Math.min(timelinePerspectives.length - 1, Math.max(0, Math.floor(relY / CELL_H)));
    const event = timelineEvents.find(ev => ev.id === dragEventId);
    if (!event) return;
    if (event.placed) {
      await moveOnWorkspace(dragEventId, x, y);
    } else {
      await placeEvent(dragEventId, x, y);
    }
    setDragEventId(null);
  };

  // --- Perspective CRUD ---
  const saveXLabel = async (index: number) => {
    const updated = [...xLabels];
    updated[index] = editingXValue.trim() || `时间${index + 1}`;
    await updateTimelineConfig(projectId, { xLabels: updated });
    setEditingXIndex(null);
  };
  const handleAddPerspective = async () => {
    if (!newPerspName.trim()) return;
    await createPerspective(projectId, { name: newPerspName.trim() });
    setNewPerspName('');
    addToast('视角已添加');
  };

  const startEditPersp = (id: number, name: string) => { setEditingPerspId(id); setEditingPerspName(name); };
  const saveEditPersp = async () => {
    if (editingPerspId === null || !editingPerspName.trim()) return;
    await updatePerspective(projectId, editingPerspId, { name: editingPerspName.trim() });
    setEditingPerspId(null);
  };
  const handleDeletePersp = async (perspId: number) => {
    if (confirm('删除视角会同时移除该视角上的所有事件位置，确定？')) {
      await deletePerspective(projectId, perspId);
      addToast('视角已删除');
    }
  };

  // --- Derived ---
  const unplacedEvents = timelineEvents.filter(e => !e.placed);
  const showPool = poolOpen && unplacedEvents.length > 0;
  const hasPerspectives = timelinePerspectives.length > 0;

  const getPlacedEventForCell = (x: number, perspId: number) =>
    timelineEvents.find(e => e.placed && e.posX === x && e.posY === perspId);

  return (
    <div className="h-full flex flex-col bg-[#0f0f1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#c9a96e]/10 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#f5f0e8]">时间轴</h1>
          <p className="text-[#f5f0e8]/40 text-xs">拖拽事件到工作区布置时间线</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowPerspectiveMgr(true)}>
            管理视角 ({timelinePerspectives.length})
          </Button>
          {unplacedEvents.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPoolOpen(!poolOpen)}>
              {poolOpen ? <><PanelRightClose size={14} className="mr-1" />隐藏事件池</> : <><PanelRightOpen size={14} className="mr-1" />显示事件池 ({unplacedEvents.length})</>}
            </Button>
          )}
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus size={14} /> 新建事件
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Workspace */}
        <div className="flex-1 flex flex-col overflow-auto transition-all">
          {!hasPerspectives ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[#f5f0e8]/40 mb-4">请先创建至少一个视角，才能使用工作区</p>
                <Button onClick={() => setShowPerspectiveMgr(true)}>管理视角</Button>
              </div>
            </div>
          ) : (
            <div ref={workspaceRef} className="flex-1 overflow-auto" onDragOver={onDragOver} onDrop={onDropWorkspace}>
              {/* X-axis header */}
              <div className="sticky top-0 z-10 flex bg-[#0f0f1a] border-b border-[#c9a96e]/10">
                <div className="shrink-0" style={{ width: LABEL_W }} />
                {Array.from({ length: X_COLUMNS }, (_, i) => (
                  <div key={i} className="flex-1 text-center py-2 text-xs border-l border-[#c9a96e]/5">
                    {editingXIndex === i ? (
                      <input
                        className="w-full bg-[#c9a96e]/10 border border-[#c9a96e]/40 rounded px-1 py-0.5 text-center text-[#f5f0e8] text-xs outline-none"
                        value={editingXValue}
                        onChange={e => setEditingXValue(e.target.value)}
                        onBlur={() => saveXLabel(i)}
                        onKeyDown={e => { if (e.key === 'Enter') saveXLabel(i); if (e.key === 'Escape') setEditingXIndex(null); }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="text-[#f5f0e8]/30 hover:text-[#c9a96e]/70 cursor-pointer transition-colors"
                        onClick={() => { setEditingXIndex(i); setEditingXValue(xLabels[i] || `时间${i + 1}`); }}
                        title="点击编辑"
                      >
                        {xLabels[i] || `时间${i + 1}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Perspective lanes */}
              {timelinePerspectives.map((persp, perspIdx) => (
                <div key={persp.id} className="flex border-b border-[#c9a96e]/5">
                  {/* Y-axis label */}
                  <div className="shrink-0 flex items-center justify-center bg-[#1a1a2e]/50 border-r border-[#c9a96e]/10" style={{ width: LABEL_W }}>
                    <span className="text-xs text-[#c9a96e] font-medium px-2 text-center leading-tight">{persp.name}</span>
                  </div>
                  {/* Cells */}
                  {Array.from({ length: X_COLUMNS }, (_, x) => {
                    const placedEvent = getPlacedEventForCell(x, persp.id);
                    return (
                      <div
                        key={x}
                        className="flex-1 border-l border-[#c9a96e]/5 relative"
                        style={{ height: CELL_H, minWidth: 80 }}
                        onDragOver={onDragOver}
                        onDrop={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragEventId === null) return;
                          const event = timelineEvents.find(ev => ev.id === dragEventId);
                          if (!event) return;
                          if (event.placed) {
                            await moveOnWorkspace(dragEventId, x, perspIdx);
                          } else {
                            await placeEvent(dragEventId, x, perspIdx);
                          }
                          setDragEventId(null);
                        }}
                      >
                        {placedEvent && (
                          <div
                            className="absolute inset-1 bg-[#c9a96e]/15 border border-[#c9a96e]/30 rounded-lg p-1.5 cursor-grab group hover:bg-[#c9a96e]/25 hover:border-[#c9a96e]/50 transition-colors overflow-hidden"
                            draggable
                            onDragStart={(e) => onDragStart(e, placedEvent.id)}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-medium text-[#f5f0e8] truncate">{placedEvent.title}</span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => openEdit(placedEvent)} className="p-0.5 text-[#f5f0e8]/40 hover:text-[#c9a96e]">
                                  <Pencil size={10} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); unplaceEvent(placedEvent.id); }} className="p-0.5 text-[#f5f0e8]/40 hover:text-yellow-400">
                                  <X size={10} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(placedEvent.id); }} className="p-0.5 text-[#f5f0e8]/40 hover:text-red-400">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Pool (right panel) */}
        {showPool && (
          <div className="w-64 shrink-0 border-l border-[#c9a96e]/10 bg-[#1a1a2e]/30 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#c9a96e]/10 shrink-0">
              <h2 className="text-sm font-semibold text-[#f5f0e8]">事件池</h2>
              <p className="text-xs text-[#f5f0e8]/30 mt-0.5">拖拽卡片到左侧工作区</p>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {unplacedEvents.map(event => (
                <div
                  key={event.id}
                  className="bg-[#2d4a3e]/40 border border-[#c9a96e]/15 rounded-lg p-3 cursor-grab hover:border-[#c9a96e]/40 transition-colors group"
                  draggable
                  onDragStart={(e) => onDragStart(e, event.id)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-sm font-medium text-[#f5f0e8] truncate">{event.title}</span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEdit(event)} className="p-0.5 text-[#f5f0e8]/40 hover:text-[#c9a96e]">
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => handleDelete(event.id)} className="p-0.5 text-[#f5f0e8]/40 hover:text-red-400">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  {event.category && (
                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-[#c9a96e]/10 text-[#c9a96e]/60 mt-1">{event.category}</span>
                  )}
                  {event.content && (
                    <p className="text-[10px] text-[#f5f0e8]/30 mt-1 line-clamp-2">{event.content}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="新建事件（将加入事件池）">
        <div className="space-y-4">
          <Input label="事件标题" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：主角觉醒" />
          <div>
            <label className="text-sm text-[#f5f0e8]/70">分类</label>
            <select className="w-full mt-1.5 bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {TimelineCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm text-[#f5f0e8]/70">事件描述</label>
            <textarea className="w-full mt-1.5 bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none h-28" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="详细描述..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!form.title.trim() || creating}>
              {creating ? '创建中...' : '创建事件'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Event Modal */}
      <Modal open={editing !== null} onClose={() => { setEditing(null); resetForm(); }} title="编辑事件">
        <div className="space-y-4">
          <Input label="事件标题" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <div>
            <label className="text-sm text-[#f5f0e8]/70">分类</label>
            <select className="w-full mt-1.5 bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {TimelineCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm text-[#f5f0e8]/70">事件描述</label>
            <textarea className="w-full mt-1.5 bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none h-28" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setEditing(null); resetForm(); }}>取消</Button>
            <Button onClick={handleUpdate} disabled={!form.title.trim()}>保存修改</Button>
          </div>
        </div>
      </Modal>

      {/* Perspective Manager Modal */}
      <Modal open={showPerspectiveMgr} onClose={() => { setShowPerspectiveMgr(false); setEditingPerspId(null); }} title="管理视角" width="max-w-md">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newPerspName}
              onChange={e => setNewPerspName(e.target.value)}
              placeholder="输入视角名称，如：主角线 / 反派线 / 世界观"
              onKeyDown={e => { if (e.key === 'Enter') handleAddPerspective(); }}
            />
            <Button onClick={handleAddPerspective} disabled={!newPerspName.trim()} className="shrink-0">
              <Plus size={14} /> 添加
            </Button>
          </div>
          {timelinePerspectives.length === 0 ? (
            <p className="text-sm text-[#f5f0e8]/30 text-center py-4">暂无视角，请添加至少一个</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-auto">
              {timelinePerspectives.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-[#2d4a3e]/30 rounded-lg px-3 py-2">
                  {editingPerspId === p.id ? (
                    <>
                      <input
                        className="flex-1 bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded px-2 py-1 text-sm text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
                        value={editingPerspName}
                        onChange={e => setEditingPerspName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditPersp(); if (e.key === 'Escape') setEditingPerspId(null); }}
                        autoFocus
                      />
                      <button onClick={saveEditPersp} className="text-xs text-[#c9a96e] hover:text-[#d4b87a] shrink-0">保存</button>
                      <button onClick={() => setEditingPerspId(null)} className="text-xs text-[#f5f0e8]/40 hover:text-[#f5f0e8] shrink-0">取消</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-[#f5f0e8]">{p.name}</span>
                      <button onClick={() => startEditPersp(p.id, p.name)} className="p-1 text-[#f5f0e8]/30 hover:text-[#c9a96e]">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDeletePersp(p.id)} className="p-1 text-[#f5f0e8]/30 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}