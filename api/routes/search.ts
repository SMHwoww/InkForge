import { Router } from 'express';
import { getDb } from '../db/index.js';
import {
  characters,
  worldbuildingItems,
  chapters,
  outlineItems,
  timelineEvents,
  mediaAssets,
  starMapNodes,
  projects,
} from '../db/schema.js';
import { eq, like, or, and } from 'drizzle-orm';
import { validateRequest } from '../middlewares/validateRequest.js';
import { searchQuery } from '../schemas/index.js';

const router = Router();

export interface SearchResult {
  id: number;
  entityType: string;
  entityLabel: string;
  title: string;
  matchText: string;
  projectId: number;
  projectTitle: string;
  route: string;
}

router.get('/', validateRequest({ query: searchQuery }), (req, res) => {
  const query = (req.query.q as string || '').trim();
  const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;

  if (!query) {
    res.json({ code: 0, data: [], message: 'ok' });
    return;
  }

  const db = getDb();
  const pattern = `%${query}%`;
  const results: SearchResult[] = [];

  // Characters
  const charConditions = or(
    like(characters.name, pattern),
    like(characters.role, pattern),
    like(characters.personality, pattern),
    like(characters.background, pattern),
  );
  const charRows = db
    .select({
      id: characters.id,
      name: characters.name,
      role: characters.role,
      projectId: characters.projectId,
      projectTitle: projects.title,
    })
    .from(characters)
    .innerJoin(projects, eq(characters.projectId, projects.id))
    .where(
      projectId != null
        ? and(charConditions, eq(characters.projectId, projectId))
        : charConditions,
    )
    .limit(20)
    .all();

  for (const row of charRows) {
    results.push({
      id: row.id,
      entityType: 'character',
      entityLabel: '角色',
      title: row.name,
      matchText: row.role || '',
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      route: `/projects/${row.projectId}/characters/${row.id}`,
    });
  }

  // Worldbuilding
  const wbConditions = or(
    like(worldbuildingItems.title, pattern),
    like(worldbuildingItems.content, pattern),
  );
  const wbRows = db
    .select({
      id: worldbuildingItems.id,
      title: worldbuildingItems.title,
      category: worldbuildingItems.category,
      projectId: worldbuildingItems.projectId,
      projectTitle: projects.title,
    })
    .from(worldbuildingItems)
    .innerJoin(projects, eq(worldbuildingItems.projectId, projects.id))
    .where(
      projectId != null
        ? and(wbConditions, eq(worldbuildingItems.projectId, projectId))
        : wbConditions,
    )
    .limit(20)
    .all();

  for (const row of wbRows) {
    results.push({
      id: row.id,
      entityType: 'worldbuilding',
      entityLabel: '世界观',
      title: row.title,
      matchText: row.category || '',
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      route: `/projects/${row.projectId}/worldbuilding`,
    });
  }

  // Chapters
  const chConditions = or(
    like(chapters.title, pattern),
    like(chapters.content, pattern),
  );
  const chRows = db
    .select({
      id: chapters.id,
      title: chapters.title,
      content: chapters.content,
      projectId: chapters.projectId,
      projectTitle: projects.title,
    })
    .from(chapters)
    .innerJoin(projects, eq(chapters.projectId, projects.id))
    .where(
      projectId != null
        ? and(chConditions, eq(chapters.projectId, projectId))
        : chConditions,
    )
    .limit(20)
    .all();

  for (const row of chRows) {
    const content = row.content || '';
    const matchIdx = content.indexOf(query);
    const snippet =
      matchIdx >= 0
        ? content.substring(
            Math.max(0, matchIdx - 30),
            Math.min(content.length, matchIdx + query.length + 30),
          )
        : '';
    results.push({
      id: row.id,
      entityType: 'chapter',
      entityLabel: '章节',
      title: row.title,
      matchText: snippet || row.title,
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      route: `/projects/${row.projectId}/chapters`,
    });
  }

  // Outlines
  const olConditions = or(
    like(outlineItems.title, pattern),
    like(outlineItems.description, pattern),
  );
  const olRows = db
    .select({
      id: outlineItems.id,
      title: outlineItems.title,
      description: outlineItems.description,
      projectId: outlineItems.projectId,
      projectTitle: projects.title,
    })
    .from(outlineItems)
    .innerJoin(projects, eq(outlineItems.projectId, projects.id))
    .where(
      projectId != null
        ? and(olConditions, eq(outlineItems.projectId, projectId))
        : olConditions,
    )
    .limit(20)
    .all();

  for (const row of olRows) {
    results.push({
      id: row.id,
      entityType: 'outline',
      entityLabel: '大纲',
      title: row.title,
      matchText: row.description || '',
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      route: `/projects/${row.projectId}/outlines`,
    });
  }

  // Timeline events
  const tlConditions = or(
    like(timelineEvents.title, pattern),
    like(timelineEvents.content, pattern),
  );
  const tlRows = db
    .select({
      id: timelineEvents.id,
      title: timelineEvents.title,
      category: timelineEvents.category,
      projectId: timelineEvents.projectId,
      projectTitle: projects.title,
    })
    .from(timelineEvents)
    .innerJoin(projects, eq(timelineEvents.projectId, projects.id))
    .where(
      projectId != null
        ? and(tlConditions, eq(timelineEvents.projectId, projectId))
        : tlConditions,
    )
    .limit(20)
    .all();

  for (const row of tlRows) {
    results.push({
      id: row.id,
      entityType: 'timeline',
      entityLabel: '时间轴',
      title: row.title,
      matchText: row.category || '',
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      route: `/projects/${row.projectId}/timeline`,
    });
  }

  // Media assets
  const mdConditions = or(
    like(mediaAssets.name, pattern),
    like(mediaAssets.prompt, pattern),
  );
  const mdRows = db
    .select({
      id: mediaAssets.id,
      name: mediaAssets.name,
      prompt: mediaAssets.prompt,
      projectId: mediaAssets.projectId,
      projectTitle: projects.title,
    })
    .from(mediaAssets)
    .innerJoin(projects, eq(mediaAssets.projectId, projects.id))
    .where(
      projectId != null
        ? and(mdConditions, eq(mediaAssets.projectId, projectId))
        : mdConditions,
    )
    .limit(20)
    .all();

  for (const row of mdRows) {
    results.push({
      id: row.id,
      entityType: 'media',
      entityLabel: '设定集',
      title: row.name,
      matchText: row.prompt || '',
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      route: `/projects/${row.projectId}/media`,
    });
  }

  // Star map nodes
  const smConditions = or(
    like(starMapNodes.name, pattern),
    like(starMapNodes.description, pattern),
  );
  const smRows = db
    .select({
      id: starMapNodes.id,
      name: starMapNodes.name,
      description: starMapNodes.description,
      projectId: starMapNodes.projectId,
      projectTitle: projects.title,
    })
    .from(starMapNodes)
    .innerJoin(projects, eq(starMapNodes.projectId, projects.id))
    .where(
      projectId != null
        ? and(smConditions, eq(starMapNodes.projectId, projectId))
        : smConditions,
    )
    .limit(20)
    .all();

  for (const row of smRows) {
    results.push({
      id: row.id,
      entityType: 'starchart',
      entityLabel: '星图',
      title: row.name,
      matchText: row.description || '',
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      route: `/projects/${row.projectId}/starchart`,
    });
  }

  res.json({ code: 0, data: results, message: 'ok' });
});

export default router;