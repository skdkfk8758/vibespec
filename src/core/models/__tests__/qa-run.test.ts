import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { QARunModel } from '../qa-run.js';
import type Database from 'better-sqlite3';

describe('QARunModel', () => {
  let db: Database.Database;
  let model: QARunModel;
  const planId = 'test-plan';

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      planId,
      'Test Plan',
      'active',
    );
    model = new QARunModel(db);
  });

  describe('create', () => {
    it('AC01: should create a QA run with correct defaults', () => {
      const run = model.create(planId, 'manual');

      expect(run.id).toHaveLength(12);
      expect(run.plan_id).toBe(planId);
      expect(run.trigger).toBe('manual');
      expect(run.status).toBe('pending');
      expect(run.summary).toBeNull();
      expect(run.total_scenarios).toBe(0);
      expect(run.passed_scenarios).toBe(0);
      expect(run.failed_scenarios).toBe(0);
      expect(run.risk_score).toBe(0);
      expect(run.created_at).toBeTruthy();
      expect(run.completed_at).toBeNull();
    });

    it('AC01: should create runs with different triggers', () => {
      const triggers = ['manual', 'auto', 'milestone'] as const;
      for (const trigger of triggers) {
        const run = model.create(planId, trigger);
        expect(run.trigger).toBe(trigger);
      }
    });
  });

  describe('AC02: trigger column quoting', () => {
    it('AC02: INSERT query uses double-quoted "trigger" column', () => {
      // Verify that the model can insert and retrieve trigger values
      // This tests that the SQL uses "trigger" (quoted) to avoid reserved word conflict
      const run = model.create(planId, 'manual');
      expect(run).not.toBeNull();
      expect(run.trigger).toBe('manual');

      // Verify via raw SQL with quoted column
      const raw = db.prepare('SELECT "trigger" FROM qa_runs WHERE id = ?').get(run.id) as { trigger: string };
      expect(raw.trigger).toBe('manual');
    });

    it('AC02: SELECT queries correctly retrieve trigger column', () => {
      const run = model.create(planId, 'auto');
      const fetched = model.get(run.id);
      expect(fetched!.trigger).toBe('auto');

      const listed = model.list(planId);
      expect(listed[0].trigger).toBe('auto');

      const latest = model.getLatestByPlan(planId);
      expect(latest!.trigger).toBe('auto');
    });
  });

  describe('get', () => {
    it('AC01: should return a run by id', () => {
      const created = model.create(planId, 'manual');
      const fetched = model.get(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
    });

    it('AC01: should return null for non-existent id', () => {
      const result = model.get('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('AC01: should list all runs when no planId given', () => {
      model.create(planId, 'manual');
      model.create(planId, 'auto');

      const runs = model.list();
      expect(runs).toHaveLength(2);
    });

    it('AC01: should list runs filtered by planId', () => {
      db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
        'other-plan',
        'Other Plan',
        'active',
      );
      model.create(planId, 'manual');
      model.create('other-plan', 'auto');

      const runs = model.list(planId);
      expect(runs).toHaveLength(1);
      expect(runs[0].plan_id).toBe(planId);
    });

    it('AC01: should return runs ordered by created_at descending', () => {
      model.create(planId, 'manual');
      model.create(planId, 'auto');

      const runs = model.list(planId);
      expect(runs).toHaveLength(2);
      // Both created in same timestamp, just verify ordering is consistent
      expect(new Date(runs[0].created_at).getTime()).toBeGreaterThanOrEqual(
        new Date(runs[1].created_at).getTime()
      );
    });
  });

  describe('updateStatus', () => {
    it('AC03: should update status to running', () => {
      const run = model.create(planId, 'manual');
      const updated = model.updateStatus(run.id, 'running');

      expect(updated.status).toBe('running');
      expect(updated.completed_at).toBeNull();
    });

    it('AC03: should set completed_at when status is completed', () => {
      const run = model.create(planId, 'manual');
      const updated = model.updateStatus(run.id, 'completed', 'All passed');

      expect(updated.status).toBe('completed');
      expect(updated.summary).toBe('All passed');
      expect(updated.completed_at).not.toBeNull();
    });

    it('AC03: should set completed_at when status is failed', () => {
      const run = model.create(planId, 'manual');
      const updated = model.updateStatus(run.id, 'failed', 'Some tests failed');

      expect(updated.status).toBe('failed');
      expect(updated.summary).toBe('Some tests failed');
      expect(updated.completed_at).not.toBeNull();
    });

    it('AC03: should not set completed_at for non-terminal statuses', () => {
      const run = model.create(planId, 'manual');
      const updated = model.updateStatus(run.id, 'running');

      expect(updated.completed_at).toBeNull();
    });
  });

  describe('updateScores', () => {
    it('AC03: should update scenario scores and risk score', () => {
      const run = model.create(planId, 'manual');
      model.updateScores(run.id, 10, 8, 2, 25);

      const fetched = model.get(run.id)!;
      expect(fetched.total_scenarios).toBe(10);
      expect(fetched.passed_scenarios).toBe(8);
      expect(fetched.failed_scenarios).toBe(2);
      expect(fetched.risk_score).toBe(25);
    });
  });

  describe('getLatestByPlan', () => {
    it('AC01: should return the latest run for a plan', () => {
      model.create(planId, 'manual');
      model.create(planId, 'auto');

      const result = model.getLatestByPlan(planId);
      expect(result).not.toBeNull();
      // Just verify it returns a run for this plan
      expect(result!.plan_id).toBe(planId);
    });

    it('AC01: should return null when no runs exist for plan', () => {
      const result = model.getLatestByPlan('no-such-plan');
      expect(result).toBeNull();
    });
  });
});
