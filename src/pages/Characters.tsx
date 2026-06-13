import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, User, Trash2, Edit3, Search, Grid3X3, List } from 'lucide-react';

export default function Characters() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { characters, fetchCharacters, createCharacter, deleteCharacter } = useProjectStore();
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', role: '', gender: '', personality: '', background: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (projectId) fetchCharacters(projectId);
  }, [projectId]);

  const filtered = characters.filter(c =>
    c.name.includes(search) || c.role.includes(search)
  );

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await createCharacter(projectId, form);
      setShowCreate(false);
      setForm({ name: '', role: '', gender: '', personality: '', background: '' });
    } catch (e) {
      console.error('创建角色失败:', e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (charId: number) => {
    if (confirm('确定要删除这个角色吗？')) {
      await deleteCharacter(projectId, charId);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f0e8]">角色管理</h1>
          <p className="text-[#f5f0e8]/40 text-sm mt-1">{characters.length} 个角色</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f5f0e8]/30" />
            <input
              className="bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg pl-9 pr-4 py-2 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 w-48"
              placeholder="搜索角色..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex rounded-lg border border-[#c9a96e]/20 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-[#c9a96e]/15 text-[#c9a96e]' : 'text-[#f5f0e8]/40 hover:text-[#f5f0e8]'}`}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-[#c9a96e]/15 text-[#c9a96e]' : 'text-[#f5f0e8]/40 hover:text-[#f5f0e8]'}`}
            >
              <List size={16} />
            </button>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            新建角色
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-16">
          <User size={48} className="mx-auto mb-4 text-[#c9a96e]/20" />
          <p className="text-[#f5f0e8]/40 mb-4">还没有角色，创建你的第一个角色吧</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            创建角色
          </Button>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(char => (
            <Card
              key={char.id}
              hover
              className="cursor-pointer group"
              onClick={() => navigate(`/projects/${projectId}/characters/${char.id}`)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#c9a96e]/30 to-[#2d4a3e] flex items-center justify-center text-[#c9a96e] font-bold text-lg shrink-0">
                  {char.name[0]}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#f5f0e8] truncate">{char.name}</h3>
                  <p className="text-xs text-[#c9a96e]/60">{char.role || '未设定'}</p>
                </div>
              </div>
              <p className="text-sm text-[#f5f0e8]/40 line-clamp-2">{char.summary || '暂无背景故事'}</p>
              <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-[#c9a96e]/8 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/projects/${projectId}/characters/${char.id}`); }}
                  className="p-1.5 rounded text-[#c9a96e]/60 hover:text-[#c9a96e] hover:bg-[#c9a96e]/10"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }}
                  className="p-1.5 rounded text-red-400/60 hover:text-red-400 hover:bg-red-400/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(char => (
            <div
              key={char.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#2d4a3e]/30 border border-[#c9a96e]/8 hover:border-[#c9a96e]/20 cursor-pointer transition-colors"
              onClick={() => navigate(`/projects/${projectId}/characters/${char.id}`)}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c9a96e]/30 to-[#2d4a3e] flex items-center justify-center text-[#c9a96e] font-bold shrink-0">
                {char.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[#f5f0e8]">{char.name}</h3>
                <p className="text-xs text-[#f5f0e8]/40 truncate">{char.role || '未设定'} · {char.summary || '暂无背景'}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }}
                  className="p-1.5 rounded text-red-400/60 hover:text-red-400 hover:bg-red-400/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="创建角色">
        <div className="space-y-4">
          <Input label="角色名称 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：张三" />
          <Input label="身份定位" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="如：主角、反派、配角" />
          <Input label="性别" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} placeholder="男 / 女 / 其他" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#f5f0e8]/70">性格描述</label>
            <textarea
              className="bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none h-20"
              value={form.personality}
              onChange={e => setForm({ ...form, personality: e.target.value })}
              placeholder="描述角色的性格特点..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#f5f0e8]/70">背景故事</label>
            <textarea
              className="bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none h-24"
              value={form.background}
              onChange={e => setForm({ ...form, background: e.target.value })}
              placeholder="描述角色的背景故事..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || creating}>
              {creating ? '创建中...' : '创建角色'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}