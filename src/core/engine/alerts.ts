import type Database from 'better-sqlite3';
import type { Alert, Plan, PlanProgress, Task } from '../types.js';

export class AlertsEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getAlerts(): Alert[] {
    const alerts: Alert[] = [];

    // Load plan_progress once for blocked/completable checks
    const progress = this.getAllPlanProgress();

    for (const task of this.getStaleTasks()) {
      alerts.push({
        type: 'stale',
        entity_type: 'task',
        entity_id: task.id,
        message: `Task "${task.title}" has been in progress for ${task.days_stale} days with no activity`,
      });
    }

    for (const plan of progress.filter(p => p.blocked_tasks > 0)) {
      alerts.push({
        type: 'blocked',
        entity_type: 'plan',
        entity_id: plan.id,
        message: `Plan "${plan.title}" has ${plan.blocked_tasks} blocked task(s)`,
      });
    }

    for (const plan of progress.filter(p => p.progress_pct === 100 && p.status === 'active')) {
      alerts.push({
        type: 'completable',
        entity_type: 'plan',
        entity_id: plan.id,
        message: `Plan "${plan.title}" has all tasks done and can be completed`,
      });
    }

    for (const plan of this.getForgottenPlans()) {
      alerts.push({
        type: 'forgotten',
        entity_type: 'plan',
        entity_id: plan.id,
        message: `Plan "${plan.title}" has had no activity for ${plan.days_inactive} days`,
      });
    }

    // QA alerts
    alerts.push(...this.getQAAlerts(progress));

    // Backlog alerts
    alerts.push(...this.getBacklogAlerts());

    return alerts;
  }

  private getQAAlerts(progress: PlanProgress[]): Alert[] {
    const qaAlerts: Alert[] = [];
    if (progress.length === 0) return qaAlerts;

    try {
      const planMap = new Map(progress.map(p => [p.id, p]));

      // Batch: high risk runs (one query for all plans)
      const highRiskRuns = this.db.prepare(
        `SELECT plan_id, risk_score FROM qa_runs
         WHERE status = 'completed' AND risk_score >= 0.5
         AND created_at = (SELECT MAX(created_at) FROM qa_runs qr2 WHERE qr2.plan_id = qa_runs.plan_id AND qr2.status = 'completed')
         GROUP BY plan_id`
      ).all() as Array<{ plan_id: string; risk_score: number }>;

      for (const row of highRiskRuns) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: 'qa_risk_high',
            entity_type: 'plan',
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"의 QA 리스크가 높습니다 (risk: ${row.risk_score.toFixed(2)})`,
          });
        }
      }

      // Batch: open critical/high findings per plan
      const openFindings = this.db.prepare(
        `SELECT qr.plan_id, COUNT(*) AS count FROM qa_findings qf
         JOIN qa_runs qr ON qr.id = qf.run_id
         WHERE qf.status = 'open' AND qf.severity IN ('critical', 'high')
         GROUP BY qr.plan_id`
      ).all() as Array<{ plan_id: string; count: number }>;

      for (const row of openFindings) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: 'qa_findings_open',
            entity_type: 'plan',
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"에 미해결 critical/high QA 이슈가 ${row.count}건 있습니다`,
          });
        }
      }

      // Batch: stale QA runs (last completed > 7 days ago)
      const staleRuns = this.db.prepare(
        `SELECT plan_id, CAST(JULIANDAY('now') - JULIANDAY(MAX(created_at)) AS INTEGER) AS days_since
         FROM qa_runs WHERE status = 'completed'
         GROUP BY plan_id
         HAVING days_since > 7`
      ).all() as Array<{ plan_id: string; days_since: number }>;

      for (const row of staleRuns) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: 'qa_stale',
            entity_type: 'plan',
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"의 마지막 QA가 ${row.days_since}일 전입니다`,
          });
        }
      }

      // Batch: fix plans with blocked tasks
      const blockedFixPlans = this.db.prepare(
        `SELECT DISTINCT qr.plan_id, COUNT(t.id) AS blocked_count
         FROM qa_findings qf
         JOIN qa_runs qr ON qr.id = qf.run_id
         JOIN tasks t ON t.plan_id = qf.fix_plan_id AND t.status = 'blocked'
         WHERE qf.fix_plan_id IS NOT NULL
         GROUP BY qr.plan_id`
      ).all() as Array<{ plan_id: string; blocked_count: number }>;

      for (const row of blockedFixPlans) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: 'qa_fix_blocked',
            entity_type: 'plan',
            entity_id: row.plan_id,
            message: `QA 수정 플랜에 차단된 태스크가 ${row.blocked_count}건 있습니다`,
          });
        }
      }
    } catch {
      // QA tables may not exist yet
    }

    return qaAlerts;
  }

  private getAllPlanProgress(): PlanProgress[] {
    return this.db
      .prepare('SELECT * FROM plan_progress')
      .all() as PlanProgress[];
  }

  getStaleTasks(thresholdDays: number = 3): (Task & { days_stale: number })[] {
    return this.db
      .prepare(
        `SELECT t.*, CAST(JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) AS INTEGER) AS days_stale
         FROM tasks t
         JOIN events e ON e.entity_id = t.id
         WHERE t.status = 'in_progress'
         GROUP BY t.id
         HAVING JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) > ?`,
      )
      .all(thresholdDays) as (Task & { days_stale: number })[];
  }

  getBlockedPlans(): PlanProgress[] {
    return this.db
      .prepare('SELECT * FROM plan_progress WHERE blocked_tasks > 0')
      .all() as PlanProgress[];
  }

  getCompletablePlans(): PlanProgress[] {
    return this.db
      .prepare(
        "SELECT * FROM plan_progress WHERE progress_pct = 100 AND status = 'active'",
      )
      .all() as PlanProgress[];
  }

  private getBacklogAlerts(): Alert[] {
    const alerts: Alert[] = [];

    try {
      // backlog_stale: open items older than 7 days
      const staleItems = this.db.prepare(
        `SELECT id, title, CAST(JULIANDAY('now') - JULIANDAY(created_at) AS INTEGER) AS days_old
         FROM backlog_items
         WHERE status = 'open'
         AND JULIANDAY('now') - JULIANDAY(created_at) > 7`
      ).all() as Array<{ id: string; title: string; days_old: number }>;

      for (const item of staleItems) {
        alerts.push({
          type: 'backlog_stale',
          entity_type: 'backlog',
          entity_id: item.id,
          message: `백로그 "${item.title}"이 ${item.days_old}일간 미처리 상태입니다`,
        });
      }

      // backlog_critical: open items with critical priority
      const criticalItems = this.db.prepare(
        `SELECT id, title FROM backlog_items
         WHERE status = 'open' AND priority = 'critical'`
      ).all() as Array<{ id: string; title: string }>;

      for (const item of criticalItems) {
        alerts.push({
          type: 'backlog_critical',
          entity_type: 'backlog',
          entity_id: item.id,
          message: `백로그 "${item.title}"이 critical 우선순위로 미처리 상태입니다`,
        });
      }
    } catch {
      // backlog_items table may not exist yet
    }

    return alerts;
  }

  getForgottenPlans(thresholdDays: number = 7): (Plan & { days_inactive: number })[] {
    return this.db
      .prepare(
        `SELECT p.*, CAST(JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) AS INTEGER) AS days_inactive
         FROM plans p
         JOIN events e ON (
           e.entity_id = p.id
           OR e.entity_id IN (SELECT id FROM tasks WHERE plan_id = p.id)
         )
         WHERE p.status = 'active'
         GROUP BY p.id
         HAVING JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) > ?`,
      )
      .all(thresholdDays) as (Plan & { days_inactive: number })[];
  }
}
