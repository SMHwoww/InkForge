import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BookOpen, Plus, Clock, Users, GitBranch, Globe } from 'lucide-react';

export default function Dashboard() {
  const { projects, fetchProjects, loading } = useProjectStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const statusLabels: Record<string, string> = {
    draft: '草稿',
    ongoing: '连载中',
    completed: '已完结',
  };

  return (
    <div className="p-8">
      {/* Hero Banner */}
      <div className="relative mb-10 p-8 rounded-2xl bg-gradient-to-br from-[#1a1a2e] via-[#2d4a3e]/40 to-[#1a1a2e] border border-[#c9a96e]/10 overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #c9a96e 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="relative">
          <h1 className="text-3xl font-bold text-[#f5f0e8] mb-2">欢迎回到墨客工坊</h1>
          <p className="text-[#f5f0e8]/50 mb-4">在此管理你的小说项目、角色关系与世界观设定</p>
          <div className="flex gap-4 text-sm">
            <span className="text-[#f5f0e8]/40">
              <Clock size={14} className="inline mr-1" />
              {projects.length} 个项目
            </span>
          </div>
        </div>
      </div>

      {/* Project Grid */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#f5f0e8]">我的项目</h2>
        <Button onClick={() => navigate('/projects')}>项目管理</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#2d4a3e]/30 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="text-center py-16">
          <BookOpen size={48} className="mx-auto mb-4 text-[#c9a96e]/30" />
          <p className="text-[#f5f0e8]/40 mb-4">还没有任何项目，开始你的第一个创作吧</p>
          <Button onClick={() => navigate('/projects')}>
            <Plus size={16} />
            创建项目
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <Card
              key={project.id}
              hover
              className="cursor-pointer"
              onClick={() => navigate(`/projects/${project.id}/characters`)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-[#f5f0e8] line-clamp-1">{project.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#c9a96e]/15 text-[#c9a96e]">
                  {statusLabels[project.status] || project.status}
                </span>
              </div>
              <p className="text-sm text-[#f5f0e8]/40 line-clamp-2 mb-4">{project.summary || '暂无简介'}</p>
              {project.genre && (
                <span className="text-xs text-[#c9a96e]/60 bg-[#c9a96e]/5 px-2 py-0.5 rounded">
                  {project.genre}
                </span>
              )}
              <div className="flex gap-4 mt-4 pt-4 border-t border-[#c9a96e]/8 text-xs text-[#f5f0e8]/30">
                <span className="flex items-center gap-1"><Users size={12} />{project.characterCount || 0} 角色</span>
                <span className="flex items-center gap-1"><GitBranch size={12} />关系图</span>
                <span className="flex items-center gap-1"><Globe size={12} />世界观</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}