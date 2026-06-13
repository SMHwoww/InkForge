import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, Save, User } from 'lucide-react';

export default function CharacterDetail() {
  const { id, charId } = useParams<{ id: string; charId: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { currentCharacter, fetchCharacter, updateCharacter } = useProjectStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '', role: '', gender: '', age: '',
    appearance: '', personality: '', background: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projectId && charId) {
      fetchCharacter(projectId, Number(charId));
    }
  }, [projectId, charId]);

  useEffect(() => {
    if (currentCharacter) {
      setForm({
        name: currentCharacter.name || '',
        role: currentCharacter.role || '',
        gender: currentCharacter.gender || '',
        age: currentCharacter.age?.toString() || '',
        appearance: currentCharacter.appearance || '',
        personality: currentCharacter.personality || '',
        background: currentCharacter.background || '',
      });
    }
  }, [currentCharacter]);

  const handleSave = async () => {
    setSaving(true);
    await updateCharacter(projectId, Number(charId), {
      ...form,
      age: form.age ? Number(form.age) : null,
    });
    setEditing(false);
    setSaving(false);
  };

  if (!currentCharacter) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse text-[#f5f0e8]/40">加载中...</div>
      </div>
    );
  }

  const fields = [
    { label: '姓名', key: 'name', value: currentCharacter.name },
    { label: '身份', key: 'role', value: currentCharacter.role || '未设定' },
    { label: '性别', key: 'gender', value: currentCharacter.gender || '未设定' },
    { label: '年龄', key: 'age', value: currentCharacter.age?.toString() || '未设定' },
    { label: '外貌', key: 'appearance', value: currentCharacter.appearance || '未设定', full: true },
    { label: '性格', key: 'personality', value: currentCharacter.personality || '未设定', full: true },
    { label: '背景', key: 'background', value: currentCharacter.background || '未设定', full: true },
  ];

  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() => navigate(`/projects/${projectId}/characters`)}
        className="flex items-center gap-2 text-[#f5f0e8]/50 hover:text-[#f5f0e8] mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        <span className="text-sm">返回角色列表</span>
      </button>

      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#c9a96e]/40 to-[#2d4a3e] flex items-center justify-center text-[#c9a96e] text-3xl font-bold shrink-0">
          {currentCharacter.name[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-[#f5f0e8]">{currentCharacter.name}</h1>
            <span className="text-sm px-2 py-0.5 rounded-full bg-[#c9a96e]/15 text-[#c9a96e]">
              {currentCharacter.role || '未设定'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#f5f0e8]/40">
            <span>{currentCharacter.gender || '未设定性别'}</span>
            {currentCharacter.age && <span>{currentCharacter.age} 岁</span>}
          </div>
        </div>
        <Button onClick={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
          {editing ? (
            <><Save size={16} />{saving ? '保存中...' : '保存'}</>
          ) : '编辑'}
        </Button>
      </div>

      <div className="space-y-6">
        {fields.map(field => (
          <div key={field.key} className="bg-[#2d4a3e]/40 rounded-xl p-5 border border-[#c9a96e]/8">
            <h3 className="text-sm font-medium text-[#c9a96e] mb-3">{field.label}</h3>
            {editing ? (
              field.full ? (
                <textarea
                  className="w-full bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60 resize-none h-28"
                  value={form[field.key as keyof typeof form] || ''}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                />
              ) : (
                <Input
                  value={form[field.key as keyof typeof form] || ''}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                />
              )
            ) : (
              <p className="text-[#f5f0e8]/70 leading-relaxed whitespace-pre-wrap">{field.value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}