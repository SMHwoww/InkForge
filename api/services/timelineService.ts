import { getDb } from '../db/index.js';
import { timelineEvents, timelinePerspectives, timelineConfig } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// ─── Events ──────────────────────────────────────────────────────────────────

export async function getTimelineEvents(projectId: number) {
  const db = getDb();
  return db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.projectId, projectId))
    .orderBy(sql`sort_order`)
    .all();
}

export async function createTimelineEvent(projectId: number, data: {
  title: string; content?: string; eventDate?: string; sortOrder?: number;
  category?: string; placed?: number; posX?: number; posY?: number;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(timelineEvents).values({
    projectId,
    title: data.title,
    content: data.content || '',
    eventDate: data.eventDate || '',
    sortOrder: data.sortOrder ?? 0,
    category: data.category || '',
    placed: data.placed ?? 0,
    posX: data.posX ?? null,
    posY: data.posY ?? null,
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
}

export async function updateTimelineEvent(projectId: number, id: number, data: Partial<{
  title: string; content: string; eventDate: string; sortOrder: number; category: string;
  placed: number; posX: number; posY: number;
}>) {
  const db = getDb();
  const now = new Date().toISOString();
  const updateData: any = { updatedAt: now };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.eventDate !== undefined) updateData.eventDate = data.eventDate;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.placed !== undefined) updateData.placed = data.placed;
  if (data.posX !== undefined) updateData.posX = data.posX;
  if (data.posY !== undefined) updateData.posY = data.posY;
  db.update(timelineEvents).set(updateData).where(and(eq(timelineEvents.projectId, projectId), eq(timelineEvents.id, id))).run();
  return db.select().from(timelineEvents).where(and(eq(timelineEvents.projectId, projectId), eq(timelineEvents.id, id))).get();
}

export async function deleteTimelineEvent(projectId: number, id: number) {
  const db = getDb();
  db.delete(timelineEvents).where(and(eq(timelineEvents.projectId, projectId), eq(timelineEvents.id, id))).run();
  return { success: true };
}

export async function reorderTimelineEvents(projectId: number, items: Array<{ id: number; sortOrder: number }>) {
  const db = getDb();
  for (const item of items) {
    db.update(timelineEvents)
      .set({ sortOrder: item.sortOrder } as any)
      .where(eq(timelineEvents.id, item.id))
      .run();
  }
  return { success: true };
}

// ─── Perspectives ────────────────────────────────────────────────────────────

export async function getPerspectives(projectId: number) {
  const db = getDb();
  return db
    .select()
    .from(timelinePerspectives)
    .where(eq(timelinePerspectives.projectId, projectId))
    .orderBy(sql`sort_order`)
    .all();
}

export async function createPerspective(projectId: number, data: { name: string; sortOrder?: number }) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(timelinePerspectives).values({
    projectId,
    name: data.name,
    sortOrder: data.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
}

export async function updatePerspective(projectId: number, id: number, data: Partial<{ name: string; sortOrder: number }>) {
  const db = getDb();
  const now = new Date().toISOString();
  const updateData: any = { updatedAt: now };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  db.update(timelinePerspectives).set(updateData).where(and(eq(timelinePerspectives.projectId, projectId), eq(timelinePerspectives.id, id))).run();
  return db.select().from(timelinePerspectives).where(and(eq(timelinePerspectives.projectId, projectId), eq(timelinePerspectives.id, id))).get();
}

export async function deletePerspective(projectId: number, id: number) {
  const db = getDb();
  db.update(timelineEvents)
    .set({ placed: 0, posX: null, posY: null } as any)
    .where(eq(timelineEvents.posY, id))
    .run();
  db.delete(timelinePerspectives).where(and(eq(timelinePerspectives.projectId, projectId), eq(timelinePerspectives.id, id))).run();
  return { success: true };
}

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_X_LABELS = '时间1,时间2,时间3,时间4,时间5,时间6,时间7,时间8,时间9,时间10';

export async function getTimelineConfig(projectId: number): Promise<{ xLabels: string[] }> {
  const db = getDb();
  const row = db
    .select({ xLabels: timelineConfig.xLabels })
    .from(timelineConfig)
    .where(eq(timelineConfig.projectId, projectId))
    .get();

  if (!row) {
    db.insert(timelineConfig).values({
      projectId,
      xLabels: DEFAULT_X_LABELS,
    } as any).run();
    return { xLabels: DEFAULT_X_LABELS.split(',') };
  }

  return { xLabels: (row.xLabels as string).split(',') };
}

export async function updateTimelineConfig(projectId: number, data: { xLabels: string[] }) {
  const db = getDb();
  const xLabels = data.xLabels.map(s => s.trim()).filter(Boolean).join(',');
  const existing = db
    .select({ id: timelineConfig.id })
    .from(timelineConfig)
    .where(eq(timelineConfig.projectId, projectId))
    .get();

  if (existing) {
    db.update(timelineConfig)
      .set({ xLabels } as any)
      .where(eq(timelineConfig.projectId, projectId))
      .run();
  } else {
    db.insert(timelineConfig).values({
      projectId,
      xLabels,
    } as any).run();
  }

  return { xLabels: xLabels.split(',') };
}