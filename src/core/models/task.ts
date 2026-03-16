import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { Task, TaskStatus, TaskTreeNode } from '../types.js';
import type { EventModel } from './event.js';

export class TaskModel {
  private events?: EventModel;

  constructor(private db: Database.Database, events?: EventModel) {
    this.events = events;
  }

  create(
    planId: string,
    title: string,
    opts?: {
      parentId?: string;
      spec?: string;
      acceptance?: string;
      sortOrder?: number;
    },
  ): Task {
    const id = nanoid(12);
    let depth = 0;

    if (opts?.parentId) {
      const parent = this.getById(opts.parentId);
      if (!parent) {
        throw new Error(`Parent task not found: ${opts.parentId}`);
      }
      depth = parent.depth + 1;
    }

    const sortOrder = opts?.sortOrder ?? 0;

    this.db
      .prepare(
        `INSERT INTO tasks (id, plan_id, parent_id, title, status, depth, sort_order, spec, acceptance)
         VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?)`,
      )
      .run(
        id,
        planId,
        opts?.parentId ?? null,
        title,
        depth,
        sortOrder,
        opts?.spec ?? null,
        opts?.acceptance ?? null,
      );

    const task = this.getById(id)!;
    this.events?.record('task', task.id, 'created', null, JSON.stringify({ title, status: 'todo' }));
    return task;
  }

  getById(id: string): Task | null {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(id) as Task | undefined;
    return row ?? null;
  }

  getTree(planId: string): TaskTreeNode[] {
    const rows = this.db
      .prepare(
        `WITH RECURSIVE task_tree AS (
           SELECT * FROM tasks WHERE plan_id = ? AND parent_id IS NULL
           UNION ALL
           SELECT t.* FROM tasks t
           INNER JOIN task_tree tt ON t.parent_id = tt.id
         )
         SELECT * FROM task_tree ORDER BY depth, sort_order`,
      )
      .all(planId) as Task[];

    return this.buildTree(rows);
  }

  private buildTree(tasks: Task[]): TaskTreeNode[] {
    const map = new Map<string, TaskTreeNode>();
    const roots: TaskTreeNode[] = [];

    for (const task of tasks) {
      map.set(task.id, { ...task, children: [] });
    }

    for (const task of tasks) {
      const node = map.get(task.id)!;
      if (task.parent_id === null) {
        roots.push(node);
      } else {
        const parent = map.get(task.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    return roots;
  }

  getChildren(parentId: string): Task[] {
    return this.db
      .prepare('SELECT * FROM tasks WHERE parent_id = ? ORDER BY sort_order')
      .all(parentId) as Task[];
  }

  update(
    id: string,
    fields: Partial<Pick<Task, 'title' | 'spec' | 'acceptance' | 'sort_order'>>,
  ): Task {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (fields.title !== undefined) {
      setClauses.push('title = ?');
      values.push(fields.title);
    }
    if (fields.spec !== undefined) {
      setClauses.push('spec = ?');
      values.push(fields.spec);
    }
    if (fields.acceptance !== undefined) {
      setClauses.push('acceptance = ?');
      values.push(fields.acceptance);
    }
    if (fields.sort_order !== undefined) {
      setClauses.push('sort_order = ?');
      values.push(fields.sort_order);
    }

    if (setClauses.length === 0) {
      return this.getById(id)!;
    }

    values.push(id);
    this.db
      .prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...values);

    return this.getById(id)!;
  }

  updateStatus(id: string, status: TaskStatus): Task {
    const oldTask = this.getById(id);
    const oldStatus = oldTask?.status;
    const completedAt = status === 'done' ? new Date().toISOString() : null;

    this.db
      .prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
      .run(status, completedAt, id);

    this.events?.record('task', id, 'status_changed', JSON.stringify({ status: oldStatus }), JSON.stringify({ status }));
    return this.getById(id)!;
  }

  getByPlan(planId: string, filter?: { status?: TaskStatus }): Task[] {
    if (filter?.status) {
      return this.db
        .prepare(
          'SELECT * FROM tasks WHERE plan_id = ? AND status = ? ORDER BY depth, sort_order',
        )
        .all(planId, filter.status) as Task[];
    }

    return this.db
      .prepare(
        'SELECT * FROM tasks WHERE plan_id = ? ORDER BY depth, sort_order',
      )
      .all(planId) as Task[];
  }
}
