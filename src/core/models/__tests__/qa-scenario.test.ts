import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { QARunModel } from '../qa-run.js';
import { QAScenarioModel } from '../qa-scenario.js';
import type Database from 'better-sqlite3';
import type { NewQAScenario } from '../../types.js';

describe('QAScenarioModel', () => {
  let db: Database.Database;
  let runModel: QARunModel;
  let model: QAScenarioModel;
  let runId: string;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
    runModel = new QARunModel(db);
    model = new QAScenarioModel(db);
    const run = runModel.create('test-plan', 'manual');
    runId = run.id;
  });

  const makeScenario = (overrides?: Partial<NewQAScenario>): NewQAScenario => ({
    category: 'functional',
    title: 'Test Scenario',
    description: 'A test scenario description',
    priority: 'medium',
    ...overrides,
  });

  describe('create', () => {
    it('AC01: should create a scenario with correct defaults', () => {
      const scenario = model.create(runId, makeScenario());

      expect(scenario.id).toHaveLength(12);
      expect(scenario.run_id).toBe(runId);
      expect(scenario.category).toBe('functional');
      expect(scenario.title).toBe('Test Scenario');
      expect(scenario.description).toBe('A test scenario description');
      expect(scenario.priority).toBe('medium');
      expect(scenario.status).toBe('pending');
      expect(scenario.related_tasks).toBeNull();
      expect(scenario.agent).toBeNull();
      expect(scenario.evidence).toBeNull();
      expect(scenario.created_at).toBeTruthy();
    });

    it('AC01: should store related_tasks when provided', () => {
      const scenario = model.create(runId, makeScenario({ related_tasks: 'task-1,task-2' }));
      expect(scenario.related_tasks).toBe('task-1,task-2');
    });
  });

  describe('bulkCreate', () => {
    it('AC01: should create multiple scenarios in a transaction', () => {
      const scenarios = [
        makeScenario({ title: 'Scenario A', priority: 'critical' }),
        makeScenario({ title: 'Scenario B', priority: 'high' }),
        makeScenario({ title: 'Scenario C', priority: 'low' }),
      ];

      const created = model.bulkCreate(runId, scenarios);

      expect(created).toHaveLength(3);
      expect(created[0].title).toBe('Scenario A');
      expect(created[1].title).toBe('Scenario B');
      expect(created[2].title).toBe('Scenario C');
    });

    it('AC01: should return empty array for empty input', () => {
      const created = model.bulkCreate(runId, []);
      expect(created).toHaveLength(0);
    });
  });

  describe('get', () => {
    it('AC01: should return a scenario by id', () => {
      const created = model.create(runId, makeScenario());
      const fetched = model.get(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
    });

    it('AC01: should return null for non-existent id', () => {
      expect(model.get('non-existent')).toBeNull();
    });
  });

  describe('listByRun', () => {
    it('AC01: should list scenarios for a run', () => {
      model.create(runId, makeScenario({ title: 'A' }));
      model.create(runId, makeScenario({ title: 'B' }));

      const list = model.listByRun(runId);
      expect(list).toHaveLength(2);
    });

    it('AC01: should filter by category', () => {
      model.create(runId, makeScenario({ category: 'functional' }));
      model.create(runId, makeScenario({ category: 'integration' }));

      const list = model.listByRun(runId, { category: 'functional' });
      expect(list).toHaveLength(1);
      expect(list[0].category).toBe('functional');
    });

    it('AC01: should filter by status', () => {
      const s1 = model.create(runId, makeScenario());
      model.create(runId, makeScenario());
      model.updateStatus(s1.id, 'pass');

      const list = model.listByRun(runId, { status: 'pass' });
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(s1.id);
    });

    it('AC01: should return empty for non-existent run', () => {
      const list = model.listByRun('no-such-run');
      expect(list).toHaveLength(0);
    });
  });

  describe('updateStatus', () => {
    it('AC03: should update status to pass', () => {
      const scenario = model.create(runId, makeScenario());
      model.updateStatus(scenario.id, 'pass');

      const fetched = model.get(scenario.id)!;
      expect(fetched.status).toBe('pass');
    });

    it('AC03: should update status to fail', () => {
      const scenario = model.create(runId, makeScenario());
      model.updateStatus(scenario.id, 'fail');

      const fetched = model.get(scenario.id)!;
      expect(fetched.status).toBe('fail');
    });

    it('AC03: should update status with evidence', () => {
      const scenario = model.create(runId, makeScenario());
      model.updateStatus(scenario.id, 'pass', 'All assertions passed');

      const fetched = model.get(scenario.id)!;
      expect(fetched.status).toBe('pass');
      expect(fetched.evidence).toBe('All assertions passed');
    });

    it('AC03: should update status without evidence (no overwrite)', () => {
      const scenario = model.create(runId, makeScenario());
      model.updateStatus(scenario.id, 'pass', 'Some evidence');
      model.updateStatus(scenario.id, 'fail');

      const fetched = model.get(scenario.id)!;
      expect(fetched.status).toBe('fail');
      // evidence is not cleared when not provided
    });
  });

  describe('listByPlan', () => {
    it('AC01: should list scenarios by plan ID', () => {
      model.create(runId, makeScenario({ title: 'Plan Scenario A', source: 'seed' }));
      model.create(runId, makeScenario({ title: 'Plan Scenario B', source: 'final' }));

      const list = model.listByPlan('test-plan');
      expect(list).toHaveLength(2);
    });

    it('AC02: should filter by task ID via related_tasks (JSON format)', () => {
      model.create(runId, makeScenario({ title: 'Task1 Scenario', related_tasks: JSON.stringify(['task-1', 'task-2']), source: 'seed' }));
      model.create(runId, makeScenario({ title: 'Task3 Scenario', related_tasks: JSON.stringify(['task-3']), source: 'seed' }));

      const list = model.listByPlan('test-plan', { taskId: 'task-1' });
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Task1 Scenario');
    });

    it('AC02: should not false-positive match task-1 against task-10', () => {
      model.create(runId, makeScenario({ title: 'Task10 Scenario', related_tasks: JSON.stringify(['task-10']), source: 'seed' }));

      const list = model.listByPlan('test-plan', { taskId: 'task-1' });
      expect(list).toHaveLength(0);
    });

    it('AC03: should filter by source', () => {
      model.create(runId, makeScenario({ title: 'Seed', source: 'seed' }));
      model.create(runId, makeScenario({ title: 'Final', source: 'final' }));

      const list = model.listByPlan('test-plan', { source: 'seed' });
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Seed');
    });

    it('AC04: should return empty for non-existent plan', () => {
      const list = model.listByPlan('non-existent-plan');
      expect(list).toHaveLength(0);
    });
  });

  describe('getStatsByRun', () => {
    it('AC03: should return stats grouped by category', () => {
      const s1 = model.create(runId, makeScenario({ category: 'functional' }));
      const s2 = model.create(runId, makeScenario({ category: 'functional' }));
      const s3 = model.create(runId, makeScenario({ category: 'integration' }));

      model.updateStatus(s1.id, 'pass');
      model.updateStatus(s2.id, 'fail');
      model.updateStatus(s3.id, 'pass');

      const stats = model.getStatsByRun(runId);
      expect(stats).toHaveLength(2);

      const functional = stats.find(s => s.category === 'functional')!;
      expect(functional.total).toBe(2);
      expect(functional.passed).toBe(1);
      expect(functional.failed).toBe(1);

      const integration = stats.find(s => s.category === 'integration')!;
      expect(integration.total).toBe(1);
      expect(integration.passed).toBe(1);
      expect(integration.failed).toBe(0);
    });

    it('AC03: should return empty for run with no scenarios', () => {
      const stats = model.getStatsByRun(runId);
      expect(stats).toHaveLength(0);
    });
  });
});
