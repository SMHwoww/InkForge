/**
 * Database connection and initialization
 * Uses better-sqlite3 for persistent file-based SQLite with WAL mode.
 */

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// In bundled builds, __dirname is a CJS global at the entry point but NOT inside
// esbuild's __commonJS wrappers, so it's undefined there.
// In ESM dev (tsx), it's undefined and we derive it from import.meta.url.
declare var __dirname: string | undefined;

// INKFORGE_BUNDLED is injected by esbuild define at build time.
// In production (SEA executable), place data alongside the executable.
// In development, use data/ relative to the project root.
declare const INKFORGE_BUNDLED: boolean | undefined;

const currentDirname = typeof INKFORGE_BUNDLED !== 'undefined'
  ? path.dirname(process.execPath)
  : typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

/** 惰性获取 data 目录路径 —— 运行时计算，确保 INKFORGE_DATA_DIR 已生效 */
function getDataDir(): string {
  if (process.env.INKFORGE_DATA_DIR) {
    return path.join(process.env.INKFORGE_DATA_DIR, 'data');
  }
  if (typeof INKFORGE_BUNDLED !== 'undefined') {
    return path.join(path.dirname(process.execPath), 'data');
  }
  return path.join(currentDirname, '..', '..', 'data');
}
function getDbPath(): string {
  return path.join(getDataDir(), 'ward.db');
}

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _rawDb: Database.Database | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _db;
}

export function getRawDb(): Database.Database {
  if (!_rawDb) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _rawDb;
}

export async function initDatabase(): Promise<void> {
  const dataDir = getDataDir();
  const dbPath = getDbPath();

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const rawDb = new Database(dbPath);
  rawDb.pragma('journal_mode = WAL');
  rawDb.pragma('foreign_keys = ON');

  // Create tables
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      cover_url TEXT,
      genre TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'ongoing', 'completed')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      age INTEGER,
      appearance TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      background TEXT DEFAULT '',
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);

    CREATE TABLE IF NOT EXISTS worldbuilding_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_worldbuilding_project ON worldbuilding_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_worldbuilding_category ON worldbuilding_items(project_id, category);

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      order_num INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'writing', 'completed')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);

    CREATE TABLE IF NOT EXISTS outline_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      parent_id INTEGER REFERENCES outline_items(id) ON DELETE SET NULL,
      chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
      sort_order INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planning' CHECK(status IN ('planning', 'writing', 'completed')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_outline_project ON outline_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_outline_parent ON outline_items(parent_id);

    CREATE TABLE IF NOT EXISTS relation_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_char_id INTEGER NOT NULL,
      target_char_id INTEGER NOT NULL,
      relation_type TEXT DEFAULT '',
      label TEXT DEFAULT '',
      description TEXT DEFAULT '',
      source_x REAL DEFAULT 0,
      source_y REAL DEFAULT 0,
      target_x REAL DEFAULT 0,
      target_y REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS graph_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      node_type TEXT DEFAULT '',
      label TEXT DEFAULT '',
      description TEXT DEFAULT '',
      char_id INTEGER,
      pos_x REAL DEFAULT 0,
      pos_y REAL DEFAULT 0,
      style_data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS star_map_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('character', 'worldbuilding', 'custom')),
      entity_id INTEGER,
      name TEXT NOT NULL,
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      color TEXT DEFAULT '#c9a96e',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_star_nodes_project ON star_map_nodes(project_id);

    CREATE TABLE IF NOT EXISTS star_map_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_node_id INTEGER NOT NULL REFERENCES star_map_nodes(id) ON DELETE CASCADE,
      target_node_id INTEGER NOT NULL REFERENCES star_map_nodes(id) ON DELETE CASCADE,
      relation_type TEXT DEFAULT 'other' CHECK(relation_type IN ('family','friend','love','enemy','master_student','colleague','association','other')),
      label TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_star_edges_project ON star_map_edges(project_id);

    CREATE TABLE IF NOT EXISTS timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      event_date TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      category TEXT DEFAULT '',
      placed INTEGER DEFAULT 0,
      pos_x INTEGER,
      pos_y INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_timeline_project ON timeline_events(project_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_sort ON timeline_events(project_id, sort_order);

    CREATE TABLE IF NOT EXISTS timeline_perspectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_perspective_project ON timeline_perspectives(project_id);

    CREATE TABLE IF NOT EXISTS timeline_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      x_labels TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS image_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      negative_prompt TEXT,
      model TEXT DEFAULT 'wan2.6-t2i',
      size TEXT DEFAULT '1280*1280',
      images TEXT,
      task_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_project ON chat_messages(project_id);

    CREATE TABLE IF NOT EXISTS media_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'image' CHECK(type IN ('image', 'video', 'audio')),
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      prompt TEXT DEFAULT '',
      source TEXT DEFAULT 'upload' CHECK(source IN ('upload', 'generated')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_media_project ON media_assets(project_id);
  `);

  // Migrations for existing databases
  try { rawDb.exec('ALTER TABLE timeline_events ADD COLUMN placed INTEGER DEFAULT 0'); } catch (_) {}
  try { rawDb.exec('ALTER TABLE timeline_events ADD COLUMN pos_x INTEGER'); } catch (_) {}
  try { rawDb.exec('ALTER TABLE timeline_events ADD COLUMN pos_y INTEGER'); } catch (_) {}
  try { rawDb.exec('ALTER TABLE chat_messages ADD COLUMN tool_calls TEXT'); } catch (_) {}

  _rawDb = rawDb;
  _db = drizzle(rawDb, { schema });

  console.log('[DB] Database initialized with WAL mode');
}