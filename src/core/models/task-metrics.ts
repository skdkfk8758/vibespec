import type Database from 'better-sqlite3';
import type { TaskMetrics, TaskMetricsInput } from '../types.js';
import { BaseRepository } from './base-repository.js';

/** BaseRepository-compatible type (id coerced to string for generic constraint) */
type TaskMetricsBase = Omit<TaskMetrics, 'id'> & { id: string };

export class TaskMetricsModel extends BaseRepository<TaskMetricsBase> {
  constructor(db: Database.Database) {
    super(db, 'task_metrics');
  }

  record(
    taskId: string,
    planId: string,
    finalStatus: string,
    metrics?: TaskMetricsInput,
  ): TaskMetrics {
    const durationMin = this.calculateDuration(taskId);
    const blockReason = this.extractBlockReason(taskId, finalStatus);

    this.db
      .prepare(
        `INSERT OR REPLACE INTO task_metrics
         (task_id, plan_id, duration_min, final_status, block_reason, impl_status, test_count, files_changed, has_concerns, changed_files_detail, scope_violations)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        taskId,
        planId,
        durationMin,
        finalStatus,
        blockReason,
        metrics?.impl_status ?? null,
        metrics?.test_count ?? null,
        metrics?.files_changed ?? null,
        metrics?.has_concerns ? 1 : 0,
        metrics?.changed_files_detail ?? null,
        metrics?.scope_violations ?? null,
      );

    return this.getByTask(taskId)!;
  }

  getByTask(taskId: string): TaskMetrics | null {
    const row = this.db
      .prepare('SELECT * FROM task_metrics WHERE task_id = ?')
      .get(taskId) as TaskMetrics | undefined;
    return row ?? null;
  }

  getByPlan(planId: string): TaskMetrics[] {
    return this.db
      .prepare('SELECT * FROM task_metrics WHERE plan_id = ? ORDER BY created_at ASC')
      .all(planId) as TaskMetrics[];
  }

  private calculateDuration(taskId: string): number | null {
    const row = this.db
      .prepare(
        `SELECT created_at FROM events
         WHERE entity_type = 'task'
           AND entity_id = ?
           AND event_type = 'status_changed'
           AND JSON_EXTRACT(new_value, '$.status') = 'in_progress'
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(taskId) as { created_at: string } | undefined;

    if (!row) return null;

    const startTime = new Date(row.created_at).getTime();
    const now = Date.now();
    const diffMin = (now - startTime) / (1000 * 60);
    return Math.round(diffMin * 100) / 100;
  }

  private extractBlockReason(taskId: string, finalStatus: string): string | null {
    const row = this.db
      .prepare(
        `SELECT new_value FROM events
         WHERE entity_type = 'task'
           AND entity_id = ?
           AND event_type = 'blocked_reason'
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(taskId) as { new_value: string } | undefined;

    if (row?.new_value) {
      try {
        const parsed = JSON.parse(row.new_value);
        if (parsed.reason) return parsed.reason;
      } catch {
        // Intentional: JSON.parse fallback for optional metrics field — returns null if unparseable
      }
    }

    if (finalStatus === 'blocked') return 'unspecified';
    return null;
  }
}
