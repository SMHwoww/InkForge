import { Router } from 'express';
import * as starchartService from '../services/starchartService.js';

const router = Router({ mergeParams: true });

// GET whole star chart data
router.get('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const data = await starchartService.getStarChart(projectId);
    res.json({ code: 0, data, message: 'ok' });
  } catch (e) {
    console.error('Get star chart error:', e);
    res.status(500).json({ code: 500, message: '获取星图数据失败' });
  }
});

// PUT save entire star chart
router.put('/', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const data = await starchartService.saveStarChart(projectId, req.body);
    res.json({ code: 0, data, message: '保存成功' });
  } catch (e) {
    console.error('Save star chart error:', e);
    res.status(500).json({ code: 500, message: '保存星图失败' });
  }
});

// POST create node
router.post('/nodes', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const node = await starchartService.createNode(projectId, req.body);
    if (!node) {
      res.status(500).json({ code: 500, message: '创建节点失败' });
      return;
    }
    res.json({ code: 0, data: node, message: '创建成功' });
  } catch (e) {
    console.error('Create node error:', e);
    res.status(500).json({ code: 500, message: '创建节点失败' });
  }
});

// PUT update node
router.put('/nodes/:nodeId', async (req, res) => {
  try {
    const node = await starchartService.updateNode(Number(req.params.nodeId), req.body);
    if (!node) {
      res.status(404).json({ code: 404, message: '节点不存在' });
      return;
    }
    res.json({ code: 0, data: node, message: '更新成功' });
  } catch (e) {
    console.error('Update node error:', e);
    res.status(500).json({ code: 500, message: '更新节点失败' });
  }
});

// DELETE node
router.delete('/nodes/:nodeId', async (req, res) => {
  try {
    await starchartService.deleteNode(Number(req.params.nodeId));
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    console.error('Delete node error:', e);
    res.status(500).json({ code: 500, message: '删除节点失败' });
  }
});

// POST create edge
router.post('/edges', async (req, res) => {
  try {
    const projectId = Number((req.params as any).projectId);
    const edge = await starchartService.createEdge(projectId, req.body);
    if (!edge) {
      res.status(500).json({ code: 500, message: '创建连线失败' });
      return;
    }
    res.json({ code: 0, data: edge, message: '创建成功' });
  } catch (e) {
    console.error('Create edge error:', e);
    res.status(500).json({ code: 500, message: '创建连线失败' });
  }
});

// PUT update edge
router.put('/edges/:edgeId', async (req, res) => {
  try {
    const edge = await starchartService.updateEdge(Number(req.params.edgeId), req.body);
    if (!edge) {
      res.status(404).json({ code: 404, message: '连线不存在' });
      return;
    }
    res.json({ code: 0, data: edge, message: '更新成功' });
  } catch (e) {
    console.error('Update edge error:', e);
    res.status(500).json({ code: 500, message: '更新连线失败' });
  }
});

// DELETE edge
router.delete('/edges/:edgeId', async (req, res) => {
  try {
    await starchartService.deleteEdge(Number(req.params.edgeId));
    res.json({ code: 0, data: null, message: '删除成功' });
  } catch (e) {
    console.error('Delete edge error:', e);
    res.status(500).json({ code: 500, message: '删除连线失败' });
  }
});

export default router;