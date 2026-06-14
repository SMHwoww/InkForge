import { getDb, saveDb } from '../db/index.js';

function colMap(columns: string[], values: any[]): Record<string, any> {
  const obj: Record<string, any> = {};
  columns.forEach((col, i) => { obj[col] = values[i]; });
  return obj;
}

function mapEvent(row: Record<string, any>) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    content: row.content,
    eventDate: row.event_date,
    sortOrder: row.sort_order,
    category: row.category,
    placed: row.placed ?? 0,
    posX: row.pos_x ?? null,
    posY: row.pos_y ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResult(result: { columns: string[]; values: any[][] }) {
  return result.values.map(v => mapEvent(colMap(result.columns, v)));
}

export async function getTimelineEvents(projectId: number) {
  const db = await getDb();
  const results = db.exec(
    `SELECT * FROM timeline_events WHERE project_id = ? ORDER BY sort_order`,
    [projectId],
  );
  if (!results.length) return [];
  return mapResult(results[0]);
}

export async function createTimelineEvent(projectId: number, data: {
  title: string; content?: string; eventDate?: string; sortOrder?: number;
  category?: string; placed?: number; posX?: number; posY?: number;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO timeline_events (project_id, title, content, event_date, sort_order, category, placed, pos_x, pos_y, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, data.title, data.content || '', data.eventDate || '', data.sortOrder ?? 0, data.category || '', data.placed ?? 0, data.posX ?? null, data.posY ?? null, now, now],
  );
  saveDb();
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
  const results = db.exec(`SELECT * FROM timeline_events WHERE id = ?`, [id]);
  return mapResult(results[0])[0];
}

export async function updateTimelineEvent(id: number, data: Partial<{
  title: string; content: string; eventDate: string; sortOrder: number; category: string;
  placed: number; posX: number; posY: number;
}>) {
  const db = await getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  const colMap: Record<string, string> = {
    eventDate: 'event_date', sortOrder: 'sort_order',
    posX: 'pos_x', posY: 'pos_y',
  };
  for (const [key, val] of Object.entries(data)) {
    const col = colMap[key] || key;
    sets.push(`${col} = ?`);
    values.push(val);
  }
  values.push(id);
  db.run(`UPDATE timeline_events SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDb();
  const results = db.exec(`SELECT * FROM timeline_events WHERE id = ?`, [id]);
  return mapResult(results[0])[0];
}

export async function deleteTimelineEvent(id: number) {
  const db = await getDb();
  db.run('DELETE FROM timeline_events WHERE id = ?', [id]);
  saveDb();
  return { success: true };
}

export async function reorderTimelineEvents(projectId: number, items: Array<{ id: number; sortOrder: number }>) {
  const db = await getDb();
  for (const item of items) {
    db.run('UPDATE timeline_events SET sort_order = ? WHERE id = ? AND project_id = ?', [item.sortOrder, item.id, projectId]);
  }
  saveDb();
  return { success: true };
}

// Perspective services
function mapPerspective(row: Record<string, any>) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPerspResult(result: { columns: string[]; values: any[][] }) {
  return result.values.map(v => mapPerspective(colMap(result.columns, v)));
}

export async function getPerspectives(projectId: number) {
  const db = await getDb();
  const results = db.exec(
    `SELECT * FROM timeline_perspectives WHERE project_id = ? ORDER BY sort_order`,
    [projectId],
  );
  if (!results.length) return [];
  return mapPerspResult(results[0]);
}

export async function createPerspective(projectId: number, data: { name: string; sortOrder?: number }) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO timeline_perspectives (project_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [projectId, data.name, data.sortOrder ?? 0, now, now],
  );
  saveDb();
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
  const results = db.exec(`SELECT * FROM timeline_perspectives WHERE id = ?`, [id]);
  return mapPerspResult(results[0])[0];
}

export async function updatePerspective(id: number, data: Partial<{ name: string; sortOrder: number }>) {
  const db = await getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  const colMap: Record<string, string> = { sortOrder: 'sort_order' };
  for (const [key, val] of Object.entries(data)) {
    const col = colMap[key] || key;
    sets.push(`${col} = ?`);
    values.push(val);
  }
  values.push(id);
  db.run(`UPDATE timeline_perspectives SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDb();
  const results = db.exec(`SELECT * FROM timeline_perspectives WHERE id = ?`, [id]);
  return mapPerspResult(results[0])[0];
}

export async function deletePerspective(id: number) {
  const db = await getDb();
  // 批量清除该视角上所有事件的位置信息
  db.run('UPDATE timeline_events SET placed = 0, pos_x = NULL, pos_y = NULL WHERE pos_y = ?', [id]);
  db.run('DELETE FROM timeline_perspectives WHERE id = ?', [id]);
  saveDb();
  return { success: true };
}

// --- Config ---
const DEFAULT_X_LABELS = '时间1,时间2,时间3,时间4,时间5,时间6,时间7,时间8,时间9,时间10';

export async function getTimelineConfig(projectId: number): Promise<{ xLabels: string[] }> {
  const db = await getDb();
  const results = db.exec('SELECT x_labels FROM timeline_config WHERE project_id = ?', [projectId]);
  if (!results.length || !results[0].values.length) {
    // Auto-create config with defaults
    db.run('INSERT INTO timeline_config (project_id, x_labels) VALUES (?, ?)', [projectId, DEFAULT_X_LABELS]);
    saveDb();
    return { xLabels: DEFAULT_X_LABELS.split(',') };
  }
  return { xLabels: (results[0].values[0][0] as string).split(',') };
}

export async function updateTimelineConfig(projectId: number, data: { xLabels: string[] }) {
  const db = await getDb();
  const xLabels = data.xLabels.map(s => s.trim()).filter(Boolean).join(',');
  const existing = db.exec('SELECT id FROM timeline_config WHERE project_id = ?', [projectId]);
  if (existing.length && existing[0].values.length) {
    db.run('UPDATE timeline_config SET x_labels = ? WHERE project_id = ?', [xLabels, projectId]);
  } else {
    db.run('INSERT INTO timeline_config (project_id, x_labels) VALUES (?, ?)', [projectId, xLabels]);
  }
  saveDb();
  return { xLabels: xLabels.split(',') };
}