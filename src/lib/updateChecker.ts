/**
 * GitHub Release 更新检查服务
 *
 * 通过 GitHub API 静默检查最新 release，与当前版本比较。
 * 仅在 Tauri 环境中生效；浏览器开发环境直接跳过。
 */

import { isTauri } from '@/lib/tauri-env';

const GITHUB_REPO = 'SMHwoww/InkForge';
const CURRENT_VERSION = '0.1.0';
// 与 src-tauri/tauri.conf.json 中的 version 字段保持同步

export interface UpdateInfo {
  version: string;
  name: string;
  url: string;
  body: string;
  publishedAt: string;
  isPrerelease: boolean;
}

/**
 * 从 GitHub API 获取最新 release 并与当前版本比较
 * @param includePrerelease 是否包含预发布版本
 * @returns 如果有新版本则返回 UpdateInfo，否则返回 null
 */
export async function checkForUpdates(
  includePrerelease: boolean = false,
): Promise<UpdateInfo | null> {
  if (!isTauri()) {
    // 浏览器开发环境：跳过更新检查
    console.log('[Update] 非 Tauri 环境，跳过更新检查');
    return null;
  }

  try {
    const url = includePrerelease
      ? `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=5`
      : `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      if (response.status === 403) {
        console.warn('[Update] GitHub API 频率限制，跳过本次检查');
      } else {
        console.warn(`[Update] GitHub API 返回 ${response.status}`);
      }
      return null;
    }

    let release: any;
    if (includePrerelease) {
      const releases: any[] = await response.json();
      if (!Array.isArray(releases) || releases.length === 0) return null;

      // 排除 draft，按发布日期排序取最新
      const valid = releases.filter(r => !r.draft);
      if (valid.length === 0) return null;
      release = valid[0];
    } else {
      release = await response.json();
    }

    if (!release || !release.tag_name) return null;

    const latestVersion = cleanVersion(release.tag_name);
    const currentVersion = cleanVersion(CURRENT_VERSION);

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      console.log(`[Update] 当前已是最新版本 (${CURRENT_VERSION})`);
      return null;
    }

    console.log(`[Update] 发现新版本: ${release.tag_name} (当前: ${CURRENT_VERSION})`);

    return {
      version: release.tag_name,
      name: release.name || release.tag_name,
      url: release.html_url,
      body: release.body || '',
      publishedAt: release.published_at || release.created_at,
      isPrerelease: release.prerelease || false,
    };
  } catch (err) {
    console.warn('[Update] 检查更新失败:', err);
    return null;
  }
}

/** 去掉版本号前的 'v' 前缀 */
function cleanVersion(version: string): string {
  return version.replace(/^v/, '');
}

/** 简单语义化版本比较，返回正数表示 a > b */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(/[.\-]/).map(Number);
  const partsB = b.split(/[.\-]/).map(Number);
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (isNaN(numA) || isNaN(numB)) {
      // 非数字部分按字符串比较
      const strA = String(partsA[i] || '');
      const strB = String(partsB[i] || '');
      if (strA < strB) return -1;
      if (strA > strB) return 1;
      continue;
    }
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/** 获取当前应用版本号 */
export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
