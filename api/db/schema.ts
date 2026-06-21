import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  summary: text('summary').default(''),
  coverUrl: text('cover_url'),
  genre: text('genre').default(''),
  status: text('status', { enum: ['draft', 'ongoing', 'completed'] }).default('draft'),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const characters = sqliteTable('characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role').default(''),
  gender: text('gender').default(''),
  age: integer('age'),
  appearance: text('appearance').default(''),
  personality: text('personality').default(''),
  background: text('background').default(''),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const worldbuildingItems = sqliteTable('worldbuilding_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  title: text('title').notNull(),
  content: text('content').default(''),
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const chapters = sqliteTable('chapters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').default(''),
  orderNum: integer('order_num').default(0),
  wordCount: integer('word_count').default(0),
  status: text('status', { enum: ['draft', 'writing', 'completed'] }).default('draft'),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const outlineItems = sqliteTable('outline_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').default(''),
  parentId: integer('parent_id'),
  chapterId: integer('chapter_id'),
  sortOrder: integer('sort_order').default(0),
  level: integer('level').default(0),
  status: text('status', { enum: ['planning', 'writing', 'completed'] }).default('planning'),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const starMapNodes = sqliteTable('star_map_nodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  entityType: text('entity_type', { enum: ['character', 'worldbuilding', 'custom'] }).notNull(),
  entityId: integer('entity_id'),
  name: text('name').notNull(),
  x: real('x').default(0),
  y: real('y').default(0),
  color: text('color').default('#c9a96e'),
  description: text('description').default(''),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const starMapEdges = sqliteTable('star_map_edges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sourceNodeId: integer('source_node_id').notNull().references(() => starMapNodes.id, { onDelete: 'cascade' }),
  targetNodeId: integer('target_node_id').notNull().references(() => starMapNodes.id, { onDelete: 'cascade' }),
  relationType: text('relation_type', { enum: ['family', 'friend', 'love', 'enemy', 'master_student', 'colleague', 'association', 'other'] }).default('other'),
  label: text('label').default(''),
  description: text('description').default(''),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const timelineEvents = sqliteTable('timeline_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').default(''),
  eventDate: text('event_date').default(''),
  sortOrder: integer('sort_order').default(0),
  category: text('category').default(''),
  placed: integer('placed').default(0),
  posX: integer('pos_x'),
  posY: integer('pos_y'),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const timelinePerspectives = sqliteTable('timeline_perspectives', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});

export const timelineConfig = sqliteTable('timeline_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  xLabels: text('x_labels').notNull(),
});

export const imageGenerations = sqliteTable('image_generations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull(),
  prompt: text('prompt').notNull(),
  negativePrompt: text('negative_prompt'),
  model: text('model').default('wan2.6-t2i'),
  size: text('size').default('1280*1280'),
  images: text('images'),
  taskId: text('task_id'),
  status: text('status').default('pending'),
  createdAt: text('created_at').default(''),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  toolCalls: text('tool_calls'),
  createdAt: text('created_at').default(''),
});

export const mediaAssets = sqliteTable('media_assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['image', 'video', 'audio'] }).notNull().default('image'),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  prompt: text('prompt').default(''),
  source: text('source', { enum: ['upload', 'generated'] }).default('upload'),
  createdAt: text('created_at').default(''),
});

export const relationEdges = sqliteTable('relation_edges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sourceCharId: integer('source_char_id').notNull(),
  targetCharId: integer('target_char_id').notNull(),
  relationType: text('relation_type').default(''),
  label: text('label').default(''),
  description: text('description').default(''),
  sourceX: real('source_x').default(0),
  sourceY: real('source_y').default(0),
  targetX: real('target_x').default(0),
  targetY: real('target_y').default(0),
});

export const graphNodes = sqliteTable('graph_nodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  nodeType: text('node_type').default(''),
  label: text('label').default(''),
  description: text('description').default(''),
  charId: integer('char_id'),
  posX: real('pos_x').default(0),
  posY: real('pos_y').default(0),
  styleData: text('style_data').default('{}'),
  createdAt: text('created_at').default(''),
  updatedAt: text('updated_at').default(''),
});