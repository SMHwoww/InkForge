import { getDb } from '../db/index.js';
import { relationEdges, graphNodes } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export async function getRelations(projectId: number) {
  const db = getDb();
  return db
    .select()
    .from(relationEdges)
    .where(eq(relationEdges.projectId, projectId))
    .all();
}

export async function saveRelations(projectId: number, edges: Array<{
  id: string; sourceCharId: string; targetCharId: string;
  relationType: string; label: string; description: string;
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}>) {
  const db = getDb();
  db.delete(relationEdges).where(eq(relationEdges.projectId, projectId)).run();

  if (edges.length === 0) {
    return [];
  }

  for (const e of edges) {
    db.insert(relationEdges).values({
      projectId,
      sourceCharId: e.sourceCharId as any,
      targetCharId: e.targetCharId as any,
      relationType: e.relationType,
      label: e.label,
      description: e.description,
      sourceX: e.sourceX,
      sourceY: e.sourceY,
      targetX: e.targetX,
      targetY: e.targetY,
    } as any).run();
  }

  return getRelations(projectId);
}

// Graph Nodes
export async function getGraphNodes(projectId: number) {
  const db = getDb();
  return db
    .select()
    .from(graphNodes)
    .where(eq(graphNodes.projectId, projectId))
    .orderBy(sql`id`)
    .all();
}

export async function saveGraphNodes(projectId: number, nodes: Array<{
  id: string; nodeType: string; label: string; description: string;
  charId?: number | null; posX: number; posY: number; styleData?: string;
}>) {
  const db = getDb();
  db.delete(graphNodes).where(eq(graphNodes.projectId, projectId)).run();

  if (nodes.length === 0) {
    return [];
  }

  for (const n of nodes) {
    db.insert(graphNodes).values({
      projectId,
      nodeType: n.nodeType,
      label: n.label,
      description: n.description || '',
      charId: n.charId ?? null,
      posX: n.posX,
      posY: n.posY,
      styleData: n.styleData || '{}',
    } as any).run();
  }

  return getGraphNodes(projectId);
}