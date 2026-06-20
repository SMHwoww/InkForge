/**
 * MCP 配置管理 — 统一配置系统
 *
 * 使用 JSON 配置文件 config.json 替代 .env 文件管理所有配置。
 * 配置读写通过 /api/config API 进行。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { BUILTIN_SERVER_NAME } from './builtinTools.js';

// INKFORGE_BUNDLED is injected by esbuild define at build time.
// In production (SEA executable), place data alongside the executable.
declare const INKFORGE_BUNDLED: boolean | undefined;

// __dirname is a CJS global in esbuild builds; undefined in ESM dev
declare var __dirname: string | undefined;

const currentDirname = typeof INKFORGE_BUNDLED !== 'undefined'
  ? path.dirname(process.execPath)
  : typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

/** 惰性获取 config.json 路径 —— 运行时计算，确保 INKFORGE_DATA_DIR 已生效 */
function getConfigPath(): string {
  if (process.env.INKFORGE_DATA_DIR) {
    return path.join(process.env.INKFORGE_DATA_DIR, 'config.json');
  }
  if (typeof INKFORGE_BUNDLED !== 'undefined') {
    return path.join(path.dirname(process.execPath), 'config.json');
  }
  return path.resolve(currentDirname, '..', '..', 'config.json');
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const McpServerConfigSchema = z.discriminatedUnion('type', [
  z.object({
    name: z.string(),
    type: z.literal('remote'),
    url: z.string(),
    headers: z.record(z.string()).optional().default({}),
    builtin: z.boolean().optional(),
    disabled: z.boolean().optional().default(false),
  }),
  z.object({
    name: z.string(),
    type: z.literal('local'),
    command: z.string(),
    args: z.array(z.string()).optional().default([]),
    env: z.record(z.string()).optional().default({}),
    builtin: z.boolean().optional(),
    disabled: z.boolean().optional().default(false),
  }),
]);

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const AppConfigSchema = z.object({
  ai: z.object({
    apiKey: z.string().default(''),
    baseUrl: z.string().default('https://api.openai.com/v1'),
    model: z.string().default('gpt-4o-mini'),
  }),
  image: z.object({
    provider: z.enum(['bailian', 'openai']).default('bailian'),
    apiKey: z.string().default(''),
    baseUrl: z.string().default(''),
    model: z.string().default('wan2.6-t2i'),
    region: z.enum(['beijing', 'singapore', 'virginia']).default('beijing'),
  }),
  mcp: z.object({
    enabled: z.boolean().default(true),
    builtinEnabled: z.boolean().default(true),
    servers: z.array(McpServerConfigSchema).default([]),
  }),
  modules: z.object({
    visible: z.record(z.boolean()).default({}),
    order: z.array(z.string()).default([]),
  }),
  update: z.object({
    checkEnabled: z.boolean().default(true),
    includePrerelease: z.boolean().default(false),
    autoDownload: z.boolean().default(true),
    silent: z.boolean().default(false),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// ─── Default config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AppConfig = {
  ai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  image: {
    provider: 'bailian',
    apiKey: '',
    baseUrl: '',
    model: 'wan2.6-t2i',
    region: 'beijing',
  },
  mcp: {
    enabled: true,
    builtinEnabled: true,
    servers: [],
  },
  modules: {
    visible: {},
    order: [],
  },
  update: {
    checkEnabled: true,
    includePrerelease: false,
    autoDownload: true,
    silent: false,
  },
};

// ─── In-memory cache ─────────────────────────────────────────────────────────

let _config: AppConfig | null = null;

// ─── Load / Save ─────────────────────────────────────────────────────────────

export function loadConfig(): AppConfig {
  if (_config) return _config;

  try {
    if (fs.existsSync(getConfigPath())) {
      const raw = fs.readFileSync(getConfigPath(), 'utf-8');
      const parsed = JSON.parse(raw);

      // Merge with defaults to handle missing keys
      _config = {
        ai: { ...DEFAULT_CONFIG.ai, ...parsed.ai },
        image: { ...DEFAULT_CONFIG.image, ...parsed.image },
        mcp: {
          ...DEFAULT_CONFIG.mcp,
          ...parsed.mcp,
          servers: Array.isArray(parsed.mcp?.servers) ? parsed.mcp.servers : [],
        },
        modules: {
          ...DEFAULT_CONFIG.modules,
          ...parsed.modules,
          visible: parsed.modules?.visible || {},
          order: Array.isArray(parsed.modules?.order) ? parsed.modules.order : [],
        },
        update: { ...DEFAULT_CONFIG.update, ...parsed.update },
      };

      // Validate
      const result = AppConfigSchema.safeParse(_config);
      if (result.success) {
        _config = result.data;
      } else {
        console.warn('[Config] Validation failed, using defaults:', result.error.message);
        _config = DEFAULT_CONFIG;
      }
    } else {
      _config = DEFAULT_CONFIG;
      saveConfig(_config); // create default config file
    }
  } catch (e) {
    console.error('[Config] Failed to load config:', e);
    _config = DEFAULT_CONFIG;
  }

  return _config;
}

export function saveConfig(config: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const merged: AppConfig = {
    ai: { ...current.ai, ...config.ai },
    image: { ...current.image, ...config.image },
    mcp: {
      ...current.mcp,
      ...config.mcp,
      servers: config.mcp?.servers ?? current.mcp.servers,
    },
    modules: {
      ...current.modules,
      ...config.modules,
      visible: config.modules?.visible ?? current.modules.visible,
      order: config.modules?.order ?? current.modules.order,
    },
    update: { ...current.update, ...config.update },
  };

  // Validate
  const result = AppConfigSchema.safeParse(merged);
  if (!result.success) {
    console.error('[Config] Validation failed:', result.error.message);
    throw new Error(`配置验证失败: ${result.error.message}`);
  }
  _config = result.data;
  try {
    const dir = path.dirname(getConfigPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getConfigPath(), JSON.stringify(_config, null, 2), 'utf-8');
    console.log('[Config] Saved to', getConfigPath(), '- MCP servers:', _config.mcp.servers.length);
  } catch (e) {
    console.error('[Config] Failed to save config:', e);
    throw new Error('无法写入配置文件');
  }
  return _config;
}

export function reloadConfig(): AppConfig {
  _config = null;
  return loadConfig();
}

// ─── Convenience getters ─────────────────────────────────────────────────────

export function getMcpEnabled(): boolean {
  return loadConfig().mcp.enabled;
}

export function getBuiltinEnabled(): boolean {
  return loadConfig().mcp.builtinEnabled;
}

export function loadMcpServerConfigs(): McpServerConfig[] {
  return loadConfig().mcp.servers;
}

export function getAiConfig() {
  return loadConfig().ai;
}

export function getImageConfig() {
  return loadConfig().image;
}

export function getUpdateConfig() {
  return loadConfig().update;
}

/** 获取内置 MCP 服务配置（始终启用，不可删除） */
export function getBuiltinServerConfig(): McpServerConfig {
  return {
    name: BUILTIN_SERVER_NAME,
    type: 'local',
    command: 'builtin',
    args: [],
    env: {},
    builtin: true,
  };
}
