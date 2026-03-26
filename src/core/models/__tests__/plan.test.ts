import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { PlanModel } from '../plan.js';
import { EventModel } from '../event.js';
import type Database from 'better-sqlite3';

describe('PlanModel', () => {
  let db: Database.Database;
  let model: PlanModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    model = new PlanModel(db);
  });

  describe('create and getById', () => {
    it('should create a plan and retrieve it by id', () => {
      const plan = model.create('My Plan', 'some spec', 'a summary');

      expect(plan.id).toHaveLength(12);
      expect(plan.title).toBe('My Plan');
      expect(plan.spec).toBe('some spec');
      expect(plan.summary).toBe('a summary');
      expect(plan.status).toBe('draft');
      expect(plan.created_at).toBeTruthy();
      expect(plan.completed_at).toBeNull();

      const fetched = model.getById(plan.id);
      expect(fetched).toEqual(plan);
    });

    it('should create a plan with defaults when optional args omitted', () => {
      const plan = model.create('Minimal Plan');

      expect(plan.title).toBe('Minimal Plan');
      expect(plan.spec).toBeNull();
      expect(plan.summary).toBeNull();
      expect(plan.status).toBe('draft');
    });

    it('should return null for non-existent id', () => {
      expect(model.getById('nonexistent')).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all plans', () => {
      model.create('Plan A');
      model.create('Plan B');

      const plans = model.list();
      expect(plans).toHaveLength(2);
    });

    it('should filter by status', () => {
      const a = model.create('Draft Plan');
      const b = model.create('Active Plan');
      model.activate(b.id);

      const drafts = model.list({ status: 'draft' });
      expect(drafts).toHaveLength(1);
      expect(drafts[0].id).toBe(a.id);

      const actives = model.list({ status: 'active' });
      expect(actives).toHaveLength(1);
      expect(actives[0].id).toBe(b.id);
    });
  });

  describe('update', () => {
    it('should update title', () => {
      const plan = model.create('Old Title');
      const updated = model.update(plan.id, { title: 'New Title' });

      expect(updated.title).toBe('New Title');
    });

    it('should update summary and spec', () => {
      const plan = model.create('Plan');
      const updated = model.update(plan.id, { summary: 'new summary', spec: 'new spec' });

      expect(updated.summary).toBe('new summary');
      expect(updated.spec).toBe('new spec');
    });

    it('should throw for non-existent plan', () => {
      expect(() => model.update('nonexistent', { title: 'x' })).toThrow('Plan not found');
    });
  });

  describe('status transitions', () => {
    it('should transition draft → active → completed → archived', () => {
      const plan = model.create('Lifecycle Plan');
      expect(plan.status).toBe('draft');

      const active = model.activate(plan.id);
      expect(active.status).toBe('active');

      const completed = model.complete(plan.id);
      expect(completed.status).toBe('completed');
      expect(completed.completed_at).toBeTruthy();

      const archived = model.archive(plan.id);
      expect(archived.status).toBe('archived');
    });

    it('should transition active → approved', () => {
      const plan = model.create('Approve Plan');
      model.activate(plan.id);

      const approved = model.approve(plan.id);
      expect(approved.status).toBe('approved');
    });

    it('should list approved plans by status filter', () => {
      const plan = model.create('Filterable Plan');
      model.activate(plan.id);
      model.approve(plan.id);

      const approved = model.list({ status: 'approved' });
      expect(approved).toHaveLength(1);
      expect(approved[0].title).toBe('Filterable Plan');
    });

    it('approve should throw for non-active plan', () => {
      const plan = model.create('Draft Plan');
      expect(() => model.approve(plan.id)).toThrow('Only active plans can be approved');
    });

    it('activate should throw for non-existent plan', () => {
      expect(() => model.activate('nonexistent')).toThrow('Plan not found');
    });

    it('complete should throw for non-existent plan', () => {
      expect(() => model.complete('nonexistent')).toThrow('Plan not found');
    });

    it('archive should throw for non-existent plan', () => {
      expect(() => model.archive('nonexistent')).toThrow('Plan not found');
    });
  });
});

describe('PlanModel with EventModel', () => {
  let db: Database.Database;
  let model: PlanModel;
  let events: EventModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    events = new EventModel(db);
    model = new PlanModel(db, events);
  });

  it('should record a created event on plan.create()', () => {
    const plan = model.create('Event Plan');
    const recorded = events.getByEntity('plan', plan.id);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].event_type).toBe('created');
    expect(recorded[0].old_value).toBeNull();
    const newValue = JSON.parse(recorded[0].new_value!);
    expect(newValue.title).toBe('Event Plan');
    expect(newValue.status).toBe('draft');
  });

  it('should record an activated event on plan.activate()', () => {
    const plan = model.create('Activate Plan');
    model.activate(plan.id);
    const recorded = events.getByEntity('plan', plan.id);

    expect(recorded).toHaveLength(2);
    const activatedEvent = recorded[1];
    expect(activatedEvent.event_type).toBe('activated');
    expect(JSON.parse(activatedEvent.old_value!)).toEqual({ status: 'draft' });
    expect(JSON.parse(activatedEvent.new_value!)).toEqual({ status: 'active' });
  });

  it('should record a completed event on plan.complete()', () => {
    const plan = model.create('Complete Plan');
    model.activate(plan.id);
    model.complete(plan.id);
    const recorded = events.getByEntity('plan', plan.id);

    expect(recorded).toHaveLength(3);
    const completedEvent = recorded[2];
    expect(completedEvent.event_type).toBe('completed');
    expect(JSON.parse(completedEvent.old_value!)).toEqual({ status: 'active' });
    expect(JSON.parse(completedEvent.new_value!)).toEqual({ status: 'completed' });
  });

  it('should record an archived event on plan.archive()', () => {
    const plan = model.create('Archive Plan');
    model.archive(plan.id);
    const recorded = events.getByEntity('plan', plan.id);

    expect(recorded).toHaveLength(2);
    const archivedEvent = recorded[1];
    expect(archivedEvent.event_type).toBe('archived');
    expect(JSON.parse(archivedEvent.old_value!)).toEqual({ status: 'draft' });
    expect(JSON.parse(archivedEvent.new_value!)).toEqual({ status: 'archived' });
  });

  it('should record an updated event on plan.update()', () => {
    const plan = model.create('Old Title');
    model.update(plan.id, { title: 'New Title' });
    const recorded = events.getByEntity('plan', plan.id);

    expect(recorded).toHaveLength(2);
    const updatedEvent = recorded[1];
    expect(updatedEvent.event_type).toBe('updated');
    expect(JSON.parse(updatedEvent.old_value!)).toEqual({ title: 'Old Title' });
    expect(JSON.parse(updatedEvent.new_value!)).toEqual({ title: 'New Title' });
  });
});
