import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { WorldbuildingCategories } from '@/types';
import { Plus, Trash2, ChevronDown, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { useToastStore } from '@/stores/toastStore';

export default function Worldbuilding() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { worldbuilding, fetchWorldbuilding, createWorldbuilding, updateWorldbuilding, deleteWorldbuilding } = useProjectStore();
  const addToast = useToastStore(s => s.addToast);
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ category: '地理', title: '', content: '' });
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    if (projectId) {
      const cat = activeCategory === '全部' ? undefined : activeCategory;
      fetchWorldbuilding(projectId, cat);
    }
  }, [projectId, activeCategory]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      await createWorldbuilding(projectId, form);
      setShowCreate(false);
      setForm({ category: '地理', title: '', content: '' });
      addToast('世界观条目创建成功');
    } catch (e: any) {
      addToast(e.message || '创建世界观条目失败', 'error');
    }
    setCreating(false);
  };

  const handleDelete = async (itemId: number) => {
    if (confirm('确定要删除这条世界观设定吗？')) {
      await deleteWorldbuilding(projectId, itemId);
      addToast('世界观条目已删除');
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const result = await api.generateWorldbuilding(projectId, activeCategory === '全部' ? '地理' : activeCategory, aiPrompt);
      if (result.content) {
        setForm({ ...form, content: result.content });
      }
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f0e8]">世界观编辑器</h1>
          <p className="text-[#f5f0e8]/40 text-sm mt-1">构建你的故事世界</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          新建条目
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory('全部')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeCategory === '全部'
              ? 'bg-[#c9a96e]/20 text-[#c9a96e]'
              : 'text-[#f5f0e8]/50 hover:text-[#f5f0e8] hover:bg-[#f5f0e8]/5'
          }`}
        >
          全部
        </button>
        {WorldbuildingCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-[#c9a96e]/20 text-[#c9a96e]'
                : 'text-[#f5f0e8]/50 hover:text-[#f5f0e8] hover:bg-[#f5f0e8]/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      {worldbuilding.length === 0 ? (
        <div className="text-center py-16 bg-[#2d4a3e]/30 rounded-xl border border-[#c9a96e]/8">
          <p className="text-[#f5f0e8]/40">该分类下暂无世界观设定</p>
        </div>
      ) : (
        <div className="space-y-3">
          {worldbuilding.map(item => (
            <div key={item.id} className="bg-[#2d4a3e]/40 rounded-xl border border-[#c9a96e]/8 overflow-hidden">
              <button
                onClick={() => {
                  const next = new Set(expanded);
                  if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  setExpanded(next);
                }}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#c9a96e]/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expanded.has(item.id) ? <ChevronDown size={16} className="text-[#c9a96e]/60" /> : <ChevronRight size={16} className="text-[#c9a96e]/60" />}
                  <h3 className="text-[#f5f0e8] font-medium">{item.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#c9a96e]/10 text-[#c9a96e]/60">{item.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    className="p-1 rounded text-[#f5f0e8]/30 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </button>
              {expanded.has(item.id) && item.content && (
                <div className="px-5 pb-5">
                  <div className="pt-4 border-t border-[#c9a96e]/8">
                    <p className="text-[#f5f0e8]/60 text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="新建世界观条目">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#f5f0e8]/70">分类</label>
            <select
              className="w-full mt-1.5 bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
            >
              {WorldbuildingCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <Input label="标题" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：大陆名称" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-[#f5f0e8]/70">内容</label>
              <button
                onClick={handleAIGenerate}
                disabled={generating || !aiPrompt.trim()}
                className="flex items-center gap-1 text-xs text-[#c9a96e] hover:text-[#d4b87a] disabled:opacity-40"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                AI生成
              </button>
            </div>
            <div className="mb-2">
              <input
                className="w-full bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60"
                placeholder="输入关键词让AI帮你生成..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
              />
            </div>
            <textarea
              className="w-full bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none h-40"
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="详细描述..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!form.title.trim() || creating}>
              {creating ? '创建中...' : '创建条目'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}