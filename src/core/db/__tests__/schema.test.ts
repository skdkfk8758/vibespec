import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../connection.js';
import { initSchema, applyMigrations } from '../schema.js';
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

  it('should include depends_on column in tasks table for new DB', () => {
    const columns = db.pragma('table_info(tasks)') as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain('depends_on');
  });

  it('should add depends_on column when migrating from v1 to v2', () => {
    // Arrange: simulate a v1 database without depends_on
    const v1Db = createMemoryDb();
    v1Db.exec(`
      CREATE TABLE plans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        summary TEXT,
        spec TEXT,
        branch TEXT,
        worktree_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        depth INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        spec TEXT,
        acceptance TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
    `);
    v1Db.pragma('user_version = 1');

    // Act: apply migrations
    applyMigrations(v1Db);

    // Assert: depends_on column should exist
    const columns = v1Db.pragma('table_info(tasks)') as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('depends_on');

    v1Db.close();
  });

  it('should set existing task depends_on to null after v2 migration', () => {
    // Arrange: simulate a v1 database with existing task data
    const v1Db = createMemoryDb();
    v1Db.exec(`
      CREATE TABLE plans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        summary TEXT,
        spec TEXT,
        branch TEXT,
        worktree_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        depth INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        spec TEXT,
        acceptance TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
    `);
    v1Db.pragma('user_version = 1');

    // Insert a plan and task before migration
    v1Db.exec(`
      INSERT INTO plans (id, title, status) VALUES ('plan-1', 'Test Plan', 'active');
      INSERT INTO tasks (id, plan_id, title, status) VALUES ('task-1', 'plan-1', 'Test Task', 'todo');
    `);

    // Act: apply migrations
    applyMigrations(v1Db);

    // Assert: existing task's depends_on should be null
    const task = v1Db.prepare('SELECT depends_on FROM tasks WHERE id = ?').get('task-1') as { depends_on: string | null };
    expect(task.depends_on).toBeNull();

    v1Db.close();
  });

  it('should set user_version to 2 after v2 migration', () => {
    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(2);
  });
});
