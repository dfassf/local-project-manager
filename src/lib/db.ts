import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'command-center.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT,
      path TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL,
      project_type TEXT,
      is_monorepo INTEGER DEFAULT 0,
      git_remote TEXT,
      dev_command TEXT,
      dev_port INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      content TEXT NOT NULL,
      note_type TEXT DEFAULT 'memo',
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      summary_type TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS process_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id),
      label TEXT NOT NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL,
      port INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS process_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id INTEGER REFERENCES process_configs(id),
      pid INTEGER,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      stopped_at DATETIME,
      exit_code INTEGER,
      stop_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS claude_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      file_path TEXT NOT NULL,
      first_message TEXT,
      message_count INTEGER DEFAULT 0,
      started_at DATETIME,
      last_activity DATETIME
    );

    CREATE TABLE IF NOT EXISTS scan_directories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      slug TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);
    CREATE INDEX IF NOT EXISTS idx_summaries_project ON ai_summaries(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON claude_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_process_configs_project ON process_configs(project_id);
  `);

  // 기본 스캔 디렉토리 시드
  const count = db.prepare('SELECT COUNT(*) as c FROM scan_directories').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO scan_directories (path, label, slug) VALUES (?, ?, ?)');
    insert.run('/Users/test/Desktop/private_repo', '개인', 'personal');
    insert.run('/Users/test/Desktop/지금회사/repo', '회사', 'work');
  }
}
