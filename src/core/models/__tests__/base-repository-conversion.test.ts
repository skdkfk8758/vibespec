import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { BaseRepository } from '../base-repository.js';
import { EventModel } from '../event.js';
import { SkillUsageModel } from '../skill-usage.js';
import { TaskMetricsModel } from '../task-metrics.js';
import type Database from 'better-sqlite3';

describe('Type A BaseRepository Conversion', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
  });

  describe('AC01: 4개 모델이 BaseRepository를 상속해야 한다', () => {
    it('AC01: EventModel extends BaseRepository', () => {
      const model = new EventModel(db);
      expect(model).toBeInstanceOf(BaseRepository);
    });

    it('AC01: SkillUsageModel extends BaseRepository', () => {
      const model = new SkillUsageModel(db);
      expect(model).toBeInstanceOf(BaseRepository);
    });

    it('AC01: TaskMetricsModel extends BaseRepository', () => {
      const model = new TaskMetricsModel(db);
      expect(model).toBeInstanceOf(BaseRepository);
    });
  });

  describe('AC02: 기존 공개 API 불변', () => {
    it('AC02: EventModel.record still works with positional args', () => {
      const model = new EventModel(db);
      const evt = model.record('plan', 'p1', 'created');
      expect(evt.entity_type).toBe('plan');
      expect(evt.entity_id).toBe('p1');
      expect(evt.event_type).toBe('created');
    });

    it('AC02: EventModel.record still works with options object', () => {
      const model = new EventModel(db);
      const evt = model.record({
        entityType: 'task',
        entityId: 't1',
        eventType: 'status_changed',
        oldValue: '"todo"',
        newValue: '"done"',
      });
      expect(evt.entity_type).toBe('task');
      expect(evt.old_value).toBe('"todo"');
      expect(evt.new_value).toBe('"done"');
    });

    it('AC02: EventModel.getByEntity returns events in order', () => {
      const model = new EventModel(db);
      model.record('plan', 'p1', 'created');
      model.record('plan', 'p1', 'updated');
      const results = model.getByEntity('plan', 'p1');
      expect(results).toHaveLength(2);
      expect(results[0].event_type).toBe('created');
    });

    it('AC02: EventModel.getBySession works', () => {
      const model = new EventModel(db);
      model.record('plan', 'p1', 'created', null, null, 'sess-1');
      const results = model.getBySession('sess-1');
      expect(results).toHaveLength(1);
    });

    it('AC02: EventModel.getRecent works with default and custom limit', () => {
      const model = new EventModel(db);
      for (let i = 0; i < 5; i++) model.record('plan', `p${i}`, 'created');
      expect(model.getRecent(3)).toHaveLength(3);
      expect(model.getRecent()).toHaveLength(5);
    });

    it('AC02: SkillUsageModel.record works', () => {
      const model = new SkillUsageModel(db);
      const result = model.record('vs-next');
      expect(result.id).toBeTruthy();
      expect(result.skill_name).toBe('vs-next');
    });

    it('AC02: SkillUsageModel.record with opts works', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Test', 'active')").run();
      const model = new SkillUsageModel(db);
      const result = model.record('vs-next', { planId: 'p1', sessionId: 's1' });
      expect(result.plan_id).toBe('p1');
      expect(result.session_id).toBe('s1');
    });

    it('AC02: SkillUsageModel.getStats works', () => {
      const model = new SkillUsageModel(db);
      model.record('a');
      model.record('a');
      model.record('b');
      const stats = model.getStats();
      expect(stats).toHaveLength(2);
    });

    it('AC02: SkillUsageModel.getRecentUsage works', () => {
      const model = new SkillUsageModel(db);
      model.record('a');
      model.record('b');
      const recent = model.getRecentUsage(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].skill_name).toBe('b');
    });

    it('AC02: TaskMetricsModel.record works', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Test', 'active')").run();
      db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t1', 'p1', 'Task', 'done')").run();
      const model = new TaskMetricsModel(db);
      const result = model.record('t1', 'p1', 'done', { impl_status: 'DONE', test_count: 5 });
      expect(result.task_id).toBe('t1');
      expect(result.impl_status).toBe('DONE');
    });

    it('AC02: TaskMetricsModel.getByTask works', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Test', 'active')").run();
      db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t1', 'p1', 'Task', 'done')").run();
      const model = new TaskMetricsModel(db);
      model.record('t1', 'p1', 'done');
      const result = model.getByTask('t1');
      expect(result).not.toBeNull();
      expect(result!.task_id).toBe('t1');
    });

    it('AC02: TaskMetricsModel.getByPlan works', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES ('p1', 'Test', 'active')").run();
      db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t1', 'p1', 'Task', 'done')").run();
      db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES ('t2', 'p1', 'Task2', 'done')").run();
      const model = new TaskMetricsModel(db);
      model.record('t1', 'p1', 'done');
      model.record('t2', 'p1', 'done');
      const results = model.getByPlan('p1');
      expect(results).toHaveLength(2);
    });
  });
});
