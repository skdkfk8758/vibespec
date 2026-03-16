import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { TaskModel } from '../task.js';
import { EventModel } from '../event.js';
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
  });

  describe('updateStatus', () => {
    it('should set completed_at when status is done', () => {
      const task = taskModel.create('test-plan', 'Task');
      const updated = taskModel.updateStatus(task.id, 'done');

      expect(updated.status).toBe('done');
      expect(updated.completed_at).not.toBeNull();
    });

    it('should clear completed_at when status is not done', () => {
      const task = taskModel.create('test-plan', 'Task');
      taskModel.updateStatus(task.id, 'done');
      const updated = taskModel.updateStatus(task.id, 'in_progress');

      expect(updated.status).toBe('in_progress');
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
      taskModel.updateStatus(t1.id, 'done');

      const doneTasks = taskModel.getByPlan('test-plan', { status: 'done' });
      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0].title).toBe('Task 1');

      const todoTasks = taskModel.getByPlan('test-plan', { status: 'todo' });
      expect(todoTasks).toHaveLength(2);
    });
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
    taskModel.updateStatus(task.id, 'done');
    const recorded = events.getByEntity('task', task.id);

    expect(recorded).toHaveLength(2);
    const statusEvent = recorded[1];
    expect(statusEvent.event_type).toBe('status_changed');
    expect(statusEvent.old_value).toBe('{"status":"todo"}');
    expect(statusEvent.new_value).toBe('{"status":"done"}');
  });
});
