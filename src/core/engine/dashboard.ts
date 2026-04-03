import type Database from 'better-sqlite3';
import type { BacklogItem, PlanProgress, QARunSummary, SkillStats } from '../types.js';
import { normalizeError } from '../utils.js';
import type { SkillUsageModel } from '../models/skill-usage.js';

export interface BacklogOverview {
  total: number;
  open: number;
  by_priority: { critical: number; high: number; medium: number; low: number };
  top_items: BacklogItem[];
}

export interface DashboardOverview {
  plans: PlanProgress[];
  active_count: number;
  total_tasks: number;
  done_tasks: number;
  backlog: BacklogOverview;
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

    const backlog = this.getBacklogSummary();

    return { plans, active_count, total_tasks, done_tasks, backlog };
  }

  getBacklogSummary(): BacklogOverview {
    try {
      const rows = this.db
        .prepare(
          `SELECT priority, COUNT(*) AS count
           FROM backlog_items
           WHERE status = 'open'
           GROUP BY priority`
        )
        .all() as Array<{ priority: string; count: number }>;

      const by_priority = { critical: 0, high: 0, medium: 0, low: 0 };
      let open = 0;
      for (const row of rows) {
        if (row.priority in by_priority) {
          by_priority[row.priority as keyof typeof by_priority] = row.count;
        }
        open += row.count;
      }

      const totalRow = this.db
        .prepare('SELECT COUNT(*) AS total FROM backlog_items')
        .get() as { total: number };

      const top_items = this.db
        .prepare(
          `SELECT * FROM backlog_items
           WHERE status = 'open'
           ORDER BY CASE priority
             WHEN 'critical' THEN 0
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             WHEN 'low' THEN 3
           END, created_at DESC
           LIMIT 5`
        )
        .all() as BacklogItem[];

      return { total: totalRow.total, open, by_priority, top_items };
    } catch (e) {
      console.error('[dashboard] backlog query failed:', normalizeError(e).message);
      return { total: 0, open: 0, by_priority: { critical: 0, high: 0, medium: 0, low: 0 }, top_items: [] };
    }
  }

  getPlanSummary(planId: string): PlanProgress | null {
    const row = this.db
      .prepare('SELECT * FROM plan_progress WHERE id = ?')
      .get(planId) as PlanProgress | undefined;
    return row ?? null;
  }

  getQASummary(planId: string): QARunSummary | null {
    try {
      const row = this.db
        .prepare(
          `SELECT * FROM qa_run_summary
           WHERE plan_id = ?
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(planId) as QARunSummary | undefined;
      return row ?? null;
    } catch (e) {
      console.error('[dashboard] QA run query failed:', normalizeError(e).message);
      return null;
    }
  }

  getOpenFindings(planId: string): { critical: number; high: number; medium: number; low: number } {
    try {
      const rows = this.db
        .prepare(
          `SELECT qf.severity, COUNT(*) AS count
           FROM qa_findings qf
           JOIN qa_runs qr ON qr.id = qf.run_id
           WHERE qr.plan_id = ? AND qf.status = 'open'
           GROUP BY qf.severity`
        )
        .all(planId) as Array<{ severity: string; count: number }>;

      const result = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const row of rows) {
        if (row.severity in result) {
          result[row.severity as keyof typeof result] = row.count;
        }
      }
      return result;
    } catch (e) {
      console.error('[dashboard] alert counts query failed:', normalizeError(e).message);
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }
  }
}
