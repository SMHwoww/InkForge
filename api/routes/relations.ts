import { Router } from 'express';
import * as relationService from '../services/relationService.js';

const router = Router({ mergeParams: true });

// Edges
router.get('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const edges = await relationService.getRelations(projectId);
    res.json({ code: 0, data: edges, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取关系图数据失败' });
  }
});

router.put('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { edges } = req.body;
    const result = await relationService.saveRelations(projectId, edges || []);
    res.json({ code: 0, data: result, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '保存关系图失败' });
  }
});

// Graph Nodes
router.get('/nodes', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const nodes = await relationService.getGraphNodes(projectId);
    res.json({ code: 0, data: nodes, message: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取节点数据失败' });
  }
});

router.put('/nodes', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const { nodes } = req.body;
    const result = await relationService.saveGraphNodes(projectId, nodes || []);
    res.json({ code: 0, data: result, message: '保存成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '保存节点数据失败' });
  }
});

export default router;