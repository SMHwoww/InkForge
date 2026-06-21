import { Router } from 'express';
import * as characterService from '../services/characterService.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { NotFoundError } from '../common/errors.js';
import { projectIdParam, projectIdAndCharIdParam, createCharacterBody, updateCharacterBody } from '../schemas/index.js';

const router = Router({ mergeParams: true });

router.get('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const list = await characterService.getCharacterList(Number(req.params.projectId));
  res.json({ code: 0, data: list, message: 'ok' });
}));

router.get('/:charId', validateRequest({ params: projectIdAndCharIdParam }), asyncHandler(async (req, res) => {
  const character = await characterService.getCharacter(Number(req.params.projectId), Number(req.params.charId));
  if (!character) throw new NotFoundError('角色不存在');
  res.json({ code: 0, data: character, message: 'ok' });
}));

router.post('/', validateRequest({ params: projectIdParam, body: createCharacterBody }), asyncHandler(async (req, res) => {
  const character = await characterService.createCharacter(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: character, message: '创建成功' });
}));

router.put('/:charId', validateRequest({ params: projectIdAndCharIdParam, body: updateCharacterBody }), asyncHandler(async (req, res) => {
  const character = await characterService.updateCharacter(Number(req.params.projectId), Number(req.params.charId), req.body);
  res.json({ code: 0, data: character, message: '更新成功' });
}));

router.delete('/:charId', validateRequest({ params: projectIdAndCharIdParam }), asyncHandler(async (req, res) => {
  await characterService.deleteCharacter(Number(req.params.projectId), Number(req.params.charId));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

export default router;