import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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