import type Database from 'better-sqlite3';
import type { QAScenario, QAScenarioStatus, NewQAScenario } from '../types.js';
import { generateId } from '../utils.js';
import { BaseRepository } from './base-repository.js';

export class QAScenarioModel extends BaseRepository<QAScenario> {
  constructor(db: Database.Database) {
    super(db, 'qa_scenarios');
  }

  create(runId: string, data: NewQAScenario): QAScenario {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_scenarios (id, run_id, category, title, description, priority, related_tasks, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, runId, data.category, data.title, data.description, data.priority, data.related_tasks ?? null, data.source ?? 'final');
    return this.get(id)!;
  }

  bulkCreate(runId: string, scenarios: NewQAScenario[]): QAScenario[] {
    const insert = this.db.prepare(
      `INSERT INTO qa_scenarios (id, run_id, category, title, description, priority, related_tasks, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const ids: string[] = [];
    const tx = this.db.transaction(() => {
      for (const s of scenarios) {
        const id = generateId();
        insert.run(id, runId, s.category, s.title, s.description, s.priority, s.related_tasks ?? null, s.source ?? 'final');
        ids.push(id);
      }
    });
    tx();

    return ids.map((id) => this.get(id)!);
  }

  get(id: string): QAScenario | null {
    return this.getById(id);
  }

  listByRun(runId: string, filters?: { category?: string; status?: string; agent?: string; source?: string }): QAScenario[] {
    const conditions: string[] = ['run_id = ?'];
    const params: unknown[] = [runId];

    if (filters?.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.agent) {
      conditions.push('agent = ?');
      params.push(filters.agent);
    }
    if (filters?.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }

    const where = conditions.join(' AND ');
    return this.db.prepare(
      `SELECT * FROM qa_scenarios WHERE ${where} ORDER BY created_at ASC`
    ).all(...params) as QAScenario[];
  }

  updateStatus(id: string, status: QAScenarioStatus, evidence?: string): void {
    if (evidence !== undefined) {
      this.db.prepare(
        `UPDATE qa_scenarios SET status = ?, evidence = ? WHERE id = ?`
      ).run(status, evidence, id);
    } else {
      this.db.prepare(
        `UPDATE qa_scenarios SET status = ? WHERE id = ?`
      ).run(status, id);
    }
  }

  listByPlan(planId: string, filters?: { taskId?: string; source?: string; category?: string; status?: string }): QAScenario[] {
    const conditions: string[] = ['r.plan_id = ?'];
    const params: unknown[] = [planId];

    if (filters?.source) {
      conditions.push('s.source = ?');
      params.push(filters.source);
    }
    if (filters?.category) {
      conditions.push('s.category = ?');
      params.push(filters.category);
    }
    if (filters?.status) {
      conditions.push('s.status = ?');
      params.push(filters.status);
    }
    if (filters?.taskId) {
      // related_tasks is stored as JSON array (e.g. '["task-1","task-2"]') or plain ID
      // Use exact quoted match to avoid false positives (e.g. "task-1" matching "task-10")
      conditions.push("(s.related_tasks LIKE ? OR s.related_tasks = ?)");
      params.push(`%"${filters.taskId}"%`, filters.taskId);
    }

    const where = conditions.join(' AND ');
    return this.db.prepare(
      `SELECT s.* FROM qa_scenarios s
       INNER JOIN qa_runs r ON s.run_id = r.id
       WHERE ${where}
       ORDER BY s.created_at ASC`
    ).all(...params) as QAScenario[];
  }

  listByPlanSource(planId: string, source: string): QAScenario[] {
    return this.listByPlan(planId, { source });
  }

  getStatsByRun(runId: string): Array<{ category: string; total: number; passed: number; failed: number }> {
    return this.db.prepare(
      `SELECT
        category,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) AS failed
      FROM qa_scenarios
      WHERE run_id = ?
      GROUP BY category`
    ).all(runId) as Array<{ category: string; total: number; passed: number; failed: number }>;
  }
}
