import type { ApiResponse } from '@/types';
import { isTauri, getBaseUrl } from '@/lib/tauri-env';

let BASE_URL = '/api';
let _initialized = false;

/**
 * 初始化 API 客户端基础地址
 * - 开发环境：使用 Vite 代理的相对路径 /api
 * - Tauri 生产环境：启动 Sidecar 后使用 http://127.0.0.1:{port}/api
 */
async function initBaseUrl(): Promise<void> {
  if (_initialized) return;
  const baseUrl = await getBaseUrl();
  BASE_URL = baseUrl ? `${baseUrl}/api` : '/api';
  _initialized = true;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  await initBaseUrl();
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json: ApiResponse<T> = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message || '请求失败');
  }
  return json.data;
}

export const api = {
  getProjects: () => request<any[]>('/projects'),
  getProject: (id: number) => request<any>(`/projects/${id}`),
  createProject: (data: { title: string; summary?: string; genre?: string }) =>
    request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number, data: any) =>
    request<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number) =>
    request<any>(`/projects/${id}`, { method: 'DELETE' }),

  getCharacters: (projectId: number) =>
    request<any[]>(`/projects/${projectId}/characters`),
  getCharacter: (projectId: number, charId: number) =>
    request<any>(`/projects/${projectId}/characters/${charId}`),
  createCharacter: (projectId: number, data: any) =>
    request<any>(`/projects/${projectId}/characters`, { method: 'POST', body: JSON.stringify(data) }),
  updateCharacter: (projectId: number, charId: number, data: any) =>
    request<any>(`/projects/${projectId}/characters/${charId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCharacter: (projectId: number, charId: number) =>
    request<any>(`/projects/${projectId}/characters/${charId}`, { method: 'DELETE' }),

  getWorldbuilding: (projectId: number, category?: string) => {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return request<any[]>(`/projects/${projectId}/worldbuilding${query}`);
  },
  createWorldbuilding: (projectId: number, data: { category: string; title: string; content: string }) =>
    request<any>(`/projects/${projectId}/worldbuilding`, { method: 'POST', body: JSON.stringify(data) }),
  updateWorldbuilding: (projectId: number, itemId: number, data: any) =>
    request<any>(`/projects/${projectId}/worldbuilding/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorldbuilding: (projectId: number, itemId: number) =>
    request<any>(`/projects/${projectId}/worldbuilding/${itemId}`, { method: 'DELETE' }),

  getChapters: (projectId: number) =>
    request<any[]>(`/projects/${projectId}/chapters`),
  getChapter: (projectId: number, chapterId: number) =>
    request<any>(`/projects/${projectId}/chapters/${chapterId}`),
  createChapter: (projectId: number, data: { title: string; content?: string; orderNum?: number }) =>
    request<any>(`/projects/${projectId}/chapters`, { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (projectId: number, chapterId: number, data: any) =>
    request<any>(`/projects/${projectId}/chapters/${chapterId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChapter: (projectId: number, chapterId: number) =>
    request<any>(`/projects/${projectId}/chapters/${chapterId}`, { method: 'DELETE' }),

  getOutlines: (projectId: number) =>
    request<any[]>(`/projects/${projectId}/outlines`),
  createOutline: (projectId: number, data: { title: string; description?: string; parentId?: number | null; chapterId?: number | null; level?: number }) =>
    request<any>(`/projects/${projectId}/outlines`, { method: 'POST', body: JSON.stringify(data) }),
  updateOutline: (projectId: number, itemId: number, data: any) =>
    request<any>(`/projects/${projectId}/outlines/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOutline: (projectId: number, itemId: number) =>
    request<any>(`/projects/${projectId}/outlines/${itemId}`, { method: 'DELETE' }),
  reorderOutlines: (projectId: number, items: Array<{ id: number; sortOrder: number; parentId?: number | null; level?: number }>) =>
    request<any>(`/projects/${projectId}/outlines/reorder/batch`, { method: 'PUT', body: JSON.stringify({ items }) }),

  generateWorldbuilding: (projectId: number, category: string, prompt: string) =>
    request<any>('/ai/generate-worldbuilding', { method: 'POST', body: JSON.stringify({ projectId, category, prompt }) }),
  generateCharacter: (projectId: number, prompt: string) =>
    request<any>('/ai/generate-character', { method: 'POST', body: JSON.stringify({ projectId, prompt }) }),

  // Star Chart
  getStarChart: (projectId: number) =>
    request<any>(`/projects/${projectId}/starchart`),
  saveStarChart: (projectId: number, data: { nodes: any[]; edges: any[] }) =>
    request<any>(`/projects/${projectId}/starchart`, { method: 'PUT', body: JSON.stringify(data) }),
  createStarNode: (projectId: number, data: { entityType: string; entityId?: number; name: string; x?: number; y?: number; color?: string; description?: string }) =>
    request<any>(`/projects/${projectId}/starchart/nodes`, { method: 'POST', body: JSON.stringify(data) }),
  updateStarNode: (projectId: number, nodeId: number, data: any) =>
    request<any>(`/projects/${projectId}/starchart/nodes/${nodeId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStarNode: (projectId: number, nodeId: number) =>
    request<any>(`/projects/${projectId}/starchart/nodes/${nodeId}`, { method: 'DELETE' }),
  createStarEdge: (projectId: number, data: { sourceNodeId: number; targetNodeId: number; relationType?: string; label?: string; description?: string }) =>
    request<any>(`/projects/${projectId}/starchart/edges`, { method: 'POST', body: JSON.stringify(data) }),
  updateStarEdge: (projectId: number, edgeId: number, data: any) =>
    request<any>(`/projects/${projectId}/starchart/edges/${edgeId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStarEdge: (projectId: number, edgeId: number) =>
    request<any>(`/projects/${projectId}/starchart/edges/${edgeId}`, { method: 'DELETE' }),

  // Timeline
  getTimeline: (projectId: number) =>
    request<any[]>(`/projects/${projectId}/timeline`),
  createTimelineEvent: (projectId: number, data: { title: string; content?: string; eventDate?: string; sortOrder?: number; category?: string; placed?: number; posX?: number; posY?: number }) =>
    request<any>(`/projects/${projectId}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
  updateTimelineEvent: (projectId: number, eventId: number, data: any) =>
    request<any>(`/projects/${projectId}/timeline/${eventId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTimelineEvent: (projectId: number, eventId: number) =>
    request<any>(`/projects/${projectId}/timeline/${eventId}`, { method: 'DELETE' }),
  reorderTimelineEvents: (projectId: number, items: Array<{ id: number; sortOrder: number }>) =>
    request<any>(`/projects/${projectId}/timeline/reorder/batch`, { method: 'PUT', body: JSON.stringify({ items }) }),

  // Timeline Perspectives
  getPerspectives: (projectId: number) =>
    request<any[]>(`/projects/${projectId}/timeline/perspectives`),
  createPerspective: (projectId: number, data: { name: string }) =>
    request<any>(`/projects/${projectId}/timeline/perspectives`, { method: 'POST', body: JSON.stringify(data) }),
  updatePerspective: (projectId: number, perspectiveId: number, data: any) =>
    request<any>(`/projects/${projectId}/timeline/perspectives/${perspectiveId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePerspective: (projectId: number, perspectiveId: number) =>
    request<any>(`/projects/${projectId}/timeline/perspectives/${perspectiveId}`, { method: 'DELETE' }),

  // Timeline Config
  getTimelineConfig: (projectId: number) =>
    request<{ xLabels: string[] }>(`/projects/${projectId}/timeline/config`),
  updateTimelineConfig: (projectId: number, data: { xLabels: string[] }) =>
    request<{ xLabels: string[] }>(`/projects/${projectId}/timeline/config`, { method: 'PUT', body: JSON.stringify(data) }),

  // MCP Config
  getMcpConfig: () =>
    request<any>('/mcp/config'),
  saveMcpConfig: (data: { enabled: boolean; servers: any[] }) =>
    request<any>('/mcp/config', { method: 'PUT', body: JSON.stringify(data) }),
  reloadMcp: () =>
    request<any>('/mcp/reload', { method: 'POST' }),

  // Global Config
  getConfig: () => request<any>('/config'),
  saveConfig: (data: any) => request<any>('/config', { method: 'PUT', body: JSON.stringify(data) }),

  // AI Config
  getAiConfig: () => request<any>('/config/ai'),
  saveAiConfig: (data: any) => request<any>('/config/ai', { method: 'PUT', body: JSON.stringify(data) }),

  // Module Config
  getModuleConfig: () => request<{ visible: Record<string, boolean>; order: string[] }>('/config/modules'),
  saveModuleConfig: (data: { visible?: Record<string, boolean>; order?: string[] }) =>
    request<any>('/config/modules', { method: 'PUT', body: JSON.stringify(data) }),

  // Update Config
  getUpdateConfig: () => request<{ checkEnabled: boolean; includePrerelease: boolean; autoDownload: boolean; silent: boolean }>('/config/update'),
  saveUpdateConfig: (data: { checkEnabled?: boolean; includePrerelease?: boolean; autoDownload?: boolean; silent?: boolean }) =>
    request<any>('/config/update', { method: 'PUT', body: JSON.stringify(data) }),

  // Chat History
  getChatMessages: (projectId: number) =>
    request<any[]>(`/chat/${projectId}`),
  saveChatMessages: (projectId: number, messages: { role: string; content: string; tool_calls?: any[] }[]) =>
    request<any>(`/chat/${projectId}`, { method: 'POST', body: JSON.stringify({ messages }) }),
  deleteChatMessages: (projectId: number) =>
    request<any>(`/chat/${projectId}`, { method: 'DELETE' }),

  // Image Generation (真珠)
  generateImage: (data: {
    prompt: string;
    negativePrompt?: string;
    size?: string;
    n?: number;
    model?: string;
    projectId?: number;
  }) =>
    request<any>('/image/generate', { method: 'POST', body: JSON.stringify(data) }),
  getImageTask: (taskId: string) =>
    request<any>(`/image/task/${taskId}`),
  createImageVariation: (data: { imageUrl: string; prompt?: string }) =>
    request<any>('/image/variation', { method: 'POST', body: JSON.stringify(data) }),
};