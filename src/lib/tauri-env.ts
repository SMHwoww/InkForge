/**
 * Tauri 环境检测与 Sidecar 管理
 *
 * 负责：
 * 1. 检测是否在 Tauri 环境中运行
 * 2. 在 Tauri 生产环境下启动 Sidecar 后端
 * 3. 动态获取后端 API 地址
 */

import { Command } from '@tauri-apps/plugin-shell';
import { appDataDir } from '@tauri-apps/api/path';

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
 *
 * 使用 spawn() 而非 execute()，因为后端是长期运行的服务器进程，
 * execute() 会阻塞等待进程退出，导致永远不会返回。
 * 改用轮询 /api/health 端点检测服务就绪。
 */
async function launchSidecar(): Promise<number> {
  const DEFAULT_PORT = 3001;

  console.log('[Tauri] 正在启动后端 Sidecar...');

  try {
    const dataDir = await appDataDir();
    const command = Command.sidecar('binaries/inkforge-backend', ['--data-dir=' + dataDir]);

    // 从 Sidecar stdout 中解析实际端口号
    // 后端在 server.ts 中输出 INKFORGE_SERVER_PORT=<port> 行
    let resolvedPort: number | null = null;
    command.stdout.on('data', (line: string) => {
      const match = line.match(/INKFORGE_SERVER_PORT=(\d+)/);
      if (match) {
        resolvedPort = parseInt(match[1], 10);
        console.log(`[Tauri] 从 Sidecar stdout 解析到端口: ${resolvedPort}`);
      }
    });

    command.on('close', (data) => {
      console.log(`[Tauri] Sidecar 进程退出, code=${data.code}, signal=${data.signal}`);
    });
    command.on('error', (error) => {
      console.error('[Tauri] Sidecar 进程错误:', error);
    });

    const child = await command.spawn();
    console.log(`[Tauri] Sidecar 已 spawn, pid=${child.pid}`);

    // 轮询 health 端点等待服务就绪（最多等 15 秒）
    const maxRetries = 30;
    const pollInterval = 500;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));

      // 优先使用从 stdout 解析到的端口，若尚未收到则回退到默认端口
      const port = resolvedPort || DEFAULT_PORT;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (res.ok) {
          console.log(`[Tauri] 后端 Sidecar 已就绪，端口: ${port}`);
          return port;
        }
      } catch {
        // 服务尚未就绪，继续等待
      }
    }

    console.warn(`[Tauri] 后端未在 ${(maxRetries * pollInterval) / 1000}s 内就绪，使用默认端口 ${DEFAULT_PORT}`);
    return DEFAULT_PORT;
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