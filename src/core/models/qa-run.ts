import type Database from 'better-sqlite3';
import type { QARun, QARunStatus, QARunSummary, QARunTrigger } from '../types.js';
import { generateId } from '../utils.js';
import { BaseRepository } from './base-repository.js';

export class QARunModel extends BaseRepository<QARun> {
  constructor(db: Database.Database) {
    super(db, 'qa_runs');
  }

  create(planId: string, trigger: QARunTrigger): QARun {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_runs (id, plan_id, "trigger") VALUES (?, ?, ?)`
    ).run(id, planId, trigger);
    return this.get(id)!;
  }

  get(id: string): QARun | null {
    return this.getById(id);
  }

  list(planId?: string): QARun[] {
    if (planId) {
      return this.db.prepare(
        `SELECT * FROM qa_runs WHERE plan_id = ? ORDER BY created_at DESC`
      ).all(planId) as QARun[];
    }
    return this.db.prepare(
      `SELECT * FROM qa_runs ORDER BY created_at DESC`
    ).all() as QARun[];
  }

  updateStatus(id: string, status: QARunStatus, summary?: string): QARun {
    this.db.prepare(
      `UPDATE qa_runs SET status = ?, summary = ?,
       completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = ?`
    ).run(status, summary ?? null, status, id);
    return this.get(id)!;
  }

  updateScores(id: string, total: number, passed: number, failed: number, riskScore: number): void {
    this.db.prepare(
      `UPDATE qa_runs SET total_scenarios = ?, passed_scenarios = ?, failed_scenarios = ?, risk_score = ? WHERE id = ?`
    ).run(total, passed, failed, riskScore, id);
  }

  getLatestByPlan(planId: string): QARun | null {
    const row = this.db.prepare(
      `SELECT * FROM qa_runs WHERE plan_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(planId) as QARun | undefined;
    return row ?? null;
  }

  getSummary(id: string): QARunSummary | null {
    const row = this.db.prepare(
      `SELECT * FROM qa_run_summary WHERE id = ?`
    ).get(id) as QARunSummary | undefined;
    return row ?? null;
  }
}
