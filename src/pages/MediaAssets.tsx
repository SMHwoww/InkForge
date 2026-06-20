import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Plus, Trash2, Image as ImageIcon, Video, Music, Search,
  Grid3X3, ExternalLink, Copy, X, Eye, Loader2, Upload, Link,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { clsx } from 'clsx';
import type { MediaAsset } from '@/types';

const TYPE_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
};

const TYPE_LABELS: Record<string, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
};

export default function MediaAssets() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const addToast = useToastStore(s => s.addToast);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<'url' | 'file'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Add form
  const [addForm, setAddForm] = useState({
    name: '',
    type: 'image',
    url: '',
    prompt: '',
  });

  useEffect(() => {
    if (projectId) loadAssets();
  }, [projectId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const data = await api.getMediaAssets(projectId);
      setAssets(Array.isArray(data) ? data : []);
    } catch (e: any) {
      addToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      addToast('名称不能为空', 'error');
      return;
    }
    if (addMode === 'url' && !addForm.url.trim()) {
      addToast('URL不能为空', 'error');
      return;
    }
    if (addMode === 'file' && !selectedFile) {
      addToast('请选择文件', 'error');
      return;
    }

    setAdding(true);
    try {
      if (addMode === 'file' && selectedFile) {
        await api.uploadMediaAsset(projectId, selectedFile, addForm.name.trim(), addForm.prompt.trim());
      } else {
        await api.createMediaAsset(projectId, {
          name: addForm.name.trim(),
          type: addForm.type,
          url: addForm.url.trim(),
          prompt: addForm.prompt.trim(),
          source: 'upload',
        });
      }
      setShowAdd(false);
      setAddForm({ name: '', type: 'image', url: '', prompt: '' });
      setSelectedFile(null);
      setAddMode('url');
      addToast('已添加到设定集');
      loadAssets();
    } catch (e: any) {
      addToast(e.message || '添加失败', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (assetId: number) => {
    if (!confirm('确定要删除这个媒体文件吗？')) return;
    try {
      await api.deleteMediaAsset(projectId, assetId);
      addToast('已删除');
      if (previewId === assetId) setPreviewId(null);
      loadAssets();
    } catch (e: any) {
      addToast(e.message || '删除失败', 'error');
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast('已复制链接');
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      addToast('已复制链接');
    }
  };

  const filtered = assets.filter(a => {
    const matchSearch = !search || a.name.includes(search) || a.prompt.includes(search);
    const matchType = filterType === 'all' || a.type === filterType;
    return matchSearch && matchType;
  });

  const previewAsset = previewId ? assets.find(a => a.id === previewId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[#c9a96e]/60" />
      </div>
    );
  }

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#f5f0e8]">设定集</h1>
          <p className="text-[#f5f0e8]/40 text-sm mt-1">{assets.length} 个媒体文件</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={16} />
            添加媒体
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f5f0e8]/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索名称或提示词..."
            className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg pl-9 pr-3 py-2 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60"
          />
        </div>
        <div className="flex items-center gap-1 bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg p-0.5">
          {(['all', 'image', 'video', 'audio'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs transition-colors',
                filterType === t
                  ? 'bg-[#c9a96e]/20 text-[#c9a96e]'
                  : 'text-[#f5f0e8]/40 hover:text-[#f5f0e8]/60',
              )}
            >
              {t === 'all' ? '全部' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <ImageIcon size={48} className="text-[#c9a96e]/20 mb-4" />
          <h2 className="text-lg font-semibold text-[#f5f0e8]/60 mb-2">暂无媒体文件</h2>
          <p className="text-sm text-[#f5f0e8]/30 max-w-md mb-6">
            设定集用于存储项目中的图片、视频和音频等媒体文件。你可以手动添加，或从真珠生图一键提交。
          </p>
          <Button onClick={() => setShowAdd(true)} variant="secondary">
            <Plus size={16} />
            添加第一个媒体
          </Button>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto">
          {filtered.map(asset => (
            <div
              key={asset.id}
              className="group relative bg-[#0f0f1a] border border-[#c9a96e]/10 rounded-xl overflow-hidden hover:border-[#c9a96e]/30 transition-all cursor-pointer"
              onClick={() => setPreviewId(asset.id)}
            >
              {/* Thumbnail */}
              <div className="aspect-square bg-[#1a1a2e] flex items-center justify-center">
                {asset.type === 'image' ? (
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : asset.type === 'video' ? (
                  <Video size={40} className="text-[#f5f0e8]/20" />
                ) : (
                  <Music size={40} className="text-[#f5f0e8]/20" />
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-medium text-[#f5f0e8] truncate">{asset.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-[#f5f0e8]/30 bg-[#f5f0e8]/5 px-1.5 py-0.5 rounded">
                    {TYPE_LABELS[asset.type] || asset.type}
                  </span>
                  {asset.source === 'generated' && (
                    <span className="text-[10px] text-[#c9a96e]/50 bg-[#c9a96e]/10 px-1.5 py-0.5 rounded">
                      AI生成
                    </span>
                  )}
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/60 hover:text-red-400 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setSelectedFile(null); setAddMode('url'); }} title="添加媒体文件">
        <div className="space-y-4">
          {/* 添加方式切换 */}
          <div>
            <label className="block text-sm text-[#f5f0e8]/70 mb-2">添加方式</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAddMode('url')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  addMode === 'url'
                    ? 'bg-[#c9a96e]/20 text-[#c9a96e] border border-[#c9a96e]/30'
                    : 'bg-[#0f0f1a] border border-[#c9a96e]/10 text-[#f5f0e8]/50 hover:text-[#f5f0e8]',
                )}
              >
                <Link size={14} />
                URL链接
              </button>
              <button
                onClick={() => setAddMode('file')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  addMode === 'file'
                    ? 'bg-[#c9a96e]/20 text-[#c9a96e] border border-[#c9a96e]/30'
                    : 'bg-[#0f0f1a] border border-[#c9a96e]/10 text-[#f5f0e8]/50 hover:text-[#f5f0e8]',
                )}
              >
                <Upload size={14} />
                上传文件
              </button>
            </div>
          </div>

          <Input
            label="名称"
            value={addForm.name}
            onChange={e => setAddForm({ ...addForm, name: e.target.value })}
            placeholder="输入媒体名称..."
          />
          <div>
            <label className="block text-sm text-[#f5f0e8]/70 mb-2">类型</label>
            <div className="flex gap-2">
              {(['image', 'video', 'audio'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setAddForm({ ...addForm, type: t })}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    addForm.type === t
                      ? 'bg-[#c9a96e]/20 text-[#c9a96e] border border-[#c9a96e]/30'
                      : 'bg-[#0f0f1a] border border-[#c9a96e]/10 text-[#f5f0e8]/50 hover:text-[#f5f0e8]',
                  )}
                >
                  {(() => {
                    const Icon = TYPE_ICONS[t];
                    return <Icon size={14} />;
                  })()}
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {addMode === 'url' ? (
            <Input
              label="URL"
              value={addForm.url}
              onChange={e => setAddForm({ ...addForm, url: e.target.value })}
              placeholder="https://..."
            />
          ) : (
            <div>
              <label className="block text-sm text-[#f5f0e8]/70 mb-2">文件</label>
              <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-[#c9a96e]/20 rounded-xl cursor-pointer hover:border-[#c9a96e]/50 transition-colors bg-[#0f0f1a]">
                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm text-[#c9a96e] truncate max-w-[200px]">{selectedFile.name}</p>
                    <p className="text-xs text-[#f5f0e8]/30 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="text-[#f5f0e8]/30" />
                    <p className="text-sm text-[#f5f0e8]/40">点击选择文件</p>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    if (file && !addForm.name) {
                      setAddForm(prev => ({ ...prev, name: file.name.replace(/\.[^.]+$/, '') }));
                    }
                  }}
                />
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm text-[#f5f0e8]/70 mb-2">提示词（可选）</label>
            <textarea
              value={addForm.prompt}
              onChange={e => setAddForm({ ...addForm, prompt: e.target.value })}
              placeholder="记录生成该媒体所用的提示词..."
              rows={3}
              className="w-full bg-[#0f0f1a] border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowAdd(false); setSelectedFile(null); setAddMode('url'); }}>取消</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? '添加中...' : '添加'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="bg-[#1e1e2e] border border-[#c9a96e]/15 rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#c9a96e]/10">
              <h3 className="text-base font-semibold text-[#f5f0e8] truncate">{previewAsset.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyUrl(previewAsset.url)}
                  className="p-1.5 rounded-lg text-[#f5f0e8]/40 hover:text-[#c9a96e] hover:bg-[#c9a96e]/10 transition-colors"
                  title="复制链接"
                >
                  <Copy size={16} />
                </button>
                <a
                  href={previewAsset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-[#f5f0e8]/40 hover:text-[#c9a96e] hover:bg-[#c9a96e]/10 transition-colors"
                  title="打开原图"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => handleDelete(previewAsset.id)}
                  className="p-1.5 rounded-lg text-[#f5f0e8]/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => setPreviewId(null)}
                  className="p-1.5 rounded-lg text-[#f5f0e8]/40 hover:text-[#f5f0e8] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="p-6">
              <div className="rounded-xl overflow-hidden bg-[#0f0f1a] mb-4">
                {previewAsset.type === 'image' ? (
                  <img
                    src={previewAsset.url}
                    alt={previewAsset.name}
                    className="w-full h-auto max-h-[60vh] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : previewAsset.type === 'video' ? (
                  <video
                    src={previewAsset.url}
                    controls
                    className="w-full max-h-[60vh]"
                  />
                ) : (
                  <audio
                    src={previewAsset.url}
                    controls
                    className="w-full py-8"
                  />
                )}
              </div>

              {/* Meta */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded',
                    previewAsset.type === 'image' && 'bg-blue-500/10 text-blue-400',
                    previewAsset.type === 'video' && 'bg-purple-500/10 text-purple-400',
                    previewAsset.type === 'audio' && 'bg-green-500/10 text-green-400',
                  )}>
                    {TYPE_LABELS[previewAsset.type]}
                  </span>
                  {previewAsset.source === 'generated' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#c9a96e]/10 text-[#c9a96e]">
                      AI生成
                    </span>
                  )}
                </div>
                {previewAsset.prompt && (
                  <div>
                    <p className="text-xs text-[#f5f0e8]/40 mb-1">提示词</p>
                    <p className="text-sm text-[#f5f0e8]/70 bg-[#0f0f1a] rounded-lg px-3 py-2">
                      {previewAsset.prompt}
                    </p>
                  </div>
                )}
                <p className="text-xs text-[#f5f0e8]/20">
                  创建于 {previewAsset.createdAt}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}