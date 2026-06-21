import { getDb } from '../db/index.js';
import { characters } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export async function getCharacterList(projectId: number) {
  const db = getDb();
  return db
    .select({
      id: characters.id,
      name: characters.name,
      role: characters.role,
      avatarUrl: characters.avatarUrl,
      summary: characters.background,
    })
    .from(characters)
    .where(eq(characters.projectId, projectId))
    .orderBy(sql`id DESC`)
    .all();
}

export async function getCharacter(projectId: number, id: number) {
  const db = getDb();
  return db.select().from(characters).where(and(eq(characters.projectId, projectId), eq(characters.id, id))).get() ?? null;
}

export async function createCharacter(projectId: number, data: {
  name: string; role?: string; gender?: string; age?: number;
  appearance?: string; personality?: string; background?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(characters).values({
    projectId,
    name: data.name,
    role: data.role || '',
    gender: data.gender || '',
    age: data.age ?? null,
    appearance: data.appearance || '',
    personality: data.personality || '',
    background: data.background || '',
    createdAt: now,
    updatedAt: now,
  } as any).returning().get();
}

export async function updateCharacter(projectId: number, id: number, data: Partial<{
  name: string; role: string; gender: string; age: number;
  appearance: string; personality: string; background: string; avatarUrl: string;
}>) {
  const db = getDb();
  const now = new Date().toISOString();
  const updateData: any = { updatedAt: now };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.age !== undefined) updateData.age = data.age;
  if (data.appearance !== undefined) updateData.appearance = data.appearance;
  if (data.personality !== undefined) updateData.personality = data.personality;
  if (data.background !== undefined) updateData.background = data.background;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
  db.update(characters).set(updateData).where(and(eq(characters.projectId, projectId), eq(characters.id, id))).run();
  return getCharacter(projectId, id);
}

export async function deleteCharacter(projectId: number, id: number) {
  const db = getDb();
  db.delete(characters).where(and(eq(characters.projectId, projectId), eq(characters.id, id))).run();
  return { success: true };
}