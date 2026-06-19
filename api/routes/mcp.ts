/**
 * MCP 配置管理 API
 *
 * GET  /api/mcp/config   — 获取当前 MCP 配置
 * PUT  /api/mcp/config   — 更新 MCP 配置（写入 config.json 并热重载）
 * POST /api/mcp/reload   — 热重载 MCP 服务器
 * POST /api/mcp/test     — 测试单个服务器连接
 */

import { Router, type Request, type Response } from 'express';
import { loadConfig, saveConfig, getBuiltinServerConfig, McpServerConfigSchema, type McpServerConfig } from '../services/mcpConfig.js';
import { reloadMcp, getAllTools, testMcpServer } from '../services/mcpClient.js';
import { BUILTIN_SERVER_NAME } from '../services/builtinTools.js';

const router = Router();

// ─── GET /api/mcp/config ─────────────────────────────────────────────────────

router.get('/config', (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const tools = getAllTools();

    // 内置 MCP 服务始终排在第一位
    const builtinConfig = getBuiltinServerConfig();
    const allServers = [builtinConfig, ...config.mcp.servers.filter(s => s.name !== BUILTIN_SERVER_NAME)];

    res.json({
      code: 0,
      data: {
        enabled: config.mcp.enabled,
        builtinEnabled: config.mcp.builtinEnabled,
        servers: allServers,
        builtinServerName: BUILTIN_SERVER_NAME,
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
    const { enabled, builtinEnabled, servers } = req.body;

    const validatedServers: McpServerConfig[] = [];
    if (Array.isArray(servers)) {
      for (const item of servers) {
        // 禁止删除或修改内置 MCP 服务
        if (item.builtin) {
          continue;
        }
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
    const current = loadConfig();
    const updated = saveConfig({
      mcp: {
        enabled: enabled !== undefined ? enabled : current.mcp.enabled,
        builtinEnabled: builtinEnabled !== undefined ? builtinEnabled : current.mcp.builtinEnabled,
        servers: validatedServers,
      },
    });

    // Reload
    const results = await reloadMcp(validatedServers);

    res.json({
      code: 0,
      data: {
        enabled: updated.mcp.enabled,
        builtinEnabled: updated.mcp.builtinEnabled,
        servers: [getBuiltinServerConfig(), ...updated.mcp.servers],
        builtinServerName: BUILTIN_SERVER_NAME,
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
        builtinServerName: BUILTIN_SERVER_NAME,
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