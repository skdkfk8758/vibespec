import type Database from 'better-sqlite3';

export interface ContextLog {
  id: number;
  plan_id: string | null;
  session_id: string | null;
  summary: string;
  last_task_id: string | null;
  created_at: string;
}

export interface NewContextLog {
  plan_id?: string;
  session_id?: string;
  summary: string;
  last_task_id?: string;
}

export class ContextLogModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  create(input: NewContextLog): ContextLog {
    const stmt = this.db.prepare(
      `INSERT INTO context_log (plan_id, session_id, summary, last_task_id)
       VALUES (?, ?, ?, ?)`,
    );
    const result = stmt.run(
      input.plan_id ?? null,
      input.session_id ?? null,
      input.summary,
      input.last_task_id ?? null,
    );
    return this.db
      .prepare('SELECT * FROM context_log WHERE id = ?')
      .get(result.lastInsertRowid) as ContextLog;
  }

  getById(id: number): ContextLog | null {
    const row = this.db
      .prepare('SELECT * FROM context_log WHERE id = ?')
      .get(id) as ContextLog | undefined;
    return row ?? null;
  }

  search(tag: string): ContextLog[] {
    return this.db
      .prepare('SELECT * FROM context_log WHERE summary LIKE ? ORDER BY created_at DESC')
      .all(`%${tag}%`) as ContextLog[];
  }

  list(limit: number = 50): ContextLog[] {
    return this.db
      .prepare('SELECT * FROM context_log ORDER BY created_at DESC LIMIT ?')
      .all(limit) as ContextLog[];
  }
}
