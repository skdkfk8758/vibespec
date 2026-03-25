import type Database from 'better-sqlite3';
import type { QAScenario, QAScenarioStatus, NewQAScenario } from '../types.js';
import { generateId } from '../utils.js';

export class QAScenarioModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  create(runId: string, data: NewQAScenario): QAScenario {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_scenarios (id, run_id, category, title, description, priority, related_tasks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, runId, data.category, data.title, data.description, data.priority, data.related_tasks ?? null);
    return this.get(id)!;
  }

  bulkCreate(runId: string, scenarios: NewQAScenario[]): QAScenario[] {
    const insert = this.db.prepare(
      `INSERT INTO qa_scenarios (id, run_id, category, title, description, priority, related_tasks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const ids: string[] = [];
    const tx = this.db.transaction(() => {
      for (const s of scenarios) {
        const id = generateId();
        insert.run(id, runId, s.category, s.title, s.description, s.priority, s.related_tasks ?? null);
        ids.push(id);
      }
    });
    tx();

    return ids.map((id) => this.get(id)!);
  }

  get(id: string): QAScenario | null {
    const row = this.db.prepare(`SELECT * FROM qa_scenarios WHERE id = ?`).get(id) as QAScenario | undefined;
    return row ?? null;
  }

  listByRun(runId: string, filters?: { category?: string; status?: string; agent?: string }): QAScenario[] {
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
