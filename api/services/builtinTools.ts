/**
 * 内置 MCP 服务 — InkForge 项目数据读写工具
 *
 * 作为内置 MCP 服务，提供 AI 对项目各模块（章节、大纲、世界观、角色、星图、时间轴）的
 * 读取和修改能力。此服务始终启用，不可删除。
 */

import { getDb } from '../db/index.js';
import {
  projects,
  chapters,
  outlineItems,
  worldbuildingItems,
  characters,
  starMapNodes,
  starMapEdges,
  timelineEvents,
} from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BuiltinToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface OpenAIBuiltinTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const BUILTIN_TOOLS: BuiltinToolDef[] = [
  // ── 项目 ──
  {
    name: 'inkforge_list_projects',
    description: '列出所有创作项目，包含项目ID、标题、类型、状态等基本信息',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'inkforge_get_project',
    description: '获取指定项目的详细信息，包括标题、摘要、类型、状态等',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
      },
      required: ['projectId'],
    },
  },
  // ── 章节 ──
  {
    name: 'inkforge_list_chapters',
    description: '列出指定项目的所有章节，包含章节ID、标题、字数、状态等',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'inkforge_get_chapter',
    description: '获取指定章节的完整内容（正文）',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        chapterId: { type: 'number', description: '章节ID' },
      },
      required: ['projectId', 'chapterId'],
    },
  },
  {
    name: 'inkforge_create_chapter',
    description: '创建新章节。正文内容使用标准 Markdown 格式',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        title: { type: 'string', description: '章节标题' },
        content: { type: 'string', description: '章节正文内容（Markdown格式）' },
        orderNum: { type: 'number', description: '排序序号（可选，默认追加到末尾）' },
      },
      required: ['projectId', 'title', 'content'],
    },
  },
  {
    name: 'inkforge_update_chapter',
    description: '更新指定章节的标题或正文内容',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        chapterId: { type: 'number', description: '章节ID' },
        title: { type: 'string', description: '新标题（可选）' },
        content: { type: 'string', description: '新正文内容（可选，Markdown格式）' },
      },
      required: ['projectId', 'chapterId'],
    },
  },
  // ── 大纲 ──
  {
    name: 'inkforge_list_outlines',
    description: '列出指定项目的所有大纲条目，包含层级结构和描述',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'inkforge_create_outline',
    description: '创建新的大纲条目，可指定父级大纲和关联章节',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        title: { type: 'string', description: '大纲标题' },
        description: { type: 'string', description: '大纲描述（可选）' },
        parentId: { type: 'number', description: '父级大纲ID（可选，用于创建子节点）' },
        chapterId: { type: 'number', description: '关联的章节ID（可选）' },
        level: { type: 'number', description: '层级深度（0=根节点，1=子节点，默认0）' },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'inkforge_update_outline',
    description: '更新指定大纲条目的标题或描述',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        outlineId: { type: 'number', description: '大纲条目ID' },
        title: { type: 'string', description: '新标题（可选）' },
        description: { type: 'string', description: '新描述（可选）' },
      },
      required: ['projectId', 'outlineId'],
    },
  },
  // ── 世界观 ──
  {
    name: 'inkforge_list_worldbuilding',
    description: '列出指定项目的所有世界观条目，可按分类筛选',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        category: { type: 'string', description: '分类筛选（可选，如：地理、魔法、政治、宗教等）' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'inkforge_create_worldbuilding',
    description: '创建新的世界观条目。内容使用标准 Markdown 格式',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        title: { type: 'string', description: '世界观条目标题' },
        content: { type: 'string', description: '世界观详细内容（Markdown 格式，支持标题、粗体、斜体、列表等）' },
        category: { type: 'string', description: '分类（如：地理、魔法、政治、宗教、历史、文化、通用等）' },
      },
      required: ['projectId', 'title', 'content', 'category'],
    },
  },
  {
    name: 'inkforge_update_worldbuilding',
    description: '更新指定世界观条目的内容。内容使用标准 Markdown 格式',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        itemId: { type: 'number', description: '世界观条目ID' },
        title: { type: 'string', description: '新标题（可选）' },
        content: { type: 'string', description: '新内容（可选，Markdown 格式）' },
        category: { type: 'string', description: '新分类（可选）' },
      },
      required: ['projectId', 'itemId'],
    },
  },
  // ── 角色 ──
  {
    name: 'inkforge_list_characters',
    description: '列出指定项目的所有角色，包含姓名、角色定位、性别等基本信息',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'inkforge_get_character',
    description: '获取指定角色的完整详细信息，包括外貌、性格、背景故事等',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        characterId: { type: 'number', description: '角色ID' },
      },
      required: ['projectId', 'characterId'],
    },
  },
  {
    name: 'inkforge_create_character',
    description: '创建新角色，包含完整的人物设定信息',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        name: { type: 'string', description: '角色姓名' },
        role: { type: 'string', description: '角色定位（如：主角、反派、配角等）' },
        gender: { type: 'string', description: '性别（可选）' },
        age: { type: 'number', description: '年龄（可选）' },
        appearance: { type: 'string', description: '外貌描述（可选）' },
        personality: { type: 'string', description: '性格描述（可选）' },
        background: { type: 'string', description: '背景故事（可选）' },
      },
      required: ['projectId', 'name', 'role'],
    },
  },
  // ── 星图 ──
  {
    name: 'inkforge_list_starchart',
    description: '获取指定项目的星图数据，包含所有节点和连线关系',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'inkforge_create_starchart_node',
    description: '在星图中创建新节点（星辰）。节点可代表角色、世界观概念或自定义实体',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        name: { type: 'string', description: '节点名称' },
        entityType: {
          type: 'string',
          enum: ['character', 'worldbuilding', 'custom'],
          description: '实体类型：character=角色节点, worldbuilding=世界观节点, custom=自定义节点',
        },
        description: { type: 'string', description: '节点描述（可选）' },
        entityId: { type: 'number', description: '关联的角色/世界观ID（可选，仅character/worldbuilding类型时使用）' },
        color: { type: 'string', description: '节点颜色（可选，默认金色）' },
      },
      required: ['projectId', 'name', 'entityType'],
    },
  },
  {
    name: 'inkforge_create_starchart_edge',
    description: '在星图中创建节点之间的连线关系',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        sourceNodeId: { type: 'number', description: '起始节点ID' },
        targetNodeId: { type: 'number', description: '目标节点ID' },
        relationType: {
          type: 'string',
          enum: ['family', 'friend', 'love', 'enemy', 'master_student', 'colleague', 'association', 'other'],
          description: '关系类型：family=家人, friend=朋友, love=恋人, enemy=敌人, master_student=师徒, colleague=同僚, association=关联, other=其他',
        },
        label: { type: 'string', description: '关系标签（可选）' },
        description: { type: 'string', description: '关系描述（可选）' },
      },
      required: ['projectId', 'sourceNodeId', 'targetNodeId', 'relationType'],
    },
  },
  // ── 时间轴 ──
  {
    name: 'inkforge_list_timeline',
    description: '列出指定项目的所有时间轴事件，按时间顺序排列',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'inkforge_create_timeline_event',
    description: '创建新的时间轴事件。注意：时间顺序不一定是故事发展顺序',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: '项目ID' },
        title: { type: 'string', description: '事件标题' },
        content: { type: 'string', description: '事件详细描述（可选）' },
        eventDate: { type: 'string', description: '事件日期/时间标记（可选）' },
        category: { type: 'string', description: '事件分类（可选，如：重大事件、日常、转折点等）' },
      },
      required: ['projectId', 'title'],
    },
  },
];

// ─── Tool Handlers ───────────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, any>) => Promise<string>;

function row(obj: any): any {
  const clean: any = {};
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = v ?? null;
  }
  return clean;
}

function toJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

// ── 项目 ──

async function handleListProjects(): Promise<string> {
  const db = getDb();
  const rows = db.select().from(projects).orderBy(sql`updated_at DESC`).all();
  if (!rows.length) return '当前没有任何项目。';
  const list = rows.map(v => row({
    id: v.id, title: v.title, summary: v.summary, genre: v.genre, status: v.status,
    createdAt: v.createdAt, updatedAt: v.updatedAt,
  }));
  return toJson(list);
}

async function handleGetProject(args: { projectId: number }): Promise<string> {
  const db = getDb();
  const v = db.select().from(projects).where(eq(projects.id, args.projectId)).get();
  if (!v) return `项目 ${args.projectId} 不存在。`;
  return toJson(row({
    id: v.id, title: v.title, summary: v.summary, genre: v.genre, status: v.status,
    createdAt: v.createdAt, updatedAt: v.updatedAt,
  }));
}

// ── 章节 ──

async function handleListChapters(args: { projectId: number }): Promise<string> {
  const db = getDb();
  const rows = db
    .select({ id: chapters.id, title: chapters.title, orderNum: chapters.orderNum, wordCount: chapters.wordCount, status: chapters.status, createdAt: chapters.createdAt, updatedAt: chapters.updatedAt })
    .from(chapters)
    .where(eq(chapters.projectId, args.projectId))
    .orderBy(sql`order_num`)
    .all();
  if (!rows.length) return '该项目暂无章节。';
  return toJson(rows.map(v => row(v)));
}

async function handleGetChapter(args: { projectId: number; chapterId: number }): Promise<string> {
  const db = getDb();
  const v = db.select().from(chapters).where(and(eq(chapters.id, args.chapterId), eq(chapters.projectId, args.projectId))).get();
  if (!v) return `章节 ${args.chapterId} 不存在。`;
  return toJson(row(v));
}

async function handleCreateChapter(args: { projectId: number; title: string; content: string; orderNum?: number }): Promise<string> {
  const db = getDb();
  const now = new Date().toISOString();
  const wordCount = args.content.replace(/[#*`\-\s]/g, '').length;
  const result = db.insert(chapters).values({
    projectId: args.projectId,
    title: args.title,
    content: args.content,
    orderNum: args.orderNum ?? 0,
    wordCount,
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
  return toJson({ success: true, id: result.id, title: args.title, wordCount });
}

async function handleUpdateChapter(args: { projectId: number; chapterId: number; title?: string; content?: string }): Promise<string> {
  const db = getDb();
  const updateData: any = { updatedAt: new Date().toISOString() };
  if (args.title !== undefined) updateData.title = args.title;
  if (args.content !== undefined) {
    updateData.content = args.content;
    updateData.wordCount = args.content.replace(/[#*`\-\s]/g, '').length;
  }
  if (Object.keys(updateData).length === 1) return '没有需要更新的字段。';
  db.update(chapters)
    .set(updateData)
    .where(and(eq(chapters.id, args.chapterId), eq(chapters.projectId, args.projectId)))
    .run();
  return toJson({ success: true, chapterId: args.chapterId });
}

// ── 大纲 ──

async function handleListOutlines(args: { projectId: number }): Promise<string> {
  const db = getDb();
  const rows = db
    .select({ id: outlineItems.id, title: outlineItems.title, description: outlineItems.description, parentId: outlineItems.parentId, chapterId: outlineItems.chapterId, sortOrder: outlineItems.sortOrder, level: outlineItems.level, status: outlineItems.status })
    .from(outlineItems)
    .where(eq(outlineItems.projectId, args.projectId))
    .orderBy(sql`sort_order`)
    .all();
  if (!rows.length) return '该项目暂无大纲。';
  return toJson(rows.map(v => row(v)));
}

async function handleCreateOutline(args: { projectId: number; title: string; description?: string; parentId?: number; chapterId?: number; level?: number }): Promise<string> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.insert(outlineItems).values({
    projectId: args.projectId,
    title: args.title,
    description: args.description || '',
    parentId: args.parentId ?? null,
    chapterId: args.chapterId ?? null,
    level: args.level ?? 0,
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
  return toJson({ success: true, id: result.id, title: args.title, level: args.level ?? 0 });
}

async function handleUpdateOutline(args: { projectId: number; outlineId: number; title?: string; description?: string }): Promise<string> {
  const db = getDb();
  const updateData: any = { updatedAt: new Date().toISOString() };
  if (args.title !== undefined) updateData.title = args.title;
  if (args.description !== undefined) updateData.description = args.description;
  if (Object.keys(updateData).length === 1) return '没有需要更新的字段。';
  db.update(outlineItems)
    .set(updateData)
    .where(and(eq(outlineItems.id, args.outlineId), eq(outlineItems.projectId, args.projectId)))
    .run();
  return toJson({ success: true, outlineId: args.outlineId });
}

// ── 世界观 ──

async function handleListWorldbuilding(args: { projectId: number; category?: string }): Promise<string> {
  const db = getDb();
  let rows;
  if (args.category) {
    rows = db
      .select({ id: worldbuildingItems.id, title: worldbuildingItems.title, category: worldbuildingItems.category, sortOrder: worldbuildingItems.sortOrder, createdAt: worldbuildingItems.createdAt })
      .from(worldbuildingItems)
      .where(and(eq(worldbuildingItems.projectId, args.projectId), eq(worldbuildingItems.category, args.category)))
      .orderBy(sql`sort_order`)
      .all();
  } else {
    rows = db
      .select({ id: worldbuildingItems.id, title: worldbuildingItems.title, category: worldbuildingItems.category, sortOrder: worldbuildingItems.sortOrder, createdAt: worldbuildingItems.createdAt })
      .from(worldbuildingItems)
      .where(eq(worldbuildingItems.projectId, args.projectId))
      .orderBy(sql`sort_order`)
      .all();
  }
  if (!rows.length) return '该项目暂无世界观条目。';
  return toJson(rows.map(v => row(v)));
}

async function handleCreateWorldbuilding(args: { projectId: number; title: string; content: string; category: string }): Promise<string> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.insert(worldbuildingItems).values({
    projectId: args.projectId,
    title: args.title,
    content: args.content,
    category: args.category,
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
  return toJson({ success: true, id: result.id, title: args.title, category: args.category });
}

async function handleUpdateWorldbuilding(args: { projectId: number; itemId: number; title?: string; content?: string; category?: string }): Promise<string> {
  const db = getDb();
  const updateData: any = { updatedAt: new Date().toISOString() };
  if (args.title !== undefined) updateData.title = args.title;
  if (args.content !== undefined) updateData.content = args.content;
  if (args.category !== undefined) updateData.category = args.category;
  if (Object.keys(updateData).length === 1) return '没有需要更新的字段。';
  db.update(worldbuildingItems)
    .set(updateData)
    .where(and(eq(worldbuildingItems.id, args.itemId), eq(worldbuildingItems.projectId, args.projectId)))
    .run();
  return toJson({ success: true, itemId: args.itemId });
}

// ── 角色 ──

async function handleListCharacters(args: { projectId: number }): Promise<string> {
  const db = getDb();
  const rows = db
    .select({ id: characters.id, name: characters.name, role: characters.role, gender: characters.gender, age: characters.age })
    .from(characters)
    .where(eq(characters.projectId, args.projectId))
    .all();
  if (!rows.length) return '该项目暂无角色。';
  return toJson(rows.map(v => row(v)));
}

async function handleGetCharacter(args: { projectId: number; characterId: number }): Promise<string> {
  const db = getDb();
  const v = db.select().from(characters).where(and(eq(characters.id, args.characterId), eq(characters.projectId, args.projectId))).get();
  if (!v) return `角色 ${args.characterId} 不存在。`;
  return toJson(row(v));
}

async function handleCreateCharacter(args: { projectId: number; name: string; role: string; gender?: string; age?: number; appearance?: string; personality?: string; background?: string }): Promise<string> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.insert(characters).values({
    projectId: args.projectId,
    name: args.name,
    role: args.role,
    gender: args.gender || '',
    age: args.age ?? null,
    appearance: args.appearance || '',
    personality: args.personality || '',
    background: args.background || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
  return toJson({ success: true, id: result.id, name: args.name, role: args.role });
}

// ── 星图 ──

async function handleListStarchart(args: { projectId: number }): Promise<string> {
  const db = getDb();
  const nodes = db
    .select({ id: starMapNodes.id, entityType: starMapNodes.entityType, entityId: starMapNodes.entityId, name: starMapNodes.name, x: starMapNodes.x, y: starMapNodes.y, color: starMapNodes.color, description: starMapNodes.description })
    .from(starMapNodes)
    .where(eq(starMapNodes.projectId, args.projectId))
    .all();
  const edges = db
    .select({ id: starMapEdges.id, sourceNodeId: starMapEdges.sourceNodeId, targetNodeId: starMapEdges.targetNodeId, relationType: starMapEdges.relationType, label: starMapEdges.label, description: starMapEdges.description })
    .from(starMapEdges)
    .where(eq(starMapEdges.projectId, args.projectId))
    .all();
  return toJson({ nodes: nodes.map(v => row(v)), edges: edges.map(v => row(v)) });
}

async function handleCreateStarchartNode(args: { projectId: number; name: string; entityType: string; description?: string; entityId?: number; color?: string }): Promise<string> {
  const db = getDb();
  const now = new Date().toISOString();
  const x = Math.random() * 200 - 100;
  const y = Math.random() * 200 - 100;
  const result = db.insert(starMapNodes).values({
    projectId: args.projectId,
    entityType: args.entityType as any,
    entityId: args.entityId ?? null,
    name: args.name,
    x,
    y,
    color: args.color || '#c9a96e',
    description: args.description || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
  return toJson({ success: true, id: result.id, name: args.name, entityType: args.entityType });
}

async function handleCreateStarchartEdge(args: { projectId: number; sourceNodeId: number; targetNodeId: number; relationType: string; label?: string; description?: string }): Promise<string> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.insert(starMapEdges).values({
    projectId: args.projectId,
    sourceNodeId: args.sourceNodeId,
    targetNodeId: args.targetNodeId,
    relationType: args.relationType,
    label: args.label || '',
    description: args.description || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
  return toJson({ success: true, id: result.id, relationType: args.relationType });
}

// ── 时间轴 ──

async function handleListTimeline(args: { projectId: number }): Promise<string> {
  const db = getDb();
  const rows = db
    .select({ id: timelineEvents.id, title: timelineEvents.title, content: timelineEvents.content, eventDate: timelineEvents.eventDate, sortOrder: timelineEvents.sortOrder, category: timelineEvents.category })
    .from(timelineEvents)
    .where(eq(timelineEvents.projectId, args.projectId))
    .orderBy(sql`sort_order`)
    .all();
  if (!rows.length) return '该项目暂无时间轴事件。';
  return toJson(rows.map(v => row(v)));
}

async function handleCreateTimelineEvent(args: { projectId: number; title: string; content?: string; eventDate?: string; category?: string }): Promise<string> {
  const db = getDb();
  const now = new Date().toISOString();
  const maxOrder = db
    .select({ m: sql<number>`COALESCE(MAX(sort_order), 0)` })
    .from(timelineEvents)
    .where(eq(timelineEvents.projectId, args.projectId))
    .get();
  const sortOrder = (Number(maxOrder?.m) || 0) + 1;
  const result = db.insert(timelineEvents).values({
    projectId: args.projectId,
    title: args.title,
    content: args.content || '',
    eventDate: args.eventDate || '',
    sortOrder,
    category: args.category || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
  return toJson({ success: true, id: result.id, title: args.title, sortOrder });
}

// ─── Handler Map ─────────────────────────────────────────────────────────────

const HANDLERS: Record<string, ToolHandler> = {
  inkforge_list_projects: handleListProjects,
  inkforge_get_project: handleGetProject,
  inkforge_list_chapters: handleListChapters,
  inkforge_get_chapter: handleGetChapter,
  inkforge_create_chapter: handleCreateChapter,
  inkforge_update_chapter: handleUpdateChapter,
  inkforge_list_outlines: handleListOutlines,
  inkforge_create_outline: handleCreateOutline,
  inkforge_update_outline: handleUpdateOutline,
  inkforge_list_worldbuilding: handleListWorldbuilding,
  inkforge_create_worldbuilding: handleCreateWorldbuilding,
  inkforge_update_worldbuilding: handleUpdateWorldbuilding,
  inkforge_list_characters: handleListCharacters,
  inkforge_get_character: handleGetCharacter,
  inkforge_create_character: handleCreateCharacter,
  inkforge_list_starchart: handleListStarchart,
  inkforge_create_starchart_node: handleCreateStarchartNode,
  inkforge_create_starchart_edge: handleCreateStarchartEdge,
  inkforge_list_timeline: handleListTimeline,
  inkforge_create_timeline_event: handleCreateTimelineEvent,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** 内置 MCP 服务名称（固定不可修改） */
export const BUILTIN_SERVER_NAME = 'InkForge 内置工具';

/** 获取所有内置工具定义 */
export function getBuiltinToolDefs(): BuiltinToolDef[] {
  return BUILTIN_TOOLS;
}

/** 将内置工具转换为 OpenAI function calling 格式 */
export function builtinToolsToOpenAI(): OpenAIBuiltinTool[] {
  return BUILTIN_TOOLS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/** 执行内置工具调用 */
export async function executeBuiltinTool(name: string, args: Record<string, any>): Promise<string> {
  const handler = HANDLERS[name];
  if (!handler) {
    return `Error: 内置工具 "${name}" 不存在。可用工具: ${Object.keys(HANDLERS).join(', ')}`;
  }
  try {
    return await handler(args);
  } catch (e: any) {
    console.error(`[BuiltinTools] ${name} failed:`, e.message);
    return `Error: 执行 "${name}" 失败: ${e.message}`;
  }
}