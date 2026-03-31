import type Database from 'better-sqlite3';
import type { Task, TaskStatus, TaskTreeNode, TaskUpdateInput, Wave } from '../types.js';
import type { EventModel } from './event.js';
import { BaseRepository } from './base-repository.js';
import { generateId, validateTransition, withTransaction, type AllowedTransitions } from '../utils.js';

export const TASK_TRANSITIONS: AllowedTransitions = {
  todo: ['in_progress', 'blocked', 'skipped'],
  in_progress: ['done', 'blocked', 'todo'],
  blocked: ['todo', 'in_progress', 'skipped'],
  done: [],
  skipped: [],
};

export interface AcceptanceValidationResult {
  valid: boolean;
  warnings: string[];
}

const ACTION_VERBS_KO = /(?:반환|표시|생성|포함|존재|동작|출력|실행|저장|삭제|변경|확인|처리|전달|호출|설정|검증|수행|발생|제공|응답|보여|보고|판정|매핑|이동)(?:한다|된다|하다|된다|합니다|됩니다|해야)/;
const ACTION_VERBS_EN = /\b(?:return|display|create|contain|exist|output|run|save|delete|change|verify|should|must|shall|throw|fail|pass|handle|accept|reject|render|show|send|receive|include|produce|emit|dispatch|call|update|remove|add|store|load|fetch|respond|report|generate|trigger|prevent|allow|deny|block|skip)s?\b/i;
const GIVEN_WHEN_THEN = /\b(?:given|when|then)\b/i;

export function validateAcceptance(acceptance: string | null | undefined): AcceptanceValidationResult {
  if (acceptance === null || acceptance === undefined) {
    return { valid: true, warnings: [] };
  }

  const trimmed = acceptance.trim();
  if (trimmed.length === 0) {
    return { valid: false, warnings: ['AC가 비어있습니다. acceptance criteria를 작성해주세요.'] };
  }

  // Parse items: split by lines starting with -, *, or numbered (1., 2., etc.)
  const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items: string[] = [];
  let currentItem = '';

  for (const line of lines) {
    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      if (currentItem) items.push(currentItem);
      currentItem = line.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '');
    } else if (items.length === 0 && !currentItem) {
      // First line without list marker - treat as single item
      currentItem = line;
    } else {
      // Continuation of previous item
      currentItem += ' ' + line;
    }
  }
  if (currentItem) items.push(currentItem);

  // If no list markers found, treat each line as an item
  if (items.length === 0) {
    items.push(trimmed);
  }

  const warnings: string[] = [];

  if (items.length === 1) {
    warnings.push('AC 항목이 1개뿐입니다. 다양한 시나리오를 커버하는 여러 항목을 작성하세요.');
  }

  // Check each item for verifiability
  const unverifiable: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const hasKoVerb = ACTION_VERBS_KO.test(item);
    const hasEnVerb = ACTION_VERBS_EN.test(item);
    const hasGWT = GIVEN_WHEN_THEN.test(item);

    if (!hasKoVerb && !hasEnVerb && !hasGWT) {
      unverifiable.push(i + 1);
    }
  }

  if (unverifiable.length > 0) {
    const itemNums = unverifiable.join(', ');
    warnings.push(
      `AC #${itemNums}번 항목에 검증 가능한 동사가 없습니다. ` +
      `"~한다/~된다" 또는 "should/must" 형태로 기대 동작을 명시하세요.`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export type TaskWithWarnings = Task & { warnings: string[] };

export class TaskModel extends BaseRepository<Task> {
  private events?: EventModel;

  constructor(db: Database.Database, events?: EventModel) {
    super(db, 'tasks');
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
      dependsOn?: string[];
      allowedFiles?: string[];
      forbiddenPatterns?: string[];
    },
  ): TaskWithWarnings {
    const { warnings } = validateAcceptance(opts?.acceptance);
    const id = generateId();
    let depth = 0;

    if (opts?.parentId) {
      const parent = this.getById(opts.parentId);
      if (!parent) {
        throw new Error(`Parent task not found: ${opts.parentId}`);
      }
      depth = parent.depth + 1;
    }

    const sortOrder = opts?.sortOrder ?? 0;
    const dependsOn = opts?.dependsOn && opts.dependsOn.length > 0
      ? JSON.stringify(opts.dependsOn)
      : null;
    const allowedFiles = opts?.allowedFiles && opts.allowedFiles.length > 0
      ? JSON.stringify(opts.allowedFiles)
      : null;
    const forbiddenPatterns = opts?.forbiddenPatterns && opts.forbiddenPatterns.length > 0
      ? JSON.stringify(opts.forbiddenPatterns)
      : null;

    if (opts?.dependsOn && opts.dependsOn.length > 0) {
      this.validateDependencies(planId, id, opts.dependsOn);
    }

    this.db
      .prepare(
        `INSERT INTO tasks (id, plan_id, parent_id, title, status, depth, sort_order, spec, acceptance, depends_on, allowed_files, forbidden_patterns)
         VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?)`,
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
        dependsOn,
        allowedFiles,
        forbiddenPatterns,
      );

    const task = this.getById(id)!;
    this.events?.record('task', task.id, 'created', null, JSON.stringify({ title, status: 'todo' }));
    return Object.assign(task, { warnings });
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

  private buildTaskMap(tasks: Task[]): Map<string, Task> {
    const map = new Map<string, Task>();
    for (const t of tasks) {
      map.set(t.id, t);
    }
    return map;
  }

  private parseDeps(task: Task): string[] {
    if (!task.depends_on) return [];
    return JSON.parse(task.depends_on);
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
    fields: TaskUpdateInput,
  ): TaskWithWarnings {
    const { warnings } = fields.acceptance !== undefined
      ? validateAcceptance(fields.acceptance)
      : { warnings: [] as string[] };
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
    if (fields.depends_on !== undefined) {
      if (fields.depends_on !== null) {
        const depIds: string[] = JSON.parse(fields.depends_on);
        if (depIds.length > 0) {
          const task = this.getById(id);
          if (task) {
            this.validateDependencies(task.plan_id, id, depIds);
          }
        }
      }
      setClauses.push('depends_on = ?');
      values.push(fields.depends_on);
    }
    if (fields.allowed_files !== undefined) {
      setClauses.push('allowed_files = ?');
      values.push(fields.allowed_files);
    }
    if (fields.forbidden_patterns !== undefined) {
      setClauses.push('forbidden_patterns = ?');
      values.push(fields.forbidden_patterns);
    }

    if (setClauses.length === 0) {
      return Object.assign(this.getById(id)!, { warnings });
    }

    values.push(id);
    return withTransaction(this.db, () => {
      this.db
        .prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`)
        .run(...values);

      const oldTask = this.getById(id);
      this.events?.record('task', id, 'updated', null, JSON.stringify(fields));
      return Object.assign(oldTask!, { warnings });
    });
  }

  updateStatus(id: string, status: TaskStatus, opts?: { force?: boolean }): Task {
    const oldTask = this.getById(id);
    if (!oldTask) throw new Error(`Task not found: ${id}`);
    if (oldTask.status === status) return oldTask;
    validateTransition(TASK_TRANSITIONS, oldTask.status, status, opts);
    const oldStatus = oldTask.status;
    const completedAt = status === 'done' ? new Date().toISOString() : null;

    return withTransaction(this.db, () => {
      this.db
        .prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
        .run(status, completedAt, id);

      this.events?.record('task', id, 'status_changed', JSON.stringify({ status: oldStatus }), JSON.stringify({ status }));
      return this.getById(id)!;
    });
  }

  delete(id: string): void {
    const task = this.getById(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    withTransaction(this.db, () => {
      this.db.prepare('DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE parent_id = ?)').run(id);
      this.db.prepare('DELETE FROM tasks WHERE parent_id = ?').run(id);
      this.db.prepare('DELETE FROM events WHERE entity_id = ?').run(id);
      this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      this.events?.record('task', id, 'deleted', JSON.stringify({ title: task.title }), null);
    });
  }

  validateDependencies(planId: string, taskId: string, dependsOn: string[]): void {
    if (!dependsOn || dependsOn.length === 0) {
      return;
    }

    // Batch load all tasks in the plan to avoid N+1 queries
    const allTasks = this.getByPlan(planId);
    const taskMap = this.buildTaskMap(allTasks);

    for (const depId of dependsOn) {
      if (depId === taskId) {
        throw new Error(`Task cannot depend on itself: ${depId}`);
      }

      const depTask = taskMap.get(depId);
      if (!depTask) {
        // Check if it exists in a different plan
        const crossPlanTask = this.getById(depId);
        if (crossPlanTask && crossPlanTask.plan_id !== planId) {
          throw new Error(
            `Dependency task ${depId} belongs to different plan: ${crossPlanTask.plan_id}`,
          );
        }
        throw new Error(`Dependency task not found: ${depId}`);
      }
    }

    // Circular dependency check (DFS) using in-memory taskMap
    const visited = new Set<string>();

    const hasCycle = (currentId: string): boolean => {
      if (currentId === taskId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      const current = taskMap.get(currentId);
      if (!current) return false;
      const deps = this.parseDeps(current);
      return deps.some(dep => hasCycle(dep));
    };

    for (const depId of dependsOn) {
      visited.clear();
      if (hasCycle(depId)) {
        throw new Error('Circular dependency detected');
      }
    }
  }

  getWaves(planId: string): Wave[] {
    const tasks = this.getByPlan(planId);
    if (tasks.length === 0) return [];

    const taskMap = this.buildTaskMap(tasks);
    const poisoned = this.findPoisonedTasks(tasks, taskMap);

    // Exclude tasks that depend on blocked/skipped, but keep blocked/skipped tasks themselves
    const includedTasks = tasks.filter(
      t => !poisoned.has(t.id) || t.status === 'blocked' || t.status === 'skipped',
    );

    // Assign wave index: max(wave of deps) + 1, or 0 if no deps
    const waveIndex = new Map<string, number>();
    const includedSet = new Set(includedTasks.map(t => t.id));

    const computeWave = (id: string, visited: Set<string>): number => {
      if (waveIndex.has(id)) return waveIndex.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);

      const task = taskMap.get(id)!;
      const deps = this.parseDeps(task).filter(d => includedSet.has(d));
      if (deps.length === 0) {
        waveIndex.set(id, 0);
        return 0;
      }

      const wave = Math.max(...deps.map(d => computeWave(d, visited))) + 1;
      waveIndex.set(id, wave);
      return wave;
    };

    for (const t of includedTasks) {
      computeWave(t.id, new Set());
    }

    // Group by wave, sort tasks within each wave by sort_order
    const waveMap = new Map<number, Task[]>();
    for (const t of includedTasks) {
      const idx = waveIndex.get(t.id) ?? 0;
      if (!waveMap.has(idx)) waveMap.set(idx, []);
      waveMap.get(idx)!.push(t);
    }

    return Array.from(waveMap.keys())
      .sort((a, b) => a - b)
      .map(idx => ({
        index: idx,
        task_ids: waveMap.get(idx)!
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(t => t.id),
      }));
  }

  getNextAvailable(planId: string): Task | null {
    const tasks = this.getByPlan(planId);
    if (tasks.length === 0) return null;

    const taskMap = this.buildTaskMap(tasks);

    const todoTasks = tasks
      .filter(t => t.status === 'todo')
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const task of todoTasks) {
      const deps = this.parseDeps(task);
      if (deps.length === 0) return task;

      const allDone = deps.every(id => taskMap.get(id)?.status === 'done');
      const anyPoisoned = deps.some(id => {
        const s = taskMap.get(id)?.status;
        return s === 'blocked' || s === 'skipped';
      });

      if (allDone && !anyPoisoned) return task;
    }

    return null;
  }

  private findPoisonedTasks(tasks: Task[], taskMap: Map<string, Task>): Set<string> {
    const poisoned = new Set<string>();

    const check = (id: string, visited: Set<string>): boolean => {
      if (poisoned.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);

      const task = taskMap.get(id);
      if (!task) return false;
      if (task.status === 'blocked' || task.status === 'skipped') {
        poisoned.add(id);
        return true;
      }

      for (const dep of this.parseDeps(task)) {
        if (check(dep, visited)) {
          poisoned.add(id);
          return true;
        }
      }
      return false;
    };

    for (const t of tasks) {
      if (t.depends_on) check(t.id, new Set());
    }

    return poisoned;
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
