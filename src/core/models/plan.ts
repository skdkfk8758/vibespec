import type Database from 'better-sqlite3';
import type { Plan, PlanStatus } from '../types.js';
import type { EventModel } from './event.js';
import type { AgentHandoffModel } from './agent-handoff.js';
import { BaseRepository } from './base-repository.js';
import { detectGitContext } from '../db/connection.js';
import { generateId, buildUpdateQuery, validateTransition, withTransaction, type AllowedTransitions } from '../utils.js';

export const PLAN_TRANSITIONS: AllowedTransitions = {
  draft: ['active'],
  active: ['approved', 'completed', 'archived'],
  approved: ['completed', 'archived'],
  completed: ['archived'],
  archived: [],
};

export class PlanModel extends BaseRepository<Plan> {
  private events?: EventModel;
  private handoffs?: AgentHandoffModel;

  constructor(db: Database.Database, events?: EventModel, handoffs?: AgentHandoffModel) {
    super(db, 'plans');
    this.events = events;
    this.handoffs = handoffs;
  }

  requireById(id: string): Plan {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    return plan;
  }

  create(title: string, spec?: string, summary?: string): Plan {
    const id = generateId();
    const ctx = detectGitContext();
    this.db.prepare(
      `INSERT INTO plans (id, title, status, spec, summary, branch, worktree_name) VALUES (?, ?, 'draft', ?, ?, ?, ?)`
    ).run(id, title, spec ?? null, summary ?? null, ctx.branch, ctx.worktreeName);
    const plan = this.requireById(id);
    this.events?.record('plan', plan.id, 'created', null, JSON.stringify({ title, status: 'draft', branch: ctx.branch }));
    return plan;
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
    return this.db.prepare(`SELECT * FROM plans ${where} ORDER BY created_at DESC`).all(...params) as Plan[];
  }

  update(id: string, fields: Partial<Pick<Plan, 'title' | 'summary' | 'spec'>>): Plan {
    const plan = this.requireById(id);

    const query = buildUpdateQuery('plans', id, fields);
    if (!query) return plan;

    const oldFields: Record<string, unknown> = {};
    const newFields: Record<string, unknown> = {};
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      if (fields[key] !== undefined) {
        oldFields[key] = plan[key];
        newFields[key] = fields[key];
      }
    }

    this.db.prepare(query.sql).run(...query.params);
    this.events?.record('plan', id, 'updated', JSON.stringify(oldFields), JSON.stringify(newFields));
    return this.requireById(id);
  }

  private transitionStatus(
    id: string,
    newStatus: PlanStatus,
    eventType: 'activated' | 'completed' | 'approved' | 'archived',
    guard?: (plan: Plan) => void,
    extra?: string,
    opts?: { force?: boolean },
  ): Plan {
    const plan = this.requireById(id);
    if (plan.status === newStatus) return plan;
    validateTransition(PLAN_TRANSITIONS, plan.status, newStatus, opts);
    if (guard) guard(plan);
    const oldStatus = plan.status;

    withTransaction(this.db, () => {
      const sql = extra
        ? `UPDATE plans SET status = ?, ${extra} WHERE id = ?`
        : `UPDATE plans SET status = ? WHERE id = ?`;
      this.db.prepare(sql).run(newStatus, id);

      this.events?.record('plan', id, eventType,
        JSON.stringify({ status: oldStatus }),
        JSON.stringify({ status: newStatus }),
      );
    });

    // Auto-clean handoff data when plan reaches terminal status
    if ((newStatus === 'completed' || newStatus === 'archived') && this.handoffs) {
      try {
        this.handoffs.cleanByPlan(id);
      } catch {
        // Best-effort cleanup: don't fail the transition
      }
    }

    return this.requireById(id);
  }

  activate(id: string, opts?: { force?: boolean }): Plan {
    return this.transitionStatus(id, 'active', 'activated', undefined, undefined, opts);
  }

  complete(id: string, opts?: { force?: boolean }): Plan {
    return this.transitionStatus(id, 'completed', 'completed', undefined, 'completed_at = CURRENT_TIMESTAMP', opts);
  }

  approve(id: string, opts?: { force?: boolean }): Plan {
    return this.transitionStatus(id, 'approved', 'approved', undefined, undefined, opts);
  }

  archive(id: string, opts?: { force?: boolean }): Plan {
    return this.transitionStatus(id, 'archived', 'archived', undefined, undefined, opts);
  }

  delete(id: string): void {
    const plan = this.requireById(id);
    if (plan.status !== 'draft') {
      throw new Error(`Only draft plans can be deleted. Current status: ${plan.status}`);
    }
    withTransaction(this.db, () => {
      this.db.prepare('DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE plan_id = ?)').run(id);
      this.db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
      this.db.prepare('DELETE FROM tasks WHERE plan_id = ?').run(id);
      this.db.prepare('DELETE FROM plans WHERE id = ?').run(id);
    });
  }
}
