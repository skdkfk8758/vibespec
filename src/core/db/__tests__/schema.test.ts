import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../connection.js';
import { initSchema } from '../schema.js';
import type Database from 'better-sqlite3';

describe('Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
  });

  it('should create all required tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('plans');
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('events');
    expect(tableNames).toContain('context_log');
  });

  it('should create plan_progress view', () => {
    const views = db
      .prepare("SELECT name FROM sqlite_master WHERE type='view'")
      .all() as { name: string }[];
    const viewNames = views.map((v) => v.name);

    expect(viewNames).toContain('plan_progress');
  });

  it('should be idempotent (can run twice)', () => {
    expect(() => initSchema(db)).not.toThrow();
  });
});
