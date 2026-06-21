import { Router } from 'express';
import * as outlineService from '../services/outlineService.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { NotFoundError } from '../common/errors.js';
import { projectIdParam, projectIdAndItemIdParam, createOutlineBody, updateOutlineBody, reorderOutlinesBody } from '../schemas/index.js';

const router = Router({ mergeParams: true });

router.get('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const outlines = await outlineService.getOutlineItems(Number(req.params.projectId));
  res.json({ code: 0, data: outlines, message: 'ok' });
}));

router.post('/', validateRequest({ params: projectIdParam, body: createOutlineBody }), asyncHandler(async (req, res) => {
  const item = await outlineService.createOutlineItem(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: item, message: '创建成功' });
}));

router.put('/:itemId', validateRequest({ params: projectIdAndItemIdParam, body: updateOutlineBody }), asyncHandler(async (req, res) => {
  const item = await outlineService.updateOutlineItem(Number(req.params.projectId), Number(req.params.itemId), req.body);
  if (!item) throw new NotFoundError('大纲条目不存在');
  res.json({ code: 0, data: item, message: '保存成功' });
}));

router.delete('/:itemId', validateRequest({ params: projectIdAndItemIdParam }), asyncHandler(async (req, res) => {
  await outlineService.deleteOutlineItem(Number(req.params.projectId), Number(req.params.itemId));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

router.put('/reorder/batch', validateRequest({ params: projectIdParam, body: reorderOutlinesBody }), asyncHandler(async (req, res) => {
  await outlineService.reorderOutlineItems(Number(req.params.projectId), req.body.items);
  res.json({ code: 0, data: null, message: '排序成功' });
}));

export default router;