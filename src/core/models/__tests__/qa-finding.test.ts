import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { QARunModel } from '../qa-run.js';
import { QAScenarioModel } from '../qa-scenario.js';
import { QAFindingModel } from '../qa-finding.js';
import type Database from 'better-sqlite3';
import type { NewQAFinding } from '../../types.js';

describe('QAFindingModel', () => {
  let db: Database.Database;
  let runModel: QARunModel;
  let scenarioModel: QAScenarioModel;
  let model: QAFindingModel;
  let runId: string;
  let scenarioId: string;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan',
      'Test Plan',
      'active',
    );
    runModel = new QARunModel(db);
    scenarioModel = new QAScenarioModel(db);
    model = new QAFindingModel(db);

    const run = runModel.create('test-plan', 'manual');
    runId = run.id;
    const scenario = scenarioModel.create(runId, {
      category: 'functional',
      title: 'Test Scenario',
      description: 'Desc',
      priority: 'medium',
    });
    scenarioId = scenario.id;
  });

  const makeFinding = (overrides?: Partial<NewQAFinding>): NewQAFinding => ({
    scenario_id: scenarioId,
    severity: 'high',
    category: 'bug',
    title: 'Test Finding',
    description: 'A test finding description',
    ...overrides,
  });

  describe('create', () => {
    it('AC01: should create a finding with correct defaults', () => {
      const finding = model.create(runId, makeFinding());

      expect(finding.id).toHaveLength(12);
      expect(finding.run_id).toBe(runId);
      expect(finding.scenario_id).toBe(scenarioId);
      expect(finding.severity).toBe('high');
      expect(finding.category).toBe('bug');
      expect(finding.title).toBe('Test Finding');
      expect(finding.description).toBe('A test finding description');
      expect(finding.status).toBe('open');
      expect(finding.affected_files).toBeNull();
      expect(finding.related_task_id).toBeNull();
      expect(finding.fix_suggestion).toBeNull();
      expect(finding.fix_plan_id).toBeNull();
      expect(finding.created_at).toBeTruthy();
    });

    it('AC01: should create a finding with optional fields', () => {
      const finding = model.create(runId, makeFinding({
        affected_files: 'src/foo.ts',
        fix_suggestion: 'Fix the bug',
      }));

      expect(finding.affected_files).toBe('src/foo.ts');
      expect(finding.fix_suggestion).toBe('Fix the bug');
    });

    it('AC01: should create a finding without scenario_id', () => {
      const finding = model.create(runId, makeFinding({ scenario_id: undefined }));
      expect(finding.scenario_id).toBeNull();
    });
  });

  describe('get', () => {
    it('AC01: should return a finding by id', () => {
      const created = model.create(runId, makeFinding());
      const fetched = model.get(created.id);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
    });

    it('AC01: should return null for non-existent id', () => {
      expect(model.get('non-existent')).toBeNull();
    });
  });

  describe('list', () => {
    it('AC01: should list all findings with no filters', () => {
      model.create(runId, makeFinding());
      model.create(runId, makeFinding({ title: 'Another' }));

      const findings = model.list();
      expect(findings).toHaveLength(2);
    });

    it('AC01: should filter by runId', () => {
      const run2 = runModel.create('test-plan', 'auto');
      model.create(runId, makeFinding());
      model.create(run2.id, makeFinding({ title: 'Other run finding' }));

      const findings = model.list({ runId });
      expect(findings).toHaveLength(1);
      expect(findings[0].run_id).toBe(runId);
    });

    it('AC01: should filter by severity', () => {
      model.create(runId, makeFinding({ severity: 'critical' }));
      model.create(runId, makeFinding({ severity: 'low' }));

      const findings = model.list({ severity: 'critical' });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
    });

    it('AC01: should filter by status', () => {
      const f1 = model.create(runId, makeFinding());
      model.create(runId, makeFinding());
      model.updateStatus(f1.id, 'fixed');

      const findings = model.list({ status: 'fixed' });
      expect(findings).toHaveLength(1);
      expect(findings[0].id).toBe(f1.id);
    });

    it('AC01: should filter by category', () => {
      model.create(runId, makeFinding({ category: 'bug' }));
      model.create(runId, makeFinding({ category: 'security' }));

      const findings = model.list({ category: 'bug' });
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('bug');
    });

    it('AC01: should combine multiple filters', () => {
      model.create(runId, makeFinding({ severity: 'critical', category: 'bug' }));
      model.create(runId, makeFinding({ severity: 'critical', category: 'security' }));
      model.create(runId, makeFinding({ severity: 'low', category: 'bug' }));

      const findings = model.list({ severity: 'critical', category: 'bug' });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].category).toBe('bug');
    });
  });

  describe('updateStatus', () => {
    it('AC03: should update status to fixed', () => {
      const finding = model.create(runId, makeFinding());
      model.updateStatus(finding.id, 'fixed');

      const fetched = model.get(finding.id)!;
      expect(fetched.status).toBe('fixed');
    });

    it('AC03: should update status to wontfix', () => {
      const finding = model.create(runId, makeFinding());
      model.updateStatus(finding.id, 'wontfix');

      const fetched = model.get(finding.id)!;
      expect(fetched.status).toBe('wontfix');
    });

    it('AC03: should update status with fix_plan_id', () => {
      // fix_plan_id references plans table, use existing plan
      const finding = model.create(runId, makeFinding());
      model.updateStatus(finding.id, 'planned', 'test-plan');

      const fetched = model.get(finding.id)!;
      expect(fetched.status).toBe('planned');
      expect(fetched.fix_plan_id).toBe('test-plan');
    });

    it('AC03: should not overwrite fix_plan_id when not provided', () => {
      const finding = model.create(runId, makeFinding());
      model.updateStatus(finding.id, 'planned', 'test-plan');
      model.updateStatus(finding.id, 'fixed');

      const fetched = model.get(finding.id)!;
      expect(fetched.status).toBe('fixed');
      expect(fetched.fix_plan_id).toBe('test-plan');
    });
  });

  describe('getOpenByPlan', () => {
    it('AC03: should return open findings for a plan', () => {
      model.create(runId, makeFinding());
      const f2 = model.create(runId, makeFinding({ title: 'Fixed one' }));
      model.updateStatus(f2.id, 'fixed');

      const open = model.getOpenByPlan('test-plan');
      expect(open).toHaveLength(1);
      expect(open[0].status).toBe('open');
    });

    it('AC03: should return empty when no open findings', () => {
      const f1 = model.create(runId, makeFinding());
      model.updateStatus(f1.id, 'fixed');

      const open = model.getOpenByPlan('test-plan');
      expect(open).toHaveLength(0);
    });
  });

  describe('getStatsByRun', () => {
    it('AC03: should return finding counts grouped by severity', () => {
      model.create(runId, makeFinding({ severity: 'critical' }));
      model.create(runId, makeFinding({ severity: 'critical' }));
      model.create(runId, makeFinding({ severity: 'high' }));
      model.create(runId, makeFinding({ severity: 'low' }));

      const stats = model.getStatsByRun(runId);
      expect(stats).toHaveLength(3);

      const critical = stats.find(s => s.severity === 'critical')!;
      expect(critical.count).toBe(2);

      const high = stats.find(s => s.severity === 'high')!;
      expect(high.count).toBe(1);

      const low = stats.find(s => s.severity === 'low')!;
      expect(low.count).toBe(1);
    });

    it('AC03: should return empty for run with no findings', () => {
      const stats = model.getStatsByRun(runId);
      expect(stats).toHaveLength(0);
    });
  });
});
