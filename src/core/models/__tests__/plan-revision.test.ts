import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { PlanRevisionModel } from '../plan-revision.js';
import type Database from 'better-sqlite3';

describe('PlanRevisionModel', () => {
  let db: Database.Database;
  let model: PlanRevisionModel;
  const planId = 'test-plan';

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      planId,
      'Test Plan',
      'active',
    );
    model = new PlanRevisionModel(db);
  });

  describe('create', () => {
    it('AC01: should create a plan revision with correct fields', () => {
      const revision = model.create(
        planId,
        'scope_explosion',
        'task-123',
        'Scope grew beyond original estimate',
        JSON.stringify({ added_tasks: ['t1', 't2'] }),
      );

      expect(revision.id).toHaveLength(12);
      expect(revision.plan_id).toBe(planId);
      expect(revision.trigger_type).toBe('scope_explosion');
      expect(revision.trigger_source).toBe('task-123');
      expect(revision.description).toBe('Scope grew beyond original estimate');
      expect(revision.changes).toBe(JSON.stringify({ added_tasks: ['t1', 't2'] }));
      expect(revision.status).toBe('proposed');
      expect(revision.created_at).toBeTruthy();
    });

    it('AC01: should allow null trigger_source', () => {
      const revision = model.create(
        planId,
        'design_flaw',
        null,
        'Architecture needs rethinking',
        '{}',
      );

      expect(revision.trigger_source).toBeNull();
    });

    it('AC01: should support all trigger types', () => {
      const types = [
        'assumption_violation',
        'scope_explosion',
        'design_flaw',
        'complexity_exceeded',
        'dependency_shift',
      ] as const;

      for (const triggerType of types) {
        const revision = model.create(planId, triggerType, null, `Test ${triggerType}`, '{}');
        expect(revision.trigger_type).toBe(triggerType);
      }
    });
  });

  describe('getById', () => {
    it('AC01: should return a revision by id', () => {
      const created = model.create(planId, 'design_flaw', null, 'Test', '{}');
      const fetched = model.getById(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
    });

    it('AC01: should return null for non-existent id', () => {
      const result = model.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('listByPlan', () => {
    it('AC02: should list revisions for a specific plan', () => {
      model.create(planId, 'design_flaw', null, 'First', '{}');
      model.create(planId, 'scope_explosion', null, 'Second', '{}');

      const revisions = model.listByPlan(planId);
      expect(revisions).toHaveLength(2);
      expect(revisions.every((r) => r.plan_id === planId)).toBe(true);
    });

    it('AC02: should not include revisions from other plans', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
        'other-plan',
        'Other Plan',
        'active',
      );
      model.create(planId, 'design_flaw', null, 'Mine', '{}');
      model.create('other-plan', 'scope_explosion', null, 'Other', '{}');

      const revisions = model.listByPlan(planId);
      expect(revisions).toHaveLength(1);
      expect(revisions[0].description).toBe('Mine');
    });

    it('AC02: should return revisions ordered by created_at descending', () => {
      model.create(planId, 'design_flaw', null, 'First', '{}');
      model.create(planId, 'scope_explosion', null, 'Second', '{}');

      const revisions = model.listByPlan(planId);
      expect(revisions).toHaveLength(2);
      expect(new Date(revisions[0].created_at).getTime()).toBeGreaterThanOrEqual(
        new Date(revisions[1].created_at).getTime(),
      );
    });

    it('AC02: should return empty array when no revisions exist', () => {
      const revisions = model.listByPlan(planId);
      expect(revisions).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('AC03: should update status to approved', () => {
      const revision = model.create(planId, 'design_flaw', null, 'Test', '{}');
      const updated = model.updateStatus(revision.id, 'approved');

      expect(updated.status).toBe('approved');
      expect(updated.id).toBe(revision.id);
    });

    it('AC03: should update status to rejected', () => {
      const revision = model.create(planId, 'scope_explosion', null, 'Test', '{}');
      const updated = model.updateStatus(revision.id, 'rejected');

      expect(updated.status).toBe('rejected');
    });

    it('AC03: should preserve other fields when updating status', () => {
      const revision = model.create(
        planId,
        'complexity_exceeded',
        'src-123',
        'Complex description',
        '{"key":"value"}',
      );
      const updated = model.updateStatus(revision.id, 'approved');

      expect(updated.plan_id).toBe(planId);
      expect(updated.trigger_type).toBe('complexity_exceeded');
      expect(updated.trigger_source).toBe('src-123');
      expect(updated.description).toBe('Complex description');
      expect(updated.changes).toBe('{"key":"value"}');
    });
  });
});
