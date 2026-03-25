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

    return alerts;
  }

  private getQAAlerts(progress: PlanProgress[]): Alert[] {
    const qaAlerts: Alert[] = [];

    try {
      // Check if qa_runs table exists
      const tables = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='qa_runs'"
      ).all();
      if (tables.length === 0) return qaAlerts;

      for (const plan of progress) {
        // qa_risk_high: risk_score >= 0.5
        const highRiskRun = this.db.prepare(
          `SELECT id, risk_score FROM qa_runs
           WHERE plan_id = ? AND status = 'completed' AND risk_score >= 0.5
           ORDER BY created_at DESC LIMIT 1`
        ).get(plan.id) as { id: string; risk_score: number } | undefined;

        if (highRiskRun) {
          qaAlerts.push({
            type: 'qa_risk_high',
            entity_type: 'plan',
            entity_id: plan.id,
            message: `Plan "${plan.title}"의 QA 리스크가 높습니다 (risk: ${highRiskRun.risk_score.toFixed(2)})`,
          });
        }

        // qa_findings_open: open critical/high findings
        const openFindings = this.db.prepare(
          `SELECT COUNT(*) AS count FROM qa_findings qf
           JOIN qa_runs qr ON qr.id = qf.run_id
           WHERE qr.plan_id = ? AND qf.status = 'open' AND qf.severity IN ('critical', 'high')`
        ).get(plan.id) as { count: number };

        if (openFindings.count > 0) {
          qaAlerts.push({
            type: 'qa_findings_open',
            entity_type: 'plan',
            entity_id: plan.id,
            message: `Plan "${plan.title}"에 미해결 critical/high QA 이슈가 ${openFindings.count}건 있습니다`,
          });
        }

        // qa_stale: last QA run > 7 days ago
        const lastRun = this.db.prepare(
          `SELECT CAST(JULIANDAY('now') - JULIANDAY(MAX(created_at)) AS INTEGER) AS days_since
           FROM qa_runs WHERE plan_id = ? AND status = 'completed'`
        ).get(plan.id) as { days_since: number | null } | undefined;

        if (lastRun?.days_since && lastRun.days_since > 7) {
          qaAlerts.push({
            type: 'qa_stale',
            entity_type: 'plan',
            entity_id: plan.id,
            message: `Plan "${plan.title}"의 마지막 QA가 ${lastRun.days_since}일 전입니다`,
          });
        }

        // qa_fix_blocked: QA fix plan has blocked tasks
        const fixPlans = this.db.prepare(
          `SELECT DISTINCT qf.fix_plan_id FROM qa_findings qf
           JOIN qa_runs qr ON qr.id = qf.run_id
           WHERE qr.plan_id = ? AND qf.fix_plan_id IS NOT NULL`
        ).all(plan.id) as Array<{ fix_plan_id: string }>;

        for (const fp of fixPlans) {
          const blockedTasks = this.db.prepare(
            `SELECT COUNT(*) AS count FROM tasks WHERE plan_id = ? AND status = 'blocked'`
          ).get(fp.fix_plan_id) as { count: number };

          if (blockedTasks.count > 0) {
            qaAlerts.push({
              type: 'qa_fix_blocked',
              entity_type: 'plan',
              entity_id: plan.id,
              message: `QA 수정 플랜에 차단된 태스크가 ${blockedTasks.count}건 있습니다`,
            });
            break;
          }
        }
      }
    } catch {
      // QA tables may not exist yet — silently skip
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
