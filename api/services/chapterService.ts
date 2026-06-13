import { getDb, saveDb } from '../db/index.js';

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
  const db = await getDb();
  const rows = db.exec(
    `SELECT * FROM chapters WHERE project_id = ? ORDER BY order_num, id`,
    [projectId],
  );
  if (!rows.length) return [];
  return rows[0].values.map((row: any[]) => ({
    id: Number(row[0]),
    projectId: Number(row[1]),
    title: String(row[2]),
    content: String(row[3]),
    orderNum: Number(row[4]),
    wordCount: Number(row[5]),
    status: String(row[6]),
    createdAt: String(row[7]),
    updatedAt: String(row[8]),
  }));
}

export async function getChapter(projectId: number, chapterId: number): Promise<Chapter | null> {
  const db = await getDb();
  const rows = db.exec(
    `SELECT * FROM chapters WHERE id = ? AND project_id = ?`,
    [chapterId, projectId],
  );
  if (!rows.length || !rows[0].values.length) return null;
  const row = rows[0].values[0];
  return {
    id: Number(row[0]), projectId: Number(row[1]), title: String(row[2]), content: String(row[3]),
    orderNum: Number(row[4]), wordCount: Number(row[5]), status: String(row[6]),
    createdAt: String(row[7]), updatedAt: String(row[8]),
  };
}

export async function createChapter(
  projectId: number,
  data: { title: string; content?: string; orderNum?: number },
): Promise<Chapter> {
  const db = await getDb();
  const orderNum = data.orderNum ?? 0;
  const wordCount = (data.content || '').replace(/\s/g, '').length;
  db.run(
    `INSERT INTO chapters (project_id, title, content, order_num, word_count) VALUES (?, ?, ?, ?, ?)`,
    [projectId, data.title, data.content || '', orderNum, wordCount],
  );
  const rows = db.exec(
    `SELECT * FROM chapters WHERE id = last_insert_rowid()`,
  );
  saveDb();
  const row = rows[0].values[0];
  return {
    id: Number(row[0]), projectId: Number(row[1]), title: String(row[2]), content: String(row[3]),
    orderNum: Number(row[4]), wordCount: Number(row[5]), status: String(row[6]),
    createdAt: String(row[7]), updatedAt: String(row[8]),
  };
}

export async function updateChapter(
  projectId: number,
  chapterId: number,
  data: { title?: string; content?: string; orderNum?: number; status?: string },
): Promise<Chapter | null> {
  const db = await getDb();
  const existing = await getChapter(projectId, chapterId);
  if (!existing) return null;

  const title = data.title ?? existing.title;
  const content = data.content ?? existing.content;
  const orderNum = data.orderNum ?? existing.orderNum;
  const status = data.status ?? existing.status;
  const wordCount = content.replace(/\s/g, '').length;

  db.run(
    `UPDATE chapters SET title = ?, content = ?, order_num = ?, word_count = ?, status = ?, updated_at = datetime('now', 'localtime') WHERE id = ? AND project_id = ?`,
    [title, content, orderNum, wordCount, status, chapterId, projectId],
  );
  saveDb();
  return getChapter(projectId, chapterId);
}

export async function deleteChapter(projectId: number, chapterId: number): Promise<boolean> {
  const db = await getDb();
  db.run(`DELETE FROM chapters WHERE id = ? AND project_id = ?`, [chapterId, projectId]);
  saveDb();
  return true;
}