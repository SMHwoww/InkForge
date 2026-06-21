import { Router } from 'express';
import * as chapterService from '../services/chapterService.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { NotFoundError } from '../common/errors.js';
import { projectIdParam, projectIdAndChapterIdParam, createChapterBody, updateChapterBody } from '../schemas/index.js';

const router = Router({ mergeParams: true });

router.get('/', validateRequest({ params: projectIdParam }), asyncHandler(async (req, res) => {
  const chapters = await chapterService.getChapters(Number(req.params.projectId));
  res.json({ code: 0, data: chapters, message: 'ok' });
}));

router.get('/:chapterId', validateRequest({ params: projectIdAndChapterIdParam }), asyncHandler(async (req, res) => {
  const chapter = await chapterService.getChapter(Number(req.params.projectId), Number(req.params.chapterId));
  if (!chapter) throw new NotFoundError('章节不存在');
  res.json({ code: 0, data: chapter, message: 'ok' });
}));

router.post('/', validateRequest({ params: projectIdParam, body: createChapterBody }), asyncHandler(async (req, res) => {
  const chapter = await chapterService.createChapter(Number(req.params.projectId), req.body);
  res.json({ code: 0, data: chapter, message: '创建成功' });
}));

router.put('/:chapterId', validateRequest({ params: projectIdAndChapterIdParam, body: updateChapterBody }), asyncHandler(async (req, res) => {
  const chapter = await chapterService.updateChapter(Number(req.params.projectId), Number(req.params.chapterId), req.body);
  if (!chapter) throw new NotFoundError('章节不存在');
  res.json({ code: 0, data: chapter, message: '保存成功' });
}));

router.delete('/:chapterId', validateRequest({ params: projectIdAndChapterIdParam }), asyncHandler(async (req, res) => {
  await chapterService.deleteChapter(Number(req.params.projectId), Number(req.params.chapterId));
  res.json({ code: 0, data: null, message: '删除成功' });
}));

export default router;