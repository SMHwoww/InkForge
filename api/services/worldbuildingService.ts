import { getDb, saveDb } from '../db/index.js';

export async function getWorldbuildingItems(projectId: number, category?: string) {
  const db = await getDb();
  let rows;
  if (category) {
    rows = db.exec(
      `SELECT * FROM worldbuilding_items WHERE project_id = ? AND category = ? ORDER BY sort_order`,
      [projectId, category],
    );
  } else {
    rows = db.exec(
      `SELECT * FROM worldbuilding_items WHERE project_id = ? ORDER BY sort_order`,
      [projectId],
    );
  }
  if (!rows.length) return [];
  return rows[0].values.map(row => ({
    id: row[0], projectId: row[1], category: row[2], title: row[3],
    content: row[4], sortOrder: row[5], createdAt: row[6], updatedAt: row[7],
  }));
}

export async function createWorldbuildingItem(projectId: number, data: {
  category: string; title: string; content: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO worldbuilding_items (project_id, category, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [projectId, data.category, data.title, data.content || '', now, now],
  );
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
  const rows = db.exec(`SELECT * FROM worldbuilding_items WHERE id = ?`, [id]);
  saveDb();
  const row = rows[0].values[0];
  return {
    id: row[0], projectId: row[1], category: row[2], title: row[3],
    content: row[4], sortOrder: row[5], createdAt: row[6], updatedAt: row[7],
  };
}

export async function updateWorldbuildingItem(id: number, data: Partial<{
  category: string; title: string; content: string; sortOrder: number;
}>) {
  const db = await getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  for (const [key, val] of Object.entries(data)) {
    const col = key === 'sortOrder' ? 'sort_order' : key;
    sets.push(`${col} = ?`);
    values.push(val);
  }
  values.push(id);
  db.run(`UPDATE worldbuilding_items SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDb();
  const rows = db.exec(`SELECT * FROM worldbuilding_items WHERE id = ?`, [id]);
  const row = rows[0].values[0];
  return {
    id: row[0], projectId: row[1], category: row[2], title: row[3],
    content: row[4], sortOrder: row[5], createdAt: row[6], updatedAt: row[7],
  };
}

export async function deleteWorldbuildingItem(id: number) {
  const db = await getDb();
  db.run('DELETE FROM worldbuilding_items WHERE id = ?', [id]);
  saveDb();
  return { success: true };
}