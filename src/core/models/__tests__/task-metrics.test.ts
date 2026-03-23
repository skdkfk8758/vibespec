import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { TaskMetricsModel } from '../task-metrics.js';
import { EventModel } from '../event.js';
import type Database from 'better-sqlite3';
import type { TaskMetrics } from '../../types.js';

describe('TaskMetricsModel', () => {
  let db: Database.Database;
  let metrics: TaskMetricsModel;
  let events: EventModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    events = new EventModel(db);
    metrics = new TaskMetricsModel(db);

    // Create a plan and tasks for FK constraints
    db.prepare(
      "INSERT INTO plans (id, title, status) VALUES ('plan1', 'Test Plan', 'active')",
    ).run();
    db.prepare(
      "INSERT INTO tasks (id, plan_id, title, status) VALUES ('task1', 'plan1', 'Task 1', 'done')",
    ).run();
    db.prepare(
      "INSERT INTO tasks (id, plan_id, title, status) VALUES ('task2', 'plan1', 'Task 2', 'blocked')",
    ).run();
    db.prepare(
      "INSERT INTO tasks (id, plan_id, title, status) VALUES ('task3', 'plan1', 'Task 3', 'done')",
    ).run();
  });

  describe('record()', () => {
    it('should create a task_metrics record with basic fields', () => {
      const result = metrics.record('task1', 'plan1', 'done', {
        impl_status: 'DONE',
        test_count: 5,
        files_changed: 3,
        has_concerns: false,
      });

      expect(result.task_id).toBe('task1');
      expect(result.plan_id).toBe('plan1');
      expect(result.final_status).toBe('done');
      expect(result.impl_status).toBe('DONE');
      expect(result.test_count).toBe(5);
      expect(result.files_changed).toBe(3);
      expect(result.has_concerns).toBe(0);
      expect(result.created_at).toBeTruthy();
    });

    it('should auto-calculate duration_min from events table when in_progress event exists', () => {
      // Insert a status_changed event with in_progress 5 minutes ago
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO events (entity_type, entity_id, event_type, new_value, created_at)
         VALUES ('task', 'task1', 'status_changed', '{"status":"in_progress"}', ?)`,
      ).run(fiveMinAgo);

      const result = metrics.record('task1', 'plan1', 'done');

      expect(result.duration_min).not.toBeNull();
      // Allow some tolerance (4-6 minutes)
      expect(result.duration_min).toBeGreaterThanOrEqual(4);
      expect(result.duration_min).toBeLessThanOrEqual(6);
    });

    it('should set duration_min to null when no in_progress event exists', () => {
      const result = metrics.record('task1', 'plan1', 'done');

      expect(result.duration_min).toBeNull();
    });

    it('should use the most recent in_progress event for duration calculation', () => {
      // Insert an old in_progress event (30 minutes ago)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO events (entity_type, entity_id, event_type, new_value, created_at)
         VALUES ('task', 'task1', 'status_changed', '{"status":"in_progress"}', ?)`,
      ).run(thirtyMinAgo);

      // Insert a more recent in_progress event (2 minutes ago)
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO events (entity_type, entity_id, event_type, new_value, created_at)
         VALUES ('task', 'task1', 'status_changed', '{"status":"in_progress"}', ?)`,
      ).run(twoMinAgo);

      const result = metrics.record('task1', 'plan1', 'done');

      expect(result.duration_min).not.toBeNull();
      expect(result.duration_min).toBeGreaterThanOrEqual(1);
      expect(result.duration_min).toBeLessThanOrEqual(4);
    });

    it('should auto-extract block_reason from events when blocked_reason event exists', () => {
      events.record(
        'task',
        'task2',
        'blocked_reason',
        null,
        JSON.stringify({ reason: 'Dependency not met' }),
      );

      const result = metrics.record('task2', 'plan1', 'blocked');

      expect(result.block_reason).toBe('Dependency not met');
    });

    it('should set block_reason to "unspecified" when finalStatus is blocked but no blocked_reason event', () => {
      const result = metrics.record('task2', 'plan1', 'blocked');

      expect(result.block_reason).toBe('unspecified');
    });

    it('should set block_reason to null when finalStatus is not blocked and no blocked_reason event', () => {
      const result = metrics.record('task1', 'plan1', 'done');

      expect(result.block_reason).toBeNull();
    });

    it('should UPDATE on duplicate task_id (INSERT OR REPLACE)', () => {
      metrics.record('task1', 'plan1', 'in_progress', {
        impl_status: 'WIP',
        test_count: 2,
      });

      const updated = metrics.record('task1', 'plan1', 'done', {
        impl_status: 'DONE',
        test_count: 5,
        files_changed: 3,
        has_concerns: true,
      });

      expect(updated.final_status).toBe('done');
      expect(updated.impl_status).toBe('DONE');
      expect(updated.test_count).toBe(5);
      expect(updated.has_concerns).toBe(1);

      // Should only have one record for task1
      const all = db
        .prepare('SELECT * FROM task_metrics WHERE task_id = ?')
        .all('task1');
      expect(all).toHaveLength(1);
    });

    it('should handle record with no optional metrics', () => {
      const result = metrics.record('task1', 'plan1', 'done');

      expect(result.impl_status).toBeNull();
      expect(result.test_count).toBeNull();
      expect(result.files_changed).toBeNull();
      expect(result.has_concerns).toBe(0);
    });

    it('should store changed_files_detail as JSON string', () => {
      const detail = JSON.stringify([{ file: 'src/a.ts', status: 'modified' }]);
      const result = metrics.record('task1', 'plan1', 'done', {
        changed_files_detail: detail,
      });

      expect(result.changed_files_detail).toBe(detail);
    });

    it('should store scope_violations as JSON string', () => {
      const violations = JSON.stringify([{ file: 'agents/foo.ts', reason: 'forbidden' }]);
      const result = metrics.record('task1', 'plan1', 'done', {
        scope_violations: violations,
      });

      expect(result.scope_violations).toBe(violations);
    });

    it('should store null for changed_files_detail and scope_violations when not provided', () => {
      const result = metrics.record('task1', 'plan1', 'done');

      expect(result.changed_files_detail).toBeNull();
      expect(result.scope_violations).toBeNull();
    });
  });

  describe('getByTask()', () => {
    it('should return task metrics by task_id', () => {
      metrics.record('task1', 'plan1', 'done', { test_count: 3 });

      const result = metrics.getByTask('task1');

      expect(result).not.toBeNull();
      expect(result!.task_id).toBe('task1');
      expect(result!.test_count).toBe(3);
    });

    it('should return null when no metrics exist for task_id', () => {
      const result = metrics.getByTask('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByPlan()', () => {
    it('should return all task metrics for a plan', () => {
      metrics.record('task1', 'plan1', 'done', { test_count: 3 });
      metrics.record('task3', 'plan1', 'done', { test_count: 7 });

      const results = metrics.getByPlan('plan1');

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.task_id).sort()).toEqual(['task1', 'task3']);
    });

    it('should return empty array when no metrics exist for plan', () => {
      const results = metrics.getByPlan('nonexistent');

      expect(results).toEqual([]);
    });
  });
});
