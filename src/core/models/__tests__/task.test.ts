import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { TaskModel, validateAcceptance } from '../task.js';
import { EventModel } from '../event.js';
import { InvalidTransitionError } from '../../utils.js';
import type { EntityType, EventType } from '../../types.js';
import type Database from 'better-sqlite3';

describe('TaskModel', () => {
  let db: Database.Database;
  let taskModel: TaskModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
    taskModel = new TaskModel(db);
  });

  describe('create', () => {
    it('should create a root task with depth 0', () => {
      const task = taskModel.create('test-plan', 'Root Task');

      expect(task.id).toHaveLength(12);
      expect(task.plan_id).toBe('test-plan');
      expect(task.parent_id).toBeNull();
      expect(task.title).toBe('Root Task');
      expect(task.status).toBe('todo');
      expect(task.depth).toBe(0);
      expect(task.sort_order).toBe(0);
    });

    it('should create a child task with depth = parent.depth + 1', () => {
      const root = taskModel.create('test-plan', 'Root Task');
      const child = taskModel.create('test-plan', 'Child Task', {
        parentId: root.id,
      });

      expect(child.parent_id).toBe(root.id);
      expect(child.depth).toBe(1);
    });

    it('should create a grandchild task with depth 2', () => {
      const root = taskModel.create('test-plan', 'Root');
      const child = taskModel.create('test-plan', 'Child', {
        parentId: root.id,
      });
      const grandchild = taskModel.create('test-plan', 'Grandchild', {
        parentId: child.id,
      });

      expect(grandchild.depth).toBe(2);
    });

    it('should accept optional spec, acceptance, and sortOrder', () => {
      const task = taskModel.create('test-plan', 'Task', {
        spec: 'Some spec',
        acceptance: 'Acceptance criteria',
        sortOrder: 5,
      });

      expect(task.spec).toBe('Some spec');
      expect(task.acceptance).toBe('Acceptance criteria');
      expect(task.sort_order).toBe(5);
    });

    it('should throw when parent task does not exist', () => {
      expect(() =>
        taskModel.create('test-plan', 'Orphan', { parentId: 'nonexistent' }),
      ).toThrow('Parent task not found');
    });

    it('should store allowed_files as JSON string', () => {
      const task = taskModel.create('test-plan', 'Scoped Task', {
        allowedFiles: ['src/a.ts', 'src/b.ts'],
      });

      expect(task.allowed_files).toBe(JSON.stringify(['src/a.ts', 'src/b.ts']));
    });

    it('should store forbidden_patterns as JSON string', () => {
      const task = taskModel.create('test-plan', 'Scoped Task', {
        forbiddenPatterns: ['src/core/db/**', 'agents/*'],
      });

      expect(task.forbidden_patterns).toBe(JSON.stringify(['src/core/db/**', 'agents/*']));
    });

    it('should store null for allowed_files when not provided', () => {
      const task = taskModel.create('test-plan', 'No Scope');

      expect(task.allowed_files).toBeNull();
    });

    it('should store null for forbidden_patterns when not provided', () => {
      const task = taskModel.create('test-plan', 'No Scope');

      expect(task.forbidden_patterns).toBeNull();
    });

    it('should store dependsOn array as JSON string', () => {
      const t1 = taskModel.create('test-plan', 'Task 1');
      const t2 = taskModel.create('test-plan', 'Task 2');
      const t3 = taskModel.create('test-plan', 'Dependent Task', {
        dependsOn: [t1.id, t2.id],
      });

      expect(t3.depends_on).toBe(JSON.stringify([t1.id, t2.id]));
    });

    it('should store null when dependsOn is not provided', () => {
      const task = taskModel.create('test-plan', 'No Deps');

      expect(task.depends_on).toBeNull();
    });

    it('should store null when dependsOn is empty array', () => {
      const task = taskModel.create('test-plan', 'Empty Deps', {
        dependsOn: [],
      });

      expect(task.depends_on).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return the task by id', () => {
      const created = taskModel.create('test-plan', 'My Task');
      const fetched = taskModel.getById(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe('My Task');
    });

    it('should return null for non-existent id', () => {
      expect(taskModel.getById('nonexistent')).toBeNull();
    });

    it('should return depends_on field', () => {
      const t1 = taskModel.create('test-plan', 'Dep Task');
      const task = taskModel.create('test-plan', 'Main Task', {
        dependsOn: [t1.id],
      });
      const fetched = taskModel.getById(task.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.depends_on).toBe(JSON.stringify([t1.id]));
    });
  });

  describe('getTree', () => {
    it('should return nested tree structure', () => {
      const root1 = taskModel.create('test-plan', 'Root 1', { sortOrder: 0 });
      const root2 = taskModel.create('test-plan', 'Root 2', { sortOrder: 1 });
      const child1 = taskModel.create('test-plan', 'Child 1-1', {
        parentId: root1.id,
        sortOrder: 0,
      });
      taskModel.create('test-plan', 'Child 1-2', {
        parentId: root1.id,
        sortOrder: 1,
      });
      taskModel.create('test-plan', 'Grandchild 1-1-1', {
        parentId: child1.id,
      });

      const tree = taskModel.getTree('test-plan');

      expect(tree).toHaveLength(2);
      expect(tree[0].title).toBe('Root 1');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].title).toBe('Child 1-1');
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].title).toBe('Grandchild 1-1-1');
      expect(tree[0].children[1].title).toBe('Child 1-2');
      expect(tree[1].title).toBe('Root 2');
      expect(tree[1].children).toHaveLength(0);
    });

    it('should return empty array for plan with no tasks', () => {
      const tree = taskModel.getTree('test-plan');
      expect(tree).toEqual([]);
    });
  });

  describe('getChildren', () => {
    it('should return only direct children', () => {
      const root = taskModel.create('test-plan', 'Root');
      const child1 = taskModel.create('test-plan', 'Child 1', {
        parentId: root.id,
        sortOrder: 0,
      });
      taskModel.create('test-plan', 'Child 2', {
        parentId: root.id,
        sortOrder: 1,
      });
      taskModel.create('test-plan', 'Grandchild', {
        parentId: child1.id,
      });

      const children = taskModel.getChildren(root.id);

      expect(children).toHaveLength(2);
      expect(children[0].title).toBe('Child 1');
      expect(children[1].title).toBe('Child 2');
    });

    it('should return empty array when no children exist', () => {
      const root = taskModel.create('test-plan', 'Root');
      expect(taskModel.getChildren(root.id)).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update specified fields', () => {
      const task = taskModel.create('test-plan', 'Original');
      const updated = taskModel.update(task.id, {
        title: 'Updated',
        spec: 'New spec',
        sort_order: 10,
      });

      expect(updated.title).toBe('Updated');
      expect(updated.spec).toBe('New spec');
      expect(updated.sort_order).toBe(10);
    });

    it('should not change unspecified fields', () => {
      const task = taskModel.create('test-plan', 'Original', {
        spec: 'Keep this',
      });
      const updated = taskModel.update(task.id, { title: 'New Title' });

      expect(updated.title).toBe('New Title');
      expect(updated.spec).toBe('Keep this');
    });

    it('should update depends_on field', () => {
      const t1 = taskModel.create('test-plan', 'Task 1');
      const task = taskModel.create('test-plan', 'Task 2');
      const updated = taskModel.update(task.id, {
        depends_on: JSON.stringify([t1.id]),
      });

      expect(updated.depends_on).toBe(JSON.stringify([t1.id]));
    });
  });

  describe('updateStatus', () => {
    it('should set completed_at when status is done', () => {
      const task = taskModel.create('test-plan', 'Task');
      taskModel.updateStatus(task.id, 'in_progress');
      const updated = taskModel.updateStatus(task.id, 'done');

      expect(updated.status).toBe('done');
      expect(updated.completed_at).not.toBeNull();
    });

    it('should clear completed_at when transitioning back to todo via blocked recovery', () => {
      const task = taskModel.create('test-plan', 'Task');
      taskModel.updateStatus(task.id, 'in_progress');
      taskModel.updateStatus(task.id, 'blocked');
      const updated = taskModel.updateStatus(task.id, 'todo');

      expect(updated.status).toBe('todo');
      expect(updated.completed_at).toBeNull();
    });
  });

  describe('getByPlan', () => {
    it('should return all tasks for a plan', () => {
      taskModel.create('test-plan', 'Task 1');
      taskModel.create('test-plan', 'Task 2');
      taskModel.create('test-plan', 'Task 3');

      const tasks = taskModel.getByPlan('test-plan');
      expect(tasks).toHaveLength(3);
    });

    it('should filter by status', () => {
      const t1 = taskModel.create('test-plan', 'Task 1');
      taskModel.create('test-plan', 'Task 2');
      taskModel.create('test-plan', 'Task 3');
      taskModel.updateStatus(t1.id, 'in_progress');
      taskModel.updateStatus(t1.id, 'done');

      const doneTasks = taskModel.getByPlan('test-plan', { status: 'done' });
      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0].title).toBe('Task 1');

      const todoTasks = taskModel.getByPlan('test-plan', { status: 'todo' });
      expect(todoTasks).toHaveLength(2);
    });
  });

  describe('validateDependencies', () => {
    it('should throw when referencing a non-existent taskId', () => {
      const task = taskModel.create('test-plan', 'Task A');

      expect(() =>
        taskModel.validateDependencies('test-plan', task.id, ['nonexistent-id']),
      ).toThrow('Dependency task not found');
    });

    it('should throw when referencing a taskId from a different plan', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
        'other-plan',
        'Other Plan',
        'active',
      );
      const otherTask = taskModel.create('other-plan', 'Other Task');
      const task = taskModel.create('test-plan', 'Task A');

      expect(() =>
        taskModel.validateDependencies('test-plan', task.id, [otherTask.id]),
      ).toThrow('belongs to different plan');
    });

    it('should throw when referencing self', () => {
      const task = taskModel.create('test-plan', 'Task A');

      expect(() =>
        taskModel.validateDependencies('test-plan', task.id, [task.id]),
      ).toThrow();
    });

    it('should throw on circular dependency A->B->C->A', () => {
      const taskA = taskModel.create('test-plan', 'Task A');
      const taskB = taskModel.create('test-plan', 'Task B', {
        dependsOn: [taskA.id],
      });
      const taskC = taskModel.create('test-plan', 'Task C', {
        dependsOn: [taskB.id],
      });

      // Now trying to make A depend on C would create A->C->B->A cycle
      expect(() =>
        taskModel.validateDependencies('test-plan', taskA.id, [taskC.id]),
      ).toThrow('Circular dependency detected');
    });

    it('should skip validation for empty array', () => {
      const task = taskModel.create('test-plan', 'Task A');

      expect(() =>
        taskModel.validateDependencies('test-plan', task.id, []),
      ).not.toThrow();
    });

    it('should allow valid dependencies', () => {
      const t1 = taskModel.create('test-plan', 'Task 1');
      const t2 = taskModel.create('test-plan', 'Task 2');
      const t3 = taskModel.create('test-plan', 'Task 3');

      expect(() =>
        taskModel.validateDependencies('test-plan', t3.id, [t1.id, t2.id]),
      ).not.toThrow();
    });
  });

  describe('create with dependency validation', () => {
    it('should throw when creating a task with invalid dependency', () => {
      expect(() =>
        taskModel.create('test-plan', 'Bad Task', {
          dependsOn: ['nonexistent-id'],
        }),
      ).toThrow('Dependency task not found');
    });

    it('should successfully create a task with valid dependencies', () => {
      const t1 = taskModel.create('test-plan', 'Task 1');
      const t2 = taskModel.create('test-plan', 'Task 2', {
        dependsOn: [t1.id],
      });

      expect(t2.depends_on).toBe(JSON.stringify([t1.id]));
    });
  });

  describe('update with dependency validation', () => {
    it('should throw when updating with invalid dependency', () => {
      const task = taskModel.create('test-plan', 'Task');

      expect(() =>
        taskModel.update(task.id, {
          depends_on: JSON.stringify(['nonexistent-id']),
        }),
      ).toThrow('Dependency task not found');
    });

    it('should throw when updating creates circular dependency', () => {
      const taskA = taskModel.create('test-plan', 'Task A');
      const taskB = taskModel.create('test-plan', 'Task B', {
        dependsOn: [taskA.id],
      });

      expect(() =>
        taskModel.update(taskA.id, {
          depends_on: JSON.stringify([taskB.id]),
        }),
      ).toThrow('Circular dependency detected');
    });

    it('should allow valid dependency update', () => {
      const t1 = taskModel.create('test-plan', 'Task 1');
      const t2 = taskModel.create('test-plan', 'Task 2');

      const updated = taskModel.update(t2.id, {
        depends_on: JSON.stringify([t1.id]),
      });

      expect(updated.depends_on).toBe(JSON.stringify([t1.id]));
    });
  });

  describe('update with scope fields', () => {
    it('should update allowed_files field', () => {
      const task = taskModel.create('test-plan', 'Task');
      const updated = taskModel.update(task.id, {
        allowed_files: JSON.stringify(['src/a.ts']),
      });

      expect(updated.allowed_files).toBe(JSON.stringify(['src/a.ts']));
    });

    it('should update forbidden_patterns field', () => {
      const task = taskModel.create('test-plan', 'Task');
      const updated = taskModel.update(task.id, {
        forbidden_patterns: JSON.stringify(['agents/*']),
      });

      expect(updated.forbidden_patterns).toBe(JSON.stringify(['agents/*']));
    });

    it('should not change scope fields when not specified in update', () => {
      const task = taskModel.create('test-plan', 'Scoped', {
        allowedFiles: ['src/a.ts'],
        forbiddenPatterns: ['agents/*'],
      });
      const updated = taskModel.update(task.id, { title: 'New Title' });

      expect(updated.allowed_files).toBe(JSON.stringify(['src/a.ts']));
      expect(updated.forbidden_patterns).toBe(JSON.stringify(['agents/*']));
    });
  });
});

describe('getWaves', () => {
  let db: Database.Database;
  let taskModel: TaskModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
    taskModel = new TaskModel(db);
  });

  it('should place all independent tasks in Wave 0', () => {
    const t1 = taskModel.create('test-plan', 'Task 1', { sortOrder: 0 });
    const t2 = taskModel.create('test-plan', 'Task 2', { sortOrder: 1 });
    const t3 = taskModel.create('test-plan', 'Task 3', { sortOrder: 2 });

    const waves = taskModel.getWaves('test-plan');

    expect(waves).toHaveLength(1);
    expect(waves[0].index).toBe(0);
    expect(waves[0].task_ids).toContain(t1.id);
    expect(waves[0].task_ids).toContain(t2.id);
    expect(waves[0].task_ids).toContain(t3.id);
  });

  it('should assign linear dependencies to sequential waves A->B->C', () => {
    const tA = taskModel.create('test-plan', 'A', { sortOrder: 0 });
    const tB = taskModel.create('test-plan', 'B', { sortOrder: 1, dependsOn: [tA.id] });
    const tC = taskModel.create('test-plan', 'C', { sortOrder: 2, dependsOn: [tB.id] });

    const waves = taskModel.getWaves('test-plan');

    expect(waves).toHaveLength(3);
    expect(waves[0]).toEqual({ index: 0, task_ids: [tA.id] });
    expect(waves[1]).toEqual({ index: 1, task_ids: [tB.id] });
    expect(waves[2]).toEqual({ index: 2, task_ids: [tC.id] });
  });

  it('should group tasks with common dependencies in the same wave', () => {
    const tA = taskModel.create('test-plan', 'A', { sortOrder: 0 });
    const tB = taskModel.create('test-plan', 'B', { sortOrder: 1 });
    const tC = taskModel.create('test-plan', 'C', { sortOrder: 2, dependsOn: [tA.id, tB.id] });

    const waves = taskModel.getWaves('test-plan');

    expect(waves).toHaveLength(2);
    expect(waves[0].index).toBe(0);
    expect(waves[0].task_ids).toContain(tA.id);
    expect(waves[0].task_ids).toContain(tB.id);
    expect(waves[1]).toEqual({ index: 1, task_ids: [tC.id] });
  });

  it('should skip tasks that depend on blocked/skipped tasks', () => {
    const tA = taskModel.create('test-plan', 'A', { sortOrder: 0 });
    taskModel.updateStatus(tA.id, 'blocked');
    const tB = taskModel.create('test-plan', 'B', { sortOrder: 1, dependsOn: [tA.id] });

    const waves = taskModel.getWaves('test-plan');

    // tA is in wave 0, tB should be excluded (depends on blocked)
    expect(waves).toHaveLength(1);
    expect(waves[0].task_ids).toContain(tA.id);
    expect(waves[0].task_ids).not.toContain(tB.id);
  });

  it('should return empty array for plan with no tasks', () => {
    const waves = taskModel.getWaves('test-plan');
    expect(waves).toEqual([]);
  });

  it('should order task_ids by sort_order within a wave', () => {
    const t1 = taskModel.create('test-plan', 'Task 1', { sortOrder: 2 });
    const t2 = taskModel.create('test-plan', 'Task 2', { sortOrder: 0 });
    const t3 = taskModel.create('test-plan', 'Task 3', { sortOrder: 1 });

    const waves = taskModel.getWaves('test-plan');

    expect(waves[0].task_ids).toEqual([t2.id, t3.id, t1.id]);
  });
});

describe('getNextAvailable', () => {
  let db: Database.Database;
  let taskModel: TaskModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
    taskModel = new TaskModel(db);
  });

  it('should return task when all dependencies are done', () => {
    const tA = taskModel.create('test-plan', 'A', { sortOrder: 0 });
    const tB = taskModel.create('test-plan', 'B', { sortOrder: 1, dependsOn: [tA.id] });
    taskModel.updateStatus(tA.id, 'in_progress');
    taskModel.updateStatus(tA.id, 'done');

    const next = taskModel.getNextAvailable('test-plan');

    expect(next).not.toBeNull();
    expect(next!.id).toBe(tB.id);
  });

  it('should return null when dependency is in_progress', () => {
    const tA = taskModel.create('test-plan', 'A', { sortOrder: 0 });
    taskModel.create('test-plan', 'B', { sortOrder: 1, dependsOn: [tA.id] });
    taskModel.updateStatus(tA.id, 'in_progress');

    const next = taskModel.getNextAvailable('test-plan');

    // A is in_progress so not available (not todo), B depends on A which is not done
    expect(next).toBeNull();
  });

  it('should skip tasks that depend on blocked tasks', () => {
    const tA = taskModel.create('test-plan', 'A', { sortOrder: 0 });
    taskModel.create('test-plan', 'B', { sortOrder: 1, dependsOn: [tA.id] });
    taskModel.updateStatus(tA.id, 'blocked');

    const next = taskModel.getNextAvailable('test-plan');

    // A is blocked (not todo), B depends on blocked A -> skip
    expect(next).toBeNull();
  });

  it('should return first todo task with no dependencies based on sort_order', () => {
    const t1 = taskModel.create('test-plan', 'Task 1', { sortOrder: 2 });
    const t2 = taskModel.create('test-plan', 'Task 2', { sortOrder: 0 });
    const t3 = taskModel.create('test-plan', 'Task 3', { sortOrder: 1 });

    const next = taskModel.getNextAvailable('test-plan');

    expect(next).not.toBeNull();
    expect(next!.id).toBe(t2.id);
  });

  it('should return null when no tasks exist', () => {
    const next = taskModel.getNextAvailable('test-plan');
    expect(next).toBeNull();
  });

  it('should return null when all tasks are done', () => {
    const t1 = taskModel.create('test-plan', 'Task 1');
    taskModel.updateStatus(t1.id, 'in_progress');
    taskModel.updateStatus(t1.id, 'done');

    const next = taskModel.getNextAvailable('test-plan');
    expect(next).toBeNull();
  });

  it('should skip tasks that depend on skipped tasks', () => {
    const tA = taskModel.create('test-plan', 'A', { sortOrder: 0 });
    taskModel.create('test-plan', 'B', { sortOrder: 1, dependsOn: [tA.id] });
    taskModel.updateStatus(tA.id, 'skipped');

    const next = taskModel.getNextAvailable('test-plan');
    expect(next).toBeNull();
  });
});

describe('TaskModel with EventModel', () => {
  let db: Database.Database;
  let taskModel: TaskModel;
  let events: EventModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    events = new EventModel(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
    taskModel = new TaskModel(db, events);
  });

  it('should record a created event on task.create()', () => {
    const task = taskModel.create('test-plan', 'New Task');
    const recorded = events.getByEntity('task', task.id);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].event_type).toBe('created');
    expect(recorded[0].old_value).toBeNull();
    expect(JSON.parse(recorded[0].new_value!)).toEqual({ title: 'New Task', status: 'todo' });
  });

  it('should record a status_changed event on task.updateStatus()', () => {
    const task = taskModel.create('test-plan', 'Status Task');
    taskModel.updateStatus(task.id, 'in_progress');
    taskModel.updateStatus(task.id, 'done');
    const recorded = events.getByEntity('task', task.id);

    expect(recorded).toHaveLength(3);
    const statusEvent = recorded[2];
    expect(statusEvent.event_type).toBe('status_changed');
    expect(statusEvent.old_value).toBe('{"status":"in_progress"}');
    expect(statusEvent.new_value).toBe('{"status":"done"}');
  });
});

describe('Task transaction rollback', () => {
  let db: Database.Database;
  let taskModel: TaskModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
  });

  it('AC05: updateStatus should rollback DB change when event recording throws', () => {
    // Arrange: create task with a normal model first
    const normalModel = new TaskModel(db);
    const task = normalModel.create('test-plan', 'Rollback Task');

    // Now create a model with faulty events
    const faultyEvents = {
      record: () => { throw new Error('Event recording failed'); },
      getByEntity: () => [],
    } as unknown as EventModel;
    taskModel = new TaskModel(db, faultyEvents);

    // Act: attempt status change that will fail during event recording
    expect(() => taskModel.updateStatus(task.id, 'in_progress')).toThrow('Event recording failed');

    // Assert: status should NOT have changed (rollback)
    const afterTask = taskModel.getById(task.id);
    expect(afterTask!.status).toBe('todo');
  });

  it('AC01: delete() wraps all operations in a transaction', () => {
    // Arrange: create task with events, then use faulty events
    const realEvents = new EventModel(db);
    taskModel = new TaskModel(db, realEvents);
    const task = taskModel.create('test-plan', 'Delete Task');
    const child = taskModel.create('test-plan', 'Child Task', { parentId: task.id });

    // Replace with faulty events that throw on 'deleted' event
    const faultyEvents = {
      record: (_a: EntityType, _b: string, eventType: EventType) => {
        if (eventType === 'deleted') throw new Error('Delete event failed');
        return realEvents.record(_a, _b, eventType, null, null);
      },
      getByEntity: (t: EntityType, id: string) => realEvents.getByEntity(t, id),
    } as unknown as EventModel;
    taskModel = new TaskModel(db, faultyEvents);

    // Act: attempt delete that will fail during event recording
    expect(() => taskModel.delete(task.id)).toThrow('Delete event failed');

    // Assert: task and child should still exist (rollback)
    expect(taskModel.getById(task.id)).not.toBeNull();
    expect(taskModel.getById(child.id)).not.toBeNull();
  });

  it('AC02: updateStatus() wraps UPDATE + event in a transaction', () => {
    const realEvents = new EventModel(db);
    taskModel = new TaskModel(db, realEvents);
    const task = taskModel.create('test-plan', 'Status Task');

    // Replace with faulty events
    const faultyEvents = {
      record: (_a: EntityType, _b: string, eventType: EventType) => {
        if (eventType === 'status_changed') throw new Error('Status event failed');
        return realEvents.record(_a, _b, eventType, null, null);
      },
      getByEntity: (t: EntityType, id: string) => realEvents.getByEntity(t, id),
    } as unknown as EventModel;
    taskModel = new TaskModel(db, faultyEvents);

    expect(() => taskModel.updateStatus(task.id, 'in_progress')).toThrow('Status event failed');
    expect(taskModel.getById(task.id)!.status).toBe('todo');
  });

  it('AC03: update() wraps UPDATE + event in a transaction', () => {
    const realEvents = new EventModel(db);
    taskModel = new TaskModel(db, realEvents);
    const task = taskModel.create('test-plan', 'Update Task');

    // Replace with faulty events that throw on any record after creation
    let callCount = 0;
    const faultyEvents = {
      record: () => {
        callCount++;
        throw new Error('Update event failed');
      },
      getByEntity: (t: EntityType, id: string) => realEvents.getByEntity(t, id),
    } as unknown as EventModel;
    taskModel = new TaskModel(db, faultyEvents);

    expect(() => taskModel.update(task.id, { title: 'New Title' })).toThrow('Update event failed');
    expect(taskModel.getById(task.id)!.title).toBe('Update Task');
  });
});

describe('TaskModel AC validation integration', () => {
  let db: Database.Database;
  let taskModel: TaskModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
    taskModel = new TaskModel(db);
  });

  it('should include warnings in create() result for vague acceptance', () => {
    const result = taskModel.create('test-plan', 'Task', {
      acceptance: '기능 구현',
    });
    expect(result.warnings).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    // Task properties still accessible
    expect(result.id).toHaveLength(12);
    expect(result.title).toBe('Task');
  });

  it('should return empty warnings for valid acceptance', () => {
    const result = taskModel.create('test-plan', 'Task', {
      acceptance: '- 정상 입력 시 데이터를 반환한다\n- 에러 시 예외를 발생한다',
    });
    expect(result.warnings).toEqual([]);
  });

  it('should return empty warnings when no acceptance provided', () => {
    const result = taskModel.create('test-plan', 'Task');
    expect(result.warnings).toEqual([]);
  });

  it('should include warnings in update() result when acceptance is changed', () => {
    const task = taskModel.create('test-plan', 'Task');
    const updated = taskModel.update(task.id, {
      acceptance: '모호한 내용',
    });
    expect(updated.warnings.length).toBeGreaterThan(0);
  });

  it('should return empty warnings in update() when acceptance not changed', () => {
    const task = taskModel.create('test-plan', 'Task');
    const updated = taskModel.update(task.id, { title: 'New Title' });
    expect(updated.warnings).toEqual([]);
  });
});

describe('validateAcceptance', () => {
  it('should return valid with no warnings for null input', () => {
    const result = validateAcceptance(null);
    expect(result).toEqual({ valid: true, warnings: [] });
  });

  it('should return valid with no warnings for undefined input', () => {
    const result = validateAcceptance(undefined);
    expect(result).toEqual({ valid: true, warnings: [] });
  });

  it('should return invalid for empty string', () => {
    const result = validateAcceptance('');
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('비어있습니다');
  });

  it('should return invalid for whitespace-only string', () => {
    const result = validateAcceptance('   \n  ');
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('비어있습니다');
  });

  it('should warn when only one AC item exists', () => {
    const result = validateAcceptance('- 데이터를 반환한다');
    expect(result.warnings.some(w => w.includes('1개뿐'))).toBe(true);
  });

  it('should warn when items lack action verbs', () => {
    const result = validateAcceptance('- 첫번째 항목\n- 두번째 항목');
    expect(result.warnings.some(w => w.includes('검증 가능한 동사가 없습니다'))).toBe(true);
  });

  it('should pass for well-formed Korean AC with action verbs', () => {
    const ac = `- 빈 입력 시 에러를 반환한다
- 정상 입력 시 데이터가 저장된다
- 중복 키 입력 시 경고를 표시한다`;
    const result = validateAcceptance(ac);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should pass for Given-When-Then format', () => {
    const ac = `- Given a valid user, When login is called, Then a token should be returned
- Given an invalid password, When login is called, Then an error should be thrown`;
    const result = validateAcceptance(ac);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should pass for English AC with action verbs', () => {
    const ac = `- The function should return an error for empty input
- The API must handle concurrent requests`;
    const result = validateAcceptance(ac);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should handle numbered list format', () => {
    const ac = `1. 데이터를 정상적으로 저장한다
2. 에러 발생 시 롤백 처리한다`;
    const result = validateAcceptance(ac);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should identify specific unverifiable items by number', () => {
    const ac = `- 첫번째 기능
- 정상 입력 시 데이터를 반환한다
- 세번째 기능`;
    const result = validateAcceptance(ac);
    expect(result.warnings.some(w => w.includes('1') && w.includes('3') && w.includes('검증 가능한 동사'))).toBe(true);
  });
});

describe('Task transition guards', () => {
  let db: Database.Database;
  let taskModel: TaskModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
    taskModel = new TaskModel(db);
  });

  // --- Invalid transitions ---

  it('AC01: done -> todo should throw InvalidTransitionError', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'in_progress');
    taskModel.updateStatus(task.id, 'done');
    expect(() => taskModel.updateStatus(task.id, 'todo')).toThrow(InvalidTransitionError);
    expect(() => taskModel.updateStatus(task.id, 'todo')).toThrow('Invalid transition: done → todo');
  });

  it('AC01: done -> in_progress should throw InvalidTransitionError', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'in_progress');
    taskModel.updateStatus(task.id, 'done');
    expect(() => taskModel.updateStatus(task.id, 'in_progress')).toThrow(InvalidTransitionError);
  });

  it('AC01: done -> blocked should throw InvalidTransitionError', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'in_progress');
    taskModel.updateStatus(task.id, 'done');
    expect(() => taskModel.updateStatus(task.id, 'blocked')).toThrow(InvalidTransitionError);
  });

  it('AC01: skipped -> todo should throw InvalidTransitionError', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'skipped');
    expect(() => taskModel.updateStatus(task.id, 'todo')).toThrow(InvalidTransitionError);
  });

  it('AC01: skipped -> in_progress should throw InvalidTransitionError', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'skipped');
    expect(() => taskModel.updateStatus(task.id, 'in_progress')).toThrow(InvalidTransitionError);
  });

  it('AC01: todo -> done (skip in_progress) should throw InvalidTransitionError', () => {
    const task = taskModel.create('test-plan', 'Task');
    expect(() => taskModel.updateStatus(task.id, 'done')).toThrow(InvalidTransitionError);
  });

  // --- Valid transitions ---

  it('AC02: todo -> in_progress -> done (normal flow)', () => {
    const task = taskModel.create('test-plan', 'Task');
    expect(taskModel.updateStatus(task.id, 'in_progress').status).toBe('in_progress');
    expect(taskModel.updateStatus(task.id, 'done').status).toBe('done');
  });

  it('AC02: todo -> blocked -> in_progress -> done', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'blocked');
    taskModel.updateStatus(task.id, 'in_progress');
    expect(taskModel.updateStatus(task.id, 'done').status).toBe('done');
  });

  it('AC03: blocked -> todo (recovery) should be allowed', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'blocked');
    const recovered = taskModel.updateStatus(task.id, 'todo');
    expect(recovered.status).toBe('todo');
  });

  it('AC03: blocked -> in_progress (recovery) should be allowed', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'blocked');
    const recovered = taskModel.updateStatus(task.id, 'in_progress');
    expect(recovered.status).toBe('in_progress');
  });

  it('AC03: blocked -> skipped should be allowed', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'blocked');
    expect(taskModel.updateStatus(task.id, 'skipped').status).toBe('skipped');
  });

  it('AC02: in_progress -> todo (reset) should be allowed', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'in_progress');
    expect(taskModel.updateStatus(task.id, 'todo').status).toBe('todo');
  });

  // --- Same status (no-op) ---

  it('same status transition should be a no-op', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'in_progress');
    const result = taskModel.updateStatus(task.id, 'in_progress');
    expect(result.status).toBe('in_progress');
  });

  it('same status todo -> todo should be a no-op', () => {
    const task = taskModel.create('test-plan', 'Task');
    const result = taskModel.updateStatus(task.id, 'todo');
    expect(result.status).toBe('todo');
  });

  // --- Force option ---

  it('force:true should allow invalid transition done -> todo', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'in_progress');
    taskModel.updateStatus(task.id, 'done');
    const result = taskModel.updateStatus(task.id, 'todo', { force: true });
    expect(result.status).toBe('todo');
  });

  it('force:true should allow invalid transition todo -> done', () => {
    const task = taskModel.create('test-plan', 'Task');
    const result = taskModel.updateStatus(task.id, 'done', { force: true });
    expect(result.status).toBe('done');
  });

  it('force:true should allow invalid transition skipped -> in_progress', () => {
    const task = taskModel.create('test-plan', 'Task');
    taskModel.updateStatus(task.id, 'skipped');
    const result = taskModel.updateStatus(task.id, 'in_progress', { force: true });
    expect(result.status).toBe('in_progress');
  });
});
