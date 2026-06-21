import { Router } from 'express';
import * as timelineService from '../services/timelineService.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { projectIdParam, projectIdAndEventIdParam, projectIdAndPerspectiveIdParam, createTimelineEventBody, updateTimelineEventBody, reorderTimelineEventsBody, createPerspectiveBody, updatePerspectiveBody, updateTimelineConfigBody } from '../schemas/index.js';

const router = Router({ mergeParams: true });

// ─── Events ──────────────────────────────────────────────────────────────────

router.get('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const items = await timelineService.getTimelineEvents(Number(req.params.projectId));
  res.json({ code: 0, data: items, message: 'ok' });
}));

router.post('/', validateRequest({ params: projectIdParam, body: createTimelineEventBody }), asyncHandler(async (req, res) => {
  const item = await timelineService.createTimelineEvent(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: item, message: '创建成功' });
}));

router.put('/:eventId', validateRequest({ params: projectIdAndEventIdParam, body: updateTimelineEventBody }), asyncHandler(async (req, res) => {
  const item = await timelineService.updateTimelineEvent(Number(req.params.projectId), Number(req.params.eventId), req.body);
  res.json({ code: 0, data: item, message: '更新成功' });
}));

router.delete('/:eventId', validateRequest({ params: projectIdAndEventIdParam }), asyncHandler(async (req, res) => {
  await timelineService.deleteTimelineEvent(Number(req.params.projectId), Number(req.params.eventId));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

router.put('/reorder/batch', validateRequest({ params: projectIdParam, body: reorderTimelineEventsBody }), asyncHandler(async (req, res) => {
  await timelineService.reorderTimelineEvents(Number(req.params.projectId), req.body.items);
  res.json({ code: 0, data: null, message: '排序成功' });
}));

// ─── Perspectives ────────────────────────────────────────────────────────────

router.get('/perspectives', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const items = await timelineService.getPerspectives(Number(req.params.projectId));
  res.json({ code: 0, data: items, message: 'ok' });
}));

router.post('/perspectives', validateRequest({ params: projectIdParam, body: createPerspectiveBody }), asyncHandler(async (req, res) => {
  const item = await timelineService.createPerspective(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: item, message: '创建成功' });
}));

router.put('/perspectives/:perspectiveId', validateRequest({ params: projectIdAndPerspectiveIdParam, body: updatePerspectiveBody }), asyncHandler(async (req, res) => {
  const item = await timelineService.updatePerspective(Number(req.params.projectId), Number(req.params.perspectiveId), req.body);
  res.json({ code: 0, data: item, message: '更新成功' });
}));

router.delete('/perspectives/:perspectiveId', validateRequest({ params: projectIdAndPerspectiveIdParam }), asyncHandler(async (req, res) => {
  await timelineService.deletePerspective(Number(req.params.projectId), Number(req.params.perspectiveId));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

// ─── Config ──────────────────────────────────────────────────────────────────

router.get('/config', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const config = await timelineService.getTimelineConfig(Number(req.params.projectId));
  res.json({ code: 0, data: config, message: 'ok' });
}));

router.put('/config', validateRequest({ params: projectIdParam, body: updateTimelineConfigBody }), asyncHandler(async (req, res) => {
  const config = await timelineService.updateTimelineConfig(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: config, message: '更新成功' });
}));

export default router;