import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Plus, Trash2, FileText, Save, Clock, Edit3, ChevronRight,
  Eye,
} from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';

export default function ChapterEditor() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const {
    chapters,
    fetchChapters, createChapter, updateChapter, deleteChapter,
  } = useProjectStore();
  const addToast = useToastStore(s => s.addToast);

  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const selectedChapterIdRef = useRef<number | null>(null);
  const projectIdRef = useRef<number>(projectId);
  const updateChapterRef = useRef(updateChapter);

  // Keep refs updated
  useEffect(() => { selectedChapterIdRef.current = selectedChapterId; }, [selectedChapterId]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { updateChapterRef.current = updateChapter; }, [updateChapter]);

  useEffect(() => {
    if (projectId) {
      fetchChapters(projectId);
    }
  }, [projectId]);

  const selectedChapter = chapters.find(c => c.id === selectedChapterId) || null;

  // Auto-save function using refs
  const handleAutoSave = useCallback(async (content: string) => {
    const cid = selectedChapterIdRef.current;
    const pid = projectIdRef.current;
    if (!cid || !pid) return;
    setSaving(true);
    try {
      await updateChapterRef.current(pid, cid, { content });
      setLastSaved(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
    setSaving(false);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: '开始书写你的故事...',
      }),
    ],
    content: selectedChapter?.content || '',
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-6 text-[#f5f0e8] leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        handleAutoSave(editor.getHTML());
      }, 2000);
    },
  });

  // Update editor content when selected chapter changes
  useEffect(() => {
    if (editor && selectedChapter) {
      editor.commands.setContent(selectedChapter.content || '');
    }
  }, [selectedChapterId]);

  const handleManualSave = async () => {
    if (!editor || !selectedChapterId || !projectId) return;
    setSaving(true);
    try {
      await updateChapter(projectId, selectedChapterId, { content: editor.getHTML() });
      setLastSaved(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(false);
  };

  const handleCreateChapter = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const chapter = await createChapter(projectId, { title: newTitle.trim(), orderNum: chapters.length });
      setShowCreate(false);
      setNewTitle('');
      setSelectedChapterId(chapter.id);
      addToast('章节创建成功');
    } catch (e: any) {
      addToast(e.message || '创建章节失败', 'error');
    }
    setCreating(false);
  };

  const handleDeleteChapter = async (chapterId: number) => {
    if (!confirm('确定要删除这个章节吗？')) return;
    await deleteChapter(projectId, chapterId);
    addToast('章节已删除');
    if (selectedChapterId === chapterId) {
      setSelectedChapterId(null);
    }
  };

  const handleSelectChapter = (chapterId: number) => {
    if (editor && selectedChapterId) {
      updateChapter(projectId, selectedChapterId, { content: editor.getHTML() });
    }
    setSelectedChapterId(chapterId);
    setIsPreview(false);
  };

  const wordCount = (text: string) => {
    return text.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
  };

  const currentHTML = editor?.getHTML() || '';

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#c9a96e]/10 bg-[#1a1a2e]/90">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[#cad9e8]">正文编辑器</h1>
          {selectedChapter && (
            <span className="text-sm text-[#f5f0e8]/40 flex items-center gap-1">
              <Edit3 size={14} />
              {selectedChapter.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-xs text-[#c9a96e]/60 flex items-center gap-1">
              <Clock size={12} className="animate-pulse" />保存中...
            </span>
          )}
          {lastSaved && !saving && (
            <span className="text-xs text-[#f5f0e8]/30">
              已保存 {lastSaved}
            </span>
          )}
          {selectedChapter && (
            <>
              <span className="text-xs text-[#f5f0e8]/30 px-2 py-0.5 rounded bg-[#f5f0e8]/5">
                {wordCount(currentHTML)} 字
              </span>
              <Button
                variant={isPreview ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setIsPreview(!isPreview)}
                title={isPreview ? '切换到编辑模式' : '切换到预览模式'}
              >
                {isPreview ? <Edit3 size={14} /> : <Eye size={14} />}
                {isPreview ? '编辑' : '预览'}
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={handleManualSave} disabled={saving || !selectedChapter}>
            <Save size={14} />保存
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />新建章节
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Chapter List Sidebar */}
        <div className="w-64 border-r border-[#c9a96e]/10 bg-[#1a1a2e]/50 overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-[#c9a96e]/8">
            <p className="text-xs text-[#f5f0e8]/30 uppercase tracking-wider">章节列表</p>
          </div>
          {chapters.length === 0 ? (
            <div className="p-6 text-center">
              <FileText size={32} className="text-[#f5f0e8]/15 mx-auto mb-3" />
              <p className="text-sm text-[#f5f0e8]/30">暂无章节</p>
              <p className="text-xs text-[#f5f0e8]/20 mt-1">点击右上角新建章节</p>
            </div>
          ) : (
            <div className="py-1">
              {chapters.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${
                    selectedChapterId === chapter.id
                      ? 'bg-[#c9a96e]/15 text-[#c9a96e]'
                      : 'text-[#f5f0e8]/60 hover:bg-[#f5f0e8]/5 hover:text-[#f5f0e8]'
                  }`}
                  onClick={() => handleSelectChapter(chapter.id)}
                >
                  <ChevronRight
                    size={14}
                    className={`flex-shrink-0 transition-transform ${
                      selectedChapterId === chapter.id ? 'text-[#c9a96e]' : 'text-[#f5f0e8]/20'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {index + 1}. {chapter.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#f5f0e8]/25">
                        {chapter.wordCount || 0}字
                      </span>
                      {chapter.status === 'completed' && (
                        <span className="text-[10px] px-1 rounded bg-green-900/30 text-green-400/70">已完</span>
                      )}
                      {chapter.status === 'writing' && (
                        <span className="text-[10px] px-1 rounded bg-blue-900/30 text-blue-400/70">写作中</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chapter.id); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-[#f5f0e8]/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor / Preview Area */}
        <div className="flex-1 overflow-y-auto bg-[#0f0f1a]">
          {selectedChapter ? (
            isPreview ? (
              /* Preview Mode */
              <div className="max-w-3xl mx-auto">
                <div
                  className="tiptap prose prose-invert max-w-none min-h-[400px] px-8 py-6 text-[#f5f0e8] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: currentHTML }}
                />
              </div>
            ) : (
              /* Edit Mode */
              <div className="max-w-3xl mx-auto">
                <EditorContent editor={editor} />
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Edit3 size={48} className="text-[#f5f0e8]/10 mx-auto mb-4" />
                <p className="text-[#f5f0e8]/30 text-lg">选择一个章节开始编辑</p>
                <p className="text-[#f5f0e8]/15 text-sm mt-2">
                  或点击右上角新建章节
                </p>
                <div className="mt-6 p-4 bg-[#1a1a2e]/50 rounded-xl border border-[#c9a96e]/8 max-w-md mx-auto">
                  <p className="text-xs text-[#f5f0e8]/40 mb-2">编辑器功能</p>
                  <ul className="text-xs text-[#f5f0e8]/30 space-y-1.5 text-left">
                    <li>- 支持编辑/预览模式切换</li>
                    <li>- 支持 Markdown 快捷语法（# 标题, **粗体** 等）</li>
                    <li>- 自动保存，无需手动操作</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Chapter Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="新建章节">
        <div className="space-y-4">
          <Input
            label="章节标题"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="如：第一章 觉醒"
            onKeyDown={e => { if (e.key === 'Enter') handleCreateChapter(); }}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreateChapter} disabled={!newTitle.trim() || creating}>
              {creating ? '创建中...' : '创建章节'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}