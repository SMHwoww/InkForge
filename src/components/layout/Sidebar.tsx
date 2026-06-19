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
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useModuleConfigStore } from '@/stores/moduleConfigStore';

interface SidebarProps {
  onNewProject: () => void;
}

export function Sidebar({ onNewProject }: SidebarProps) {
  const { id } = useParams<{ id: string }>();
  const [collapsed, setCollapsed] = useState(false);
  const projectId = id ? Number(id) : null;
  const { config, fetchModuleConfig } = useModuleConfigStore();

  useEffect(() => { fetchModuleConfig(); }, []);

  const moduleDefs = [
    { id: 'ai-assistant', label: 'AI助手', icon: Sparkles, path: 'ai-assistant' },
    { id: 'chapters', label: '正文编辑', icon: PenLine, path: 'chapters' },
    { id: 'outlines', label: '大纲', icon: ListTree, path: 'outlines' },
    { id: 'characters', label: '角色', icon: Users, path: 'characters' },
    { id: 'starchart', label: '星图', icon: Stars, path: 'starchart' },
    { id: 'worldbuilding', label: '世界观', icon: Globe, path: 'worldbuilding' },
    { id: 'timeline', label: '时间轴', icon: Timer, path: 'timeline' },
  ];

  // Filter and sort modules based on config
  const visibleModules = (() => {
    const order = config.order.length > 0 ? config.order : moduleDefs.map(m => m.id);
    const result: typeof moduleDefs = [];
    const seen = new Set<string>();
    for (const id of order) {
      const mod = moduleDefs.find(m => m.id === id);
      if (mod && !seen.has(id) && config.visible[id] !== false) {
        seen.add(id);
        result.push(mod);
      }
    }
    // Add any modules not in order but visible
    for (const mod of moduleDefs) {
      if (!seen.has(mod.id) && config.visible[mod.id] !== false) {
        result.push(mod);
      }
    }
    return result;
  })();

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

            {visibleModules.map(mod => (
              <NavLink key={mod.id} to={`/projects/${projectId}/${mod.path}`} className={linkClass}>
                <mod.icon size={18} />
                {!collapsed && <span>{mod.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="p-2 border-t border-[#c9a96e]/10 space-y-1">
        <NavLink to="/settings" className={linkClass}>
          <Settings size={18} />
          {!collapsed && <span>设置</span>}
        </NavLink>

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