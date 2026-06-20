import { create } from 'zustand';
import type { Project, Character, CharacterListItem, WorldbuildingItem, Chapter, OutlineItem, TimelineEvent, TimelinePerspective } from '@/types';
import { api } from '@/api/client';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  characters: CharacterListItem[];
  currentCharacter: Character | null;
  worldbuilding: WorldbuildingItem[];
  chapters: Chapter[];
  outlines: OutlineItem[];
  timelineEvents: TimelineEvent[];
  timelinePerspectives: TimelinePerspective[];
  loading: boolean;
  // projects
  fetchProjects: () => Promise<void>;
  fetchProject: (id: number) => Promise<void>;
  createProject: (data: { title: string; summary?: string; genre?: string }) => Promise<Project>;
  updateProject: (id: number, data: any) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  // characters
  fetchCharacters: (projectId: number) => Promise<void>;
  fetchCharacter: (projectId: number, charId: number) => Promise<void>;
  createCharacter: (projectId: number, data: any) => Promise<Character>;
  updateCharacter: (projectId: number, charId: number, data: any) => Promise<void>;
  deleteCharacter: (projectId: number, charId: number) => Promise<void>;
  // worldbuilding
  fetchWorldbuilding: (projectId: number, category?: string) => Promise<void>;
  createWorldbuilding: (projectId: number, data: { category: string; title: string; content: string }) => Promise<WorldbuildingItem>;
  updateWorldbuilding: (projectId: number, itemId: number, data: any) => Promise<void>;
  deleteWorldbuilding: (projectId: number, itemId: number) => Promise<void>;
  // chapters
  fetchChapters: (projectId: number) => Promise<void>;
  createChapter: (projectId: number, data: { title: string; content?: string; orderNum?: number }) => Promise<Chapter>;
  updateChapter: (projectId: number, chapterId: number, data: any) => Promise<void>;
  deleteChapter: (projectId: number, chapterId: number) => Promise<void>;
  // outlines
  fetchOutlines: (projectId: number) => Promise<void>;
  createOutline: (projectId: number, data: { title: string; description?: string; parentId?: number | null; chapterId?: number | null; level?: number }) => Promise<OutlineItem>;
  updateOutline: (projectId: number, itemId: number, data: any) => Promise<void>;
  deleteOutline: (projectId: number, itemId: number) => Promise<void>;
  // timeline
  fetchTimeline: (projectId: number) => Promise<void>;
  createTimelineEvent: (projectId: number, data: { title: string; content?: string; eventDate?: string; sortOrder?: number; category?: string; placed?: number; posX?: number; posY?: number }) => Promise<TimelineEvent>;
  updateTimelineEvent: (projectId: number, eventId: number, data: any) => Promise<void>;
  deleteTimelineEvent: (projectId: number, eventId: number) => Promise<void>;
  // timeline perspectives
  fetchPerspectives: (projectId: number) => Promise<void>;
  createPerspective: (projectId: number, data: { name: string }) => Promise<TimelinePerspective>;
  updatePerspective: (projectId: number, perspectiveId: number, data: any) => Promise<void>;
  deletePerspective: (projectId: number, perspectiveId: number) => Promise<void>;
  // timeline config
  xLabels: string[];
  fetchTimelineConfig: (projectId: number) => Promise<void>;
  updateTimelineConfig: (projectId: number, data: { xLabels: string[] }) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  characters: [],
  currentCharacter: null,
  worldbuilding: [],
  chapters: [],
  outlines: [],
  timelineEvents: [],
  timelinePerspectives: [],
  xLabels: [],
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    const projects = await api.getProjects();
    set({ projects, loading: false });
  },

  fetchProject: async (id) => {
    set({ loading: true });
    const project = await api.getProject(id);
    set({ currentProject: project, loading: false });
  },

  createProject: async (data) => {
    const project = await api.createProject(data);
    if (!project) throw new Error('创建项目失败：服务器返回空数据');
    set({ projects: [project, ...get().projects] });
    return project;
  },

  updateProject: async (id, data) => {
    const project = await api.updateProject(id, data);
    set({
      currentProject: project,
      projects: get().projects.map(p => p.id === id ? { ...p, ...project } : p),
    });
  },

  deleteProject: async (id) => {
    await api.deleteProject(id);
    set({
      projects: get().projects.filter(p => p.id !== id),
      currentProject: null,
    });
  },

  fetchCharacters: async (projectId) => {
    const characters = await api.getCharacters(projectId);
    set({ characters });
  },

  fetchCharacter: async (projectId, charId) => {
    const character = await api.getCharacter(projectId, charId);
    set({ currentCharacter: character });
  },

  createCharacter: async (projectId, data) => {
    const character = await api.createCharacter(projectId, data);
    if (!character) throw new Error('创建角色失败');
    set({ characters: [...get().characters, { id: character.id, name: character.name, role: character.role, avatarUrl: character.avatarUrl, summary: character.background }] });
    return character;
  },

  updateCharacter: async (projectId, charId, data) => {
    const character = await api.updateCharacter(projectId, charId, data);
    set({
      currentCharacter: character,
      characters: get().characters.map(c => c.id === charId ? { ...c, ...character } : c),
    });
  },

  deleteCharacter: async (projectId, charId) => {
    await api.deleteCharacter(projectId, charId);
    set({
      characters: get().characters.filter(c => c.id !== charId),
      currentCharacter: null,
    });
  },

  fetchWorldbuilding: async (projectId, category) => {
    const worldbuilding = await api.getWorldbuilding(projectId, category);
    set({ worldbuilding });
  },

  createWorldbuilding: async (projectId, data) => {
    const item = await api.createWorldbuilding(projectId, data);
    if (!item) throw new Error('创建世界观条目失败');
    set({ worldbuilding: [...get().worldbuilding, item] });
    return item;
  },

  updateWorldbuilding: async (projectId, itemId, data) => {
    const item = await api.updateWorldbuilding(projectId, itemId, data);
    set({ worldbuilding: get().worldbuilding.map(w => w.id === itemId ? item : w) });
  },

  deleteWorldbuilding: async (projectId, itemId) => {
    await api.deleteWorldbuilding(projectId, itemId);
    set({ worldbuilding: get().worldbuilding.filter(w => w.id !== itemId) });
  },

  fetchChapters: async (projectId) => {
    const chapters = await api.getChapters(projectId);
    set({ chapters });
  },

  createChapter: async (projectId, data) => {
    const chapter = await api.createChapter(projectId, data);
    if (!chapter) throw new Error('创建章节失败');
    set({ chapters: [...get().chapters, chapter] });
    return chapter;
  },

  updateChapter: async (projectId, chapterId, data) => {
    const chapter = await api.updateChapter(projectId, chapterId, data);
    set({ chapters: get().chapters.map(c => c.id === chapterId ? chapter : c) });
  },

  deleteChapter: async (projectId, chapterId) => {
    await api.deleteChapter(projectId, chapterId);
    set({ chapters: get().chapters.filter(c => c.id !== chapterId) });
  },

  fetchOutlines: async (projectId) => {
    const outlines = await api.getOutlines(projectId);
    set({ outlines });
  },

  createOutline: async (projectId, data) => {
    const outline = await api.createOutline(projectId, data);
    if (!outline) throw new Error('创建大纲条目失败');
    await get().fetchOutlines(projectId);
    return outline;
  },

  updateOutline: async (projectId, itemId, data) => {
    await api.updateOutline(projectId, itemId, data);
    await get().fetchOutlines(projectId);
  },

  deleteOutline: async (projectId, itemId) => {
    await api.deleteOutline(projectId, itemId);
    await get().fetchOutlines(projectId);
  },

  fetchTimeline: async (projectId) => {
    const timelineEvents = await api.getTimeline(projectId);
    set({ timelineEvents });
  },

  createTimelineEvent: async (projectId, data) => {
    const event = await api.createTimelineEvent(projectId, data);
    if (!event) throw new Error('创建时间轴事件失败');
    set({ timelineEvents: [...get().timelineEvents, event] });
    return event;
  },

  updateTimelineEvent: async (projectId, eventId, data) => {
    const event = await api.updateTimelineEvent(projectId, eventId, data);
    set({ timelineEvents: get().timelineEvents.map(e => e.id === eventId ? event : e) });
  },

  deleteTimelineEvent: async (projectId, eventId) => {
    await api.deleteTimelineEvent(projectId, eventId);
    set({ timelineEvents: get().timelineEvents.filter(e => e.id !== eventId) });
  },

  fetchPerspectives: async (projectId) => {
    const timelinePerspectives = await api.getPerspectives(projectId);
    set({ timelinePerspectives });
  },

  createPerspective: async (projectId, data) => {
    const perspective = await api.createPerspective(projectId, data);
    if (!perspective) throw new Error('创建视角失败');
    set({ timelinePerspectives: [...get().timelinePerspectives, perspective] });
    return perspective;
  },

  updatePerspective: async (projectId, perspectiveId, data) => {
    const perspective = await api.updatePerspective(projectId, perspectiveId, data);
    set({ timelinePerspectives: get().timelinePerspectives.map(p => p.id === perspectiveId ? perspective : p) });
  },

  deletePerspective: async (projectId, perspectiveId) => {
    await api.deletePerspective(projectId, perspectiveId);
    set({
      timelinePerspectives: get().timelinePerspectives.filter(p => p.id !== perspectiveId),
      // 同步前端状态：撤销该视角上所有已放置事件
      timelineEvents: get().timelineEvents.map(e =>
        e.posY === perspectiveId ? { ...e, placed: 0, posX: null, posY: null } : e
      ),
    });
  },

  fetchTimelineConfig: async (projectId) => {
    const config = await api.getTimelineConfig(projectId);
    if (config) set({ xLabels: config.xLabels });
  },

  updateTimelineConfig: async (projectId, data) => {
    const config = await api.updateTimelineConfig(projectId, data);
    if (config) set({ xLabels: config.xLabels });
  },
}));