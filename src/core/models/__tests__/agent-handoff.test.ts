import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { AgentHandoffModel } from '../agent-handoff.js';
import { PlanModel } from '../plan.js';
import { EventModel } from '../event.js';
import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('AgentHandoffModel', () => {
  let db: Database.Database;
  let model: AgentHandoffModel;
  let planModel: PlanModel;
  const planId = 'test-plan';
  const taskId = 'test-task';
  let testBaseDir: string;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    // Insert plan and task for FK
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(planId, 'Test Plan', 'active');
    db.prepare("INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)").run(
      taskId, planId, 'Test Task', 'in_progress', 0, 1,
    );
    testBaseDir = join(tmpdir(), `handoff-test-${Date.now()}`);
    mkdirSync(testBaseDir, { recursive: true });
    model = new AgentHandoffModel(db, testBaseDir);
    const events = new EventModel(db);
    planModel = new PlanModel(db, events);
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('AC01: write creates DB record and JSON file', () => {
    it('AC01: create should insert a record and writeHandoffReport should create a JSON file', () => {
      const handoff = model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'All tests passed');

      expect(handoff.id).toHaveLength(12);
      expect(handoff.task_id).toBe(taskId);
      expect(handoff.plan_id).toBe(planId);
      expect(handoff.agent_type).toBe('tdd-implementer');
      expect(handoff.attempt).toBe(1);
      expect(handoff.verdict).toBe('DONE');
      expect(handoff.summary).toBe('All tests passed');

      // Write report file
      const reportData = { status: 'DONE', tests: 5 };
      const reportPath = model.writeHandoffReport(taskId, 'tdd-implementer', 1, reportData);

      expect(existsSync(reportPath)).toBe(true);
      const content = JSON.parse(readFileSync(reportPath, 'utf-8'));
      expect(content.status).toBe('DONE');
      expect(content.tests).toBe(5);
    });
  });

  describe('AC02: read returns DB metadata and file content', () => {
    it('AC02: readHandoffReport should return JSON content from file', () => {
      model.create(taskId, planId, 'verifier', 1, 'PASS', 'Verified');
      const data = { verdict: 'PASS', details: 'ok' };
      model.writeHandoffReport(taskId, 'verifier', 1, data);

      const content = model.readHandoffReport(taskId, 'verifier', 1);
      expect(content).toEqual(data);
    });

    it('AC02: get should return DB record', () => {
      const created = model.create(taskId, planId, 'verifier', 1, 'PASS', 'Verified');
      const fetched = model.get(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.verdict).toBe('PASS');
    });

    it('AC02: getByTask should filter by task, agent, attempt', () => {
      model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'First');
      model.create(taskId, planId, 'tdd-implementer', 2, 'DONE', 'Second');
      model.create(taskId, planId, 'verifier', 1, 'PASS', 'Verified');

      const all = model.getByTask(taskId);
      expect(all).toHaveLength(3);

      const byAgent = model.getByTask(taskId, 'tdd-implementer');
      expect(byAgent).toHaveLength(2);

      const byAttempt = model.getByTask(taskId, 'tdd-implementer', 1);
      expect(byAttempt).toHaveLength(1);
      expect(byAttempt[0].summary).toBe('First');
    });
  });

  describe('AC03: clean deletes all handoff records and files for a plan', () => {
    it('AC03: cleanByPlan should delete DB records and handoff directories', () => {
      model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'Done');
      model.writeHandoffReport(taskId, 'tdd-implementer', 1, { status: 'DONE' });

      // Verify they exist
      expect(model.list(planId)).toHaveLength(1);
      const reportPath = join(testBaseDir, taskId, 'tdd-implementer_1.json');
      expect(existsSync(reportPath)).toBe(true);

      model.cleanByPlan(planId);

      expect(model.list(planId)).toHaveLength(0);
      // Directory for this task should be removed
      expect(existsSync(join(testBaseDir, taskId))).toBe(false);
    });
  });

  describe('AC04: plan complete triggers handoff clean', () => {
    it('AC04: completing a plan should auto-clean handoff data', () => {
      // Create handoff with plan model that has handoff model attached
      const planModelWithHandoff = new PlanModel(db, new EventModel(db), model);
      model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'Done');
      model.writeHandoffReport(taskId, 'tdd-implementer', 1, { done: true });

      expect(model.list(planId)).toHaveLength(1);

      planModelWithHandoff.complete(planId, { force: true });

      expect(model.list(planId)).toHaveLength(0);
    });

    it('AC04: archiving a plan should auto-clean handoff data', () => {
      const planModelWithHandoff = new PlanModel(db, new EventModel(db), model);
      model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'Done');

      // Move plan to completed first, then archive
      db.prepare("UPDATE plans SET status = 'completed' WHERE id = ?").run(planId);

      planModelWithHandoff.archive(planId, { force: true });

      expect(model.list(planId)).toHaveLength(0);
    });
  });

  describe('AC05: auto-create handoff directory', () => {
    it('AC05: writeHandoffReport should create directories when they do not exist', () => {
      const newTaskId = 'new-task-xyz';
      db.prepare("INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)").run(
        newTaskId, planId, 'New Task', 'in_progress', 0, 2,
      );

      const dir = join(testBaseDir, newTaskId);
      expect(existsSync(dir)).toBe(false);

      const reportPath = model.writeHandoffReport(newTaskId, 'verifier', 1, { data: 'test' });

      expect(existsSync(dir)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);
    });
  });

  describe('AC06: duplicate write returns error', () => {
    it('AC06: creating duplicate task+agent+attempt should throw error', () => {
      model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'First');

      expect(() => {
        model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'Duplicate');
      }).toThrow();
    });
  });

  describe('list', () => {
    it('should list handoffs by planId', () => {
      model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'Done');
      model.create(taskId, planId, 'verifier', 1, 'PASS', 'Passed');

      const items = model.list(planId);
      expect(items).toHaveLength(2);
    });

    it('should list handoffs by taskId', () => {
      model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'Done');
      const items = model.list(undefined, taskId);
      expect(items).toHaveLength(1);
    });

    it('should list all handoffs when no filter', () => {
      model.create(taskId, planId, 'tdd-implementer', 1, 'DONE', 'Done');
      const items = model.list();
      expect(items).toHaveLength(1);
    });
  });
});
