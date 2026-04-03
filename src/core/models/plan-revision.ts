import type Database from 'better-sqlite3';
import type { PlanRevision, RevisionTriggerType, RevisionStatus } from '../types.js';
import { generateId } from '../utils.js';
import { BaseRepository } from './base-repository.js';

export class PlanRevisionModel extends BaseRepository<PlanRevision> {
  constructor(db: Database.Database) {
    super(db, 'plan_revisions');
  }

  create(planId: string, triggerType: RevisionTriggerType, triggerSource: string | null, description: string, changes: string): PlanRevision {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO plan_revisions (id, plan_id, trigger_type, trigger_source, description, changes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, planId, triggerType, triggerSource, description, changes);
    return this.getById(id)!;
  }

  listByPlan(planId: string): PlanRevision[] {
    return this.db.prepare(
      'SELECT * FROM plan_revisions WHERE plan_id = ? ORDER BY created_at DESC'
    ).all(planId) as PlanRevision[];
  }

  updateStatus(id: string, status: RevisionStatus): PlanRevision {
    return this.update(id, { status } as Partial<Omit<PlanRevision, 'id'>>);
  }
}
