import { Router } from 'express';
import * as chapterService from '../services/chapterService.js';

const router = Router({ mergeParams: true });

// Get all chapters for a project
router.get('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const chapters = await chapterService.getChapters(projectId);
    res.json({ code: 0, data: chapters, message: 'ok' });
  } catch (e) {
    console.error('Get chapters error:', e);
    res.status(500).json({ code: 500, message: '获取章节列表失败' });
  }
});

// Get a single chapter
router.get('/:chapterId', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const chapterId = Number((req.params as any).chapterId);
    const chapter = await chapterService.getChapter(projectId, chapterId);
    if (!chapter) {
      res.status(404).json({ code: 404, message: '章节不存在' });
      return;
    }
    res.json({ code: 0, data: chapter, message: 'ok' });
  } catch (e) {
    console.error('Get chapter error:', e);
    res.status(500).json({ code: 500, message: '获取章节失败' });
  }
});

// Create a new chapter
router.post('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { title, content, orderNum } = req.body;
    if (!title) {
      res.status(400).json({ code: 400, message: '章节标题不能为空' });
      return;
    }
    const chapter = await chapterService.createChapter(projectId, { title, content, orderNum });
    res.json({ code: 0, data: chapter, message: '创建成功' });
  } catch (e) {
    console.error('Create chapter error:', e);
    res.status(500).json({ code: 500, message: '创建章节失败' });
  }
});

// Update a chapter
router.put('/:chapterId', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const chapterId = Number((req.params as any).chapterId);
    const { title, content, orderNum, status } = req.body;
    const chapter = await chapterService.updateChapter(projectId, chapterId, { title, content, orderNum, status });
    if (!chapter) {
      res.status(404).json({ code: 404, message: '章节不存在' });
      return;
    }
    res.json({ code: 0, data: chapter, message: '保存成功' });
  } catch (e) {
    console.error('Update chapter error:', e);
    res.status(500).json({ code: 500, message: '更新章节失败' });
  }
});

// Delete a chapter
router.delete('/:chapterId', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const chapterId = Number((req.params as any).chapterId);
    await chapterService.deleteChapter(projectId, chapterId);
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    console.error('Delete chapter error:', e);
    res.status(500).json({ code: 500, message: '删除章节失败' });
  }
});

export default router;