import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { PlanModel } from '../../models/plan.js';
import { TaskModel } from '../../models/task.js';
import { EventModel } from '../../models/event.js';
import { LifecycleEngine } from '../lifecycle.js';
import type Database from 'better-sqlite3';

function markDone(taskModel: TaskModel, id: string) {
  taskModel.updateStatus(id, 'in_progress');
  taskModel.updateStatus(id, 'done');
}

describe('LifecycleEngine', () => {
  let db: Database.Database;
  let planModel: PlanModel;
  let taskModel: TaskModel;
  let eventModel: EventModel;
  let engine: LifecycleEngine;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    eventModel = new EventModel(db);
    planModel = new PlanModel(db, eventModel);
    taskModel = new TaskModel(db, eventModel);
    engine = new LifecycleEngine(db, planModel, taskModel, eventModel);
  });

  describe('canComplete', () => {
    it('should return false with blockers when tasks are not all done', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      const t3 = taskModel.create(plan.id, 'Task 3');
      markDone(taskModel, t2.id);
      markDone(taskModel, t3.id);

      const result = engine.canComplete(plan.id);

      expect(result.completable).toBe(false);
      expect(result.blockers).toEqual(['Task 1']);
    });

    it('should return true with empty blockers when all tasks are done', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      const t3 = taskModel.create(plan.id, 'Task 3');
      markDone(taskModel, t1.id);
      markDone(taskModel, t2.id);
      markDone(taskModel, t3.id);

      const result = engine.canComplete(plan.id);

      expect(result.completable).toBe(true);
      expect(result.blockers).toEqual([]);
    });

    it('should treat skipped tasks as completable', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      const t3 = taskModel.create(plan.id, 'Task 3');
      markDone(taskModel, t1.id);
      taskModel.updateStatus(t2.id, 'skipped');
      markDone(taskModel, t3.id);

      const result = engine.canComplete(plan.id);

      expect(result.completable).toBe(true);
      expect(result.blockers).toEqual([]);
    });

    it('should only check leaf tasks (tasks with no children)', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const parent = taskModel.create(plan.id, 'Parent Task');
      const child1 = taskModel.create(plan.id, 'Child 1', { parentId: parent.id });
      const child2 = taskModel.create(plan.id, 'Child 2', { parentId: parent.id });
      // Parent is still 'todo' but children are done - should be completable
      markDone(taskModel, child1.id);
      markDone(taskModel, child2.id);

      const result = engine.canComplete(plan.id);

      expect(result.completable).toBe(true);
      expect(result.blockers).toEqual([]);
    });
  });

  describe('completePlan', () => {
    it('should complete the plan when all tasks are done', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      markDone(taskModel, t1.id);
      markDone(taskModel, t2.id);

      const completed = engine.completePlan(plan.id);

      expect(completed.status).toBe('completed');
      expect(completed.completed_at).not.toBeNull();
    });

    it('should throw when incomplete tasks exist', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      taskModel.create(plan.id, 'Task 2');
      markDone(taskModel, t1.id);

      expect(() => engine.completePlan(plan.id)).toThrow(
        /Plan cannot be completed/,
      );
    });

    it('should record an event when completing', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      markDone(taskModel, t1.id);

      engine.completePlan(plan.id);

      const events = eventModel.getByEntity('plan', plan.id);
      const lifecycleEvent = events.find(
        (e) => e.event_type === 'lifecycle_completed',
      );
      expect(lifecycleEvent).toBeDefined();
    });
  });

  describe('autoCheckCompletion', () => {
    it('should return correct progress stats', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      taskModel.create(plan.id, 'Task 3');
      markDone(taskModel, t1.id);
      markDone(taskModel, t2.id);

      const result = engine.autoCheckCompletion(plan.id);

      expect(result.all_done).toBe(false);
      expect(result.progress.total).toBe(3);
      expect(result.progress.done).toBe(2);
      expect(result.progress.pct).toBe(67);
    });

    it('should return all_done true when all leaf tasks are done', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      markDone(taskModel, t1.id);
      markDone(taskModel, t2.id);

      const result = engine.autoCheckCompletion(plan.id);

      expect(result.all_done).toBe(true);
      expect(result.progress.total).toBe(2);
      expect(result.progress.done).toBe(2);
      expect(result.progress.pct).toBe(100);
    });

    it('should count skipped tasks as done in progress', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      markDone(taskModel, t1.id);
      taskModel.updateStatus(t2.id, 'skipped');

      const result = engine.autoCheckCompletion(plan.id);

      expect(result.all_done).toBe(true);
      expect(result.progress.done).toBe(2);
      expect(result.progress.pct).toBe(100);
    });
  });
});
