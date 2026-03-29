import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { BacklogModel } from '../backlog.js';
import { EventModel } from '../event.js';
import type Database from 'better-sqlite3';

describe('BacklogModel', () => {
  let db: Database.Database;
  let model: BacklogModel;
  let events: EventModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    events = new EventModel(db);
    model = new BacklogModel(db, events);
  });

  describe('create', () => {
    it('AC01: should create a backlog item with defaults', () => {
      const item = model.create({ title: 'New Feature' });

      expect(item.id).toHaveLength(12);
      expect(item.title).toBe('New Feature');
      expect(item.description).toBeNull();
      expect(item.priority).toBe('medium');
      expect(item.category).toBeNull();
      expect(item.tags).toBeNull();
      expect(item.complexity_hint).toBeNull();
      expect(item.source).toBeNull();
      expect(item.status).toBe('open');
      expect(item.plan_id).toBeNull();
      expect(item.created_at).toBeTruthy();
    });

    it('AC01: should create a backlog item with all fields', () => {
      const item = model.create({
        title: 'Bug Fix',
        description: 'Fix the login issue',
        priority: 'critical',
        category: 'bugfix',
        tags: ['auth', 'login'],
        complexity_hint: 'simple',
        source: 'user-report',
      });

      expect(item.title).toBe('Bug Fix');
      expect(item.description).toBe('Fix the login issue');
      expect(item.priority).toBe('critical');
      expect(item.category).toBe('bugfix');
      expect(item.tags).toBe(JSON.stringify(['auth', 'login']));
      expect(item.complexity_hint).toBe('simple');
      expect(item.source).toBe('user-report');
      expect(item.status).toBe('open');
    });

    it('AC01: should record a created event', () => {
      const item = model.create({ title: 'Tracked Item' });
      const eventsList = events.getByEntity('backlog', item.id);

      expect(eventsList.length).toBeGreaterThanOrEqual(1);
      expect(eventsList.some((e: { event_type: string }) => e.event_type === 'created')).toBe(true);
    });
  });

  describe('getById', () => {
    it('AC01: should retrieve a backlog item by id', () => {
      const created = model.create({ title: 'Find Me' });
      const found = model.getById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe('Find Me');
    });

    it('AC01: should return null for non-existent id', () => {
      const result = model.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('AC01: should list all backlog items', () => {
      model.create({ title: 'Item A' });
      model.create({ title: 'Item B' });
      model.create({ title: 'Item C' });

      const items = model.list();
      expect(items).toHaveLength(3);
    });

    it('AC01: should filter by status', () => {
      const item = model.create({ title: 'To Plan' });
      model.create({ title: 'Stay Open' });

      // Insert a plan so we can promote
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      model.promote(item.id, 'p1');

      const openItems = model.list({ status: 'open' });
      expect(openItems).toHaveLength(1);
      expect(openItems[0].title).toBe('Stay Open');

      const plannedItems = model.list({ status: 'planned' });
      expect(plannedItems).toHaveLength(1);
      expect(plannedItems[0].title).toBe('To Plan');
    });

    it('AC01: should filter by priority', () => {
      model.create({ title: 'Critical', priority: 'critical' });
      model.create({ title: 'Low', priority: 'low' });

      const critical = model.list({ priority: 'critical' });
      expect(critical).toHaveLength(1);
      expect(critical[0].title).toBe('Critical');
    });

    it('AC01: should filter by category', () => {
      model.create({ title: 'Feature', category: 'feature' });
      model.create({ title: 'Bug', category: 'bugfix' });

      const features = model.list({ category: 'feature' });
      expect(features).toHaveLength(1);
      expect(features[0].title).toBe('Feature');
    });

    it('AC01: should filter by tag', () => {
      model.create({ title: 'Tagged', tags: ['ui', 'frontend'] });
      model.create({ title: 'Other', tags: ['backend'] });

      const uiItems = model.list({ tag: 'ui' });
      expect(uiItems).toHaveLength(1);
      expect(uiItems[0].title).toBe('Tagged');
    });

    it('AC01: should order by priority then created_at desc', () => {
      model.create({ title: 'Low', priority: 'low' });
      model.create({ title: 'Critical', priority: 'critical' });
      model.create({ title: 'High', priority: 'high' });

      const items = model.list();
      expect(items[0].title).toBe('Critical');
      expect(items[1].title).toBe('High');
      expect(items[2].title).toBe('Low');
    });
  });

  describe('update', () => {
    it('AC01: should update title and description', () => {
      const item = model.create({ title: 'Original' });
      const updated = model.update(item.id, {
        title: 'Updated',
        description: 'New description',
      });

      expect(updated.title).toBe('Updated');
      expect(updated.description).toBe('New description');
    });

    it('AC01: should update status and record status_changed event', () => {
      const item = model.create({ title: 'Status Test' });
      model.update(item.id, { status: 'dropped' });

      const eventsList = events.getByEntity('backlog', item.id);
      expect(eventsList.some((e: { event_type: string }) => e.event_type === 'status_changed')).toBe(true);
    });

    it('AC01: should throw when updating non-existent item', () => {
      expect(() => model.update('nonexistent', { title: 'Fail' })).toThrow(
        'Backlog item not found',
      );
    });
  });

  describe('delete', () => {
    it('AC01: should delete a backlog item', () => {
      const item = model.create({ title: 'Delete Me' });
      model.delete(item.id);

      expect(model.getById(item.id)).toBeNull();
    });

    it('AC01: should also delete associated events', () => {
      const item = model.create({ title: 'With Events' });
      model.update(item.id, { title: 'Updated' });

      model.delete(item.id);

      const eventsList = events.getByEntity('backlog', item.id);
      expect(eventsList).toHaveLength(0);
    });

    it('AC01: should throw when deleting non-existent item', () => {
      expect(() => model.delete('nonexistent')).toThrow('Backlog item not found');
    });
  });

  describe('promote', () => {
    it('AC01: should promote an open item to planned', () => {
      const item = model.create({ title: 'Promotable' });
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');

      const promoted = model.promote(item.id, 'p1');

      expect(promoted.status).toBe('planned');
      expect(promoted.plan_id).toBe('p1');
    });

    it('AC01: should throw when promoting non-open item', () => {
      const item = model.create({ title: 'Already Planned' });
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      model.promote(item.id, 'p1');

      expect(() => model.promote(item.id, 'p1')).toThrow(
        'Only open backlog items can be promoted',
      );
    });

    it('AC01: should record status_changed event on promote', () => {
      const item = model.create({ title: 'Event Track' });
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      model.promote(item.id, 'p1');

      const eventsList = events.getByEntity('backlog', item.id);
      expect(eventsList.some((e: { event_type: string }) => e.event_type === 'status_changed')).toBe(true);
    });
  });

  describe('findByTitle', () => {
    it('AC02: should find a backlog item by title', () => {
      model.create({ title: 'Unique Title' });
      const found = model.findByTitle('Unique Title');

      expect(found).not.toBeNull();
      expect(found!.title).toBe('Unique Title');
    });

    it('AC02: should filter by title and status', () => {
      const item = model.create({ title: 'Filterable' });
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('p1', 'Plan', 'active');
      model.promote(item.id, 'p1');

      expect(model.findByTitle('Filterable', 'open')).toBeNull();
      expect(model.findByTitle('Filterable', 'planned')).not.toBeNull();
    });

    it('AC02: should return null for non-existent title', () => {
      expect(model.findByTitle('Does Not Exist')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('AC01: should return correct stats for empty db', () => {
      const stats = model.getStats();

      expect(stats.total).toBe(0);
      expect(stats.by_priority).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
      expect(stats.by_status).toEqual({ open: 0, planned: 0, done: 0, dropped: 0 });
      expect(stats.by_category).toEqual({});
    });

    it('AC01: should aggregate stats correctly', () => {
      model.create({ title: 'A', priority: 'critical', category: 'feature' });
      model.create({ title: 'B', priority: 'critical', category: 'bugfix' });
      model.create({ title: 'C', priority: 'low', category: 'feature' });
      model.create({ title: 'D' }); // medium priority, no category

      const stats = model.getStats();

      expect(stats.total).toBe(4);
      expect(stats.by_priority.critical).toBe(2);
      expect(stats.by_priority.low).toBe(1);
      expect(stats.by_priority.medium).toBe(1);
      expect(stats.by_status.open).toBe(4);
      expect(stats.by_category['feature']).toBe(2);
      expect(stats.by_category['bugfix']).toBe(1);
      expect(stats.by_category['uncategorized']).toBe(1);
    });
  });
});
