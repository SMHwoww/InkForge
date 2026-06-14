import initSqlJs, { type Database } from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', '..', 'data');
const dbPath = path.join(dataDir, 'ward.db');

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  return db;
}

export function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export async function initDatabase() {
  const database = await getDb();
  database.run(`
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
  `);

  // Migration: add columns to existing timeline_events table
  try { database.run('ALTER TABLE timeline_events ADD COLUMN placed INTEGER DEFAULT 0'); } catch (_) {}
  try { database.run('ALTER TABLE timeline_events ADD COLUMN pos_x INTEGER'); } catch (_) {}
  try { database.run('ALTER TABLE timeline_events ADD COLUMN pos_y INTEGER'); } catch (_) {}

  saveDb();
}