import type Database from 'better-sqlite3';
import type { PlanProgress, SkillStats } from '../types.js';
import type { SkillUsageModel } from '../models/skill-usage.js';

export interface DashboardOverview {
  plans: PlanProgress[];
  active_count: number;
  total_tasks: number;
  done_tasks: number;
}

export class DashboardEngine {
  private db: Database.Database;
  private skillUsageModel?: SkillUsageModel;

  constructor(db: Database.Database, skillUsageModel?: SkillUsageModel) {
    this.db = db;
    this.skillUsageModel = skillUsageModel;
  }

  getSkillUsageSummary(days: number = 7): SkillStats[] {
    if (!this.skillUsageModel) return [];
    return this.skillUsageModel.getStats(days).slice(0, 5);
  }

  getOverview(): DashboardOverview {
    const plans = this.db
      .prepare('SELECT * FROM plan_progress')
      .all() as PlanProgress[];

    const active_count = plans.filter((p) => p.status === 'active').length;
    const total_tasks = plans.reduce((sum, p) => sum + p.total_tasks, 0);
    const done_tasks = plans.reduce((sum, p) => sum + p.done_tasks, 0);

    return { plans, active_count, total_tasks, done_tasks };
  }

  getPlanSummary(planId: string): PlanProgress | null {
    const row = this.db
      .prepare('SELECT * FROM plan_progress WHERE id = ?')
      .get(planId) as PlanProgress | undefined;
    return row ?? null;
  }
}
