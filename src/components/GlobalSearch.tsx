import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import {
  Search, Users, Globe, PenLine, ListTree, Timer, Image, Stars,
  Loader2, ArrowRight, CornerDownLeft,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SearchResultItem {
  id: number;
  entityType: string;
  entityLabel: string;
  title: string;
  matchText: string;
  projectId: number;
  projectTitle: string;
  route: string;
}

const ENTITY_ICONS: Record<string, typeof Users> = {
  character: Users,
  worldbuilding: Globe,
  chapter: PenLine,
  outline: ListTree,
  timeline: Timer,
  media: Image,
  starchart: Stars,
};

const ENTITY_COLORS: Record<string, string> = {
  character: 'text-amber-400',
  worldbuilding: 'text-emerald-400',
  chapter: 'text-blue-400',
  outline: 'text-purple-400',
  timeline: 'text-rose-400',
  media: 'text-cyan-400',
  starchart: 'text-yellow-400',
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const projectId = id ? Number(id) : undefined;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.search(query.trim(), projectId);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, projectId]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      navigate(results[selectedIdx].route);
      onClose();
    }
  }, [results, selectedIdx, navigate, onClose]);

  // ESC to close
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, [open, onClose]);

  if (!open) return null;

  // Group results by entity type
  const grouped = results.reduce<Record<string, SearchResultItem[]>>((acc, item) => {
    if (!acc[item.entityType]) acc[item.entityType] = [];
    acc[item.entityType].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-[#1a1a2e] border border-[#c9a96e]/20 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#c9a96e]/10">
          <Search size={18} className="text-[#f5f0e8]/30 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="搜索角色、世界观、章节、大纲、时间轴、设定集..."
            className="flex-1 bg-transparent text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 text-sm outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-[#f5f0e8]/25 bg-[#f5f0e8]/5 border border-[#f5f0e8]/10">
            <CornerDownLeft size={10} />
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-[#c9a96e]/60" />
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="text-center py-10">
              <Search size={32} className="mx-auto mb-3 text-[#f5f0e8]/15" />
              <p className="text-sm text-[#f5f0e8]/30">未找到匹配结果</p>
            </div>
          )}

          {!loading && !query.trim() && (
            <div className="text-center py-10">
              <Search size={32} className="mx-auto mb-3 text-[#f5f0e8]/15" />
              <p className="text-sm text-[#f5f0e8]/30">输入关键词开始搜索</p>
              <p className="text-xs text-[#f5f0e8]/15 mt-1">可搜索角色、世界观、章节、大纲、时间轴、设定集、星图</p>
            </div>
          )}

          {!loading && Object.keys(grouped).length > 0 && (
            <div className="py-2">
              {Object.entries(grouped).map(([entityType, items]) => {
                const Icon = ENTITY_ICONS[entityType] || Search;
                const colorClass = ENTITY_COLORS[entityType] || 'text-[#f5f0e8]/50';
                return (
                  <div key={entityType}>
                    <div className="flex items-center gap-2 px-4 py-1.5">
                      <Icon size={12} className={colorClass} />
                      <span className="text-[10px] uppercase tracking-wider text-[#f5f0e8]/25 font-medium">
                        {items[0].entityLabel}
                      </span>
                      <span className="text-[10px] text-[#f5f0e8]/15">{items.length} 个结果</span>
                    </div>
                    {items.map((item, idx) => {
                      const globalIdx = results.indexOf(item);
                      const isSelected = globalIdx === selectedIdx;
                      return (
                        <button
                          key={`${item.entityType}-${item.id}`}
                          onClick={() => { navigate(item.route); onClose(); }}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                          className={clsx(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            isSelected ? 'bg-[#c9a96e]/10' : 'hover:bg-[#f5f0e8]/3',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#f5f0e8] truncate">{item.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.matchText && (
                                <p className="text-xs text-[#f5f0e8]/30 truncate max-w-[200px]">{item.matchText}</p>
                              )}
                              <span className="text-[10px] text-[#f5f0e8]/15 px-1.5 py-0.5 rounded bg-[#f5f0e8]/5 shrink-0">
                                {item.projectTitle}
                              </span>
                            </div>
                          </div>
                          <ArrowRight size={14} className={clsx(
                            'shrink-0 transition-opacity',
                            isSelected ? 'text-[#c9a96e]' : 'text-[#f5f0e8]/15',
                          )} />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#c9a96e]/10 text-[10px] text-[#f5f0e8]/20">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#f5f0e8]/5 border border-[#f5f0e8]/10">↑↓</kbd>
              <span>导航</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#f5f0e8]/5 border border-[#f5f0e8]/10">Enter</kbd>
              <span>跳转</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#f5f0e8]/5 border border-[#f5f0e8]/10">Esc</kbd>
              <span>关闭</span>
            </span>
          </div>
          {results.length > 0 && (
            <span className="text-[#f5f0e8]/15">{results.length} 个结果</span>
          )}
        </div>
      </div>
    </div>
  );
}