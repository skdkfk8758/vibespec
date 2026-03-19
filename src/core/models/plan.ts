import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { Plan, PlanStatus } from '../types.js';
import type { EventModel } from './event.js';
import { detectGitContext } from '../db/connection.js';

export class PlanModel {
  private db: Database.Database;
  private events?: EventModel;

  constructor(db: Database.Database, events?: EventModel) {
    this.db = db;
    this.events = events;
  }

  create(title: string, spec?: string, summary?: string): Plan {
    const id = nanoid(12);
    const ctx = detectGitContext();
    const stmt = this.db.prepare(
      `INSERT INTO plans (id, title, status, spec, summary, branch, worktree_name) VALUES (?, ?, 'draft', ?, ?, ?, ?)`
    );
    stmt.run(id, title, spec ?? null, summary ?? null, ctx.branch, ctx.worktreeName);
    const plan = this.getById(id)!;
    this.events?.record('plan', plan.id, 'created', null, JSON.stringify({ title, status: 'draft', branch: ctx.branch }));
    return plan;
  }

  getById(id: string): Plan | null {
    const stmt = this.db.prepare(`SELECT * FROM plans WHERE id = ?`);
    const row = stmt.get(id) as Plan | undefined;
    return row ?? null;
  }

  list(filter?: { status?: PlanStatus; branch?: string }): Plan[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.branch) {
      conditions.push('branch = ?');
      params.push(filter.branch);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = this.db.prepare(`SELECT * FROM plans ${where} ORDER BY created_at DESC`);
    return stmt.all(...params) as Plan[];
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

  delete(id: string): void {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    if (plan.status !== 'draft') {
      throw new Error(`Only draft plans can be deleted. Current status: ${plan.status}`);
    }
    // Delete events referencing tasks in this plan
    this.db.prepare(
      'DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE plan_id = ?)',
    ).run(id);
    // Delete events referencing the plan itself
    this.db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
    // Delete tasks (FK constraint)
    this.db.prepare('DELETE FROM tasks WHERE plan_id = ?').run(id);
    // Delete the plan
    this.db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  }

  approve(id: string): Plan {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    if (plan.status !== 'active') {
      throw new Error(`Only active plans can be approved. Current status: ${plan.status}`);
    }
    const oldStatus = plan.status;

    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run('approved', id);
    this.events?.record('plan', id, 'approved', JSON.stringify({ status: oldStatus }), JSON.stringify({ status: 'approved' }));
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
