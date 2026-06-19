/**
 * Tauri 环境检测与 Sidecar 管理
 *
 * 负责：
 * 1. 检测是否在 Tauri 环境中运行
 * 2. 在 Tauri 生产环境下启动 Sidecar 后端
 * 3. 动态获取后端 API 地址
 */

import { Command } from '@tauri-apps/plugin-shell';

let _isTauri: boolean | null = null;
let _backendPort: number | null = null;
let _backendPromise: Promise<number> | null = null;

/**
 * 检测是否在 Tauri 环境中运行
 */
export function isTauri(): boolean {
  if (_isTauri !== null) return _isTauri;
  _isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  return _isTauri;
}

/**
 * 获取后端 API 基础地址
 * - 开发环境：使用 Vite 代理，返回空字符串（相对路径 /api）
 * - Tauri 生产环境：启动 Sidecar 并返回 http://localhost:{port}
 */
export async function getBaseUrl(): Promise<string> {
  if (!isTauri()) {
    // 开发模式 / Vite 代理，使用相对路径
    return '';
  }

  // Tauri 生产模式：启动 Sidecar 获取端口
  if (_backendPort !== null) {
    return `http://127.0.0.1:${_backendPort}`;
  }

  if (_backendPromise === null) {
    _backendPromise = launchSidecar();
  }

  _backendPort = await _backendPromise;
  return `http://127.0.0.1:${_backendPort}`;
}

/**
 * 启动 Sidecar 后端并获取端口号
 */
async function launchSidecar(): Promise<number> {
  console.log('[Tauri] 正在启动后端 Sidecar...');

  try {
    const command = Command.sidecar('binaries/inkforge-backend');
    const output = await command.execute();

    // 解析 stdout 中的端口号：INKFORGE_SERVER_PORT=3001
    const stdout = output.stdout || '';
    const portMatch = stdout.match(/INKFORGE_SERVER_PORT=(\d+)/);

    if (portMatch) {
      const port = parseInt(portMatch[1], 10);
      console.log(`[Tauri] 后端 Sidecar 已启动，端口: ${port}`);
      return port;
    }

    // 如果无法从 stdout 解析，尝试从 stderr 解析
    const stderr = output.stderr || '';
    const stderrMatch = stderr.match(/INKFORGE_SERVER_PORT=(\d+)/);
    if (stderrMatch) {
      const port = parseInt(stderrMatch[1], 10);
      console.log(`[Tauri] 后端 Sidecar 已启动，端口: ${port}`);
      return port;
    }

    console.warn('[Tauri] 无法从 Sidecar 输出中解析端口号，使用默认端口 3001');
    console.log('[Tauri] stdout:', stdout);
    console.log('[Tauri] stderr:', stderr);
    return 3001;
  } catch (err) {
    console.error('[Tauri] Sidecar 启动失败:', err);
    throw new Error('后端服务启动失败');
  }
}

/**
 * 获取后端端口（同步版本，仅当端口已确定时有效）
 */
export function getBackendPort(): number | null {
  return _backendPort;
}