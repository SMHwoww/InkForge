import { Router } from 'express';
import * as projectService from '../services/projectService.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { NotFoundError } from '../common/errors.js';
import { idParam, createProjectBody, updateProjectBody } from '../schemas/index.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const projects = await projectService.getProjectList();
  res.json({ code: 0, data: projects, message: 'ok' });
}));

router.get('/:id', validateRequest({ params: idParam }), asyncHandler(async (req, res) => {
  const project = await projectService.getProject(Number(req.params.id));
  if (!project) throw new NotFoundError('项目不存在');
  res.json({ code: 0, data: project, message: 'ok' });
}));

router.post('/', validateRequest({ body: createProjectBody }), asyncHandler(async (req, res) => {
  const project = await projectService.createProject(req.body);
  res.json({ code: 0, data: project, message: '创建成功' });
}));

router.put('/:id', validateRequest({ params: idParam, body: updateProjectBody }), asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(Number(req.params.id), req.body);
  res.json({ code: 0, data: project, message: '更新成功' });
}));

router.delete('/:id', validateRequest({ params: idParam }), asyncHandler(async (req, res) => {
  await projectService.deleteProject(Number(req.params.id));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

export default router;