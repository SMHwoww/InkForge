import { getDb, saveDb } from '../db/index.js';

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

function rowToItem(row: any[]): OutlineItem {
  return {
    id: Number(row[0]),
    projectId: Number(row[1]),
    title: String(row[2]),
    description: String(row[3]),
    parentId: row[4] != null ? Number(row[4]) : null,
    chapterId: row[5] != null ? Number(row[5]) : null,
    sortOrder: Number(row[6]),
    level: Number(row[7]),
    status: String(row[8]),
    createdAt: String(row[9]),
    updatedAt: String(row[10]),
  };
}

export async function getOutlineItems(projectId: number): Promise<OutlineItem[]> {
  const db = await getDb();
  const rows = db.exec(
    `SELECT * FROM outline_items WHERE project_id = ? ORDER BY sort_order, id`,
    [projectId],
  );
  if (!rows.length) return [];

  const items = rows[0].values.map((row: any[]) => rowToItem(row));

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
  const db = await getDb();
  // Get next sort order
  const countRows = db.exec(
    `SELECT COUNT(*) FROM outline_items WHERE project_id = ? AND parent_id IS ?`,
    [projectId, data.parentId || null],
  );
  const nextOrder = countRows[0]?.values[0]?.[0] || 0;

  db.run(
    `INSERT INTO outline_items (project_id, title, description, parent_id, chapter_id, sort_order, level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectId, data.title, data.description || '', data.parentId || null, data.chapterId || null, nextOrder, data.level || 0],
  );
  const rows = db.exec(`SELECT * FROM outline_items WHERE id = last_insert_rowid()`);
  saveDb();
  return rowToItem(rows[0].values[0]);
}

export async function updateOutlineItem(
  projectId: number,
  itemId: number,
  data: { title?: string; description?: string; parentId?: number | null; chapterId?: number | null; sortOrder?: number; level?: number; status?: string },
): Promise<OutlineItem | null> {
  const db = await getDb();
  const existingRows = db.exec(
    `SELECT * FROM outline_items WHERE id = ? AND project_id = ?`,
    [itemId, projectId],
  );
  if (!existingRows.length || !existingRows[0].values.length) return null;

  const existing = rowToItem(existingRows[0].values[0]);
  const title = data.title ?? existing.title;
  const description = data.description ?? existing.description;
  const parentId = data.parentId !== undefined ? data.parentId : existing.parentId;
  const chapterId = data.chapterId !== undefined ? data.chapterId : existing.chapterId;
  const sortOrder = data.sortOrder ?? existing.sortOrder;
  const level = data.level ?? existing.level;
  const status = data.status ?? existing.status;

  db.run(
    `UPDATE outline_items SET title = ?, description = ?, parent_id = ?, chapter_id = ?, sort_order = ?, level = ?, status = ?, updated_at = datetime('now', 'localtime') WHERE id = ? AND project_id = ?`,
    [title, description, parentId, chapterId, sortOrder, level, status, itemId, projectId],
  );
  saveDb();

  const rows = db.exec(
    `SELECT * FROM outline_items WHERE id = ? AND project_id = ?`,
    [itemId, projectId],
  );
  return rowToItem(rows[0].values[0]);
}

export async function deleteOutlineItem(projectId: number, itemId: number): Promise<boolean> {
  const db = await getDb();
  // Delete children first
  db.run(`UPDATE outline_items SET parent_id = NULL WHERE parent_id = ? AND project_id = ?`, [itemId, projectId]);
  db.run(`DELETE FROM outline_items WHERE id = ? AND project_id = ?`, [itemId, projectId]);
  saveDb();
  return true;
}

export async function reorderOutlineItems(
  projectId: number,
  items: Array<{ id: number; sortOrder: number; parentId?: number | null; level?: number }>,
): Promise<boolean> {
  const db = await getDb();
  for (const item of items) {
    const updates: string[] = ['sort_order = ?'];
    const values: any[] = [item.sortOrder];
    if (item.parentId !== undefined) {
      updates.push('parent_id = ?');
      values.push(item.parentId);
    }
    if (item.level !== undefined) {
      updates.push('level = ?');
      values.push(item.level);
    }
    updates.push("updated_at = datetime('now', 'localtime')");
    values.push(item.id, projectId);
    db.run(
      `UPDATE outline_items SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
      values,
    );
  }
  saveDb();
  return true;
}