import type Database from 'better-sqlite3';
import type { BacklogItem, BacklogStatus, BacklogPriority, BacklogCategory, NewBacklogItem } from '../types.js';
import type { EventModel } from './event.js';
import { generateId, buildUpdateQuery } from '../utils.js';

export interface BacklogFilter {
  status?: BacklogStatus;
  priority?: BacklogPriority;
  category?: BacklogCategory;
  tag?: string;
}

export interface BacklogStats {
  total: number;
  by_priority: Record<BacklogPriority, number>;
  by_category: Record<string, number>;
  by_status: Record<BacklogStatus, number>;
}

export class BacklogModel {
  private db: Database.Database;
  private events?: EventModel;

  constructor(db: Database.Database, events?: EventModel) {
    this.db = db;
    this.events = events;
  }

  create(item: NewBacklogItem): BacklogItem {
    const id = generateId();
    const tags = item.tags ? JSON.stringify(item.tags) : null;

    this.db.prepare(`
      INSERT INTO backlog_items (id, title, description, priority, category, tags, complexity_hint, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.title,
      item.description ?? null,
      item.priority ?? 'medium',
      item.category ?? null,
      tags,
      item.complexity_hint ?? null,
      item.source ?? null,
    );

    const created = this.requireById(id);
    this.events?.record('backlog', id, 'created', null, JSON.stringify({ title: item.title }));
    return created;
  }

  getById(id: string): BacklogItem | null {
    const row = this.db.prepare('SELECT * FROM backlog_items WHERE id = ?').get(id) as BacklogItem | undefined;
    return row ?? null;
  }

  private requireById(id: string): BacklogItem {
    const item = this.getById(id);
    if (!item) throw new Error(`Backlog item not found: ${id}`);
    return item;
  }

  list(filter?: BacklogFilter): BacklogItem[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.status) {
      conditions.push('b.status = ?');
      params.push(filter.status);
    }
    if (filter?.priority) {
      conditions.push('b.priority = ?');
      params.push(filter.priority);
    }
    if (filter?.category) {
      conditions.push('b.category = ?');
      params.push(filter.category);
    }

    let sql: string;
    if (filter?.tag) {
      conditions.push('EXISTS (SELECT 1 FROM json_each(b.tags) WHERE json_each.value = ?)');
      params.push(filter.tag);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const priorityOrder = "CASE b.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END";
    sql = `SELECT b.* FROM backlog_items b ${where} ORDER BY ${priorityOrder}, b.created_at DESC`;

    return this.db.prepare(sql).all(...params) as BacklogItem[];
  }

  update(id: string, fields: Partial<Pick<BacklogItem, 'title' | 'description' | 'priority' | 'category' | 'tags' | 'complexity_hint' | 'source' | 'status'>>): BacklogItem {
    const item = this.requireById(id);

    const dbFields: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };

    const query = buildUpdateQuery('backlog_items', id, dbFields);
    if (!query) return item;

    const oldFields: Record<string, unknown> = {};
    const newFields: Record<string, unknown> = {};
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      if (fields[key] !== undefined) {
        oldFields[key] = item[key];
        newFields[key] = fields[key];
      }
    }

    this.db.prepare(query.sql).run(...query.params);

    if (fields.status && fields.status !== item.status) {
      this.events?.record('backlog', id, 'status_changed', JSON.stringify({ status: item.status }), JSON.stringify({ status: fields.status }));
    } else {
      this.events?.record('backlog', id, 'updated', JSON.stringify(oldFields), JSON.stringify(newFields));
    }

    return this.requireById(id);
  }

  promote(id: string, planId: string): BacklogItem {
    const item = this.requireById(id);
    if (item.status !== 'open') {
      throw new Error(`Only open backlog items can be promoted. Current status: ${item.status}`);
    }

    this.db.prepare(
      'UPDATE backlog_items SET status = ?, plan_id = ?, updated_at = ? WHERE id = ?'
    ).run('planned', planId, new Date().toISOString(), id);

    this.events?.record('backlog', id, 'status_changed',
      JSON.stringify({ status: 'open' }),
      JSON.stringify({ status: 'planned', plan_id: planId }),
    );

    return this.requireById(id);
  }

  delete(id: string): void {
    this.requireById(id);
    this.db.prepare('DELETE FROM events WHERE entity_type = ? AND entity_id = ?').run('backlog', id);
    this.db.prepare('DELETE FROM backlog_items WHERE id = ?').run(id);
  }

  getStats(): BacklogStats {
    const items = this.db.prepare('SELECT priority, category, status FROM backlog_items').all() as Array<{ priority: string; category: string | null; status: string }>;

    const stats: BacklogStats = {
      total: items.length,
      by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
      by_category: {},
      by_status: { open: 0, planned: 0, done: 0, dropped: 0 },
    };

    for (const item of items) {
      stats.by_priority[item.priority as BacklogPriority]++;
      stats.by_status[item.status as BacklogStatus]++;
      const cat = item.category ?? 'uncategorized';
      stats.by_category[cat] = (stats.by_category[cat] ?? 0) + 1;
    }

    return stats;
  }
}
