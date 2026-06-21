import { Router } from 'express';
import * as relationService from '../services/relationService.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { projectIdParam, saveRelationsBody, saveGraphNodesBody } from '../schemas/index.js';

const router = Router({ mergeParams: true });

router.get('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const edges = await relationService.getRelations(Number(req.params.projectId));
  res.json({ code: 0, data: edges, message: 'ok' });
}));

router.put('/', validateRequest({ params: projectIdParam, body: saveRelationsBody }), asyncHandler(async (req, res) => {
  const result = await relationService.saveRelations(Number(req.params.projectId), req.body.edges || []);
  res.json({ code: 0, data: result, message: '保存成功' });
}));

router.get('/nodes', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const nodes = await relationService.getGraphNodes(Number(req.params.projectId));
  res.json({ code: 0, data: nodes, message: 'ok' });
}));

router.put('/nodes', validateRequest({ params: projectIdParam, body: saveGraphNodesBody }), asyncHandler(async (req, res) => {
  const result = await relationService.saveGraphNodes(Number(req.params.projectId), req.body.nodes || []);
  res.json({ code: 0, data: result, message: '保存成功' });
}));

export default router;