import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useProjectStore } from '@/stores/projectStore';
import { useToastStore } from '@/stores/toastStore';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Search } from 'lucide-react';

export function AppLayout() {
  const navigate = useNavigate();
  const createProject = useProjectStore(s => s.createProject);
  const addToast = useToastStore(s => s.addToast);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', summary: '', genre: '' });
  const [creating, setCreating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Ctrl+K / Cmd+K 全局快捷键
  const handleGlobalKey = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setShowSearch(prev => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, [handleGlobalKey]);

  const handleCreate = async () => {
    if (!newProject.title.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(newProject);
      if (!project?.id) {
        throw new Error('创建项目失败：返回数据异常');
      }
      setShowNewProject(false);
      setNewProject({ title: '', summary: '', genre: '' });
      addToast('项目创建成功');
      navigate(`/projects/${project.id}/characters`);
    } catch (e: any) {
      addToast(e.message || '创建项目失败', 'error');
    }
    setCreating(false);
  };

  return (
    <div className="flex h-screen bg-[#0f0f1a]">
      <Sidebar onNewProject={() => setShowNewProject(true)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with global search trigger */}
        <div className="flex items-center justify-end px-6 py-2 border-b border-[#c9a96e]/8 bg-[#0f0f1a] shrink-0">
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#f5f0e8]/30 hover:text-[#f5f0e8] hover:bg-[#f5f0e8]/5 border border-transparent hover:border-[#c9a96e]/15 transition-all"
          >
            <Search size={14} />
            <span className="hidden sm:inline">全局搜索</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-[#f5f0e8]/20 bg-[#f5f0e8]/5 border border-[#f5f0e8]/8">
              Ctrl+K
            </kbd>
          </button>
        </div>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <GlobalSearch open={showSearch} onClose={() => setShowSearch(false)} />

      <Modal open={showNewProject} onClose={() => setShowNewProject(false)} title="新建小说项目">
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
            <Button variant="ghost" onClick={() => setShowNewProject(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!newProject.title.trim() || creating}>
              {creating ? '创建中...' : '创建项目'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}