import type Database from 'better-sqlite3';
import type { MergeReport, NewMergeReport } from '../types.js';
import { generateId } from '../utils.js';

interface MergeReportRow {
  id: string;
  plan_id: string | null;
  commit_hash: string;
  source_branch: string;
  target_branch: string;
  changes_summary: string;
  review_checklist: string;
  conflict_log: string | null;
  ai_judgments: string | null;
  verification: string;
  task_ids: string | null;
  report_path: string;
  created_at: string;
}

function rowToReport(row: MergeReportRow): MergeReport {
  return {
    id: row.id,
    plan_id: row.plan_id,
    commit_hash: row.commit_hash,
    source_branch: row.source_branch,
    target_branch: row.target_branch,
    changes_summary: JSON.parse(row.changes_summary),
    review_checklist: JSON.parse(row.review_checklist),
    conflict_log: row.conflict_log ? JSON.parse(row.conflict_log) : null,
    ai_judgments: row.ai_judgments ? JSON.parse(row.ai_judgments) : null,
    verification: JSON.parse(row.verification),
    task_ids: row.task_ids ? JSON.parse(row.task_ids) : null,
    report_path: row.report_path,
    created_at: row.created_at,
  };
}

export class MergeReportModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  create(data: NewMergeReport): MergeReport {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO merge_reports (id, plan_id, commit_hash, source_branch, target_branch,
        changes_summary, review_checklist, conflict_log, ai_judgments, verification, task_ids, report_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.plan_id ?? null,
      data.commit_hash,
      data.source_branch,
      data.target_branch,
      JSON.stringify(data.changes_summary),
      JSON.stringify(data.review_checklist),
      data.conflict_log ? JSON.stringify(data.conflict_log) : null,
      data.ai_judgments ? JSON.stringify(data.ai_judgments) : null,
      JSON.stringify(data.verification),
      data.task_ids ? JSON.stringify(data.task_ids) : null,
      data.report_path,
    );
    return this.get(id)!;
  }

  get(id: string): MergeReport | null {
    const row = this.db.prepare(
      `SELECT * FROM merge_reports WHERE id = ?`
    ).get(id) as MergeReportRow | undefined;
    return row ? rowToReport(row) : null;
  }

  getByCommit(hash: string): MergeReport | null {
    const row = this.db.prepare(
      `SELECT * FROM merge_reports WHERE commit_hash = ? ORDER BY created_at DESC LIMIT 1`
    ).get(hash) as MergeReportRow | undefined;
    return row ? rowToReport(row) : null;
  }

  getByPlan(planId: string): MergeReport[] {
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports WHERE plan_id = ? ORDER BY created_at DESC`
    ).all(planId) as MergeReportRow[];
    return rows.map(rowToReport);
  }

  getLatest(limit: number = 5): MergeReport[] {
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports ORDER BY created_at DESC LIMIT ?`
    ).all(limit) as MergeReportRow[];
    return rows.map(rowToReport);
  }

  list(opts?: { planId?: string; limit?: number }): MergeReport[] {
    if (opts?.planId) {
      const rows = this.db.prepare(
        `SELECT * FROM merge_reports WHERE plan_id = ? ORDER BY created_at DESC LIMIT ?`
      ).all(opts.planId, opts.limit ?? 100) as MergeReportRow[];
      return rows.map(rowToReport);
    }
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports ORDER BY created_at DESC LIMIT ?`
    ).all(opts?.limit ?? 100) as MergeReportRow[];
    return rows.map(rowToReport);
  }
}
