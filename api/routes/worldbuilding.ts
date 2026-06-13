import { Router } from 'express';
import * as worldbuildingService from '../services/worldbuildingService.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const category = req.query.category as string | undefined;
    const items = await worldbuildingService.getWorldbuildingItems(projectId, category);
    res.json({ code: 0, data: items, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取世界观条目失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { category, title, content } = req.body;
    if (!category || !title) {
      res.status(400).json({ code: 400, message: '分类和标题不能为空' });
      return;
    }
    const item = await worldbuildingService.createWorldbuildingItem(
      projectId,
      { category, title, content },
    );
    res.json({ code: 0, data: item, message: '创建成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '创建世界观条目失败' });
  }
});

router.put('/:itemId', async (req, res) => {
  try {
    const item = await worldbuildingService.updateWorldbuildingItem(
      Number(req.params.itemId),
      req.body,
    );
    res.json({ code: 0, data: item, message: '更新成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '更新世界观条目失败' });
  }
});

router.delete('/:itemId', async (req, res) => {
  try {
    await worldbuildingService.deleteWorldbuildingItem(Number(req.params.itemId));
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除世界观条目失败' });
  }
});

export default router;