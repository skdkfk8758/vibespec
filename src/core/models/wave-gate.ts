import type Database from 'better-sqlite3';
import type { WaveGate, WaveGateVerdict } from '../types.js';
import { generateId } from '../utils.js';

export class WaveGateModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  create(planId: string, waveNumber: number, taskIds: string[], verdict: WaveGateVerdict, summary?: string, findingsCount?: number): WaveGate {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO wave_gates (id, plan_id, wave_number, task_ids, verdict, summary, findings_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, planId, waveNumber, JSON.stringify(taskIds), verdict, summary ?? null, findingsCount ?? 0);
    return this.get(id)!;
  }

  get(id: string): WaveGate | null {
    const row = this.db.prepare('SELECT * FROM wave_gates WHERE id = ?').get(id) as WaveGate | undefined;
    return row ?? null;
  }

  listByPlan(planId: string): WaveGate[] {
    return this.db.prepare(
      'SELECT * FROM wave_gates WHERE plan_id = ? ORDER BY wave_number ASC'
    ).all(planId) as WaveGate[];
  }
}
