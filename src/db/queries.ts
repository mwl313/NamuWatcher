import type { SnapshotRow, ArticleRow } from "../types.js";
import { getDb, saveDb } from "./schema.js";

// ===== Snapshots =====

export function insertSnapshots(rows: SnapshotRow[]): void {
  if (rows.length === 0) return;
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO snapshots (captured_at, rank, keyword, category, views, likes, comments, post_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of rows) {
    stmt.bind([item.captured_at, item.rank, item.keyword, item.category, item.views, item.likes, item.comments, item.post_id]);
    stmt.step();
    stmt.reset();
  }

  stmt.free();
  saveDb();
}

export function getSnapshotsByDate(date: string, count: number): SnapshotRow[] {
  const db = getDb();
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;
  const stmt = db.prepare("SELECT * FROM snapshots WHERE captured_at >= ? AND captured_at <= ? ORDER BY rank ASC LIMIT ?");
  stmt.bind([start, end, count]);
  const rows: SnapshotRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as SnapshotRow);
  }
  stmt.free();
  return rows;
}

export function getSnapshotsByKeyword(
  keyword: string,
  limit: number
): { captured_at: string; rank: number; views: number }[] {
  const db = getDb();
  const stmt = db.prepare("SELECT captured_at, rank, views FROM snapshots WHERE keyword = ? ORDER BY captured_at DESC LIMIT ?");
  stmt.bind([keyword, limit]);
  const rows: { captured_at: string; rank: number; views: number }[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as { captured_at: string; rank: number; views: number });
  }
  stmt.free();
  return rows;
}

export function getRecentSnapshots(hours: number): SnapshotRow[] {
  const db = getDb();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const stmt = db.prepare("SELECT * FROM snapshots WHERE captured_at >= ? ORDER BY captured_at DESC");
  stmt.bind([cutoff]);
  const rows: SnapshotRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as SnapshotRow);
  }
  stmt.free();
  return rows;
}

export function getSnapshotsInRange(from: string, to: string): SnapshotRow[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM snapshots WHERE captured_at >= ? AND captured_at <= ?");
  stmt.bind([from, to]);
  const rows: SnapshotRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as SnapshotRow);
  }
  stmt.free();
  return rows;
}

export function getDistinctKeywordsInRange(from: string, to: string): string[] {
  const db = getDb();
  const stmt = db.prepare("SELECT DISTINCT keyword FROM snapshots WHERE captured_at >= ? AND captured_at <= ?");
  stmt.bind([from, to]);
  const keywords: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { keyword: string };
    keywords.push(row.keyword);
  }
  stmt.free();
  return keywords;
}

export function getTodayTopKeywords(date: string): { keyword: string; rank: number }[] {
  const db = getDb();
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;
  const stmt = db.prepare(
    "SELECT keyword, MIN(rank) as rank FROM snapshots WHERE captured_at >= ? AND captured_at <= ? GROUP BY keyword ORDER BY COUNT(*) DESC LIMIT 5"
  );
  stmt.bind([start, end]);
  const rows: { keyword: string; rank: number }[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as { keyword: string; rank: number });
  }
  stmt.free();
  return rows;
}

export function getTodayCategoryDistribution(
  date: string
): { category: string; count: number }[] {
  const db = getDb();
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;
  const stmt = db.prepare(
    "SELECT category, COUNT(DISTINCT keyword) as count FROM snapshots WHERE captured_at >= ? AND captured_at <= ? GROUP BY category ORDER BY count DESC"
  );
  stmt.bind([start, end]);
  const rows: { category: string; count: number }[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as { category: string; count: number });
  }
  stmt.free();
  return rows;
}

export function getTodayTotalKeywords(date: string): number {
  const db = getDb();
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;
  const stmt = db.prepare(
    "SELECT COUNT(DISTINCT keyword) as cnt FROM snapshots WHERE captured_at >= ? AND captured_at <= ?"
  );
  stmt.bind([start, end]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as { cnt: number };
    stmt.free();
    return row.cnt;
  }
  stmt.free();
  return 0;
}

// ===== Articles =====

export function upsertArticle(article: ArticleRow): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO articles (post_id, keyword, category, body, views, likes, comments, posted_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([article.post_id, article.keyword, article.category, article.body, article.views, article.likes, article.comments, article.posted_at, article.fetched_at]);
  stmt.step();
  stmt.free();
  saveDb();
}

export function findArticleByKeyword(keyword: string): ArticleRow | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM articles WHERE keyword LIKE ? ORDER BY fetched_at DESC LIMIT 1");
  stmt.bind([`%${keyword}%`]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as ArticleRow;
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function findRelatedKeywords(keyword: string, count: number): { keyword: string; co_occurrence: number; category: string }[] {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT a2.keyword, COUNT(*) as co_occurrence, a2.category
     FROM snapshots s1
     JOIN snapshots s2 ON s1.captured_at = s2.captured_at
     JOIN articles a2 ON s2.post_id = a2.post_id
     WHERE s1.keyword = ? AND s2.keyword != ?
     GROUP BY a2.keyword
     ORDER BY co_occurrence DESC
     LIMIT ?`
  );
  stmt.bind([keyword, keyword, count]);
  const rows: { keyword: string; co_occurrence: number; category: string }[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as { keyword: string; co_occurrence: number; category: string });
  }
  stmt.free();
  return rows;
}