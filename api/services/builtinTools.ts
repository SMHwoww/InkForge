/**
 * 内置 MCP 服务 — InkForge 项目数据读写工具
 *
 * 作为内置 MCP 服务，提供 AI 对项目各模块（章节、大纲、世界观、角色、星图、时间轴）的
 * 读取和修改能力。此服务始终启用，不可删除。
 */

import { getDb, saveDb } from '../db/index.js';

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

// ── 项目 ──

async function handleListProjects(): Promise<string> {
  const db = await getDb();
  const rows = db.exec('SELECT * FROM projects ORDER BY updated_at DESC');
  if (!rows.length || !rows[0].values.length) return '当前没有任何项目。';
  const projects = rows[0].values.map(v => row({
    id: v[0], title: v[1], summary: v[2], genre: v[5], status: v[6],
    createdAt: v[7], updatedAt: v[8],
  }));
  return JSON.stringify(projects, null, 2);
}

async function handleGetProject(args: { projectId: number }): Promise<string> {
  const db = await getDb();
  const rows = db.exec('SELECT * FROM projects WHERE id = ?', [args.projectId]);
  if (!rows.length || !rows[0].values.length) return `项目 ${args.projectId} 不存在。`;
  const v = rows[0].values[0];
  return JSON.stringify(row({
    id: v[0], title: v[1], summary: v[2], genre: v[5], status: v[6],
    createdAt: v[7], updatedAt: v[8],
  }), null, 2);
}

// ── 章节 ──

async function handleListChapters(args: { projectId: number }): Promise<string> {
  const db = await getDb();
  const rows = db.exec('SELECT id, title, order_num, word_count, status, created_at, updated_at FROM chapters WHERE project_id = ? ORDER BY order_num', [args.projectId]);
  if (!rows.length || !rows[0].values.length) return '该项目暂无章节。';
  const chapters = rows[0].values.map(v => row({
    id: v[0], title: v[1], orderNum: v[2], wordCount: v[3], status: v[4],
    createdAt: v[5], updatedAt: v[6],
  }));
  return JSON.stringify(chapters, null, 2);
}

async function handleGetChapter(args: { projectId: number; chapterId: number }): Promise<string> {
  const db = await getDb();
  const rows = db.exec('SELECT * FROM chapters WHERE id = ? AND project_id = ?', [args.chapterId, args.projectId]);
  if (!rows.length || !rows[0].values.length) return `章节 ${args.chapterId} 不存在。`;
  const v = rows[0].values[0];
  return JSON.stringify(row({
    id: v[0], projectId: v[1], title: v[2], content: v[3], orderNum: v[4],
    wordCount: v[5], status: v[6], createdAt: v[7], updatedAt: v[8],
  }), null, 2);
}

async function handleCreateChapter(args: { projectId: number; title: string; content: string; orderNum?: number }): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const wordCount = args.content.replace(/[#*`\-\s]/g, '').length;
  const orderNum = args.orderNum ?? 0;
  db.run(
    'INSERT INTO chapters (project_id, title, content, order_num, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [args.projectId, args.title, args.content, orderNum, wordCount, now, now],
  );
  const id = (db.exec('SELECT last_insert_rowid()')[0].values[0] as any[])[0] as number;
  saveDb();
  return JSON.stringify({ success: true, id, title: args.title, wordCount }, null, 2);
}

async function handleUpdateChapter(args: { projectId: number; chapterId: number; title?: string; content?: string }): Promise<string> {
  const db = await getDb();
  const updates: string[] = [];
  const params: any[] = [];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (args.title !== undefined) { updates.push('title = ?'); params.push(args.title); }
  if (args.content !== undefined) {
    updates.push('content = ?');
    params.push(args.content);
    const wc = args.content.replace(/[#*`\-\s]/g, '').length;
    updates.push('word_count = ?');
    params.push(wc);
  }
  if (!updates.length) return '没有需要更新的字段。';
  updates.push('updated_at = ?');
  params.push(now);
  params.push(args.chapterId, args.projectId);
  db.run(`UPDATE chapters SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`, params);
  saveDb();
  return JSON.stringify({ success: true, chapterId: args.chapterId }, null, 2);
}

// ── 大纲 ──

async function handleListOutlines(args: { projectId: number }): Promise<string> {
  const db = await getDb();
  const rows = db.exec('SELECT id, title, description, parent_id, chapter_id, sort_order, level, status FROM outline_items WHERE project_id = ? ORDER BY sort_order', [args.projectId]);
  if (!rows.length || !rows[0].values.length) return '该项目暂无大纲。';
  const outlines = rows[0].values.map(v => row({
    id: v[0], title: v[1], description: v[2], parentId: v[3], chapterId: v[4],
    sortOrder: v[5], level: v[6], status: v[7],
  }));
  return JSON.stringify(outlines, null, 2);
}

async function handleCreateOutline(args: { projectId: number; title: string; description?: string; parentId?: number; chapterId?: number; level?: number }): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lvl = args.level ?? 0;
  db.run(
    'INSERT INTO outline_items (project_id, title, description, parent_id, chapter_id, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [args.projectId, args.title, args.description || '', args.parentId || null, args.chapterId || null, lvl, now, now],
  );
  const id = (db.exec('SELECT last_insert_rowid()')[0].values[0] as any[])[0] as number;
  saveDb();
  return JSON.stringify({ success: true, id, title: args.title, level: lvl }, null, 2);
}

async function handleUpdateOutline(args: { projectId: number; outlineId: number; title?: string; description?: string }): Promise<string> {
  const db = await getDb();
  const updates: string[] = [];
  const params: any[] = [];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (args.title !== undefined) { updates.push('title = ?'); params.push(args.title); }
  if (args.description !== undefined) { updates.push('description = ?'); params.push(args.description); }
  if (!updates.length) return '没有需要更新的字段。';
  updates.push('updated_at = ?');
  params.push(now);
  params.push(args.outlineId, args.projectId);
  db.run(`UPDATE outline_items SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`, params);
  saveDb();
  return JSON.stringify({ success: true, outlineId: args.outlineId }, null, 2);
}

// ── 世界观 ──

async function handleListWorldbuilding(args: { projectId: number; category?: string }): Promise<string> {
  const db = await getDb();
  let rows;
  if (args.category) {
    rows = db.exec('SELECT id, title, category, sort_order, created_at FROM worldbuilding_items WHERE project_id = ? AND category = ? ORDER BY sort_order', [args.projectId, args.category]);
  } else {
    rows = db.exec('SELECT id, title, category, sort_order, created_at FROM worldbuilding_items WHERE project_id = ? ORDER BY sort_order', [args.projectId]);
  }
  if (!rows.length || !rows[0].values.length) return '该项目暂无世界观条目。';
  const items = rows[0].values.map(v => row({
    id: v[0], title: v[1], category: v[2], sortOrder: v[3], createdAt: v[4],
  }));
  return JSON.stringify(items, null, 2);
}

async function handleCreateWorldbuilding(args: { projectId: number; title: string; content: string; category: string }): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.run(
    'INSERT INTO worldbuilding_items (project_id, title, content, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [args.projectId, args.title, args.content, args.category, now, now],
  );
  const id = (db.exec('SELECT last_insert_rowid()')[0].values[0] as any[])[0] as number;
  saveDb();
  return JSON.stringify({ success: true, id, title: args.title, category: args.category }, null, 2);
}

async function handleUpdateWorldbuilding(args: { projectId: number; itemId: number; title?: string; content?: string; category?: string }): Promise<string> {
  const db = await getDb();
  const updates: string[] = [];
  const params: any[] = [];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (args.title !== undefined) { updates.push('title = ?'); params.push(args.title); }
  if (args.content !== undefined) { updates.push('content = ?'); params.push(args.content); }
  if (args.category !== undefined) { updates.push('category = ?'); params.push(args.category); }
  if (!updates.length) return '没有需要更新的字段。';
  updates.push('updated_at = ?');
  params.push(now);
  params.push(args.itemId, args.projectId);
  db.run(`UPDATE worldbuilding_items SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`, params);
  saveDb();
  return JSON.stringify({ success: true, itemId: args.itemId }, null, 2);
}

// ── 角色 ──

async function handleListCharacters(args: { projectId: number }): Promise<string> {
  const db = await getDb();
  const rows = db.exec('SELECT id, name, role, gender, age FROM characters WHERE project_id = ?', [args.projectId]);
  if (!rows.length || !rows[0].values.length) return '该项目暂无角色。';
  const chars = rows[0].values.map(v => row({
    id: v[0], name: v[1], role: v[2], gender: v[3], age: v[4],
  }));
  return JSON.stringify(chars, null, 2);
}

async function handleGetCharacter(args: { projectId: number; characterId: number }): Promise<string> {
  const db = await getDb();
  const rows = db.exec('SELECT * FROM characters WHERE id = ? AND project_id = ?', [args.characterId, args.projectId]);
  if (!rows.length || !rows[0].values.length) return `角色 ${args.characterId} 不存在。`;
  const v = rows[0].values[0];
  return JSON.stringify(row({
    id: v[0], projectId: v[1], name: v[2], role: v[3], gender: v[4],
    age: v[5], appearance: v[6], personality: v[7], background: v[8],
  }), null, 2);
}

async function handleCreateCharacter(args: { projectId: number; name: string; role: string; gender?: string; age?: number; appearance?: string; personality?: string; background?: string }): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.run(
    'INSERT INTO characters (project_id, name, role, gender, age, appearance, personality, background, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [args.projectId, args.name, args.role, args.gender || '', args.age || null, args.appearance || '', args.personality || '', args.background || '', now, now],
  );
  const id = (db.exec('SELECT last_insert_rowid()')[0].values[0] as any[])[0] as number;
  saveDb();
  return JSON.stringify({ success: true, id, name: args.name, role: args.role }, null, 2);
}

// ── 星图 ──

async function handleListStarchart(args: { projectId: number }): Promise<string> {
  const db = await getDb();
  const nodes = db.exec('SELECT id, entity_type, entity_id, name, x, y, color, description FROM star_map_nodes WHERE project_id = ?', [args.projectId]);
  const edges = db.exec('SELECT id, source_node_id, target_node_id, relation_type, label, description FROM star_map_edges WHERE project_id = ?', [args.projectId]);
  const nodeList = nodes.length ? nodes[0].values.map(v => row({
    id: v[0], entityType: v[1], entityId: v[2], name: v[3], x: v[4], y: v[5], color: v[6], description: v[7],
  })) : [];
  const edgeList = edges.length ? edges[0].values.map(v => row({
    id: v[0], sourceNodeId: v[1], targetNodeId: v[2], relationType: v[3], label: v[4], description: v[5],
  })) : [];
  return JSON.stringify({ nodes: nodeList, edges: edgeList }, null, 2);
}

async function handleCreateStarchartNode(args: { projectId: number; name: string; entityType: string; description?: string; entityId?: number; color?: string }): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const x = Math.random() * 200 - 100;
  const y = Math.random() * 200 - 100;
  db.run(
    'INSERT INTO star_map_nodes (project_id, entity_type, entity_id, name, x, y, color, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [args.projectId, args.entityType, args.entityId || null, args.name, x, y, args.color || '#c9a96e', args.description || '', now, now],
  );
  const id = (db.exec('SELECT last_insert_rowid()')[0].values[0] as any[])[0] as number;
  saveDb();
  return JSON.stringify({ success: true, id, name: args.name, entityType: args.entityType }, null, 2);
}

async function handleCreateStarchartEdge(args: { projectId: number; sourceNodeId: number; targetNodeId: number; relationType: string; label?: string; description?: string }): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.run(
    'INSERT INTO star_map_edges (project_id, source_node_id, target_node_id, relation_type, label, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [args.projectId, args.sourceNodeId, args.targetNodeId, args.relationType, args.label || '', args.description || '', now, now],
  );
  const id = (db.exec('SELECT last_insert_rowid()')[0].values[0] as any[])[0] as number;
  saveDb();
  return JSON.stringify({ success: true, id, relationType: args.relationType }, null, 2);
}

// ── 时间轴 ──

async function handleListTimeline(args: { projectId: number }): Promise<string> {
  const db = await getDb();
  const rows = db.exec('SELECT id, title, content, event_date, sort_order, category FROM timeline_events WHERE project_id = ? ORDER BY sort_order', [args.projectId]);
  if (!rows.length || !rows[0].values.length) return '该项目暂无时间轴事件。';
  const events = rows[0].values.map(v => row({
    id: v[0], title: v[1], content: v[2], eventDate: v[3], sortOrder: v[4], category: v[5],
  }));
  return JSON.stringify(events, null, 2);
}

async function handleCreateTimelineEvent(args: { projectId: number; title: string; content?: string; eventDate?: string; category?: string }): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const maxOrder = db.exec('SELECT COALESCE(MAX(sort_order), 0) FROM timeline_events WHERE project_id = ?', [args.projectId]);
  const sortOrder = (Number(maxOrder[0]?.values[0]?.[0]) || 0) + 1;
  db.run(
    'INSERT INTO timeline_events (project_id, title, content, event_date, sort_order, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [args.projectId, args.title, args.content || '', args.eventDate || '', sortOrder, args.category || '', now, now],
  );
  const id = (db.exec('SELECT last_insert_rowid()')[0].values[0] as any[])[0] as number;
  saveDb();
  return JSON.stringify({ success: true, id, title: args.title, sortOrder }, null, 2);
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