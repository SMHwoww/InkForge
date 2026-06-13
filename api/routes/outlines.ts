import { Router } from 'express';
import * as outlineService from '../services/outlineService.js';

const router = Router({ mergeParams: true });

// Get all outline items for a project (tree structure)
router.get('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const outlines = await outlineService.getOutlineItems(projectId);
    res.json({ code: 0, data: outlines, message: 'ok' });
  } catch (e) {
    console.error('Get outlines error:', e);
    res.status(500).json({ code: 500, message: '获取大纲列表失败' });
  }
});

// Create a new outline item
router.post('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { title, description, parentId, chapterId, level } = req.body;
    if (!title) {
      res.status(400).json({ code: 400, message: '大纲标题不能为空' });
      return;
    }
    const item = await outlineService.createOutlineItem(projectId, { title, description, parentId, chapterId, level });
    res.json({ code: 0, data: item, message: '创建成功' });
  } catch (e) {
    console.error('Create outline error:', e);
    res.status(500).json({ code: 500, message: '创建大纲条目失败' });
  }
});

// Update an outline item
router.put('/:itemId', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const itemId = Number((req.params as any).itemId);
    const { title, description, parentId, chapterId, sortOrder, level, status } = req.body;
    const item = await outlineService.updateOutlineItem(projectId, itemId, { title, description, parentId, chapterId, sortOrder, level, status });
    if (!item) {
      res.status(404).json({ code: 404, message: '大纲条目不存在' });
      return;
    }
    res.json({ code: 0, data: item, message: '保存成功' });
  } catch (e) {
    console.error('Update outline error:', e);
    res.status(500).json({ code: 500, message: '更新大纲条目失败' });
  }
});

// Delete an outline item
router.delete('/:itemId', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const itemId = Number((req.params as any).itemId);
    await outlineService.deleteOutlineItem(projectId, itemId);
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    console.error('Delete outline error:', e);
    res.status(500).json({ code: 500, message: '删除大纲条目失败' });
  }
});

// Reorder outline items
router.put('/reorder/batch', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ code: 400, message: '排序数据不能为空' });
      return;
    }
    await outlineService.reorderOutlineItems(projectId, items);
    res.json({ code: 0, data: null, message: '排序成功' });
  } catch (e) {
    console.error('Reorder outlines error:', e);
    res.status(500).json({ code: 500, message: '排序失败' });
  }
});

export default router;