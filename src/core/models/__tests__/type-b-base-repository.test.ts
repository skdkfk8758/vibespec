import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { PlanModel } from '../plan.js';
import { TaskModel } from '../task.js';
import { BacklogModel } from '../backlog.js';
import { BaseRepository } from '../base-repository.js';
import { EventModel } from '../event.js';
import type Database from 'better-sqlite3';

describe('Type B Models - BaseRepository conversion', () => {
  let db: Database.Database;
  let events: EventModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    events = new EventModel(db);
  });

  describe('AC01: 3 models inherit BaseRepository', () => {
    it('AC01: PlanModel should be an instance of BaseRepository', () => {
      const model = new PlanModel(db, events);
      expect(model).toBeInstanceOf(BaseRepository);
    });

    it('AC01: TaskModel should be an instance of BaseRepository', () => {
      const model = new TaskModel(db, events);
      expect(model).toBeInstanceOf(BaseRepository);
    });

    it('AC01: BacklogModel should be an instance of BaseRepository', () => {
      const model = new BacklogModel(db, events);
      expect(model).toBeInstanceOf(BaseRepository);
    });
  });

  describe('AC02: events dependency is maintained', () => {
    it('AC02: PlanModel should accept events in constructor and use it', () => {
      const model = new PlanModel(db, events);
      const plan = model.create('Test Plan');
      const recorded = events.getByEntity('plan', plan.id);
      expect(recorded.length).toBeGreaterThanOrEqual(1);
    });

    it('AC02: TaskModel should accept events in constructor and use it', () => {
      const model = new TaskModel(db, events);
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      const task = model.create('p1', 'Test Task');
      const recorded = events.getByEntity('task', task.id);
      expect(recorded.length).toBeGreaterThanOrEqual(1);
    });

    it('AC02: BacklogModel should accept events in constructor and use it', () => {
      const model = new BacklogModel(db, events);
      const item = model.create({ title: 'Test Item' });
      const recorded = events.getByEntity('backlog', item.id);
      expect(recorded.length).toBeGreaterThanOrEqual(1);
    });

    it('AC02: PlanModel should work without events (optional)', () => {
      const model = new PlanModel(db);
      const plan = model.create('No Events Plan');
      expect(plan.title).toBe('No Events Plan');
    });

    it('AC02: TaskModel should work without events (optional)', () => {
      const model = new TaskModel(db);
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      const task = model.create('p1', 'No Events Task');
      expect(task.title).toBe('No Events Task');
    });

    it('AC02: BacklogModel should work without events (optional)', () => {
      const model = new BacklogModel(db);
      const item = model.create({ title: 'No Events Item' });
      expect(item.title).toBe('No Events Item');
    });
  });

  describe('AC03: create/update event recording works', () => {
    it('AC03: PlanModel.create records created event', () => {
      const model = new PlanModel(db, events);
      const plan = model.create('Event Plan');
      const recorded = events.getByEntity('plan', plan.id);
      expect(recorded.some(e => e.event_type === 'created')).toBe(true);
    });

    it('AC03: PlanModel.update records updated event', () => {
      const model = new PlanModel(db, events);
      const plan = model.create('Old Title');
      model.update(plan.id, { title: 'New Title' });
      const recorded = events.getByEntity('plan', plan.id);
      expect(recorded.some(e => e.event_type === 'updated')).toBe(true);
    });

    it('AC03: TaskModel.create records created event', () => {
      const model = new TaskModel(db, events);
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      const task = model.create('p1', 'Event Task');
      const recorded = events.getByEntity('task', task.id);
      expect(recorded.some(e => e.event_type === 'created')).toBe(true);
    });

    it('AC03: TaskModel.update records updated event', () => {
      const model = new TaskModel(db, events);
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      const task = model.create('p1', 'Task To Update');
      model.update(task.id, { title: 'Updated Task' });
      const recorded = events.getByEntity('task', task.id);
      expect(recorded.some(e => e.event_type === 'updated')).toBe(true);
    });

    it('AC03: BacklogModel.create records created event', () => {
      const model = new BacklogModel(db, events);
      const item = model.create({ title: 'Event Item' });
      const recorded = events.getByEntity('backlog', item.id);
      expect(recorded.some(e => e.event_type === 'created')).toBe(true);
    });

    it('AC03: BacklogModel.update records updated event', () => {
      const model = new BacklogModel(db, events);
      const item = model.create({ title: 'Old Item' });
      model.update(item.id, { title: 'New Item' });
      const recorded = events.getByEntity('backlog', item.id);
      expect(recorded.some(e => e.event_type === 'updated')).toBe(true);
    });
  });

  describe('AC04: inherited BaseRepository methods work correctly', () => {
    it('AC04: PlanModel.getById works via inheritance', () => {
      const model = new PlanModel(db, events);
      const plan = model.create('Find Me');
      const found = model.getById(plan.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Find Me');
    });

    it('AC04: TaskModel.getById works via inheritance', () => {
      const model = new TaskModel(db, events);
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      const task = model.create('p1', 'Find Task');
      const found = model.getById(task.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Find Task');
    });

    it('AC04: BacklogModel.getById works via inheritance', () => {
      const model = new BacklogModel(db, events);
      const item = model.create({ title: 'Find Item' });
      const found = model.getById(item.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Find Item');
    });

    it('AC04: getById returns null for non-existent id', () => {
      const model = new PlanModel(db, events);
      expect(model.getById('nonexistent')).toBeNull();
    });
  });
});
