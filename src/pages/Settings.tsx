/**
 * 设置页面 — 简洁的 MCP 服务器配置
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, RefreshCw, Loader2, CheckCircle2, XCircle, Plug, Sparkles, Server, Wrench, Globe, Terminal, Layers, GripVertical, Eye, EyeOff, AlertTriangle, Slash, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToastStore } from '@/stores/toastStore';
import { useModuleConfigStore } from '@/stores/moduleConfigStore';
import { getBaseUrl } from '@/lib/tauri-env';

// ─── Types ──────────────────────────────────────────────────────────────────

type ServerType = 'remote' | 'local';

interface McpServerConfig {
  name: string;
  type: ServerType;
  // remote
  url?: string;
  headers?: Record<string, string>;
  // local
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // built-in
  builtin?: boolean;
  disabled?: boolean;
}

interface McpToolInfo {
  qualifiedName: string;
  serverName: string;
  name: string;
  description: string;
}

interface McpConfigData {
  enabled: boolean;
  builtinEnabled: boolean;
  builtinServerName: string;
  servers: McpServerConfig[];
  tools: McpToolInfo[];
}

interface ReloadResult {
  name: string;
  success: boolean;
  toolCount: number;
  error?: string;
  disabled?: boolean;
}

// ─── API ────────────────────────────────────────────────────────────────────

/**
 * 构建完整的 API URL
 * - 开发环境：使用相对路径 /api/...（Vite 代理到 localhost:3001）
 * - Tauri 生产环境：使用绝对路径 http://127.0.0.1:{port}/api/...（Sidecar 后端）
 */
async function apiUrl(path: string): Promise<string> {
  const base = await getBaseUrl();
  return base ? `${base}${path}` : path;
}

const BASE = '/api/mcp';

async function fetchMcpConfig(): Promise<McpConfigData> {
  const url = await apiUrl(`${BASE}/config`);
  const res = await fetch(url);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
  return json.data;
}

async function saveMcpConfig(data: { enabled: boolean; builtinEnabled: boolean; servers: McpServerConfig[] }): Promise<{ reloadResults: ReloadResult[] }> {
  const url = await apiUrl(`${BASE}/config`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
  return json.data;
}

async function reloadMcp(): Promise<{ results: ReloadResult[]; tools: McpToolInfo[] }> {
  const url = await apiUrl(`${BASE}/reload`);
  const res = await fetch(url, { method: 'POST' });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
  return json.data;
}

async function testMcpServer(cfg: McpServerConfig): Promise<{ success: boolean; toolCount: number; error?: string }> {
  const url = await apiUrl(`${BASE}/test`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
  return json.data;
}

// ─── AI Config API ──────────────────────────────────────────────────────────

const AI_BASE = '/api/config/ai';

interface AiConfigData {
  aiApiKey?: string;
  apiUrl?: string;
  modelName?: string;
  imageMethod?: string;
  imageApiKey?: string;
  imageApiUrl?: string;
  imageModel?: string;
  imageRegion?: string;
}

async function fetchAiConfig(): Promise<AiConfigData> {
  const url = await apiUrl(AI_BASE);
  const res = await fetch(url);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
  return json.data;
}

async function saveAiConfigData(data: AiConfigData): Promise<void> {
  const url = await apiUrl(AI_BASE);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
}

// ─── Add Server Modal ───────────────────────────────────────────────────────

interface AddServerModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (server: McpServerConfig) => void;
  initialData?: McpServerConfig | null;
  editIndex?: number | null;
}

function AddServerModal({ open, onClose, onAdd, initialData, editIndex }: AddServerModalProps) {
  const addToast = useToastStore(s => s.addToast);
  const [type, setType] = useState<ServerType>('remote');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [command, setCommand] = useState('npx');
  const [argsText, setArgsText] = useState('');
  const [envText, setEnvText] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; toolCount: number; error?: string } | null>(null);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setType(initialData.type);
        setName(initialData.name);
        setUrl(initialData.url || '');
        setHeadersText(Object.entries(initialData.headers || {}).map(([k, v]) => `${k}=${v}`).join('\n'));
        setCommand(initialData.command || 'npx');
        setArgsText((initialData.args || []).join(' '));
        setEnvText(Object.entries(initialData.env || {}).map(([k, v]) => `${k}=${v}`).join('\n'));
      } else {
        setType('remote');
        setName('');
        setUrl('');
        setHeadersText('');
        setCommand('npx');
        setArgsText('');
        setEnvText('');
      }
      setTestResult(null);
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleTest = async () => {
    if (!name.trim()) {
      addToast('请先填写名称', 'error');
      return;
    }
    const cfg = buildConfig();
    if (!cfg) return;

    setTesting(true);
    setTestResult(null);
    try {
      const result = await testMcpServer(cfg);
      setTestResult(result);
      addToast(result.success ? `连接成功，发现 ${result.toolCount} 个工具` : `连接失败: ${result.error}`, result.success ? 'success' : 'error');
    } catch (e: any) {
      setTestResult({ success: false, toolCount: 0, error: e.message });
      addToast(`测试失败: ${e.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const buildConfig = (): McpServerConfig | null => {
    if (!name.trim()) {
      addToast('请填写名称', 'error');
      return null;
    }

    if (type === 'remote') {
      if (!url.trim()) {
        addToast('请填写 URL', 'error');
        return null;
      }
      const headers: Record<string, string> = {};
      if (headersText.trim()) {
        headersText.split('\n').forEach(line => {
          const eqIdx = line.indexOf('=');
          if (eqIdx > 0) {
            headers[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
          }
        });
      }
      return { name: name.trim(), type: 'remote', url: url.trim(), headers };
    } else {
      if (!command.trim()) {
        addToast('请填写命令', 'error');
        return null;
      }
      const env: Record<string, string> = {};
      if (envText.trim()) {
        envText.split('\n').forEach(line => {
          const eqIdx = line.indexOf('=');
          if (eqIdx > 0) {
            env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
          }
        });
      }
      return {
        name: name.trim(),
        type: 'local',
        command: command.trim(),
        args: argsText.trim() ? argsText.trim().split(/\s+/) : [],
        env,
      };
    }
  };

  const handleSave = () => {
    const cfg = buildConfig();
    if (cfg) {
      onAdd(cfg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1e1e2e] border border-[#c9a96e]/15 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c9a96e]/10">
          <h3 className="text-base font-semibold text-[#f5f0e8]">
            {editIndex !== null ? '编辑 MCP Server' : '添加 MCP Server'}
          </h3>
          <button onClick={onClose} className="text-[#f5f0e8]/40 hover:text-[#f5f0e8] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-[#f5f0e8]/70 mb-1.5">
              名称 <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full bg-[#2a2a3e] border border-[#c9a96e]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60"
              placeholder="如: brave-search"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm text-[#f5f0e8]/70 mb-2">
              类型 <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="serverType"
                  checked={type === 'remote'}
                  onChange={() => setType('remote')}
                  className="accent-[#c9a96e]"
                />
                <Globe size={14} className="text-[#c9a96e]/60" />
                <span className="text-sm text-[#f5f0e8]/80">远程 (http/sse)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="serverType"
                  checked={type === 'local'}
                  onChange={() => setType('local')}
                  className="accent-[#c9a96e]"
                />
                <Terminal size={14} className="text-[#f5f0e8]/40" />
                <span className="text-sm text-[#f5f0e8]/60">本地 (stdio)</span>
              </label>
            </div>
          </div>

          {/* Remote fields */}
          {type === 'remote' && (
            <>
              <div>
                <label className="block text-sm text-[#f5f0e8]/70 mb-1.5">
                  URL <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full bg-[#2a2a3e] border border-[#c9a96e]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60"
                  placeholder="https://..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-[#f5f0e8]/70 mb-1.5">HTTP Header</label>
                <textarea
                  className="w-full bg-[#2a2a3e] border border-[#c9a96e]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none"
                  placeholder="NAME=VALUE&#10;Authorization=Bearer xxx"
                  rows={3}
                  value={headersText}
                  onChange={e => setHeadersText(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Local fields */}
          {type === 'local' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#f5f0e8]/70 mb-1.5">命令</label>
                  <input
                    className="w-full bg-[#2a2a3e] border border-[#c9a96e]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60"
                    placeholder="npx"
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#f5f0e8]/70 mb-1.5">参数</label>
                  <input
                    className="w-full bg-[#2a2a3e] border border-[#c9a96e]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60"
                    placeholder="-y @mcp/server"
                    value={argsText}
                    onChange={e => setArgsText(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#f5f0e8]/70 mb-1.5">环境变量</label>
                <textarea
                  className="w-full bg-[#2a2a3e] border border-[#c9a96e]/20 rounded-lg px-3.5 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 resize-none"
                  placeholder="NAME=VALUE&#10;API_KEY=xxx"
                  rows={3}
                  value={envText}
                  onChange={e => setEnvText(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Test result */}
          {testResult && (
            <div className={clsx(
              'flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
              testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
            )}>
              {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              <span>{testResult.success ? `连接成功，发现 ${testResult.toolCount} 个工具` : testResult.error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#c9a96e]/10">
          <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing}>
            <RefreshCw size={13} className={testing ? 'animate-spin' : ''} />
            {testing ? '测试中...' : '测试'}
          </Button>
          <Button size="sm" onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── MCP Config Panel ───────────────────────────────────────────────────────

function McpConfigPanel() {
  const addToast = useToastStore(s => s.addToast);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [builtinEnabled, setBuiltinEnabled] = useState(true);
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [tools, setTools] = useState<McpToolInfo[]>([]);
  const [reloadMsg, setReloadMsg] = useState<ReloadResult[] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showBuiltinWarning, setShowBuiltinWarning] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMcpConfig();
      setEnabled(data.enabled);
      setBuiltinEnabled(data.builtinEnabled);
      setServers(data.servers);
      setTools(data.tools);
    } catch (e: any) {
      addToast(`加载配置失败: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setReloadMsg(null);
      const result = await saveMcpConfig({ enabled, builtinEnabled, servers });
      setReloadMsg(result.reloadResults);
      addToast('配置已保存并热重载', 'success');
      const updated = await fetchMcpConfig();
      setTools(updated.tools);
    } catch (e: any) {
      addToast(`保存失败: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save: debounce 1.5s after last change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [enabled, builtinEnabled, servers]);

  const handleReload = async () => {
    try {
      setReloading(true);
      setReloadMsg(null);
      const result = await reloadMcp();
      setReloadMsg(result.results);
      setTools(result.tools);
      addToast('MCP 服务已重载', 'success');
    } catch (e: any) {
      addToast(`重载失败: ${e.message}`, 'error');
    } finally {
      setReloading(false);
    }
  };

  const handleAddServer = (server: McpServerConfig) => {
    if (editIndex !== null) {
      const updated = [...servers];
      updated[editIndex] = server;
      setServers(updated);
    } else {
      setServers([...servers, server]);
    }
    setShowModal(false);
    setEditIndex(null);
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
    setShowModal(true);
  };

  const handleRemove = (index: number) => {
    const server = servers[index];
    if (server.builtin) {
      addToast('内置 MCP 服务不可删除', 'info');
      return;
    }
    setServers(servers.filter((_, i) => i !== index));
  };

  const handleToggleDisabled = (idx: number) => {
    const server = servers[idx];
    if (server.builtin) {
      if (builtinEnabled) {
        setShowBuiltinWarning(true);
      } else {
        setBuiltinEnabled(true);
        addToast('内置 MCP 服务已启用', 'success');
      }
    } else {
      const updated = [...servers];
      updated[idx] = { ...updated[idx], disabled: !updated[idx].disabled };
      setServers(updated);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#c9a96e]/60" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* MCP 状态 */}
      <section>
        <h3 className="text-sm font-medium text-[#f5f0e8]/50 uppercase tracking-wider mb-4">MCP 状态</h3>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors duration-200',
                enabled ? 'bg-[#c9a96e]' : 'bg-[#f5f0e8]/15',
              )}
              onClick={() => setEnabled(!enabled)}
            >
              <div
                className={clsx(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                  enabled ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </div>
            <span className="text-sm text-[#f5f0e8]/80">{enabled ? '已启用' : '已禁用'}</span>
          </label>

          <Button variant="secondary" size="sm" onClick={handleReload} disabled={reloading}>
            <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
            {reloading ? '重载中...' : '热重载'}
          </Button>
        </div>

        {reloadMsg && reloadMsg.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {reloadMsg.map(r => (
              <div
                key={r.name}
                className={clsx(
                  'flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg',
                  r.disabled ? 'bg-[#f5f0e8]/5 text-[#f5f0e8]/30' :
                  r.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
                )}
              >
                {r.disabled ? <Slash size={14} /> : r.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span className="font-medium">{r.name}</span>
                {r.disabled ? (
                  <span className="text-[#f5f0e8]/30">- 已禁用，跳过连接</span>
                ) : r.success ? (
                  <span className="text-[#f5f0e8]/50">- {r.toolCount} 个工具</span>
                ) : (
                  <span className="text-[#f5f0e8]/50">- {r.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="border-t border-[#c9a96e]/8" />

      {/* 服务器列表 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#f5f0e8]/50 uppercase tracking-wider">MCP 服务器</h3>
          <Button variant="ghost" size="sm" onClick={() => { setEditIndex(null); setShowModal(true); }}>
            <Plus size={14} />
            添加服务器
          </Button>
        </div>

        {servers.length === 0 ? (
          <div className="text-center py-12 text-[#f5f0e8]/30 text-sm">
            <Server size={40} className="mx-auto mb-3 opacity-30" />
            暂无 MCP 服务器配置
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map((server, idx) => {
              const isDisabled = server.builtin ? !builtinEnabled : server.disabled;
              return (
              <div
                key={server.name + idx}
                className={clsx(
                  'bg-[#1a1a2e]/40 border border-[#c9a96e]/6 rounded-lg px-4 py-3 flex items-center justify-between group hover:border-[#c9a96e]/20 transition-colors',
                  server.builtin && 'border-[#c9a96e]/20',
                  isDisabled && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-3">
                  {server.builtin ? (
                    <Sparkles size={16} className="text-[#c9a96e]" />
                  ) : server.type === 'remote' ? (
                    <Plug size={16} className="text-[#c9a96e]/60" />
                  ) : (
                    <Terminal size={16} className="text-[#f5f0e8]/40" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#f5f0e8]/90">{server.name}</span>
                      {server.builtin && (
                        <span className="text-[10px] text-[#c9a96e]/50 bg-[#c9a96e]/10 px-1.5 py-0.5 rounded-full">内置</span>
                      )}
                      {isDisabled && (
                        <span className="text-[10px] text-red-400/50 bg-red-400/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Slash size={10} /> 已禁用
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#f5f0e8]/40">
                      {server.builtin ? '系统内置 MCP 服务，提供 InkForge 项目数据读写能力' :
                       server.type === 'remote' ? server.url : `${server.command} ${server.args?.join(' ') || ''}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleDisabled(idx)}
                    className={clsx(
                      'p-1.5 rounded-md transition-colors',
                      !isDisabled
                        ? 'text-[#c9a96e]/70 hover:text-[#c9a96e] hover:bg-[#c9a96e]/10'
                        : 'text-red-400/70 hover:text-red-400 hover:bg-red-400/10',
                    )}
                    title={isDisabled ? '启用' : '禁用'}
                  >
                    {isDisabled ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {!server.builtin && (
                    <>
                      <button
                        onClick={() => handleEdit(idx)}
                        className="text-[#f5f0e8]/40 hover:text-[#c9a96e] p-1.5 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Wrench size={14} />
                      </button>
                      <button
                        onClick={() => handleRemove(idx)}
                        className="text-[#f5f0e8]/40 hover:text-red-400 p-1.5 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="border-t border-[#c9a96e]/8" />

      {/* 已连接工具 */}
      <section>
        <h3 className="text-sm font-medium text-[#f5f0e8]/50 uppercase tracking-wider mb-4">
          已连接工具
          {tools.length > 0 && <span className="ml-2 text-[#c9a96e]">({tools.length})</span>}
        </h3>
        {tools.length === 0 ? (
          <div className="text-center py-8 text-[#f5f0e8]/30 text-sm">
            暂无已连接工具
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {tools.map(tool => (
              <div
                key={tool.qualifiedName}
                className="bg-[#1a1a2e]/40 border border-[#c9a96e]/6 rounded-lg px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Wrench size={13} className="text-[#c9a96e]/50 shrink-0" />
                  <span className="text-sm font-medium text-[#f5f0e8]/80">{tool.qualifiedName}</span>
                </div>
                {tool.description && (
                  <p className="text-xs text-[#f5f0e8]/40 mt-1 ml-5 truncate">{tool.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end pt-2 border-t border-[#c9a96e]/8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存并重载'}
        </Button>
      </div>

      {/* 添加/编辑弹窗 */}
      <AddServerModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditIndex(null); }}
        onAdd={handleAddServer}
        initialData={editIndex !== null ? servers[editIndex] : null}
        editIndex={editIndex}
      />

      {/* 禁用内置 MCP 服务警告 */}
      {showBuiltinWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#c9a96e]/20 rounded-xl p-6 w-96 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={24} className="text-[#c9a96e] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-[#f5f0e8]">禁用内置 MCP 服务</h3>
                <p className="text-sm text-[#f5f0e8]/50 mt-2 leading-relaxed">
                  内置 MCP 服务提供 AI 对项目数据的读取和修改能力，是 <span className="text-[#c9a96e]">InkForge AIdo 功能的核心组件</span>。
                </p>
                <div className="mt-3 p-3 rounded-lg bg-[#c9a96e]/5 border border-[#c9a96e]/10">
                  <p className="text-xs text-[#f5f0e8]/40 leading-relaxed">
                    <span className="text-red-400 font-medium">警告：</span>
                    禁用后，AI 将无法使用以下能力：
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-[#f5f0e8]/30">
                    <li>· 列出和读取项目章节、大纲、角色、世界观</li>
                    <li>· 创建、修改章节和世界观条目</li>
                    <li>· 管理星图节点和连线</li>
                    <li>· 创建时间轴事件</li>
                  </ul>
                  <p className="text-xs text-red-400/60 mt-2 leading-relaxed">
                    这将严重影响 AI 创作助手的功能完整性，可能导致 AI 无法正确理解项目上下文。
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowBuiltinWarning(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#f5f0e8]/70 hover:text-[#f5f0e8] hover:bg-[#f5f0e8]/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setBuiltinEnabled(false);
                  setShowBuiltinWarning(false);
                  addToast('内置 MCP 服务已禁用，AI 创作助手功能将受限', 'info');
                }}
                className="px-4 py-2 rounded-lg bg-red-900/30 border border-red-400/20 text-sm text-red-400 hover:bg-red-900/50 transition-colors"
              >
                确认禁用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Config Panel ────────────────────────────────────────────────────────

const IMAGE_MODELS = [
  'wan2.6-t2i',
  'wan2.7-image-pro',
  'Qwen-Image-2.0-Pro',
  'Qwen-Image-2.0',
  'Qwen-Image-Max',
  'Qwen-Image-Plus',
];

const REGIONS = ['北京', '新加坡', '弗吉尼亚'];

function AiConfigPanel() {
  const addToast = useToastStore(s => s.addToast);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [aiApiKey, setAiApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('https://api.openai.com/v1');
  const [modelName, setModelName] = useState('gpt-4o-mini');

  const [imageMethod, setImageMethod] = useState('bailian');
  const [imageApiKey, setImageApiKey] = useState('');
  const [imageApiUrl, setImageApiUrl] = useState('');
  const [imageModel, setImageModel] = useState(IMAGE_MODELS[0]);
  const [imageCustomModel, setImageCustomModel] = useState('');
  const [imageRegion, setImageRegion] = useState(REGIONS[0]);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAiConfig();
      if (data.aiApiKey) setAiApiKey(data.aiApiKey);
      if (data.apiUrl) setApiUrl(data.apiUrl);
      if (data.modelName) setModelName(data.modelName);
      if (data.imageMethod) setImageMethod(data.imageMethod);
      if (data.imageApiKey) setImageApiKey(data.imageApiKey);
      if (data.imageApiUrl) setImageApiUrl(data.imageApiUrl);
      if (data.imageModel) {
        if (IMAGE_MODELS.includes(data.imageModel)) {
          setImageModel(data.imageModel);
          setImageCustomModel('');
        } else {
          setImageModel('__custom__');
          setImageCustomModel(data.imageModel);
        }
      }
      if (data.imageRegion) setImageRegion(data.imageRegion);
    } catch (e: any) {
      addToast(`加载 AI 配置失败: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const finalModel = imageModel === '__custom__' ? imageCustomModel : imageModel;
      await saveAiConfigData({
        aiApiKey,
        apiUrl,
        modelName,
        imageMethod,
        imageApiKey,
        imageApiUrl,
        imageModel: finalModel,
        imageRegion,
      });
      addToast('AI 配置已保存', 'success');
    } catch (e: any) {
      addToast(`保存失败: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save: debounce 1.5s after last change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loading) return;
    setDirty(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave();
      setDirty(false);
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [aiApiKey, apiUrl, modelName, imageMethod, imageApiKey, imageApiUrl, imageModel, imageCustomModel, imageRegion]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#c9a96e]/60" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* AI 对话配置 */}
      <section>
        <h3 className="text-sm font-medium text-[#f5f0e8]/50 uppercase tracking-wider mb-4">AI 对话配置</h3>
        <div className="space-y-4">
          <Input
            label="AI API Key"
            type="password"
            value={aiApiKey}
            onChange={e => setAiApiKey(e.target.value)}
            placeholder={aiApiKey ? '••••••••••••••••' : '输入 API Key'}
          />
          <Input
            label="API 请求地址"
            type="text"
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
          <Input
            label="模型名称"
            type="text"
            value={modelName}
            onChange={e => setModelName(e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </div>
      </section>

      <div className="border-t border-[#c9a96e]/8" />

      {/* 图像生成配置 */}
      <section>
        <h3 className="text-sm font-medium text-[#f5f0e8]/50 uppercase tracking-wider mb-4">图像生成配置</h3>
        <div className="space-y-4">
          {/* 请求方法 */}
          <div>
            <label className="block text-sm text-[#f5f0e8]/70 mb-2">请求方法</label>
            <div className="flex gap-6">
              {[{ value: 'bailian', label: '阿里云百炼原生API' },
                { value: 'openai', label: 'OpenAI兼容接口' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageMethod"
                    checked={imageMethod === opt.value}
                    onChange={() => setImageMethod(opt.value)}
                    className="accent-[#c9a96e]"
                  />
                  <span className="text-sm text-[#f5f0e8]/80">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 生图 API Key */}
          <Input
            label="生图 API Key"
            type="password"
            value={imageApiKey}
            onChange={e => setImageApiKey(e.target.value)}
            placeholder={imageApiKey ? '••••••••••••••••' : '输入 API Key'}
          />

          {/* API 请求地址 */}
          <Input
            label="API 请求地址"
            type="text"
            value={imageApiUrl}
            onChange={e => setImageApiUrl(e.target.value)}
            placeholder="https://..."
            disabled={imageMethod !== 'openai'}
            className={clsx(imageMethod !== 'openai' && 'opacity-40')}
          />

          {/* 模型选择 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#f5f0e8]/70">模型选择</label>
            <select
              value={imageModel}
              onChange={e => setImageModel(e.target.value)}
              className="bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60 focus:ring-1 focus:ring-[#c9a96e]/30 transition-colors duration-200"
            >
              {IMAGE_MODELS.map(m => (
                <option key={m} value={m} className="bg-[#1a1a2e]">{m}</option>
              ))}
              <option value="__custom__" className="bg-[#1a1a2e]">自定义...</option>
            </select>
            {imageModel === '__custom__' && (
              <input
                type="text"
                value={imageCustomModel}
                onChange={e => setImageCustomModel(e.target.value)}
                placeholder="输入自定义模型名称..."
                className="bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/30 focus:outline-none focus:border-[#c9a96e]/60 focus:ring-1 focus:ring-[#c9a96e]/30 transition-colors duration-200"
              />
            )}
          </div>

          {/* 阿里云服务器地域 */}
          {imageMethod === 'bailian' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#f5f0e8]/70">阿里云服务器地域</label>
              <select
                value={imageRegion}
                onChange={e => setImageRegion(e.target.value)}
                className="bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5 text-[#f5f0e8] focus:outline-none focus:border-[#c9a96e]/60 focus:ring-1 focus:ring-[#c9a96e]/30 transition-colors duration-200"
              >
                {REGIONS.map(r => (
                  <option key={r} value={r} className="bg-[#1a1a2e]">{r}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end pt-2 border-t border-[#c9a96e]/8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : dirty ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  );
}

// ─── Update Config Panel ────────────────────────────────────────────────────

interface UpdateConfigData {
  checkEnabled: boolean;
  includePrerelease: boolean;
  autoDownload: boolean;
  silent: boolean;
}

async function fetchUpdateConfig(): Promise<UpdateConfigData> {
  const url = await apiUrl('/api/config/update');
  const res = await fetch(url);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
  return json.data;
}

async function saveUpdateConfigData(data: Partial<UpdateConfigData>): Promise<void> {
  const url = await apiUrl('/api/config/update');
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
}

function UpdateConfigPanel() {
  const addToast = useToastStore(s => s.addToast);
  const [loading, setLoading] = useState(true);
  const [checkEnabled, setCheckEnabled] = useState(true);
  const [includePrerelease, setIncludePrerelease] = useState(false);
  const [autoDownload, setAutoDownload] = useState(true);
  const [silent, setSilent] = useState(false);

  useEffect(() => {
    fetchUpdateConfig()
      .then(data => {
        setCheckEnabled(data.checkEnabled);
        setIncludePrerelease(data.includePrerelease);
        setAutoDownload(data.autoDownload);
        setSilent(data.silent);
      })
      .catch(e => addToast(`加载更新配置失败: ${e.message}`, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    const update = { [key]: value };
    // Optimistic update
    switch (key) {
      case 'checkEnabled': setCheckEnabled(value); break;
      case 'includePrerelease': setIncludePrerelease(value); break;
      case 'autoDownload': setAutoDownload(value); break;
      case 'silent': setSilent(value); break;
    }
    try {
      await saveUpdateConfigData(update);
    } catch (e: any) {
      addToast(`保存失败: ${e.message}`, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#c9a96e]/60" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-medium text-[#f5f0e8]/50 uppercase tracking-wider mb-4">更新设置</h3>
        <p className="text-xs text-[#f5f0e8]/30 mb-6">
          应用启动时自动通过 GitHub API 检查新版本。所有更新配置即时生效。
        </p>

        <div className="space-y-1">
          {/* 检查更新 */}
          <label className="flex items-center justify-between bg-[#1a1a2e]/40 border border-[#c9a96e]/6 rounded-lg px-4 py-3.5 cursor-pointer hover:border-[#c9a96e]/15 transition-colors">
            <div className="flex items-center gap-3">
              <RefreshCw size={17} className="text-[#f5f0e8]/40" />
              <div>
                <p className="text-sm font-medium text-[#f5f0e8]/90">检查更新</p>
                <p className="text-xs text-[#f5f0e8]/30 mt-0.5">应用启动时自动检查是否有新版本</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={checkEnabled}
              onClick={(e) => { e.preventDefault(); handleToggle('checkEnabled', !checkEnabled); }}
              className={`relative w-10 h-5 rounded-full transition-colors ${checkEnabled ? 'bg-[#c9a96e]' : 'bg-[#f5f0e8]/10'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checkEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>

          {/* 检查预发布更新 */}
          <label className="flex items-center justify-between bg-[#1a1a2e]/40 border border-[#c9a96e]/6 rounded-lg px-4 py-3.5 cursor-pointer hover:border-[#c9a96e]/15 transition-colors">
            <div className="flex items-center gap-3">
              <AlertTriangle size={17} className="text-[#f5f0e8]/40" />
              <div>
                <p className="text-sm font-medium text-[#f5f0e8]/90">检查预发布版本</p>
                <p className="text-xs text-[#f5f0e8]/30 mt-0.5">同时检查标记为预发布（pre-release）的版本</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={includePrerelease}
              onClick={(e) => { e.preventDefault(); handleToggle('includePrerelease', !includePrerelease); }}
              className={`relative w-10 h-5 rounded-full transition-colors ${includePrerelease ? 'bg-[#c9a96e]' : 'bg-[#f5f0e8]/10'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${includePrerelease ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>

          {/* 自动下载 */}
          <label className="flex items-center justify-between bg-[#1a1a2e]/40 border border-[#c9a96e]/6 rounded-lg px-4 py-3.5 cursor-pointer hover:border-[#c9a96e]/15 transition-colors">
            <div className="flex items-center gap-3">
              <Download size={17} className="text-[#f5f0e8]/40" />
              <div>
                <p className="text-sm font-medium text-[#f5f0e8]/90">自动下载</p>
                <p className="text-xs text-[#f5f0e8]/30 mt-0.5">发现新版本后自动下载安装包</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={autoDownload}
              onClick={(e) => { e.preventDefault(); handleToggle('autoDownload', !autoDownload); }}
              className={`relative w-10 h-5 rounded-full transition-colors ${autoDownload ? 'bg-[#c9a96e]' : 'bg-[#f5f0e8]/10'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoDownload ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>

          {/* 静默更新 */}
          <label className="flex items-center justify-between bg-[#1a1a2e]/40 border border-[#c9a96e]/6 rounded-lg px-4 py-3.5 cursor-pointer hover:border-[#c9a96e]/15 transition-colors">
            <div className="flex items-center gap-3">
              <Slash size={17} className="text-[#f5f0e8]/40" />
              <div>
                <p className="text-sm font-medium text-[#f5f0e8]/90">静默更新</p>
                <p className="text-xs text-[#f5f0e8]/30 mt-0.5">下载完成后不弹窗询问，直接安装更新</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={silent}
              onClick={(e) => { e.preventDefault(); handleToggle('silent', !silent); }}
              className={`relative w-10 h-5 rounded-full transition-colors ${silent ? 'bg-[#c9a96e]' : 'bg-[#f5f0e8]/10'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${silent ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>
      </section>
    </div>
  );
}

// ─── Module Config ──────────────────────────────────────────────────────────

const ALL_MODULES: { id: string; label: string }[] = [
  { id: 'ai-assistant', label: 'AI助手' },
  { id: 'chapters', label: '正文编辑' },
  { id: 'outlines', label: '大纲' },
  { id: 'characters', label: '角色' },
  { id: 'starchart', label: '星图' },
  { id: 'worldbuilding', label: '世界观' },
  { id: 'timeline', label: '时间轴' },
];

function ModulesConfigPanel() {
  const addToast = useToastStore(s => s.addToast);
  const { config, loading, fetchModuleConfig, setModuleVisible, setModuleOrder } = useModuleConfigStore();
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => { fetchModuleConfig(); }, []);

  // Derive ordered module list from config
  const orderedModules = (() => {
    const order = config.order.length > 0 ? config.order : ALL_MODULES.map(m => m.id);
    const result: { id: string; label: string; visible: boolean }[] = [];
    const seen = new Set<string>();
    for (const id of order) {
      const mod = ALL_MODULES.find(m => m.id === id);
      if (mod && !seen.has(id)) {
        seen.add(id);
        result.push({ ...mod, visible: config.visible[id] !== false });
      }
    }
    // Add any modules not in order
    for (const mod of ALL_MODULES) {
      if (!seen.has(mod.id)) {
        result.push({ ...mod, visible: config.visible[mod.id] !== false });
      }
    }
    return result;
  })();

  const handleToggle = async (moduleId: string) => {
    const current = config.visible[moduleId] !== false;
    await setModuleVisible(moduleId, !current);
    addToast(`${!current ? '显示' : '隐藏'}模块成功`, 'success');
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newOrder = [...orderedModules];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(idx, 0, moved);
    setDragIdx(idx);
    setModuleOrder(newOrder.map(m => m.id));
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#c9a96e]/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium text-[#f5f0e8]/50 uppercase tracking-wider mb-4">项目模块管理</h3>
        <p className="text-xs text-[#f5f0e8]/30 mb-4">
          控制项目侧边栏中显示的模块及其排序。隐藏的模块不会在项目导航中显示。
        </p>

        <div className="space-y-1">
          {orderedModules.map((mod, idx) => (
            <div
              key={mod.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={clsx(
                'flex items-center gap-3 bg-[#1a1a2e]/40 border border-[#c9a96e]/6 rounded-lg px-4 py-3 transition-colors',
                dragIdx === idx ? 'border-[#c9a96e]/40 bg-[#2d4a3e]/40' : 'hover:border-[#c9a96e]/20',
              )}
            >
              <button
                className="text-[#f5f0e8]/20 hover:text-[#f5f0e8]/50 cursor-grab transition-colors"
                title="拖拽排序"
              >
                <GripVertical size={16} />
              </button>
              <span className={clsx(
                'flex-1 text-sm font-medium transition-colors',
                mod.visible ? 'text-[#f5f0e8]/90' : 'text-[#f5f0e8]/30',
              )}>
                {mod.label}
              </span>
              <button
                onClick={() => handleToggle(mod.id)}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  mod.visible
                    ? 'text-[#c9a96e] hover:bg-[#c9a96e]/10'
                    : 'text-[#f5f0e8]/20 hover:text-[#f5f0e8]/40 hover:bg-[#f5f0e8]/5',
                )}
                title={mod.visible ? '点击隐藏' : '点击显示'}
              >
                {mod.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Settings Page ──────────────────────────────────────────────────────────

export default function Settings() {
  const [activeCategory, setActiveCategory] = useState<'ai' | 'mcp' | 'modules' | 'update'>('ai');

  return (
    <div className="h-full flex">
      {/* 左侧导航 */}
      <aside className="w-56 shrink-0 border-r border-[#c9a96e]/10 bg-[#1a1a2e]/40">
        <div className="px-4 py-5 border-b border-[#c9a96e]/8">
          <h2 className="text-base font-semibold text-[#f5f0e8]">设置</h2>
        </div>
        <nav className="py-3">
          <button
            onClick={() => setActiveCategory('ai')}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
              activeCategory === 'ai'
                ? 'bg-[#c9a96e]/10 text-[#c9a96e] border-r-2 border-[#c9a96e]'
                : 'text-[#f5f0e8]/60 hover:text-[#f5f0e8]/80 hover:bg-[#c9a96e]/5',
            )}
          >
            <Sparkles size={17} />
            <span>AI 配置</span>
          </button>
          <button
            onClick={() => setActiveCategory('mcp')}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
              activeCategory === 'mcp'
                ? 'bg-[#c9a96e]/10 text-[#c9a96e] border-r-2 border-[#c9a96e]'
                : 'text-[#f5f0e8]/60 hover:text-[#f5f0e8]/80 hover:bg-[#c9a96e]/5',
            )}
          >
            <Plug size={17} />
            <span>MCP 服务配置</span>
          </button>
          <button
            onClick={() => setActiveCategory('modules')}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
              activeCategory === 'modules'
                ? 'bg-[#c9a96e]/10 text-[#c9a96e] border-r-2 border-[#c9a96e]'
                : 'text-[#f5f0e8]/60 hover:text-[#f5f0e8]/80 hover:bg-[#c9a96e]/5',
            )}
          >
            <Layers size={17} />
            <span>模块管理</span>
          </button>
          <button
            onClick={() => setActiveCategory('update')}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
              activeCategory === 'update'
                ? 'bg-[#c9a96e]/10 text-[#c9a96e] border-r-2 border-[#c9a96e]'
                : 'text-[#f5f0e8]/60 hover:text-[#f5f0e8]/80 hover:bg-[#c9a96e]/5',
            )}
          >
            <Download size={17} />
            <span>更新</span>
          </button>
        </nav>
      </aside>

      {/* 右侧详情 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6">
          {activeCategory === 'ai' ? <AiConfigPanel /> : activeCategory === 'mcp' ? <McpConfigPanel /> : activeCategory === 'modules' ? <ModulesConfigPanel /> : <UpdateConfigPanel />}
        </div>
      </main>
    </div>
  );
}