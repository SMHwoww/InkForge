import { getDb } from '../db/index.js';
import { projects, characters, worldbuildingItems } from '../db/schema.js';
import { eq, sql, count } from 'drizzle-orm';

export async function getProjectList() {
  const db = getDb();
  const rows = db
    .select({
      id: projects.id,
      title: projects.title,
      summary: projects.summary,
      coverUrl: projects.coverUrl,
      genre: projects.genre,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      characterCount: sql<number>`(SELECT COUNT(*) FROM characters WHERE project_id = projects.id)`.as('character_count'),
    })
    .from(projects)
    .orderBy(sql`projects.updated_at DESC`)
    .all();
  return rows;
}

export async function getProject(id: number) {
  const db = getDb();
  const row = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!row) return null;
  const wbCount = db.select({ count: count() }).from(worldbuildingItems).where(eq(worldbuildingItems.projectId, id)).get();
  return {
    ...row,
    worldbuildingCount: wbCount?.count ?? 0,
  };
}

export async function createProject(data: { title: string; summary?: string; genre?: string }) {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.insert(projects).values({
    title: data.title,
    summary: data.summary || '',
    genre: data.genre || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
  return {
    ...result,
    characterCount: 0,
    worldbuildingCount: 0,
  };
}

export async function updateProject(id: number, data: Partial<{ title: string; summary: string; coverUrl: string; genre: string; status: string }>) {
  const db = getDb();
  const now = new Date().toISOString();
  const updateData: any = { updatedAt: now };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl;
  if (data.genre !== undefined) updateData.genre = data.genre;
  if (data.status !== undefined) updateData.status = data.status;
  db.update(projects).set(updateData).where(eq(projects.id, id)).run();
  return getProject(id);
}

export async function deleteProject(id: number) {
  const db = getDb();
  db.delete(projects).where(eq(projects.id, id)).run();
  return { success: true };
}