import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Trash2, Edit3, Users, Calendar } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';

export default function ProjectWorkspace() {
  const navigate = useNavigate();
  const { projects, fetchProjects, createProject, deleteProject, loading } = useProjectStore();
  const addToast = useToastStore(s => s.addToast);
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', summary: '', genre: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async () => {
    if (!newProject.title.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(newProject);
      setShowCreate(false);
      setNewProject({ title: '', summary: '', genre: '' });
      addToast('项目创建成功');
      navigate(`/projects/${project.id}/characters`);
    } catch (e: any) {
      addToast(e.message || '创建项目失败', 'error');
    }
    setCreating(false);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？')) {
      await deleteProject(id);
      addToast('项目已删除');
    }
  };

  const statusLabels: Record<string, string> = {
    draft: '草稿',
    ongoing: '连载中',
    completed: '已完结',
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f0e8]">项目管理</h1>
          <p className="text-[#f5f0e8]/40 text-sm mt-1">管理你的所有小说项目</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          新建项目
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#2d4a3e]/30 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-[#f5f0e8]/40">还没有项目，点击右上角创建第一个项目</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <Card
              key={project.id}
              hover
              className="cursor-pointer group"
              onClick={() => navigate(`/projects/${project.id}/characters`)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-[#f5f0e8] line-clamp-1">{project.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#c9a96e]/15 text-[#c9a96e] whitespace-nowrap">
                  {statusLabels[project.status] || project.status}
                </span>
              </div>
              <p className="text-sm text-[#f5f0e8]/40 line-clamp-2 mb-4">{project.summary || '暂无简介'}</p>
              {project.genre && (
                <span className="text-xs text-[#c9a96e]/60 bg-[#c9a96e]/5 px-2 py-0.5 rounded">
                  {project.genre}
                </span>
              )}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#c9a96e]/8">
                <div className="flex items-center gap-3 text-xs text-[#f5f0e8]/30">
                  <span className="flex items-center gap-1"><Users size={12} />{project.characterCount || 0} 角色</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('zh-CN') : '-'}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/characters`); }}
                    className="p-1.5 rounded text-[#c9a96e]/60 hover:text-[#c9a96e] hover:bg-[#c9a96e]/10"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="p-1.5 rounded text-red-400/60 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="新建小说项目">
        <div className="space-y-4">
          <Input
            label="书名"
            value={newProject.title}
            onChange={e => setNewProject({ ...newProject, title: e.target.value })}
            placeholder="请输入小说名称"
          />
          <Input
            label="简介"
            value={newProject.summary}
            onChange={e => setNewProject({ ...newProject, summary: e.target.value })}
            placeholder="简要描述你的故事"
          />
          <Input
            label="类型标签"
            value={newProject.genre}
            onChange={e => setNewProject({ ...newProject, genre: e.target.value })}
            placeholder="如：玄幻、都市、科幻"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newProject.title.trim() || creating}>
              {creating ? '创建中...' : '创建项目'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}