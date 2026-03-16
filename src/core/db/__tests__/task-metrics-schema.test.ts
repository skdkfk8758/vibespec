import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../connection.js';
import { initSchema } from '../schema.js';
import type Database from 'better-sqlite3';

describe('task_metrics table', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
  });

  it('should create task_metrics table', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('task_metrics');
  });

  it('should have correct columns on task_metrics', () => {
    const columns = db.prepare('PRAGMA table_info(task_metrics)').all() as {
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }[];
    const colMap = new Map(columns.map((c) => [c.name, c]));

    expect(colMap.get('id')?.pk).toBe(1);
    expect(colMap.get('task_id')?.notnull).toBe(1);
    expect(colMap.get('plan_id')?.notnull).toBe(1);
    expect(colMap.get('duration_min')?.notnull).toBe(0);
    expect(colMap.get('final_status')?.notnull).toBe(1);
    expect(colMap.get('block_reason')?.notnull).toBe(0);
    expect(colMap.get('impl_status')?.notnull).toBe(0);
    expect(colMap.get('test_count')?.notnull).toBe(0);
    expect(colMap.get('files_changed')?.notnull).toBe(0);
    expect(colMap.has('has_concerns')).toBe(true);
    expect(colMap.has('created_at')).toBe(true);
  });

  it('should enforce task_id uniqueness', () => {
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Plan 1', 'active')").run();
    db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t1', 'p1', 'Task 1', 'done')").run();

    db.prepare(
      "INSERT INTO task_metrics (task_id, plan_id, final_status) VALUES ('t1', 'p1', 'done')"
    ).run();

    expect(() =>
      db
        .prepare("INSERT INTO task_metrics (task_id, plan_id, final_status) VALUES ('t1', 'p1', 'done')")
        .run()
    ).toThrow();
  });

  it('should cascade delete when task is deleted', () => {
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Plan 1', 'active')").run();
    db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t1', 'p1', 'Task 1', 'done')").run();
    db.prepare(
      "INSERT INTO task_metrics (task_id, plan_id, final_status) VALUES ('t1', 'p1', 'done')"
    ).run();

    db.prepare("DELETE FROM tasks WHERE id = 't1'").run();

    const count = db.prepare('SELECT COUNT(*) as cnt FROM task_metrics').get() as { cnt: number };
    expect(count.cnt).toBe(0);
  });

  it('should cascade delete when plan is deleted', () => {
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Plan 1', 'active')").run();
    db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t1', 'p1', 'Task 1', 'done')").run();
    db.prepare(
      "INSERT INTO task_metrics (task_id, plan_id, final_status) VALUES ('t1', 'p1', 'done')"
    ).run();

    db.prepare("DELETE FROM plans WHERE id = 'p1'").run();

    const count = db.prepare('SELECT COUNT(*) as cnt FROM task_metrics').get() as { cnt: number };
    expect(count.cnt).toBe(0);
  });

  it('should create indexes on plan_id and task_id', () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='task_metrics'")
      .all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_task_metrics_plan_id');
    expect(indexNames).toContain('idx_task_metrics_task_id');
  });
});

describe('plan_metrics view', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
  });

  it('should create plan_metrics view', () => {
    const views = db
      .prepare("SELECT name FROM sqlite_master WHERE type='view'")
      .all() as { name: string }[];
    const viewNames = views.map((v) => v.name);

    expect(viewNames).toContain('plan_metrics');
  });

  it('should only include completed and archived plans', () => {
    // Insert plans with different statuses
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Active', 'active')").run();
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p2', 'Completed', 'completed')").run();
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p3', 'Draft', 'draft')").run();
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p4', 'Archived', 'archived')").run();

    // Add tasks and metrics for all plans
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      db.prepare(`INSERT INTO tasks (id, plan_id, title, status) VALUES ('t-${pid}', '${pid}', 'Task', 'done')`).run();
      db.prepare(
        `INSERT INTO task_metrics (task_id, plan_id, final_status) VALUES ('t-${pid}', '${pid}', 'done')`
      ).run();
    }

    const rows = db.prepare('SELECT * FROM plan_metrics').all() as { id: string }[];
    const planIds = rows.map((r) => r.id);

    expect(planIds).toContain('p2');
    expect(planIds).toContain('p4');
    expect(planIds).not.toContain('p1');
    expect(planIds).not.toContain('p3');
  });

  it('should compute correct aggregations', () => {
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Plan 1', 'completed')").run();

    // Create tasks
    db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t1', 'p1', 'Task 1', 'done')").run();
    db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t2', 'p1', 'Task 2', 'done')").run();
    db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t3', 'p1', 'Task 3', 'blocked')").run();
    db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t4', 'p1', 'Task 4', 'done')").run();

    // Create metrics
    db.prepare(
      "INSERT INTO task_metrics (task_id, plan_id, duration_min, final_status, has_concerns) VALUES ('t1', 'p1', 10.0, 'done', 0)"
    ).run();
    db.prepare(
      "INSERT INTO task_metrics (task_id, plan_id, duration_min, final_status, has_concerns) VALUES ('t2', 'p1', 20.0, 'done', 1)"
    ).run();
    db.prepare(
      "INSERT INTO task_metrics (task_id, plan_id, duration_min, final_status, block_reason, has_concerns) VALUES ('t3', 'p1', NULL, 'blocked', 'dependency missing', 0)"
    ).run();
    db.prepare(
      "INSERT INTO task_metrics (task_id, plan_id, duration_min, final_status, has_concerns) VALUES ('t4', 'p1', 30.0, 'done', 0)"
    ).run();

    const row = db.prepare('SELECT * FROM plan_metrics WHERE id = ?').get('p1') as {
      recorded_tasks: number;
      avg_duration_min: number;
      blocked_count: number;
      done_count: number;
      concern_count: number;
      success_rate: number;
    };

    expect(row.recorded_tasks).toBe(4);
    expect(row.avg_duration_min).toBe(20.0); // (10+20+30)/3 = 20, avg of non-null
    expect(row.blocked_count).toBe(1);
    expect(row.done_count).toBe(3);
    expect(row.concern_count).toBe(1);
    expect(row.success_rate).toBe(75); // 3/4 * 100 = 75
  });

  it('should handle plan with no metrics gracefully', () => {
    db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Plan 1', 'completed')").run();

    const rows = db.prepare('SELECT * FROM plan_metrics WHERE id = ?').all('p1');
    // Plan with no task_metrics should not appear (INNER JOIN) or appear with zeros
    // Based on spec: plans JOIN task_metrics, so no metrics = no row
    expect(rows.length).toBe(0);
  });
});
