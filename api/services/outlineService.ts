import { getDb } from '../db/index.js';
import { outlineItems } from '../db/schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';

export interface OutlineItem {
  id: number;
  projectId: number;
  title: string;
  description: string;
  parentId: number | null;
  chapterId: number | null;
  sortOrder: number;
  level: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  children?: OutlineItem[];
}

export async function getOutlineItems(projectId: number): Promise<OutlineItem[]> {
  const db = getDb();
  const items = db
    .select()
    .from(outlineItems)
    .where(eq(outlineItems.projectId, projectId))
    .orderBy(sql`sort_order, id`)
    .all() as OutlineItem[];

  // Build tree structure
  const map = new Map<number, OutlineItem>();
  const roots: OutlineItem[] = [];

  for (const item of items) {
    item.children = [];
    map.set(item.id, item);
  }

  for (const item of items) {
    if (item.parentId != null && map.has(item.parentId)) {
      map.get(item.parentId)!.children!.push(item);
    } else {
      roots.push(item);
    }
  }

  return roots;
}

export async function createOutlineItem(
  projectId: number,
  data: { title: string; description?: string; parentId?: number | null; chapterId?: number | null; level?: number },
): Promise<OutlineItem> {
  const db = getDb();
  const parentCond = data.parentId != null ? eq(outlineItems.parentId, data.parentId) : isNull(outlineItems.parentId);
  const countResult = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(outlineItems)
    .where(and(eq(outlineItems.projectId, projectId), parentCond))
    .get();
  const nextOrder = countResult?.count ?? 0;

  return db.insert(outlineItems).values({
    projectId,
    title: data.title,
    description: data.description || '',
    parentId: data.parentId ?? null,
    chapterId: data.chapterId ?? null,
    sortOrder: nextOrder,
    level: data.level ?? 0,
  } as any).returning().get() as OutlineItem;
}

export async function updateOutlineItem(
  projectId: number,
  itemId: number,
  data: { title?: string; description?: string; parentId?: number | null; chapterId?: number | null; sortOrder?: number; level?: number; status?: string },
): Promise<OutlineItem | null> {
  const db = getDb();
  const existing = db
    .select()
    .from(outlineItems)
    .where(and(eq(outlineItems.id, itemId), eq(outlineItems.projectId, projectId)))
    .get() as OutlineItem | undefined;
  if (!existing) return null;

  const updateData: any = { updatedAt: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.chapterId !== undefined) updateData.chapterId = data.chapterId;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.level !== undefined) updateData.level = data.level;
  if (data.status !== undefined) updateData.status = data.status;

  db.update(outlineItems)
    .set(updateData)
    .where(and(eq(outlineItems.id, itemId), eq(outlineItems.projectId, projectId)))
    .run();

  return db
    .select()
    .from(outlineItems)
    .where(and(eq(outlineItems.id, itemId), eq(outlineItems.projectId, projectId)))
    .get() as OutlineItem;
}

export async function deleteOutlineItem(projectId: number, itemId: number): Promise<boolean> {
  const db = getDb();
  db.update(outlineItems)
    .set({ parentId: null } as any)
    .where(and(eq(outlineItems.parentId, itemId), eq(outlineItems.projectId, projectId)))
    .run();
  db.delete(outlineItems)
    .where(and(eq(outlineItems.id, itemId), eq(outlineItems.projectId, projectId)))
    .run();
  return true;
}

export async function reorderOutlineItems(
  projectId: number,
  items: Array<{ id: number; sortOrder: number; parentId?: number | null; level?: number }>,
): Promise<boolean> {
  const db = getDb();
  for (const item of items) {
    const updateData: any = { sortOrder: item.sortOrder, updatedAt: new Date().toISOString() };
    if (item.parentId !== undefined) updateData.parentId = item.parentId;
    if (item.level !== undefined) updateData.level = item.level;
    db.update(outlineItems)
      .set(updateData)
      .where(and(eq(outlineItems.id, item.id), eq(outlineItems.projectId, projectId)))
      .run();
  }
  return true;
}