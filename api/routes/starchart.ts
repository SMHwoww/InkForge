import { Router } from 'express';
import * as starchartService from '../services/starchartService.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { NotFoundError } from '../common/errors.js';
import { projectIdParam, projectIdAndNodeIdParam, projectIdAndEdgeIdParam, createNodeBody, updateNodeBody, createEdgeBody, updateEdgeBody } from '../schemas/index.js';

const router = Router({ mergeParams: true });

router.get('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const data = await starchartService.getStarChart(Number(req.params.projectId));
  res.json({ code: 0, data, message: 'ok' });
}));

router.put('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const data = await starchartService.saveStarChart(Number(req.params.projectId), req.body);
  res.json({ code: 0, data, message: '保存成功' });
}));

router.post('/nodes', validateRequest({ params: projectIdParam, body: createNodeBody }), asyncHandler(async (req, res) => {
  const node = await starchartService.createNode(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: node, message: '创建成功' });
}));

router.put('/nodes/:nodeId', validateRequest({ params: projectIdAndNodeIdParam, body: updateNodeBody }), asyncHandler(async (req, res) => {
  const node = await starchartService.updateNode(Number(req.params.nodeId), req.body);
  if (!node) throw new NotFoundError('节点不存在');
  res.json({ code: 0, data: node, message: '更新成功' });
}));

router.delete('/nodes/:nodeId', validateRequest({ params: projectIdAndNodeIdParam }), asyncHandler(async (req, res) => {
  await starchartService.deleteNode(Number(req.params.nodeId));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

router.post('/edges', validateRequest({ params: projectIdParam, body: createEdgeBody }), asyncHandler(async (req, res) => {
  const edge = await starchartService.createEdge(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: edge, message: '创建成功' });
}));

router.put('/edges/:edgeId', validateRequest({ params: projectIdAndEdgeIdParam, body: updateEdgeBody }), asyncHandler(async (req, res) => {
  const edge = await starchartService.updateEdge(Number(req.params.edgeId), req.body);
  if (!edge) throw new NotFoundError('连线不存在');
  res.json({ code: 0, data: edge, message: '更新成功' });
}));

router.delete('/edges/:edgeId', validateRequest({ params: projectIdAndEdgeIdParam }), asyncHandler(async (req, res) => {
  await starchartService.deleteEdge(Number(req.params.edgeId));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

export default router;