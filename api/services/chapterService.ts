import { getDb } from '../db/index.js';
import { chapters } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export interface Chapter {
  id: number;
  projectId: number;
  title: string;
  content: string;
  orderNum: number;
  wordCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getChapters(projectId: number): Promise<Chapter[]> {
  const db = getDb();
  return db
    .select()
    .from(chapters)
    .where(eq(chapters.projectId, projectId))
    .orderBy(sql`order_num, id`)
    .all() as Chapter[];
}

export async function getChapter(projectId: number, chapterId: number): Promise<Chapter | null> {
  const db = getDb();
  return db
    .select()
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)))
    .get() as Chapter ?? null;
}

export async function createChapter(
  projectId: number,
  data: { title: string; content?: string; orderNum?: number },
): Promise<Chapter> {
  const db = getDb();
  const wordCount = (data.content || '').replace(/\s/g, '').length;
  return db.insert(chapters).values({
    projectId,
    title: data.title,
    content: data.content || '',
    orderNum: data.orderNum ?? 0,
    wordCount,
  } as any).returning().get() as Chapter;
}

export async function updateChapter(
  projectId: number,
  chapterId: number,
  data: { title?: string; content?: string; orderNum?: number; status?: string },
): Promise<Chapter | null> {
  const db = getDb();
  const existing = await getChapter(projectId, chapterId);
  if (!existing) return null;

  const title = data.title ?? existing.title;
  const content = data.content ?? existing.content;
  const orderNum = data.orderNum ?? existing.orderNum;
  const status = data.status ?? existing.status;
  const wordCount = content.replace(/\s/g, '').length;

  db.update(chapters)
    .set({ title, content, orderNum, wordCount, status, updatedAt: new Date().toISOString() } as any)
    .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)))
    .run();

  return getChapter(projectId, chapterId);
}

export async function deleteChapter(projectId: number, chapterId: number): Promise<boolean> {
  const db = getDb();
  db.delete(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)))
    .run();
  return true;
}