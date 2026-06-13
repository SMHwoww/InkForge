import { getDb, saveDb } from '../db/index.js';

export async function getRelations(projectId: number) {
  const db = await getDb();
  const rows = db.exec(
    `SELECT * FROM relation_edges WHERE project_id = ?`,
    [projectId],
  );
  if (!rows.length) return [];
  return rows[0].values.map(row => ({
    id: row[0], projectId: row[1], sourceCharId: row[2], targetCharId: row[3],
    relationType: row[4], label: row[5], description: row[6],
    sourceX: row[7], sourceY: row[8], targetX: row[9], targetY: row[10],
  }));
}

export async function saveRelations(projectId: number, edges: Array<{
  id: string; sourceCharId: string; targetCharId: string;
  relationType: string; label: string; description: string;
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}>) {
  const db = await getDb();
  db.run('DELETE FROM relation_edges WHERE project_id = ?', [projectId]);

  if (edges.length === 0) {
    saveDb();
    return [];
  }

  for (const e of edges) {
    db.run(
      `INSERT INTO relation_edges (project_id, source_char_id, target_char_id, relation_type, label, description, source_x, source_y, target_x, target_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, e.sourceCharId, e.targetCharId, e.relationType, e.label, e.description, e.sourceX, e.sourceY, e.targetX, e.targetY],
    );
  }
  saveDb();
  return getRelations(projectId);
}

// Graph Nodes
export async function getGraphNodes(projectId: number) {
  const db = await getDb();
  const rows = db.exec(
    `SELECT * FROM graph_nodes WHERE project_id = ? ORDER BY id`,
    [projectId],
  );
  if (!rows.length) return [];
  return rows[0].values.map(row => ({
    id: row[0], projectId: row[1], nodeType: row[2], label: row[3],
    description: row[4], charId: row[5], posX: row[6], posY: row[7],
    styleData: row[8], createdAt: row[9], updatedAt: row[10],
  }));
}

export async function saveGraphNodes(projectId: number, nodes: Array<{
  id: string; nodeType: string; label: string; description: string;
  charId?: number | null; posX: number; posY: number; styleData?: string;
}>) {
  const db = await getDb();
  db.run('DELETE FROM graph_nodes WHERE project_id = ?', [projectId]);

  if (nodes.length === 0) {
    saveDb();
    return [];
  }

  for (const n of nodes) {
    db.run(
      `INSERT INTO graph_nodes (project_id, node_type, label, description, char_id, pos_x, pos_y, style_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, n.nodeType, n.label, n.description || '', n.charId || null, n.posX, n.posY, n.styleData || '{}'],
    );
  }
  saveDb();
  return getGraphNodes(projectId);
}