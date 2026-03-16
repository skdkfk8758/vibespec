import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { Plan, PlanStatus } from '../types.js';
import type { EventModel } from './event.js';

export class PlanModel {
  private db: Database.Database;
  private events?: EventModel;

  constructor(db: Database.Database, events?: EventModel) {
    this.db = db;
    this.events = events;
  }

  create(title: string, spec?: string, summary?: string): Plan {
    const id = nanoid(12);
    const stmt = this.db.prepare(
      `INSERT INTO plans (id, title, status, spec, summary) VALUES (?, ?, 'draft', ?, ?)`
    );
    stmt.run(id, title, spec ?? null, summary ?? null);
    const plan = this.getById(id)!;
    this.events?.record('plan', plan.id, 'created', null, JSON.stringify({ title, status: 'draft' }));
    return plan;
  }

  getById(id: string): Plan | null {
    const stmt = this.db.prepare(`SELECT * FROM plans WHERE id = ?`);
    const row = stmt.get(id) as Plan | undefined;
    return row ?? null;
  }

  list(filter?: { status?: PlanStatus }): Plan[] {
    if (filter?.status) {
      const stmt = this.db.prepare(`SELECT * FROM plans WHERE status = ? ORDER BY created_at DESC`);
      return stmt.all(filter.status) as Plan[];
    }
    const stmt = this.db.prepare(`SELECT * FROM plans ORDER BY created_at DESC`);
    return stmt.all() as Plan[];
  }

  update(id: string, fields: Partial<Pick<Plan, 'title' | 'summary' | 'spec'>>): Plan {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);

    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.title !== undefined) {
      sets.push('title = ?');
      values.push(fields.title);
    }
    if (fields.summary !== undefined) {
      sets.push('summary = ?');
      values.push(fields.summary);
    }
    if (fields.spec !== undefined) {
      sets.push('spec = ?');
      values.push(fields.spec);
    }

    if (sets.length === 0) return plan;

    const oldFields: Record<string, unknown> = {};
    const newFields: Record<string, unknown> = {};
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      if (fields[key] !== undefined) {
        oldFields[key] = plan[key];
        newFields[key] = fields[key];
      }
    }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE plans SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    this.events?.record('plan', id, 'updated', JSON.stringify(oldFields), JSON.stringify(newFields));
    return this.getById(id)!;
  }

  activate(id: string): Plan {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan.status;

    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run('active', id);
    this.events?.record('plan', id, 'activated', JSON.stringify({ status: oldStatus }), JSON.stringify({ status: 'active' }));
    return this.getById(id)!;
  }

  complete(id: string): Plan {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan.status;

    const stmt = this.db.prepare(
      `UPDATE plans SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
    );
    stmt.run(id);
    this.events?.record('plan', id, 'completed', JSON.stringify({ status: oldStatus }), JSON.stringify({ status: 'completed' }));
    return this.getById(id)!;
  }

  archive(id: string): Plan {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan.status;

    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run('archived', id);
    this.events?.record('plan', id, 'archived', JSON.stringify({ status: oldStatus }), JSON.stringify({ status: 'archived' }));
    return this.getById(id)!;
  }
}
