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

  it('should set user_version to latest after migrations', () => {
    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBeGreaterThanOrEqual(2);
  });

  // --- skill_usage v3 migration tests ---

  it('should create skill_usage table on fresh DB via initSchema', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('skill_usage');

    // Verify columns
    const columns = db.pragma('table_info(skill_usage)') as Array<{ name: string; type: string; notnull: number; pk: number }>;
    const colMap = Object.fromEntries(columns.map((c) => [c.name, c]));

    expect(colMap['id'].type).toBe('TEXT');
    expect(colMap['id'].pk).toBe(1);
    expect(colMap['skill_name'].type).toBe('TEXT');
    expect(colMap['skill_name'].notnull).toBe(1);
    expect(colMap['plan_id'].type).toBe('TEXT');
    expect(colMap['plan_id'].notnull).toBe(0);
    expect(colMap['session_id'].type).toBe('TEXT');
    expect(colMap['created_at'].type).toBe('TEXT');

    // Verify indexes
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='skill_usage'")
      .all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_skill_usage_name');
    expect(indexNames).toContain('idx_skill_usage_created');
  });

  it('should migrate v2 DB to v3 creating skill_usage table', () => {
    // Arrange: simulate a v2 database without skill_usage
    const v2Db = createMemoryDb();
    v2Db.exec(`
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
        depends_on TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
    `);
    v2Db.pragma('user_version = 2');

    // Act: apply migrations
    applyMigrations(v2Db);

    // Assert: skill_usage table should exist
    const tables = v2Db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('skill_usage');

    // Assert: version should be 6 (all migrations applied)
    const version = v2Db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(6);

    v2Db.close();
  });

  it('should not change anything when v3 migration runs on v3 DB', () => {
    // Arrange: db is already at latest version from initSchema
    const versionBefore = db.pragma('user_version', { simple: true }) as number;

    // Act: apply migrations again
    applyMigrations(db);

    // Assert: version unchanged, no errors
    const versionAfter = db.pragma('user_version', { simple: true }) as number;
    expect(versionAfter).toBe(versionBefore);

    // skill_usage table still exists
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain('skill_usage');
  });

  it('should set user_version to 6 after all migrations on fresh DB', () => {
    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(6);
  });
});
