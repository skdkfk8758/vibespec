import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { withTransaction } from '../../utils.js';
import type Database from 'better-sqlite3';

describe('withTransaction', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
  });

  it('AC01: withTransaction is exported from utils', () => {
    expect(typeof withTransaction).toBe('function');
  });

  it('AC02: returns the result of fn on success', () => {
    const result = withTransaction(db, () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it('AC02: commits changes on success', () => {
    withTransaction(db, () => {
      db.prepare(
        `INSERT INTO plans (id, title, status, created_at) VALUES (?, ?, ?, ?)`
      ).run('test-id-001', 'Test Plan', 'draft', new Date().toISOString());
    });

    const row = db.prepare(`SELECT * FROM plans WHERE id = ?`).get('test-id-001') as any;
    expect(row).toBeTruthy();
    expect(row.title).toBe('Test Plan');
  });

  it('AC03: rolls back changes when fn throws', () => {
    expect(() => {
      withTransaction(db, () => {
        db.prepare(
          `INSERT INTO plans (id, title, status, created_at) VALUES (?, ?, ?, ?)`
        ).run('rollback-id', 'Rollback Plan', 'draft', new Date().toISOString());
        throw new Error('intentional error');
      });
    }).toThrow('intentional error');

    const row = db.prepare(`SELECT * FROM plans WHERE id = ?`).get('rollback-id') as any;
    expect(row).toBeUndefined();
  });

  it('AC04: works with generic return types', () => {
    const result = withTransaction(db, () => {
      return { name: 'test', count: 5 };
    });
    expect(result).toEqual({ name: 'test', count: 5 });
  });
});
