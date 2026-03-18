import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { PlanModel } from '../../models/plan.js';
import { TaskModel } from '../../models/task.js';
import { EventModel } from '../../models/event.js';
import { StatsEngine } from '../stats.js';
import type Database from 'better-sqlite3';

describe('StatsEngine', () => {
  let db: Database.Database;
  let planModel: PlanModel;
  let taskModel: TaskModel;
  let eventModel: EventModel;
  let stats: StatsEngine;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    eventModel = new EventModel(db);
    planModel = new PlanModel(db, eventModel);
    taskModel = new TaskModel(db, eventModel);
    stats = new StatsEngine(db);
  });

  describe('getVelocity', () => {
    // Helper: 오늘 기준 N일 전 날짜 문자열 반환
    function daysAgo(n: number): string {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().split('T')[0];
    }

    it('should calculate velocity from completed tasks over 3 days', () => {
      const plan = planModel.create('Velocity Plan');
      planModel.activate(plan.id);

      // Day 1 (2일 전): 2 tasks completed
      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      taskModel.updateStatus(t1.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run(daysAgo(2));
      taskModel.updateStatus(t2.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run(daysAgo(2));

      // Day 2 (1일 전): 1 task completed
      const t3 = taskModel.create(plan.id, 'Task 3');
      taskModel.updateStatus(t3.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run(daysAgo(1));

      // Day 3 (오늘): 3 tasks completed
      const t4 = taskModel.create(plan.id, 'Task 4');
      const t5 = taskModel.create(plan.id, 'Task 5');
      const t6 = taskModel.create(plan.id, 'Task 6');
      taskModel.updateStatus(t4.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run(daysAgo(0));
      taskModel.updateStatus(t5.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run(daysAgo(0));
      taskModel.updateStatus(t6.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run(daysAgo(0));

      // 6 completions over 3-day window
      const result = stats.getVelocity(plan.id, 3);
      expect(result.total_completed).toBe(6);
      expect(result.daily).toBe(2.0);
    });

    it('should return 0 velocity when no tasks completed', () => {
      const plan = planModel.create('Empty Plan');
      const result = stats.getVelocity(plan.id, 7);
      expect(result.total_completed).toBe(0);
      expect(result.daily).toBe(0);
    });

    it('should calculate velocity across all plans when planId is omitted', () => {
      const plan1 = planModel.create('Plan A');
      const plan2 = planModel.create('Plan B');

      const t1 = taskModel.create(plan1.id, 'Task A1');
      const t2 = taskModel.create(plan2.id, 'Task B1');
      taskModel.updateStatus(t1.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run(daysAgo(0));
      taskModel.updateStatus(t2.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run(daysAgo(0));

      const result = stats.getVelocity(undefined, 7);
      expect(result.total_completed).toBe(2);
    });
  });

  describe('getEstimatedCompletion', () => {
    it('should estimate completion based on velocity', () => {
      const plan = planModel.create('Estimate Plan');
      planModel.activate(plan.id);

      // Create 6 done tasks + 4 remaining
      const estDaysAgo = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d.toISOString().split('T')[0];
      };
      for (let i = 1; i <= 6; i++) {
        const t = taskModel.create(plan.id, `Done Task ${i}`);
        taskModel.updateStatus(t.id, 'done');
        db.prepare(
          "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
        ).run(estDaysAgo(0));
      }
      // 4 remaining tasks (todo)
      for (let i = 1; i <= 4; i++) {
        taskModel.create(plan.id, `Remaining Task ${i}`);
      }

      // velocity = 6/7 per day, remaining = 4
      const result = stats.getEstimatedCompletion(plan.id);
      expect(result.remaining_tasks).toBe(4);
      expect(result.velocity).toBeGreaterThan(0);
      expect(result.estimated_days).not.toBeNull();
      expect(result.estimated_date).not.toBeNull();
    });

    it('should return null estimated_days when velocity is 0', () => {
      const plan = planModel.create('No Velocity Plan');
      planModel.activate(plan.id);

      // Create tasks but don't complete any
      taskModel.create(plan.id, 'Task 1');
      taskModel.create(plan.id, 'Task 2');

      const result = stats.getEstimatedCompletion(plan.id);
      expect(result.remaining_tasks).toBe(2);
      expect(result.velocity).toBe(0);
      expect(result.estimated_days).toBeNull();
      expect(result.estimated_date).toBeNull();
    });

    it('should exclude done and skipped tasks from remaining count', () => {
      const plan = planModel.create('Mixed Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Done Task');
      const t2 = taskModel.create(plan.id, 'Skipped Task');
      taskModel.create(plan.id, 'Todo Task');
      const t4 = taskModel.create(plan.id, 'In Progress Task');

      taskModel.updateStatus(t1.id, 'done');
      taskModel.updateStatus(t2.id, 'skipped');
      taskModel.updateStatus(t4.id, 'in_progress');

      const result = stats.getEstimatedCompletion(plan.id);
      // Only 'todo' and 'in_progress' count as remaining
      expect(result.remaining_tasks).toBe(2);
    });
  });

  describe('getTimeline', () => {
    it('should return daily breakdown with cumulative totals', () => {
      const plan = planModel.create('Timeline Plan');
      planModel.activate(plan.id);

      // Day 1: 2 completions
      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      taskModel.updateStatus(t1.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run('2026-03-14');
      taskModel.updateStatus(t2.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run('2026-03-14');

      // Day 2: 1 completion
      const t3 = taskModel.create(plan.id, 'Task 3');
      taskModel.updateStatus(t3.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run('2026-03-15');

      // Day 3: 3 completions
      const t4 = taskModel.create(plan.id, 'Task 4');
      const t5 = taskModel.create(plan.id, 'Task 5');
      const t6 = taskModel.create(plan.id, 'Task 6');
      taskModel.updateStatus(t4.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run('2026-03-16');
      taskModel.updateStatus(t5.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run('2026-03-16');
      taskModel.updateStatus(t6.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run('2026-03-16');

      const timeline = stats.getTimeline(plan.id);
      expect(timeline).toHaveLength(3);

      expect(timeline[0]).toEqual({
        date: '2026-03-14',
        tasks_completed: 2,
        cumulative: 2,
      });
      expect(timeline[1]).toEqual({
        date: '2026-03-15',
        tasks_completed: 1,
        cumulative: 3,
      });
      expect(timeline[2]).toEqual({
        date: '2026-03-16',
        tasks_completed: 3,
        cumulative: 6,
      });
    });

    it('should return empty array when no completions exist', () => {
      const plan = planModel.create('Empty Timeline Plan');
      const timeline = stats.getTimeline(plan.id);
      expect(timeline).toEqual([]);
    });

    it('should return timeline across all plans when planId is omitted', () => {
      const plan1 = planModel.create('Plan A');
      const plan2 = planModel.create('Plan B');

      const t1 = taskModel.create(plan1.id, 'Task A1');
      const t2 = taskModel.create(plan2.id, 'Task B1');
      taskModel.updateStatus(t1.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run('2026-03-16');
      taskModel.updateStatus(t2.id, 'done');
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events)",
      ).run('2026-03-16');

      const timeline = stats.getTimeline();
      expect(timeline).toHaveLength(1);
      expect(timeline[0].tasks_completed).toBe(2);
      expect(timeline[0].cumulative).toBe(2);
    });
  });
});
