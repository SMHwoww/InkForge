import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { logError, logInfo } from './logger.js';

const SERVICE = 'Downloader';

export interface DownloadOptions {
  /** 目标保存路径（含文件名） */
  destPath: string;
  /** 进度回调，返回已下载字节数和总字节数（可能为 0 表示未知） */
  onProgress?: (downloaded: number, total: number) => void;
  /** 取消信号，通过 AbortController 控制 */
  signal?: AbortSignal;
  /** 请求超时时间（毫秒），默认 30000 */
  timeout?: number;
  /** 最大重试次数，默认 2 */
  maxRetries?: number;
}

export interface DownloadResult {
  success: boolean;
  filePath: string;
  size: number;
  error?: string;
}

/**
 * 从 URL 下载文件到本地
 */
export async function downloadFile(
  url: string,
  options: DownloadOptions,
): Promise<DownloadResult> {
  const {
    destPath,
    onProgress,
    signal,
    timeout = 30000,
    maxRetries = 2,
  } = options;

  // 确保目标目录存在
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await doDownload(url, destPath, onProgress, signal, timeout);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (signal?.aborted) break;
      logError(SERVICE, `Download attempt ${attempt + 1} failed for ${url}`, lastError);
    }
  }

  return {
    success: false,
    filePath: destPath,
    size: 0,
    error: lastError?.message || '下载失败',
  };
}

function doDownload(
  url: string,
  destPath: string,
  onProgress?: DownloadOptions['onProgress'],
  signal?: AbortSignal,
  timeout?: number,
): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout }, (res) => {
      // 处理重定向
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        doDownload(redirectUrl, destPath, onProgress, signal, timeout)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;

      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        onProgress?.(downloaded, total);
      });

      res.on('end', () => {
        fileStream.end();
        logInfo(SERVICE, `Download completed: ${url} -> ${destPath}`, { size: downloaded });
        resolve({ success: true, filePath: destPath, size: downloaded });
      });

      res.on('error', (err) => {
        fileStream.destroy();
        fs.unlink(destPath, () => {});
        reject(err);
      });

      res.pipe(fileStream);
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    // 取消支持
    if (signal) {
      const onAbort = () => {
        req.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error('下载已取消'));
      };
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });
}