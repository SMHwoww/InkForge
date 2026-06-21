import { Router } from 'express';
import * as worldbuildingService from '../services/worldbuildingService.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { projectIdParam, projectIdAndItemIdParam, createWorldbuildingBody, updateWorldbuildingBody } from '../schemas/index.js';

const router = Router({ mergeParams: true });

router.get('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const category = req.query.category as string | undefined;
  const items = await worldbuildingService.getWorldbuildingItems(Number(req.params.projectId), category);
  res.json({ code: 0, data: items, message: 'ok' });
}));

router.post('/', validateRequest({ params: projectIdParam, body: createWorldbuildingBody }), asyncHandler(async (req, res) => {
  const item = await worldbuildingService.createWorldbuildingItem(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: item, message: '创建成功' });
}));

router.put('/:itemId', validateRequest({ params: projectIdAndItemIdParam, body: updateWorldbuildingBody }), asyncHandler(async (req, res) => {
  const item = await worldbuildingService.updateWorldbuildingItem(Number(req.params.projectId), Number(req.params.itemId), req.body);
  res.json({ code: 0, data: item, message: '更新成功' });
}));

router.delete('/:itemId', validateRequest({ params: projectIdAndItemIdParam }), asyncHandler(async (req, res) => {
  await worldbuildingService.deleteWorldbuildingItem(Number(req.params.projectId), Number(req.params.itemId));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

export default router;