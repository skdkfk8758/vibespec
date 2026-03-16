import type Database from 'better-sqlite3';

export interface VelocityResult {
  daily: number;
  total_completed: number;
}

export interface EstimatedCompletionResult {
  remaining_tasks: number;
  velocity: number;
  estimated_days: number | null;
  estimated_date: string | null;
}

export interface TimelineEntry {
  date: string;
  tasks_completed: number;
  cumulative: number;
}

export class StatsEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getVelocity(planId?: string, days: number = 7): VelocityResult {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    let query: string;
    const params: unknown[] = [];

    if (planId) {
      query = `
        SELECT COUNT(*) AS total_completed
        FROM events e
        JOIN tasks t ON e.entity_id = t.id
        WHERE e.event_type = 'status_changed'
          AND JSON_EXTRACT(e.new_value, '$.status') = 'done'
          AND DATE(e.created_at) >= ?
          AND t.plan_id = ?
      `;
      params.push(cutoffStr, planId);
    } else {
      query = `
        SELECT COUNT(*) AS total_completed
        FROM events
        WHERE event_type = 'status_changed'
          AND JSON_EXTRACT(new_value, '$.status') = 'done'
          AND DATE(created_at) >= ?
      `;
      params.push(cutoffStr);
    }

    const row = this.db.prepare(query).get(...params) as { total_completed: number };
    const total_completed = row.total_completed;
    const daily = total_completed / days;

    return { daily, total_completed };
  }

  getEstimatedCompletion(planId: string): EstimatedCompletionResult {
    const remainingRow = this.db
      .prepare(
        `SELECT COUNT(*) AS remaining
         FROM tasks
         WHERE plan_id = ?
           AND status NOT IN ('done', 'skipped')`,
      )
      .get(planId) as { remaining: number };

    const remaining_tasks = remainingRow.remaining;
    const { daily: velocity } = this.getVelocity(planId);

    if (velocity === 0) {
      return {
        remaining_tasks,
        velocity,
        estimated_days: null,
        estimated_date: null,
      };
    }

    const estimated_days = Math.ceil(remaining_tasks / velocity);
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimated_days);
    const estimated_date = estimatedDate.toISOString().split('T')[0];

    return {
      remaining_tasks,
      velocity,
      estimated_days,
      estimated_date,
    };
  }

  getTimeline(planId?: string): TimelineEntry[] {
    let query: string;
    const params: unknown[] = [];

    if (planId) {
      query = `
        SELECT DATE(e.created_at) AS date, COUNT(*) AS tasks_completed
        FROM events e
        JOIN tasks t ON e.entity_id = t.id
        WHERE e.event_type = 'status_changed'
          AND JSON_EXTRACT(e.new_value, '$.status') = 'done'
          AND t.plan_id = ?
        GROUP BY DATE(e.created_at)
        ORDER BY DATE(e.created_at)
      `;
      params.push(planId);
    } else {
      query = `
        SELECT DATE(created_at) AS date, COUNT(*) AS tasks_completed
        FROM events
        WHERE event_type = 'status_changed'
          AND JSON_EXTRACT(new_value, '$.status') = 'done'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;
    }

    const rows = this.db.prepare(query).all(...params) as {
      date: string;
      tasks_completed: number;
    }[];

    let cumulative = 0;
    return rows.map((row) => {
      cumulative += row.tasks_completed;
      return {
        date: row.date,
        tasks_completed: row.tasks_completed,
        cumulative,
      };
    });
  }
}
