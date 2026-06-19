/**
 * MCP 配置管理 API
 *
 * GET  /api/mcp/config   — 获取当前 MCP 配置
 * PUT  /api/mcp/config   — 更新 MCP 配置（写入 config.json 并热重载）
 * POST /api/mcp/reload   — 热重载 MCP 服务器
 * POST /api/mcp/test     — 测试单个服务器连接
 */

import { Router, type Request, type Response } from 'express';
import { loadConfig, saveConfig, McpServerConfigSchema, type McpServerConfig } from '../services/mcpConfig.js';
import { reloadMcp, getAllTools, testMcpServer } from '../services/mcpClient.js';

const router = Router();

// ─── GET /api/mcp/config ─────────────────────────────────────────────────────

router.get('/config', (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const tools = getAllTools();

    res.json({
      code: 0,
      data: {
        enabled: config.mcp.enabled,
        servers: config.mcp.servers,
        tools: tools.map(t => ({
          qualifiedName: t.qualifiedName,
          serverName: t.serverName,
          name: t.name,
          description: t.description,
        })),
      },
      message: 'ok',
    });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// ─── PUT /api/mcp/config ────────────────────────────────────────────────────

router.put('/config', async (req: Request, res: Response) => {
  try {
    const { enabled, servers } = req.body;

    const validatedServers: McpServerConfig[] = [];
    if (Array.isArray(servers)) {
      for (const item of servers) {
        const result = McpServerConfigSchema.safeParse(item);
        if (result.success) {
          validatedServers.push(result.data);
        } else {
          console.error('[MCP] Server validation failed:', result.error.message);
          res.status(400).json({ code: 400, message: `服务器配置无效: ${result.error.message}` });
          return;
        }
      }
    }

    // Save to config.json
    const updated = saveConfig({
      mcp: {
        enabled: enabled !== undefined ? enabled : loadConfig().mcp.enabled,
        servers: validatedServers,
      },
    });

    // Reload
    const results = await reloadMcp(validatedServers);

    res.json({
      code: 0,
      data: {
        enabled: updated.mcp.enabled,
        servers: updated.mcp.servers,
        reloadResults: results,
      },
      message: '配置已保存并重载',
    });
  } catch (e: any) {
    console.error('[MCP] Save config failed:', e);
    res.status(500).json({ code: 500, message: e.message });
  }
});

// ─── POST /api/mcp/reload ────────────────────────────────────────────────────

router.post('/reload', async (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const servers = config.mcp.servers;
    const results = await reloadMcp(servers);

    res.json({
      code: 0,
      data: {
        results,
        tools: getAllTools().map(t => ({
          qualifiedName: t.qualifiedName,
          serverName: t.serverName,
          name: t.name,
          description: t.description,
        })),
      },
      message: 'MCP 服务已重载',
    });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// ─── POST /api/mcp/test ──────────────────────────────────────────────────────

router.post('/test', async (req: Request, res: Response) => {
  try {
    const result = McpServerConfigSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ code: 400, message: `配置无效: ${result.error.message}` });
      return;
    }
    const testResult = await testMcpServer(result.data);
    res.json({
      code: 0,
      data: testResult,
      message: testResult.success ? '连接成功' : `连接失败: ${testResult.error}`,
    });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

export default router;