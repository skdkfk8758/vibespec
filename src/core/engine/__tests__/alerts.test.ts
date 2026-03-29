import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { PlanModel } from '../../models/plan.js';
import { TaskModel } from '../../models/task.js';
import { EventModel } from '../../models/event.js';
import { AlertsEngine } from '../alerts.js';
import type Database from 'better-sqlite3';

describe('AlertsEngine', () => {
  let db: Database.Database;
  let planModel: PlanModel;
  let taskModel: TaskModel;
  let eventModel: EventModel;
  let alerts: AlertsEngine;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    eventModel = new EventModel(db);
    planModel = new PlanModel(db, eventModel);
    taskModel = new TaskModel(db, eventModel);
    alerts = new AlertsEngine(db);
  });

  describe('getStaleTasks', () => {
    it('should return in_progress tasks with no recent activity', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);
      const task = taskModel.create(plan.id, 'Stale Task');
      taskModel.updateStatus(task.id, 'in_progress');

      // Move all events for this task to 4 days ago
      db.prepare(
        "UPDATE events SET created_at = datetime('now', '-4 days') WHERE entity_id = ?",
      ).run(task.id);

      const stale = alerts.getStaleTasks(3);
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe(task.id);
      expect(stale[0].days_stale).toBeGreaterThanOrEqual(3);
    });

    it('should not return tasks with recent activity', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);
      const task = taskModel.create(plan.id, 'Active Task');
      taskModel.updateStatus(task.id, 'in_progress');

      const stale = alerts.getStaleTasks(3);
      expect(stale).toHaveLength(0);
    });
  });

  describe('getBlockedPlans', () => {
    it('should return plans with blocked tasks', () => {
      const plan = planModel.create('Blocked Plan');
      planModel.activate(plan.id);
      const task = taskModel.create(plan.id, 'Blocked Task');
      taskModel.updateStatus(task.id, 'blocked');

      const blocked = alerts.getBlockedPlans();
      expect(blocked).toHaveLength(1);
      expect(blocked[0].id).toBe(plan.id);
      expect(blocked[0].blocked_tasks).toBe(1);
    });

    it('should not return plans without blocked tasks', () => {
      const plan = planModel.create('Normal Plan');
      planModel.activate(plan.id);
      taskModel.create(plan.id, 'Normal Task');

      const blocked = alerts.getBlockedPlans();
      expect(blocked).toHaveLength(0);
    });
  });

  describe('getCompletablePlans', () => {
    it('should return active plans where all tasks are done', () => {
      const plan = planModel.create('Completable Plan');
      planModel.activate(plan.id);
      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      taskModel.updateStatus(t1.id, 'in_progress');
      taskModel.updateStatus(t1.id, 'done');
      taskModel.updateStatus(t2.id, 'in_progress');
      taskModel.updateStatus(t2.id, 'done');

      const completable = alerts.getCompletablePlans();
      expect(completable).toHaveLength(1);
      expect(completable[0].id).toBe(plan.id);
      expect(completable[0].progress_pct).toBe(100);
    });

    it('should not return plans with incomplete tasks', () => {
      const plan = planModel.create('Incomplete Plan');
      planModel.activate(plan.id);
      const t1 = taskModel.create(plan.id, 'Task 1');
      taskModel.create(plan.id, 'Task 2');
      taskModel.updateStatus(t1.id, 'in_progress');
      taskModel.updateStatus(t1.id, 'done');

      const completable = alerts.getCompletablePlans();
      expect(completable).toHaveLength(0);
    });
  });

  describe('getForgottenPlans', () => {
    it('should return active plans with no recent activity', () => {
      const plan = planModel.create('Forgotten Plan');
      planModel.activate(plan.id);
      const task = taskModel.create(plan.id, 'Some Task');

      // Move all related events to 8 days ago
      db.prepare(
        "UPDATE events SET created_at = datetime('now', '-8 days') WHERE entity_id = ?",
      ).run(plan.id);
      db.prepare(
        "UPDATE events SET created_at = datetime('now', '-8 days') WHERE entity_id = ?",
      ).run(task.id);

      const forgotten = alerts.getForgottenPlans(7);
      expect(forgotten).toHaveLength(1);
      expect(forgotten[0].id).toBe(plan.id);
      expect(forgotten[0].days_inactive).toBeGreaterThanOrEqual(7);
    });

    it('should not return plans with recent activity', () => {
      const plan = planModel.create('Active Plan');
      planModel.activate(plan.id);
      taskModel.create(plan.id, 'Some Task');

      const forgotten = alerts.getForgottenPlans(7);
      expect(forgotten).toHaveLength(0);
    });
  });

  describe('getAlerts', () => {
    it('should combine all alert types', () => {
      // Stale task
      const plan1 = planModel.create('Plan with stale task');
      planModel.activate(plan1.id);
      const staleTask = taskModel.create(plan1.id, 'Stale Task');
      taskModel.updateStatus(staleTask.id, 'in_progress');
      db.prepare(
        "UPDATE events SET created_at = datetime('now', '-4 days') WHERE entity_id = ?",
      ).run(staleTask.id);

      // Blocked plan
      const plan2 = planModel.create('Blocked Plan');
      planModel.activate(plan2.id);
      const blockedTask = taskModel.create(plan2.id, 'Blocked Task');
      taskModel.updateStatus(blockedTask.id, 'blocked');

      // Completable plan
      const plan3 = planModel.create('Completable Plan');
      planModel.activate(plan3.id);
      const doneTask = taskModel.create(plan3.id, 'Done Task');
      taskModel.updateStatus(doneTask.id, 'in_progress');
      taskModel.updateStatus(doneTask.id, 'done');

      // Forgotten plan
      const plan4 = planModel.create('Forgotten Plan');
      planModel.activate(plan4.id);
      const forgottenTask = taskModel.create(plan4.id, 'Forgotten Task');
      db.prepare(
        "UPDATE events SET created_at = datetime('now', '-8 days') WHERE entity_id = ?",
      ).run(plan4.id);
      db.prepare(
        "UPDATE events SET created_at = datetime('now', '-8 days') WHERE entity_id = ?",
      ).run(forgottenTask.id);

      const allAlerts = alerts.getAlerts();

      const staleAlerts = allAlerts.filter((a) => a.type === 'stale');
      const blockedAlerts = allAlerts.filter((a) => a.type === 'blocked');
      const completableAlerts = allAlerts.filter((a) => a.type === 'completable');
      const forgottenAlerts = allAlerts.filter((a) => a.type === 'forgotten');

      expect(staleAlerts.length).toBeGreaterThanOrEqual(1);
      expect(blockedAlerts.length).toBeGreaterThanOrEqual(1);
      expect(completableAlerts.length).toBeGreaterThanOrEqual(1);
      expect(forgottenAlerts.length).toBeGreaterThanOrEqual(1);
    });
  });
});
