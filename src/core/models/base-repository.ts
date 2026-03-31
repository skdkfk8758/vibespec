import type Database from 'better-sqlite3';
import { buildUpdateQuery } from '../utils.js';

/**
 * Abstract base repository providing common CRUD operations for all models.
 * Subclasses specify the entity type T and the table name.
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected db: Database.Database;
  protected tableName: string;

  constructor(db: Database.Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  getById(id: string): T | null {
    const row = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id) as T | undefined;
    return row ?? null;
  }

  requireById(id: string): T {
    const entity = this.getById(id);
    if (!entity) throw new Error(`${this.tableName} not found: ${id}`);
    return entity;
  }

  list(): T[] {
    return this.db.prepare(`SELECT * FROM ${this.tableName}`).all() as T[];
  }

  delete(id: string): void {
    this.requireById(id);
    this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }

  count(): number {
    const row = this.db.prepare(`SELECT count(*) as cnt FROM ${this.tableName}`).get() as { cnt: number };
    return row.cnt;
  }

  update(id: string, fields: Partial<Omit<T, 'id'>>): T {
    this.requireById(id);
    const query = buildUpdateQuery(this.tableName, id, fields as Record<string, unknown>);
    if (query) {
      this.db.prepare(query.sql).run(...query.params);
    }
    return this.requireById(id);
  }
}
