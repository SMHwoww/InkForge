import { getDb, saveDb } from '../db/index.js';

export async function getCharacterList(projectId: number) {
  const db = await getDb();
  const rows = db.exec(
    `SELECT id, name, role, avatar_url, background FROM characters WHERE project_id = ? ORDER BY id DESC`,
    [projectId],
  );
  if (!rows.length) return [];
  return rows[0].values.map(row => ({
    id: row[0], name: row[1], role: row[2], avatarUrl: row[3], summary: row[4],
  }));
}

export async function getCharacter(id: number) {
  const db = await getDb();
  const rows = db.exec(`SELECT * FROM characters WHERE id = ?`, [id]);
  if (!rows.length || !rows[0].values.length) return null;
  const row = rows[0].values[0];
  return {
    id: row[0], projectId: row[1], name: row[2], role: row[3],
    gender: row[4], age: row[5], appearance: row[6], personality: row[7],
    background: row[8], avatarUrl: row[9], createdAt: row[10], updatedAt: row[11],
  };
}

export async function createCharacter(projectId: number, data: {
  name: string; role?: string; gender?: string; age?: number;
  appearance?: string; personality?: string; background?: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO characters (project_id, name, role, gender, age, appearance, personality, background, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, data.name, data.role || '', data.gender || '', data.age || null, data.appearance || '', data.personality || '', data.background || '', now, now],
  );
  saveDb();
  const rows = db.exec(`SELECT * FROM characters WHERE id = last_insert_rowid()`);
  if (!rows.length || !rows[0].values.length) return null;
  const row = rows[0].values[0];
  return {
    id: row[0], projectId: row[1], name: row[2], role: row[3],
    gender: row[4], age: row[5], appearance: row[6], personality: row[7],
    background: row[8], avatarUrl: row[9], createdAt: row[10], updatedAt: row[11],
  };
}

export async function updateCharacter(id: number, data: Partial<{
  name: string; role: string; gender: string; age: number;
  appearance: string; personality: string; background: string; avatarUrl: string;
}>) {
  const db = await getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  for (const [key, val] of Object.entries(data)) {
    const col = key === 'avatarUrl' ? 'avatar_url' : key;
    sets.push(`${col} = ?`);
    values.push(val);
  }
  values.push(id);
  db.run(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDb();
  return getCharacter(id);
}

export async function deleteCharacter(id: number) {
  const db = await getDb();
  db.run('DELETE FROM characters WHERE id = ?', [id]);
  saveDb();
  return { success: true };
}