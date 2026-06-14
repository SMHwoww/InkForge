import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Globe,
  Sparkles,
  Settings,
  ChevronLeft,
  Plus,
  PenLine,
  ListTree,
  Stars,
  Timer,
} from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

interface SidebarProps {
  onNewProject: () => void;
}

export function Sidebar({ onNewProject }: SidebarProps) {
  const { id } = useParams<{ id: string }>();
  const [collapsed, setCollapsed] = useState(false);
  const projectId = id ? Number(id) : null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
      isActive
        ? 'bg-[#c9a96e]/15 text-[#c9a96e] font-medium'
        : 'text-[#f5f0e8]/60 hover:text-[#f5f0e8] hover:bg-[#f5f0e8]/5',
    );

  return (
    <aside
      className={clsx(
        'h-screen bg-[#1a1a2e] border-r border-[#c9a96e]/10 flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-[#c9a96e]/10">
        {!collapsed && (
          <span className="text-lg font-bold text-[#c9a96e] tracking-wide whitespace-nowrap">
            墨客工坊
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-[#f5f0e8]/40 hover:text-[#f5f0e8] transition-colors"
        >
          <ChevronLeft size={18} className={clsx('transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        <NavLink to="/" end className={linkClass}>
          <LayoutDashboard size={18} />
          {!collapsed && <span>仪表盘</span>}
        </NavLink>

        <NavLink to="/projects" className={linkClass}>
          <BookOpen size={18} />
          {!collapsed && <span>项目管理</span>}
        </NavLink>

        {projectId && (
          <>
            <div className={clsx('my-3 border-t border-[#c9a96e]/8', collapsed && 'mx-2')} />
            {!collapsed && <p className="px-3 text-xs text-[#f5f0e8]/30 uppercase tracking-wider mb-1">项目模块</p>}

            <NavLink to={`/projects/${projectId}/ai-assistant`} className={linkClass}>
              <Sparkles size={18} />
              {!collapsed && <span>AI助手</span>}
            </NavLink>

            <NavLink to={`/projects/${projectId}/chapters`} className={linkClass}>
              <PenLine size={18} />
              {!collapsed && <span>正文编辑</span>}
            </NavLink>

            <NavLink to={`/projects/${projectId}/outlines`} className={linkClass}>
              <ListTree size={18} />
              {!collapsed && <span>大纲</span>}
            </NavLink>

            <NavLink to={`/projects/${projectId}/characters`} className={linkClass}>
              <Users size={18} />
              {!collapsed && <span>角色</span>}
            </NavLink>

            <NavLink to={`/projects/${projectId}/starchart`} className={linkClass}>
              <Stars size={18} />
              {!collapsed && <span>星图</span>}
            </NavLink>

            <NavLink to={`/projects/${projectId}/worldbuilding`} className={linkClass}>
              <Globe size={18} />
              {!collapsed && <span>世界观</span>}
            </NavLink>

            <NavLink to={`/projects/${projectId}/timeline`} className={linkClass}>
              <Timer size={18} />
              {!collapsed && <span>时间轴</span>}
            </NavLink>
          </>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="p-2 border-t border-[#c9a96e]/10">
        <button
          onClick={onNewProject}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#c9a96e] hover:bg-[#c9a96e]/10 transition-colors"
        >
          <Plus size={18} />
          {!collapsed && <span>新建项目</span>}
        </button>
      </div>
    </aside>
  );
}