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