/**
 * 原生 SQLite 数据库客户端（Tauri 环境）
 *
 * 使用 @tauri-apps/plugin-sql 直接操作原生 SQLite。
 * 这是对后端 sql.js 的性能优化替代方案，可逐步迁移。
 *
 * 在非 Tauri 环境下，回退到后端 REST API。
 */

import { isTauri } from './tauri-env';

let _dbPromise: Promise<unknown> | null = null;

async function getDb() {
  if (!_dbPromise) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _dbPromise = Database.load('sqlite:inkforge.db');
  }
  return _dbPromise;
}

/**
 * 执行 SELECT 查询
 */
export async function dbSelect<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!isTauri()) {
    throw new Error('原生数据库查询仅在 Tauri 环境下可用，请使用 REST API');
  }

  const db = await getDb() as { select: (sql: string, params?: unknown[]) => Promise<T[]> };
  return db.select(sql, params);
}

/**
 * 执行 INSERT/UPDATE/DELETE 语句
 */
export async function dbExecute(
  sql: string,
  params: unknown[] = [],
): Promise<{ rowsAffected: number; lastInsertId: number }> {
  if (!isTauri()) {
    throw new Error('原生数据库操作仅在 Tauri 环境下可用，请使用 REST API');
  }

  const db = await getDb() as { execute: (sql: string, params?: unknown[]) => Promise<{ rowsAffected: number; lastInsertId: number }> };
  return db.execute(sql, params);
}

/**
 * 便捷方法：获取单个项目
 */
export async function getProject(id: number) {
  const rows = await dbSelect<{ id: number; title: string; summary: string; genre: string; status: string; updated_at: string }>(
    'SELECT * FROM projects WHERE id = $1',
    [id],
  );
  return rows[0] || null;
}

/**
 * 便捷方法：获取所有项目
 */
export async function getProjects() {
  return dbSelect<{ id: number; title: string; summary: string; genre: string; status: string; updated_at: string }>(
    'SELECT * FROM projects ORDER BY updated_at DESC',
  );
}

/**
 * 便捷方法：创建项目
 */
export async function createProject(data: { title: string; summary?: string; genre?: string }) {
  return dbExecute(
    'INSERT INTO projects (title, summary, genre) VALUES ($1, $2, $3)',
    [data.title, data.summary || '', data.genre || ''],
  );
}

/**
 * 便捷方法：更新项目
 */
export async function updateProject(id: number, data: Record<string, unknown>) {
  const keys = Object.keys(data);
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
  const values = keys.map(k => data[k]);

  return dbExecute(
    `UPDATE projects SET ${setClauses.join(', ')}, updated_at = datetime('now', 'localtime') WHERE id = $1`,
    [id, ...values],
  );
}

/**
 * 便捷方法：删除项目
 */
export async function deleteProject(id: number) {
  return dbExecute('DELETE FROM projects WHERE id = $1', [id]);
}