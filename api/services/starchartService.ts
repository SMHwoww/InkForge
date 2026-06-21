import { getDb } from '../db/index.js';
import { starMapNodes, starMapEdges } from '../db/schema.js';
import { eq, or, sql } from 'drizzle-orm';

export async function getStarChart(projectId: number) {
  const db = getDb();
  const nodes = db
    .select({
      id: starMapNodes.id,
      entityType: starMapNodes.entityType,
      entityId: starMapNodes.entityId,
      name: starMapNodes.name,
      x: starMapNodes.x,
      y: starMapNodes.y,
      color: starMapNodes.color,
      description: starMapNodes.description,
      createdAt: starMapNodes.createdAt,
      updatedAt: starMapNodes.updatedAt,
    })
    .from(starMapNodes)
    .where(eq(starMapNodes.projectId, projectId))
    .orderBy(sql`id`)
    .all();

  const edges = db
    .select({
      id: starMapEdges.id,
      sourceNodeId: starMapEdges.sourceNodeId,
      targetNodeId: starMapEdges.targetNodeId,
      relationType: starMapEdges.relationType,
      label: starMapEdges.label,
      description: starMapEdges.description,
      createdAt: starMapEdges.createdAt,
      updatedAt: starMapEdges.updatedAt,
    })
    .from(starMapEdges)
    .where(eq(starMapEdges.projectId, projectId))
    .orderBy(sql`id`)
    .all();

  return { nodes, edges };
}

export async function createNode(projectId: number, data: {
  entityType: string; entityId?: number; name: string;
  x?: number; y?: number; color?: string; description?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(starMapNodes).values({
    projectId,
    entityType: data.entityType as any,
    entityId: data.entityId ?? null,
    name: data.name,
    x: data.x ?? 0,
    y: data.y ?? 0,
    color: data.color ?? '#c9a96e',
    description: data.description || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
}

export async function updateNode(nodeId: number, data: {
  name?: string; x?: number; y?: number; color?: string; description?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const updateData: any = { updatedAt: now };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.x !== undefined) updateData.x = data.x;
  if (data.y !== undefined) updateData.y = data.y;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.description !== undefined) updateData.description = data.description;
  db.update(starMapNodes).set(updateData).where(eq(starMapNodes.id, nodeId)).run();
  return db.select().from(starMapNodes).where(eq(starMapNodes.id, nodeId)).get() ?? null;
}

export async function deleteNode(nodeId: number) {
  const db = getDb();
  db.delete(starMapEdges).where(or(eq(starMapEdges.sourceNodeId, nodeId), eq(starMapEdges.targetNodeId, nodeId))).run();
  db.delete(starMapNodes).where(eq(starMapNodes.id, nodeId)).run();
  return { success: true };
}

export async function createEdge(projectId: number, data: {
  sourceNodeId: number; targetNodeId: number;
  relationType?: string; label?: string; description?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(starMapEdges).values({
    projectId,
    sourceNodeId: data.sourceNodeId,
    targetNodeId: data.targetNodeId,
    relationType: data.relationType || 'other',
    label: data.label || '',
    description: data.description || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
}

export async function updateEdge(edgeId: number, data: {
  relationType?: string; label?: string; description?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const updateData: any = { updatedAt: now };
  if (data.relationType !== undefined) updateData.relationType = data.relationType;
  if (data.label !== undefined) updateData.label = data.label;
  if (data.description !== undefined) updateData.description = data.description;
  db.update(starMapEdges).set(updateData).where(eq(starMapEdges.id, edgeId)).run();
  return db.select().from(starMapEdges).where(eq(starMapEdges.id, edgeId)).get() ?? null;
}

export async function deleteEdge(edgeId: number) {
  const db = getDb();
  db.delete(starMapEdges).where(eq(starMapEdges.id, edgeId)).run();
  return { success: true };
}

export async function saveStarChart(projectId: number, data: { nodes: any[]; edges: any[] }) {
  const db = getDb();
  const now = new Date().toISOString();

  // Delete all existing nodes/edges for this project (full replace)
  db.delete(starMapEdges).where(eq(starMapEdges.projectId, projectId)).run();
  db.delete(starMapNodes).where(eq(starMapNodes.projectId, projectId)).run();

  // Insert nodes and collect new IDs
  const nodeIds: number[] = [];
  for (const node of data.nodes) {
    const result = db.insert(starMapNodes).values({
      projectId,
      entityType: node.entityType || 'custom',
      entityId: node.entityId ?? null,
      name: node.name,
      x: node.x ?? 0,
      y: node.y ?? 0,
      color: node.color ?? '#c9a96e',
      description: node.description || '',
      createdAt: now,
      updatedAt: now,
    } as any).returning().get();
    nodeIds.push(result.id);
  }

  // Insert edges with remapped IDs
  for (const edge of data.edges) {
    const srcIdx = typeof edge.sourceNodeId === 'number' ? Math.min(edge.sourceNodeId, nodeIds.length - 1) : 0;
    const tgtIdx = typeof edge.targetNodeId === 'number' ? Math.min(edge.targetNodeId, nodeIds.length - 1) : 0;
    const srcId = nodeIds[srcIdx];
    const tgtId = nodeIds[tgtIdx];

    if (srcId && tgtId) {
      db.insert(starMapEdges).values({
        projectId,
        sourceNodeId: srcId,
        targetNodeId: tgtId,
        relationType: edge.relationType || 'other',
        label: edge.label || '',
        description: edge.description || '',
        createdAt: now,
        updatedAt: now,
      } as any).run();
    }
  }

  return getStarChart(projectId);
}