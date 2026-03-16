import type Database from 'better-sqlite3';
import type { Alert, Plan, PlanProgress, Task } from '../types.js';

export class AlertsEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getAlerts(): Alert[] {
    const alerts: Alert[] = [];

    for (const task of this.getStaleTasks()) {
      alerts.push({
        type: 'stale',
        entity_type: 'task',
        entity_id: task.id,
        message: `Task "${task.title}" has been in progress for ${task.days_stale} days with no activity`,
      });
    }

    for (const plan of this.getBlockedPlans()) {
      alerts.push({
        type: 'blocked',
        entity_type: 'plan',
        entity_id: plan.id,
        message: `Plan "${plan.title}" has ${plan.blocked_tasks} blocked task(s)`,
      });
    }

    for (const plan of this.getCompletablePlans()) {
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

    return alerts;
  }

  getStaleTasks(thresholdDays: number = 3): (Task & { days_stale: number })[] {
    const rows = this.db
      .prepare(
        `SELECT t.*, CAST(JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) AS INTEGER) AS days_stale
         FROM tasks t
         JOIN events e ON e.entity_id = t.id
         WHERE t.status = 'in_progress'
         GROUP BY t.id
         HAVING JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) > ?`,
      )
      .all(thresholdDays) as (Task & { days_stale: number })[];

    return rows;
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
    const rows = this.db
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

    return rows;
  }
}
