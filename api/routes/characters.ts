import { Router } from 'express';
import * as characterService from '../services/characterService.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const list = await characterService.getCharacterList(projectId);
    res.json({ code: 0, data: list, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取角色列表失败' });
  }
});

router.get('/:charId', async (req, res) => {
  try {
    const character = await characterService.getCharacter(Number(req.params.charId));
    if (!character) {
      res.status(404).json({ code: 404, message: '角色不存在' });
      return;
    }
    res.json({ code: 0, data: character, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取角色详情失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ code: 400, message: '角色名称不能为空' });
      return;
    }
    const character = await characterService.createCharacter(projectId, req.body);
    res.json({ code: 0, data: character, message: '创建成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '创建角色失败' });
  }
});

router.put('/:charId', async (req, res) => {
  try {
    const character = await characterService.updateCharacter(
      Number(req.params.charId),
      req.body,
    );
    res.json({ code: 0, data: character, message: '更新成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '更新角色失败' });
  }
});

router.delete('/:charId', async (req, res) => {
  try {
    await characterService.deleteCharacter(Number(req.params.charId));
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除角色失败' });
  }
});

export default router;