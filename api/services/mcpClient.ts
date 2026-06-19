/**
 * MCP 客户端 — 管理与 MCP 服务器的连接和工具调用
 *
 * 支持两种传输方式：
 * - remote: Streamable HTTP 远程服务器（默认）
 * - local: stdio 本地进程
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpServerConfig } from './mcpConfig.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface McpToolDefinition {
  qualifiedName: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

// ─── Connection Manager ──────────────────────────────────────────────────────

class McpConnection {
  client: Client;
  transport: Transport;
  serverName: string;
  tools: McpToolDefinition[] = [];

  constructor(client: Client, transport: Transport, serverName: string) {
    this.client = client;
    this.transport = transport;
    this.serverName = serverName;
  }

  async close(): Promise<void> {
    try { await this.client.close(); } catch { /* ignore */ }
  }
}

// ─── Singleton Manager ───────────────────────────────────────────────────────

let _connections: McpConnection[] | null = null;
let _initialized = false;

async function connectServer(cfg: McpServerConfig): Promise<McpConnection> {
  console.log(`[MCP] Connecting to ${cfg.name} (${cfg.type})`);

  const client = new Client(
    { name: 'InkForge', version: '1.0.0' },
    { capabilities: {} },
  );

  let transport: Transport;

  if (cfg.type === 'remote') {
    // 使用 StreamableHTTPClientTransport 替代已弃用的 SSEClientTransport
    // 修复 SSE error: Non-200 status code (405) 问题
    const headers: Record<string, string> = { ...cfg.headers };
    transport = new StreamableHTTPClientTransport(new URL(cfg.url), {
      requestInit: Object.keys(headers).length > 0 ? { headers } : undefined,
    });
  } else {
    transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args,
      env: { ...process.env, ...cfg.env } as Record<string, string>,
    });
  }

  await client.connect(transport);

  const conn = new McpConnection(client, transport, cfg.name);
  const toolsResult = await client.listTools();

  for (const tool of toolsResult.tools) {
    conn.tools.push({
      qualifiedName: `${cfg.name}::${tool.name}`,
      serverName: cfg.name,
      name: tool.name,
      description: tool.description || '',
      inputSchema: (tool as any).inputSchema || { type: 'object', properties: {} },
    });
  }

  return conn;
}

export async function initializeMcp(configs: McpServerConfig[]): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  if (!configs.length) {
    console.log('[MCP] No MCP servers configured, skipping initialization');
    return;
  }

  _connections = [];

  for (const cfg of configs) {
    try {
      const conn = await connectServer(cfg);
      _connections.push(conn);
      console.log(`[MCP] Connected to ${cfg.name}: ${conn.tools.length} tools`);
    } catch (e: any) {
      console.error(`[MCP] Failed to connect to "${cfg.name}":`, e.message);
    }
  }

  console.log(`[MCP] Initialized ${_connections.length}/${configs.length} servers, ${getAllTools().length} total tools`);
}

export function getAllTools(): McpToolDefinition[] {
  if (!_connections) return [];
  return _connections.flatMap(c => c.tools);
}

export function toolsToOpenAI(): OpenAIToolDefinition[] {
  return getAllTools().map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.qualifiedName,
      description: tool.description || tool.name,
      parameters: {
        type: 'object',
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || [],
      },
    },
  }));
}

function findTool(qualifiedName: string): { conn: McpConnection; tool: McpToolDefinition } | null {
  if (!_connections) return null;
  for (const conn of _connections) {
    const tool = conn.tools.find(t => t.qualifiedName === qualifiedName);
    if (tool) return { conn, tool };
  }
  return null;
}

export async function executeToolCall(
  qualifiedName: string,
  args: Record<string, any>,
): Promise<string> {
  const found = findTool(qualifiedName);
  if (!found) {
    return `Error: Tool "${qualifiedName}" not found. Available tools: ${getAllTools().map(t => t.qualifiedName).join(', ') || 'none'}`;
  }

  const { conn, tool } = found;

  try {
    const result = await conn.client.callTool({
      name: tool.name,
      arguments: args,
    });

    const contentArr = (result.content as any[]) || [];
    const contents = contentArr
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');

    return contents || JSON.stringify(result.content);
  } catch (e: any) {
    console.error(`[MCP] Tool call "${qualifiedName}" failed:`, e.message);
    return `Error executing "${qualifiedName}": ${e.message}`;
  }
}

export async function shutdownMcp(): Promise<void> {
  if (!_connections) return;
  console.log('[MCP] Shutting down all MCP connections...');
  await Promise.all(_connections.map(c => c.close().catch(() => {})));
  _connections = null;
  _initialized = false;
  console.log('[MCP] All connections closed');
}

export async function reloadMcp(configs: McpServerConfig[]): Promise<Array<{ name: string; success: boolean; toolCount: number; error?: string }>> {
  await shutdownMcp();
  _initialized = false;

  if (!configs.length) {
    console.log('[MCP] No configs to reload, skipping');
    return [];
  }

  _connections = [];
  const results: Array<{ name: string; success: boolean; toolCount: number; error?: string }> = [];

  for (const cfg of configs) {
    try {
      const conn = await connectServer(cfg);
      _connections.push(conn);
      results.push({ name: cfg.name, success: true, toolCount: conn.tools.length });
      console.log(`[MCP] Reloaded ${cfg.name}: ${conn.tools.length} tools`);
    } catch (e: any) {
      console.error(`[MCP] Reload failed for "${cfg.name}":`, e.message);
      results.push({ name: cfg.name, success: false, toolCount: 0, error: e.message });
    }
  }

  _initialized = true;
  console.log(`[MCP] Reload done: ${results.filter(r => r.success).length}/${configs.length} servers`);
  return results;
}

export async function testMcpServer(cfg: McpServerConfig): Promise<{ success: boolean; toolCount: number; error?: string }> {
  try {
    const conn = await connectServer(cfg);
    const toolCount = conn.tools.length;
    await conn.close();
    return { success: true, toolCount };
  } catch (e: any) {
    return { success: false, toolCount: 0, error: e.message };
  }
}