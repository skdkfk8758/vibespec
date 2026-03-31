import type Database from 'better-sqlite3';
import type { PlanRevision, RevisionTriggerType, RevisionStatus } from '../types.js';
import { generateId } from '../utils.js';

export class PlanRevisionModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  create(planId: string, triggerType: RevisionTriggerType, triggerSource: string | null, description: string, changes: string): PlanRevision {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO plan_revisions (id, plan_id, trigger_type, trigger_source, description, changes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, planId, triggerType, triggerSource, description, changes);
    return this.get(id)!;
  }

  get(id: string): PlanRevision | null {
    const row = this.db.prepare('SELECT * FROM plan_revisions WHERE id = ?').get(id) as PlanRevision | undefined;
    return row ?? null;
  }

  listByPlan(planId: string): PlanRevision[] {
    return this.db.prepare(
      'SELECT * FROM plan_revisions WHERE plan_id = ? ORDER BY created_at DESC'
    ).all(planId) as PlanRevision[];
  }

  updateStatus(id: string, status: RevisionStatus): PlanRevision {
    this.db.prepare(
      'UPDATE plan_revisions SET status = ? WHERE id = ?'
    ).run(status, id);
    return this.get(id)!;
  }
}
