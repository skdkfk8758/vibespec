import type Database from 'better-sqlite3';
import type { QAFinding, QAFindingStatus, NewQAFinding } from '../types.js';
import { generateId } from '../utils.js';
import { BaseRepository } from './base-repository.js';

export class QAFindingModel extends BaseRepository<QAFinding> {
  constructor(db: Database.Database) {
    super(db, 'qa_findings');
  }

  create(runId: string, data: NewQAFinding): QAFinding {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_findings (id, run_id, scenario_id, severity, category, title, description, affected_files, related_task_id, fix_suggestion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, runId,
      data.scenario_id ?? null,
      data.severity, data.category, data.title, data.description,
      data.affected_files ?? null,
      data.related_task_id ?? null,
      data.fix_suggestion ?? null
    );
    return this.get(id)!;
  }

  get(id: string): QAFinding | null {
    return this.getById(id);
  }

  list(filters?: { runId?: string; severity?: string; status?: string; category?: string }): QAFinding[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.runId) {
      conditions.push('run_id = ?');
      params.push(filters.runId);
    }
    if (filters?.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.prepare(
      `SELECT * FROM qa_findings ${where} ORDER BY created_at DESC`
    ).all(...params) as QAFinding[];
  }

  updateStatus(id: string, status: QAFindingStatus, fixPlanId?: string): void {
    this.db.prepare(
      `UPDATE qa_findings SET status = ?,
       fix_plan_id = CASE WHEN ? IS NOT NULL THEN ? ELSE fix_plan_id END
       WHERE id = ?`
    ).run(status, fixPlanId ?? null, fixPlanId ?? null, id);
  }

  getOpenByPlan(planId: string): QAFinding[] {
    return this.db.prepare(
      `SELECT qf.* FROM qa_findings qf
       JOIN qa_runs qr ON qr.id = qf.run_id
       WHERE qr.plan_id = ? AND qf.status = 'open'
       ORDER BY qf.created_at DESC`
    ).all(planId) as QAFinding[];
  }

  getStatsByRun(runId: string): Array<{ severity: string; count: number }> {
    return this.db.prepare(
      `SELECT severity, COUNT(*) AS count
       FROM qa_findings
       WHERE run_id = ?
       GROUP BY severity`
    ).all(runId) as Array<{ severity: string; count: number }>;
  }
}
