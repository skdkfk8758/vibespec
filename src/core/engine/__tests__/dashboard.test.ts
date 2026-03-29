import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { PlanModel } from '../../models/plan.js';
import { TaskModel } from '../../models/task.js';
import { SkillUsageModel } from '../../models/skill-usage.js';
import { DashboardEngine } from '../dashboard.js';
import type Database from 'better-sqlite3';

describe('DashboardEngine', () => {
  let db: Database.Database;
  let planModel: PlanModel;
  let taskModel: TaskModel;
  let skillUsageModel: SkillUsageModel;
  let dashboard: DashboardEngine;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    planModel = new PlanModel(db);
    taskModel = new TaskModel(db);
    skillUsageModel = new SkillUsageModel(db);
    dashboard = new DashboardEngine(db, skillUsageModel);
  });

  describe('getOverview', () => {
    it('should return correct overview with task counts and progress', () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      const t3 = taskModel.create(plan.id, 'Task 3');
      const t4 = taskModel.create(plan.id, 'Task 4');

      taskModel.updateStatus(t1.id, 'in_progress');
      taskModel.updateStatus(t1.id, 'done');
      taskModel.updateStatus(t2.id, 'in_progress');
      taskModel.updateStatus(t2.id, 'done');
      taskModel.updateStatus(t3.id, 'in_progress');
      taskModel.updateStatus(t4.id, 'blocked');

      const overview = dashboard.getOverview();

      expect(overview.plans).toHaveLength(1);
      expect(overview.plans[0].progress_pct).toBe(50);
      expect(overview.plans[0].done_tasks).toBe(2);
      expect(overview.plans[0].active_tasks).toBe(1);
      expect(overview.plans[0].blocked_tasks).toBe(1);
      expect(overview.plans[0].total_tasks).toBe(4);
      expect(overview.active_count).toBe(1);
      expect(overview.total_tasks).toBe(4);
      expect(overview.done_tasks).toBe(2);
    });

    it('should return empty overview when no plans exist', () => {
      const overview = dashboard.getOverview();

      expect(overview.plans).toHaveLength(0);
      expect(overview.active_count).toBe(0);
      expect(overview.total_tasks).toBe(0);
      expect(overview.done_tasks).toBe(0);
    });
  });

  describe('getPlanSummary', () => {
    it('should return plan progress for an existing plan', () => {
      const plan = planModel.create('Summary Plan');
      planModel.activate(plan.id);

      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      taskModel.updateStatus(t1.id, 'in_progress');
      taskModel.updateStatus(t1.id, 'done');
      taskModel.updateStatus(t2.id, 'in_progress');

      const summary = dashboard.getPlanSummary(plan.id);

      expect(summary).not.toBeNull();
      expect(summary!.id).toBe(plan.id);
      expect(summary!.title).toBe('Summary Plan');
      expect(summary!.total_tasks).toBe(2);
      expect(summary!.done_tasks).toBe(1);
      expect(summary!.active_tasks).toBe(1);
      expect(summary!.progress_pct).toBe(50);
    });

    it('should return null for a non-existent plan', () => {
      const summary = dashboard.getPlanSummary('nonexistent-id');
      expect(summary).toBeNull();
    });
  });

  describe('getSkillUsageSummary', () => {
    it('should return top 5 skill usage stats when records exist', () => {
      // Arrange: record usage for 6 different skills with varying counts
      skillUsageModel.record('commit');
      skillUsageModel.record('commit');
      skillUsageModel.record('commit');
      skillUsageModel.record('review-pr');
      skillUsageModel.record('review-pr');
      skillUsageModel.record('plan');
      skillUsageModel.record('plan');
      skillUsageModel.record('plan');
      skillUsageModel.record('plan');
      skillUsageModel.record('task');
      skillUsageModel.record('insights');
      skillUsageModel.record('insights');
      skillUsageModel.record('insights');
      skillUsageModel.record('insights');
      skillUsageModel.record('insights');
      skillUsageModel.record('error-kb');
      skillUsageModel.record('dashboard');
      skillUsageModel.record('dashboard');

      // Act
      const result = dashboard.getSkillUsageSummary(7);

      // Assert: top 5 sorted by count desc, limited to 5 results
      expect(result).toHaveLength(5);
      expect(result[0].skill_name).toBe('insights');
      expect(result[0].count).toBe(5);
      expect(result[1].skill_name).toBe('plan');
      expect(result[1].count).toBe(4);
      expect(result[2].skill_name).toBe('commit');
      expect(result[2].count).toBe(3);
      // 7 skills total, only top 5 returned
      const skillNames = result.map((s: { skill_name: string }) => s.skill_name);
      expect(skillNames).not.toContain('error-kb');
    });

    it('should return empty array when no skill usage records exist', () => {
      const result = dashboard.getSkillUsageSummary(7);
      expect(result).toEqual([]);
    });
  });
});
