import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "namu_watch.db");

let db: SqlJsDatabase | null = null;

export async function initDb(): Promise<void> {
  if (db) return;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA journal_mode = WAL");
  initializeSchema(db);
  saveDb();
}

function initializeSchema(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at TEXT NOT NULL,
      rank INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '기타',
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      post_id INTEGER NOT NULL
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON snapshots(captured_at)");
  db.run("CREATE INDEX IF NOT EXISTS idx_snapshots_keyword ON snapshots(keyword)");
  db.run("CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at_keyword ON snapshots(captured_at, keyword)");

  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      post_id INTEGER PRIMARY KEY,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '기타',
      body TEXT NOT NULL DEFAULT '',
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      posted_at TEXT NOT NULL DEFAULT '',
      fetched_at TEXT NOT NULL
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_articles_keyword ON articles(keyword)");
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}