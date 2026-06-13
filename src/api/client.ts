import type { ApiResponse } from '@/types';

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
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
};