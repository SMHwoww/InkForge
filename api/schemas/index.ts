/**
 * Zod validation schemas for all API endpoints.
 * Reusable, composable schemas for request validation.
 */

import { z } from 'zod';

// ─── Common ──────────────────────────────────────────────────────────────────

export const projectIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const idParam = z.object({
  id: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const projectIdAndCharIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
  charId: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const projectIdAndItemIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
  itemId: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const projectIdAndChapterIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
  chapterId: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const projectIdAndEventIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
  eventId: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const projectIdAndNodeIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
  nodeId: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const projectIdAndEdgeIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
  edgeId: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const projectIdAndPerspectiveIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
  perspectiveId: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const projectIdAndMediaIdParam = z.object({
  projectId: z.string().min(1).pipe(z.coerce.number().int().positive()),
  id: z.string().min(1).pipe(z.coerce.number().int().positive()),
});

export const taskIdParam = z.object({
  taskId: z.string().min(1),
});

// ─── Projects ────────────────────────────────────────────────────────────────

export const createProjectBody = z.object({
  title: z.string().min(1, '项目名称不能为空'),
  summary: z.string().optional(),
  genre: z.string().optional(),
});

export const updateProjectBody = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  coverUrl: z.string().nullable().optional(),
  genre: z.string().optional(),
  status: z.enum(['draft', 'ongoing', 'completed']).optional(),
});

// ─── Characters ──────────────────────────────────────────────────────────────

export const createCharacterBody = z.object({
  name: z.string().min(1, '角色名称不能为空'),
  role: z.string().optional(),
  gender: z.string().optional(),
  age: z.number().int().positive().nullable().optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  background: z.string().optional(),
});

export const updateCharacterBody = createCharacterBody.partial().extend({
  avatarUrl: z.string().nullable().optional(),
});

// ─── Worldbuilding ───────────────────────────────────────────────────────────

export const createWorldbuildingBody = z.object({
  category: z.string().min(1, '分类不能为空'),
  title: z.string().min(1, '标题不能为空'),
  content: z.string().optional(),
});

export const updateWorldbuildingBody = z.object({
  category: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

// ─── Chapters ────────────────────────────────────────────────────────────────

export const createChapterBody = z.object({
  title: z.string().min(1, '章节标题不能为空'),
  content: z.string().optional(),
  orderNum: z.number().int().optional(),
});

export const updateChapterBody = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  orderNum: z.number().int().optional(),
  status: z.enum(['draft', 'writing', 'completed']).optional(),
});

// ─── Outlines ────────────────────────────────────────────────────────────────

export const createOutlineBody = z.object({
  title: z.string().min(1, '大纲标题不能为空'),
  description: z.string().optional(),
  parentId: z.number().int().nullable().optional(),
  chapterId: z.number().int().nullable().optional(),
  level: z.number().int().optional(),
});

export const updateOutlineBody = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  parentId: z.number().int().nullable().optional(),
  chapterId: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
  level: z.number().int().optional(),
  status: z.string().optional(),
});

export const reorderOutlinesBody = z.object({
  items: z.array(z.object({
    id: z.number().int(),
    sortOrder: z.number().int(),
    parentId: z.number().int().nullable().optional(),
    level: z.number().int().optional(),
  })),
});

// ─── Timeline ────────────────────────────────────────────────────────────────

export const createTimelineEventBody = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().optional(),
  eventDate: z.string().optional(),
  sortOrder: z.number().int().optional(),
  category: z.string().optional(),
  placed: z.number().int().optional(),
  posX: z.number().int().nullable().optional(),
  posY: z.number().int().nullable().optional(),
});

export const updateTimelineEventBody = createTimelineEventBody.partial();

export const reorderTimelineEventsBody = z.object({
  items: z.array(z.object({
    id: z.number().int(),
    sortOrder: z.number().int(),
  })),
});

export const createPerspectiveBody = z.object({
  name: z.string().min(1, '视角名称不能为空'),
});

export const updatePerspectiveBody = z.object({
  name: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateTimelineConfigBody = z.object({
  xLabels: z.array(z.string()),
});

// ─── Star Chart ──────────────────────────────────────────────────────────────

export const createNodeBody = z.object({
  entityType: z.enum(['character', 'worldbuilding', 'custom']),
  entityId: z.number().int().optional(),
  name: z.string().min(1),
  x: z.number().optional(),
  y: z.number().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
});

export const updateNodeBody = z.object({
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
});

export const createEdgeBody = z.object({
  sourceNodeId: z.number().int(),
  targetNodeId: z.number().int(),
  relationType: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
});

export const updateEdgeBody = z.object({
  relationType: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const saveRelationsBody = z.object({
  edges: z.array(z.object({
    id: z.string(),
    sourceCharId: z.string(),
    targetCharId: z.string(),
    relationType: z.string(),
    label: z.string(),
    description: z.string(),
    sourceX: z.number(),
    sourceY: z.number(),
    targetX: z.number(),
    targetY: z.number(),
  })),
});

export const saveGraphNodesBody = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    nodeType: z.string(),
    label: z.string(),
    description: z.string(),
    charId: z.number().nullable().optional(),
    posX: z.number(),
    posY: z.number(),
    styleData: z.string().optional(),
  })),
});

// ─── Chat ────────────────────────────────────────────────────────────────────

export const saveChatMessagesBody = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string().optional(),
    tool_calls: z.any().optional(),
  })),
});

// ─── Media ───────────────────────────────────────────────────────────────────

export const createMediaBody = z.object({
  name: z.string().min(1),
  type: z.enum(['image', 'video', 'audio']).optional(),
  url: z.string().min(1),
  prompt: z.string().optional(),
  source: z.enum(['upload', 'generated']).optional(),
});

export const updateMediaBody = z.object({
  name: z.string().optional(),
  prompt: z.string().optional(),
});

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiChatBody = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
  context: z.any().optional(),
});

export const generateWorldbuildingBody = z.object({
  projectId: z.number().int().optional(),
  category: z.string().min(1),
  prompt: z.string().min(1),
});

export const generateCharacterBody = z.object({
  projectId: z.number().int().optional(),
  prompt: z.string().min(1),
});

// ─── Image ───────────────────────────────────────────────────────────────────

export const generateImageBody = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  size: z.string().optional(),
  n: z.number().int().positive().optional(),
  model: z.string().optional(),
  projectId: z.number().int().optional(),
});

export const imageVariationBody = z.object({
  imageUrl: z.string().min(1),
  prompt: z.string().optional(),
});

// ─── Search ──────────────────────────────────────────────────────────────────

export const searchQuery = z.object({
  q: z.string().optional(),
  projectId: z.string().optional(),
});