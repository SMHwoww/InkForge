import { getDb, saveDb } from '../db/index.js';

export async function getStarChart(projectId: number) {
  const db = await getDb();
  const nodesRaw = db.exec(
    `SELECT id, entity_type, entity_id, name, x, y, color, description, created_at, updated_at
     FROM star_map_nodes WHERE project_id = ? ORDER BY id`,
    [projectId],
  );
  const edgesRaw = db.exec(
    `SELECT id, source_node_id, target_node_id, relation_type, label, description, created_at, updated_at
     FROM star_map_edges WHERE project_id = ? ORDER BY id`,
    [projectId],
  );

  const nodes = nodesRaw.length ? nodesRaw[0].values.map(r => ({
    id: r[0], entityType: r[1], entityId: r[2], name: r[3],
    x: r[4], y: r[5], color: r[6], description: r[7],
    createdAt: r[8], updatedAt: r[9],
  })) : [];

  const edges = edgesRaw.length ? edgesRaw[0].values.map(r => ({
    id: r[0], sourceNodeId: r[1], targetNodeId: r[2],
    relationType: r[3], label: r[4], description: r[5],
    createdAt: r[6], updatedAt: r[7],
  })) : [];

  return { nodes, edges };
}

export async function createNode(projectId: number, data: {
  entityType: string; entityId?: number; name: string;
  x?: number; y?: number; color?: string; description?: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO star_map_nodes (project_id, entity_type, entity_id, name, x, y, color, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, data.entityType, data.entityId || null, data.name,
     data.x || 0, data.y || 0, data.color || '#c9a96e', data.description || '', now, now],
  );
  saveDb();
  const rows = db.exec(`SELECT id, entity_type, entity_id, name, x, y, color, description, created_at, updated_at FROM star_map_nodes WHERE id = last_insert_rowid()`);
  if (!rows.length || !rows[0].values.length) return null;
  const r = rows[0].values[0];
  return {
    id: r[0], entityType: r[1], entityId: r[2], name: r[3],
    x: r[4], y: r[5], color: r[6], description: r[7],
    createdAt: r[8], updatedAt: r[9],
  };
}

export async function updateNode(nodeId: number, data: {
  name?: string; x?: number; y?: number; color?: string; description?: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    // Map camelCase to snake_case
    const col = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
    sets.push(`${col} = ?`);
    values.push(val);
  }
  values.push(nodeId);
  db.run(`UPDATE star_map_nodes SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDb();
  const rows = db.exec(`SELECT id, entity_type, entity_id, name, x, y, color, description, created_at, updated_at FROM star_map_nodes WHERE id = ?`, [nodeId]);
  if (!rows.length || !rows[0].values.length) return null;
  const r = rows[0].values[0];
  return {
    id: r[0], entityType: r[1], entityId: r[2], name: r[3],
    x: r[4], y: r[5], color: r[6], description: r[7],
    createdAt: r[8], updatedAt: r[9],
  };
}

export async function deleteNode(nodeId: number) {
  const db = await getDb();
  // Also delete connected edges
  db.run('DELETE FROM star_map_edges WHERE source_node_id = ? OR target_node_id = ?', [nodeId, nodeId]);
  db.run('DELETE FROM star_map_nodes WHERE id = ?', [nodeId]);
  saveDb();
  return { success: true };
}

export async function createEdge(projectId: number, data: {
  sourceNodeId: number; targetNodeId: number;
  relationType?: string; label?: string; description?: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO star_map_edges (project_id, source_node_id, target_node_id, relation_type, label, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, data.sourceNodeId, data.targetNodeId,
     data.relationType || 'other', data.label || '', data.description || '', now, now],
  );
  saveDb();
  const rows = db.exec(`SELECT id, source_node_id, target_node_id, relation_type, label, description, created_at, updated_at FROM star_map_edges WHERE id = last_insert_rowid()`);
  if (!rows.length || !rows[0].values.length) return null;
  const r = rows[0].values[0];
  return {
    id: r[0], sourceNodeId: r[1], targetNodeId: r[2],
    relationType: r[3], label: r[4], description: r[5],
    createdAt: r[6], updatedAt: r[7],
  };
}

export async function updateEdge(edgeId: number, data: {
  relationType?: string; label?: string; description?: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    const col = key === 'relationType' ? 'relation_type' : key;
    sets.push(`${col} = ?`);
    values.push(val);
  }
  values.push(edgeId);
  db.run(`UPDATE star_map_edges SET ${sets.join(', ')} WHERE id = ?`, values);
  saveDb();
  const rows = db.exec(`SELECT id, source_node_id, target_node_id, relation_type, label, description, created_at, updated_at FROM star_map_edges WHERE id = ?`, [edgeId]);
  if (!rows.length || !rows[0].values.length) return null;
  const r = rows[0].values[0];
  return {
    id: r[0], sourceNodeId: r[1], targetNodeId: r[2],
    relationType: r[3], label: r[4], description: r[5],
    createdAt: r[6], updatedAt: r[7],
  };
}

export async function deleteEdge(edgeId: number) {
  const db = await getDb();
  db.run('DELETE FROM star_map_edges WHERE id = ?', [edgeId]);
  saveDb();
  return { success: true };
}

export async function saveStarChart(projectId: number, data: { nodes: any[]; edges: any[] }) {
  const db = await getDb();
  const now = new Date().toISOString();
  // Delete all existing nodes/edges for this project (full replace)
  db.run('DELETE FROM star_map_edges WHERE project_id = ?', [projectId]);
  db.run('DELETE FROM star_map_nodes WHERE project_id = ?', [projectId]);

  // Insert nodes and collect new IDs in order
  const insertNode = db.prepare(
    `INSERT INTO star_map_nodes (project_id, entity_type, entity_id, name, x, y, color, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const nodeIds: number[] = [];
  for (const node of data.nodes) {
    insertNode.run([projectId, node.entityType || 'custom', node.entityId || null,
      node.name, node.x || 0, node.y || 0, node.color || '#c9a96e', node.description || '', now, now]);
    const idRow = db.exec('SELECT last_insert_rowid()');
    nodeIds.push(idRow[0].values[0][0] as number);
  }
  insertNode.free();

  // Insert edges with remapped IDs using index-based mapping
  const insertEdge = db.prepare(
    `INSERT INTO star_map_edges (project_id, source_node_id, target_node_id, relation_type, label, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const edge of data.edges) {
    // Frontend sends sourceNodeId/targetNodeId as node array indices
    const srcIdx = typeof edge.sourceNodeId === 'number' ? Math.min(edge.sourceNodeId, nodeIds.length - 1) : 0;
    const tgtIdx = typeof edge.targetNodeId === 'number' ? Math.min(edge.targetNodeId, nodeIds.length - 1) : 0;
    const srcId = nodeIds[srcIdx];
    const tgtId = nodeIds[tgtIdx];

    if (srcId && tgtId) {
      insertEdge.run([projectId, srcId, tgtId,
        edge.relationType || 'other', edge.label || '', edge.description || '', now, now]);
    }
  }
  insertEdge.free();

  saveDb();
  return getStarChart(projectId);
}