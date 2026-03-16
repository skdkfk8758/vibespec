import type Database from 'better-sqlite3';
import type { PlanProgress } from '../types.js';

export interface DashboardOverview {
  plans: PlanProgress[];
  active_count: number;
  total_tasks: number;
  done_tasks: number;
}

export class DashboardEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
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
