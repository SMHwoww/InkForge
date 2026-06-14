import { Router } from 'express';
import * as timelineService from '../services/timelineService.js';

const router = Router({ mergeParams: true });

// --- Events ---

router.get('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const items = await timelineService.getTimelineEvents(projectId);
    res.json({ code: 0, data: items, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取时间轴事件失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { title, content, eventDate, sortOrder, category, placed, posX, posY } = req.body;
    if (!title) {
      res.status(400).json({ code: 400, message: '标题不能为空' });
      return;
    }
    const item = await timelineService.createTimelineEvent(projectId, { title, content, eventDate, sortOrder, category, placed, posX, posY });
    res.json({ code: 0, data: item, message: '创建成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '创建时间轴事件失败' });
  }
});

router.put('/:eventId', async (req, res) => {
  try {
    const item = await timelineService.updateTimelineEvent(Number(req.params.eventId), req.body);
    res.json({ code: 0, data: item, message: '更新成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '更新时间轴事件失败' });
  }
});

router.delete('/:eventId', async (req, res) => {
  try {
    await timelineService.deleteTimelineEvent(Number(req.params.eventId));
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除时间轴事件失败' });
  }
});

router.put('/reorder/batch', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { items } = req.body;
    await timelineService.reorderTimelineEvents(projectId, items);
    res.json({ code: 0, data: null, message: '排序成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '排序失败' });
  }
});

// --- Perspectives ---

router.get('/perspectives', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const items = await timelineService.getPerspectives(projectId);
    res.json({ code: 0, data: items, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取视角失败' });
  }
});

router.post('/perspectives', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ code: 400, message: '视角名称不能为空' });
      return;
    }
    const item = await timelineService.createPerspective(projectId, { name });
    res.json({ code: 0, data: item, message: '创建成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '创建视角失败' });
  }
});

router.put('/perspectives/:perspectiveId', async (req, res) => {
  try {
    const item = await timelineService.updatePerspective(Number(req.params.perspectiveId), req.body);
    res.json({ code: 0, data: item, message: '更新成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '更新视角失败' });
  }
});

router.delete('/perspectives/:perspectiveId', async (req, res) => {
  try {
    await timelineService.deletePerspective(Number(req.params.perspectiveId));
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除视角失败' });
  }
});

// --- Config ---

router.get('/config', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const config = await timelineService.getTimelineConfig(projectId);
    res.json({ code: 0, data: config, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取时间轴配置失败' });
  }
});

router.put('/config', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const config = await timelineService.updateTimelineConfig(projectId, req.body);
    res.json({ code: 0, data: config, message: '更新成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '更新时间轴配置失败' });
  }
});

export default router;