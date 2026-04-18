/**
 * SQLite research storage.
 * Data is stored in .deep-research/research-records.db
 */
import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { threadRoot } from "../config/paths.ts";

const dbFilePath = path.join(path.dirname(threadRoot), "research-records.db");

export interface ResearchRecord {
  threadId: string;
  title: string;
  topic: string;
  reportPath: string;
  reportContent: string;
  sources: number;
  iterations: number;
  createdAt: number; // Unix ms
}

let db: DatabaseSync | null = null;

const getDb = (): DatabaseSync => {
  if (!db) {
    throw new Error("DB not initialized. Call initDb() first.");
  }
  return db;
};

const ensureSchema = (database: DatabaseSync) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS research_records (
      thread_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      report_path TEXT NOT NULL,
      report_content TEXT NOT NULL DEFAULT '',
      sources INTEGER NOT NULL DEFAULT 0,
      iterations INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_research_records_created_at
    ON research_records(created_at DESC);
  `);
};

const normalizeStoredPaths = (database: DatabaseSync) => {
  database.exec(`
    UPDATE research_records
    SET report_path = 'sqlite://research_records/' || thread_id
    WHERE report_path NOT LIKE 'sqlite://research_records/%';
  `);
};

const rowToRecord = (row: Record<string, unknown>): ResearchRecord => ({
  threadId: String(row.thread_id),
  title: String(row.title),
  topic: String(row.topic),
  reportPath: String(row.report_path),
  reportContent: String(row.report_content ?? ""),
  sources: Number(row.sources),
  iterations: Number(row.iterations),
  createdAt: Number(row.created_at)
});

/**
 * Initialize DB once during startup.
 */
export const initDb = async (): Promise<void> => {
  if (db) return;
  await fs.mkdir(path.dirname(dbFilePath), { recursive: true });
  db = new DatabaseSync(dbFilePath);
  ensureSchema(db);
  normalizeStoredPaths(db);
};

export const upsertRecord = (record: ResearchRecord): void => {
  getDb()
    .prepare(`
      INSERT INTO research_records (
        thread_id, title, topic, report_path, report_content, sources, iterations, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET
        title = excluded.title,
        topic = excluded.topic,
        report_path = excluded.report_path,
        report_content = excluded.report_content,
        sources = excluded.sources,
        iterations = excluded.iterations,
        created_at = excluded.created_at
    `)
    .run(
      record.threadId,
      record.title,
      record.topic,
      record.reportPath,
      record.reportContent,
      record.sources,
      record.iterations,
      record.createdAt
    );
};

export const listRecords = ({
  page = 1,
  pageSize = 20
}: {
  page?: number;
  pageSize?: number;
} = {}): { total: number; records: ResearchRecord[] } => {
  const database = getDb();
  const totalRow = database
    .prepare("SELECT COUNT(*) AS count FROM research_records")
    .get() as { count: number } | undefined;
  const offset = (page - 1) * pageSize;
  const rows = database
    .prepare(`
      SELECT thread_id, title, topic, report_path, report_content, sources, iterations, created_at
      FROM research_records
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(pageSize, offset) as Array<Record<string, unknown>>;

  return {
    total: totalRow?.count ?? 0,
    records: rows.map(rowToRecord)
  };
};

export const getRecord = (threadId: string): ResearchRecord | null => {
  const row = getDb()
    .prepare(`
      SELECT thread_id, title, topic, report_path, report_content, sources, iterations, created_at
      FROM research_records
      WHERE thread_id = ?
    `)
    .get(threadId) as Record<string, unknown> | undefined;
  return row ? rowToRecord(row) : null;
};

export const getLatestRecord = (): ResearchRecord | null => {
  const row = getDb()
    .prepare(`
      SELECT thread_id, title, topic, report_path, report_content, sources, iterations, created_at
      FROM research_records
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get() as Record<string, unknown> | undefined;
  return row ? rowToRecord(row) : null;
};

export const deleteRecord = (threadId: string): boolean => {
  const result = getDb()
    .prepare(`
      DELETE FROM research_records
      WHERE thread_id = ?
    `)
    .run(threadId);
  return Number(result.changes ?? 0) > 0;
};
