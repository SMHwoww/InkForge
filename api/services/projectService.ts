import { getDb, saveDb } from '../db/index.js';

export async function getProjectList() {
  const db = await getDb();
  const rows = db.exec(`
    SELECT p.*, (SELECT COUNT(*) FROM characters WHERE project_id = p.id) as character_count
    FROM projects p ORDER BY p.updated_at DESC
  `);
  if (!rows.length) return [];
  return rows[0].values.map(row => ({
    id: row[0],
    title: row[1],
    summary: row[2],
    coverUrl: row[3],
    genre: row[4],
    status: row[5],
    characterCount: row[8],
    createdAt: row[6],
    updatedAt: row[7],
  }));
}

export async function getProject(id: number) {
  const db = await getDb();
  const rows = db.exec(`SELECT * FROM projects WHERE id = ?`, [id]);
  if (!rows.length || !rows[0].values.length) return null;
  const row = rows[0].values[0];
  const wbCount = db.exec(`SELECT COUNT(*) FROM worldbuilding_items WHERE project_id = ?`, [id]);
  const wbTotal = wbCount[0]?.values[0]?.[0] || 0;
  return {
    id: row[0], title: row[1], summary: row[2], coverUrl: row[3],
    genre: row[4], status: row[5], createdAt: row[6], updatedAt: row[7],
    worldbuildingCount: wbTotal,
  };
}

export async function createProject(data: { title: string; summary?: string; genre?: string }) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO projects (title, summary, genre, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [data.title, data.summary || '', data.genre || '', now, now],
  );
  saveDb();
  const rows = db.exec(`SELECT *, (SELECT COUNT(*) FROM characters WHERE project_id = last_insert_rowid()) as character_count FROM projects WHERE id = last_insert_rowid()`);
  if (!rows.length || !rows[0].values.length) return null;
  const row = rows[0].values[0];
  return {
    id: row[0], title: row[1], summary: row[2], coverUrl: row[3],
    genre: row[4], status: row[5], createdAt: row[6], updatedAt: row[7],
    characterCount: row[8], worldbuildingCount: 0,
  };
}

export async function updateProject(id: number, data: Partial<{ title: string; summary: string; coverUrl: string; genre: string; status: string }>) {
  const db = await getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  for (const [key, val] of Object.entries(data)) {
    const col = key === 'coverUrl' ? 'cover_url' : key;
    sets.push(`${col} = ?`);
    values.push(val);
  }
  values.push(id);
  db.run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDb();
  return getProject(id);
}

export async function deleteProject(id: number) {
  const db = await getDb();
  db.run('DELETE FROM projects WHERE id = ?', [id]);
  saveDb();
  return { success: true };
}