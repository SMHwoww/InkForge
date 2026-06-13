import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useProjectStore } from '@/stores/projectStore';

export function AppLayout() {
  const navigate = useNavigate();
  const createProject = useProjectStore(s => s.createProject);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', summary: '', genre: '' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newProject.title.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(newProject);
      setShowNewProject(false);
      setNewProject({ title: '', summary: '', genre: '' });
      navigate(`/projects/${project.id}/characters`);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  };

  return (
    <div className="flex h-screen bg-[#0f0f1a]">
      <Sidebar onNewProject={() => setShowNewProject(true)} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

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