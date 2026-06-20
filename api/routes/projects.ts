import { Router } from 'express';
import * as projectService from '../services/projectService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const projects = await projectService.getProjectList();
    res.json({ code: 0, data: projects, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取项目列表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await projectService.getProject(Number(req.params.id));
    if (!project) {
      res.status(404).json({ code: 404, message: '项目不存在' });
      return;
    }
    res.json({ code: 0, data: project, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取项目详情失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, summary, genre } = req.body;
    if (!title) {
      res.status(400).json({ code: 400, message: '项目名称不能为空' });
      return;
    }
    const project = await projectService.createProject({ title, summary, genre });
    if (!project) {
      res.status(500).json({ code: 500, message: '创建项目失败：数据库写入异常' });
      return;
    }
    res.json({ code: 0, data: project, message: '创建成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '创建项目失败' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const project = await projectService.updateProject(Number(req.params.id), req.body);
    res.json({ code: 0, data: project, message: '更新成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '更新项目失败' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await projectService.deleteProject(Number(req.params.id));
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除项目失败' });
  }
});

export default router;