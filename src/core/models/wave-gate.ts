import type Database from 'better-sqlite3';
import type { WaveGate, WaveGateVerdict } from '../types.js';
import { generateId } from '../utils.js';
import { BaseRepository } from './base-repository.js';

export class WaveGateModel extends BaseRepository<WaveGate> {
  constructor(db: Database.Database) {
    super(db, 'wave_gates');
  }

  create(planId: string, waveNumber: number, taskIds: string[], verdict: WaveGateVerdict, summary?: string, findingsCount?: number): WaveGate {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO wave_gates (id, plan_id, wave_number, task_ids, verdict, summary, findings_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, planId, waveNumber, JSON.stringify(taskIds), verdict, summary ?? null, findingsCount ?? 0);
    return this.getById(id)!;
  }

  listByPlan(planId: string): WaveGate[] {
    return this.db.prepare(
      'SELECT * FROM wave_gates WHERE plan_id = ? ORDER BY wave_number ASC'
    ).all(planId) as WaveGate[];
  }
}
