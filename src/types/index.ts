export interface Project {
  id: number;
  title: string;
  summary: string;
  coverUrl: string | null;
  genre: string;
  status: 'draft' | 'ongoing' | 'completed';
  characterCount: number;
  worldbuildingCount?: number;
  updatedAt: string;
  createdAt?: string;
}

export interface Character {
  id: number;
  projectId: number;
  name: string;
  role: string;
  gender: string;
  age: number | null;
  appearance: string;
  personality: string;
  background: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterListItem {
  id: number;
  name: string;
  role: string;
  avatarUrl: string | null;
  summary: string;
}

export interface WorldbuildingItem {
  id: number;
  projectId: number;
  category: string;
  title: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const WorldbuildingCategories = ['地理', '历史', '势力', '魔法体系', '种族', '文化', '其他'] as const;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Chapter {
  id: number;
  projectId: number;
  title: string;
  content: string;
  orderNum: number;
  wordCount: number;
  status: 'draft' | 'writing' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface OutlineItem {
  id: number;
  projectId: number;
  title: string;
  description: string;
  parentId: number | null;
  chapterId: number | null;
  sortOrder: number;
  level: number;
  status: 'planning' | 'writing' | 'completed';
  createdAt: string;
  updatedAt: string;
  children?: OutlineItem[];
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// Star Chart types
export interface StarMapNode {
  id: number;
  entityType: 'character' | 'worldbuilding' | 'custom';
  entityId: number | null;
  name: string;
  x: number;
  y: number;
  color: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface StarMapEdge {
  id: number;
  sourceNodeId: number;
  targetNodeId: number;
  relationType: RelationType;
  label: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type RelationType = 'family' | 'friend' | 'love' | 'enemy' | 'master_student' | 'colleague' | 'association' | 'other';

export const RelationTypeLabels: Record<RelationType, string> = {
  family: '亲情',
  friend: '友情',
  love: '爱情',
  enemy: '敌对',
  master_student: '师徒',
  colleague: '同僚',
  association: '关联',
  other: '其他',
};

export const RelationTypeColors: Record<RelationType, string> = {
  family: '#e87d7d',
  friend: '#7dc9a9',
  love: '#e8a8c9',
  enemy: '#a8a8c9',
  master_student: '#c9a96e',
  colleague: '#7da8c9',
  association: '#a9c97d',
  other: '#8e8e9e',
};

export interface StarChartData {
  nodes: StarMapNode[];
  edges: StarMapEdge[];
}