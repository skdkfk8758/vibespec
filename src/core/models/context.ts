import type Database from 'better-sqlite3';
import type { ContextLog } from '../types.js';

export class ContextModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  save(
    summary: string,
    opts?: { planId?: string; sessionId?: string; lastTaskId?: string },
  ): ContextLog {
    const stmt = this.db.prepare(
      `INSERT INTO context_log (summary, plan_id, session_id, last_task_id)
       VALUES (?, ?, ?, ?)`,
    );
    const result = stmt.run(
      summary,
      opts?.planId ?? null,
      opts?.sessionId ?? null,
      opts?.lastTaskId ?? null,
    );
    return this.db
      .prepare(`SELECT * FROM context_log WHERE id = ?`)
      .get(result.lastInsertRowid) as ContextLog;
  }

  getLatest(limit: number = 5): ContextLog[] {
    const stmt = this.db.prepare(
      `SELECT * FROM context_log ORDER BY created_at DESC, id DESC LIMIT ?`,
    );
    return stmt.all(limit) as ContextLog[];
  }

  getByPlan(planId: string): ContextLog[] {
    const stmt = this.db.prepare(
      `SELECT * FROM context_log WHERE plan_id = ? ORDER BY created_at DESC, id DESC`,
    );
    return stmt.all(planId) as ContextLog[];
  }

  getBySession(sessionId: string): ContextLog | null {
    const stmt = this.db.prepare(
      `SELECT * FROM context_log WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    );
    return (stmt.get(sessionId) as ContextLog) ?? null;
  }

  getById(id: number): ContextLog | null {
    return (this.db.prepare('SELECT * FROM context_log WHERE id = ?').get(id) as ContextLog) ?? null;
  }

  search(tag: string, limit: number = 100): ContextLog[] {
    return this.db.prepare(
      `SELECT * FROM context_log WHERE summary LIKE ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    ).all(`%${tag}%`, limit) as ContextLog[];
  }
}
