import { getDb } from '../db/index.js';
import { worldbuildingItems } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export async function getWorldbuildingItems(projectId: number, category?: string) {
  const db = getDb();
  if (category) {
    return db
      .select()
      .from(worldbuildingItems)
      .where(and(eq(worldbuildingItems.projectId, projectId), eq(worldbuildingItems.category, category)))
      .orderBy(sql`sort_order`)
      .all();
  }
  return db
    .select()
    .from(worldbuildingItems)
    .where(eq(worldbuildingItems.projectId, projectId))
    .orderBy(sql`sort_order`)
    .all();
}

export async function createWorldbuildingItem(projectId: number, data: {
  category: string; title: string; content: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(worldbuildingItems).values({
    projectId,
    category: data.category,
    title: data.title,
    content: data.content || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
}

export async function updateWorldbuildingItem(projectId: number, id: number, data: Partial<{
  category: string; title: string; content: string; sortOrder: number;
}>) {
  const db = getDb();
  const now = new Date().toISOString();
  const updateData: any = { updatedAt: now };
  if (data.category !== undefined) updateData.category = data.category;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  db.update(worldbuildingItems).set(updateData).where(and(eq(worldbuildingItems.projectId, projectId), eq(worldbuildingItems.id, id))).run();
  return db.select().from(worldbuildingItems).where(and(eq(worldbuildingItems.projectId, projectId), eq(worldbuildingItems.id, id))).get();
}

export async function deleteWorldbuildingItem(projectId: number, id: number) {
  const db = getDb();
  db.delete(worldbuildingItems).where(and(eq(worldbuildingItems.projectId, projectId), eq(worldbuildingItems.id, id))).run();
  return { success: true };
}