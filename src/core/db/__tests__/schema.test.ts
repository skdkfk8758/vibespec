import { describe, it, expect, beforeEach, vi } from 'vitest';
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

    // Assert: version should be latest (all migrations applied)
    const version = v2Db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(15);

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

  it('should set user_version to 15 after all migrations on fresh DB', () => {
    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(15);
  });

  describe('AC01: migration 11 - enforcement columns', () => {
    it('AC01: self_improve_rules table has enforcement and escalated_at columns after migration 11', () => {
      const columns = db.pragma('table_info(self_improve_rules)') as Array<{ name: string }>;
      const colNames = columns.map(c => c.name);
      expect(colNames).toContain('enforcement');
      expect(colNames).toContain('escalated_at');
    });

    it('AC02: existing rules have enforcement default value SOFT', () => {
      db.prepare(`
        INSERT INTO self_improve_rules (id, title, category, rule_path, status, created_at)
        VALUES ('test-id', 'Test Rule', 'LOGIC_ERROR', 'test/path.md', 'active', datetime('now'))
      `).run();

      const rule = db.prepare('SELECT enforcement FROM self_improve_rules WHERE id = ?').get('test-id') as { enforcement: string };
      expect(rule.enforcement).toBe('SOFT');
    });

    it('AC01: enforcement column has CHECK constraint for SOFT and HARD', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO self_improve_rules (id, title, category, rule_path, status, enforcement, created_at)
          VALUES ('bad-id', 'Bad', 'LOGIC_ERROR', 'test.md', 'active', 'INVALID', datetime('now'))
        `).run();
      }).toThrow();
    });
  });

  describe('AC08: SQL reserved words are double-quoted', () => {
    it('AC08: vs_config table works correctly with quoted reserved word columns', () => {
      db.prepare('INSERT INTO vs_config ("key", "value") VALUES (?, ?)').run('test_key', 'test_value');
      const row = db.prepare('SELECT "key", "value" FROM vs_config WHERE "key" = ?').get('test_key') as { key: string; value: string };
      expect(row.key).toBe('test_key');
      expect(row.value).toBe('test_value');
    });
  });

  describe('AC02: qa_runs trigger column is double-quoted in schema', () => {
    it('AC02: qa_runs table allows insert and select with quoted trigger column', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'P', 'active');
      db.prepare('INSERT INTO qa_runs (id, plan_id, "trigger") VALUES (?, ?, ?)').run('r1', 'p1', 'manual');
      const row = db.prepare('SELECT "trigger" FROM qa_runs WHERE id = ?').get('r1') as { trigger: string };
      expect(row.trigger).toBe('manual');
    });

    it('AC02: qa_runs trigger CHECK constraint works with quoted column', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p2', 'P', 'active');
      expect(() => {
        db.prepare('INSERT INTO qa_runs (id, plan_id, "trigger") VALUES (?, ?, ?)').run('r2', 'p2', 'invalid_trigger');
      }).toThrow();
    });
  });

  describe('migration 12 - vec_errors and error_embeddings', () => {
    it('AC03: loadVec 성공 시 vec_errors 및 error_embeddings 테이블이 생성된다', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE name IN ('vec_errors', 'error_embeddings') ORDER BY name")
        .all() as { name: string }[];
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('error_embeddings');

      const columns = db.pragma('table_info(error_embeddings)') as Array<{ name: string; type: string; notnull: number }>;
      const colMap = Object.fromEntries(columns.map((c) => [c.name, c]));
      expect(colMap['error_id'].type).toBe('TEXT');
      expect(colMap['vec_rowid'].type).toBe('INTEGER');
      expect(colMap['vec_rowid'].notnull).toBe(1);

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='error_embeddings'")
        .all() as { name: string }[];
      expect(indexes.map((i) => i.name)).toContain('idx_error_embeddings_vec');
    });

    it('AC05: migration 12가 sqlite-vec 없이도 에러 없이 통과한다', async () => {
      const embeddings = await import('../../engine/embeddings.js');
      const loadVecSpy = vi.spyOn(embeddings, 'loadVec').mockReturnValue(false);

      try {
        const noVecDb = createMemoryDb();
        noVecDb.exec(`
          CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY, title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft', summary TEXT, spec TEXT,
            branch TEXT, worktree_name TEXT, qa_overrides TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME
          );
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id),
            parent_id TEXT, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'todo',
            depth INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
            spec TEXT, acceptance TEXT, depends_on TEXT, allowed_files TEXT,
            forbidden_patterns TEXT, shadow_result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME
          );
          CREATE TABLE IF NOT EXISTS task_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL,
            plan_id TEXT NOT NULL, duration_min REAL, final_status TEXT NOT NULL,
            block_reason TEXT, impl_status TEXT, test_count INTEGER,
            files_changed INTEGER, has_concerns BOOLEAN DEFAULT 0,
            changed_files_detail TEXT, scope_violations TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS qa_runs (
            id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id),
            "trigger" TEXT NOT NULL CHECK("trigger" IN ('manual','auto','milestone','post_merge')),
            status TEXT NOT NULL DEFAULT 'pending',
            summary TEXT, total_scenarios INTEGER DEFAULT 0,
            passed_scenarios INTEGER DEFAULT 0, failed_scenarios INTEGER DEFAULT 0,
            risk_score REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME
          );
          CREATE TABLE IF NOT EXISTS qa_scenarios (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES qa_runs(id),
            category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'medium', related_tasks TEXT,
            status TEXT NOT NULL DEFAULT 'pending', agent TEXT, evidence TEXT,
            source TEXT NOT NULL DEFAULT 'final',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS qa_findings (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES qa_runs(id),
            scenario_id TEXT, severity TEXT NOT NULL, category TEXT NOT NULL,
            title TEXT NOT NULL, description TEXT NOT NULL, affected_files TEXT,
            related_task_id TEXT, fix_suggestion TEXT,
            status TEXT NOT NULL DEFAULT 'open', fix_plan_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
        noVecDb.pragma('user_version = 11');
        expect(() => applyMigrations(noVecDb)).not.toThrow();
        const version = noVecDb.pragma('user_version', { simple: true }) as number;
        expect(version).toBe(15);
        noVecDb.close();
      } finally {
        loadVecSpy.mockRestore();
      }
    });

    it('AC05: migration 12 is idempotent', () => {
      expect(() => applyMigrations(db)).not.toThrow();
      const version = db.pragma('user_version', { simple: true }) as number;
      expect(version).toBe(15);
    });

    it('AC03: error_embeddings can store and query data', () => {
      db.prepare(`
        INSERT INTO error_embeddings (error_id, vec_rowid, model)
        VALUES (?, ?, ?)
      `).run('err-001', 1, 'all-MiniLM-L6-v2');

      const row = db.prepare('SELECT * FROM error_embeddings WHERE error_id = ?').get('err-001') as {
        error_id: string; vec_rowid: number; model: string; created_at: string;
      };
      expect(row.error_id).toBe('err-001');
      expect(row.vec_rowid).toBe(1);
      expect(row.model).toBe('all-MiniLM-L6-v2');
      expect(row.created_at).toBeTruthy();
    });
  });

  describe('AC03: no other unquoted SQL reserved word columns', () => {
    it('AC03: all SQL reserved word columns in schema are properly quoted', () => {
      const reservedWordTests = [
        { table: 'vs_config', column: 'key', insert: 'INSERT INTO vs_config ("key", "value") VALUES (?, ?)', params: ['rw_test', 'val'] },
        { table: 'vs_config', column: 'value', insert: 'INSERT INTO vs_config ("key", "value") VALUES (?, ?)', params: ['rw_test2', 'val2'] },
      ];

      for (const test of reservedWordTests) {
        expect(() => {
          db.prepare(test.insert).run(...test.params);
        }).not.toThrow();
      }
    });
  });
});
