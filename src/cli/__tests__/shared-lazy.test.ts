import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll mock all the dependencies to isolate the lazy behavior
vi.mock('../../core/db/connection.js', () => ({
  getDb: vi.fn(() => ({ pragma: vi.fn(), exec: vi.fn(), prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })) })),
}));

vi.mock('../../core/db/schema.js', () => ({
  initSchema: vi.fn(),
}));

// Track construction calls
const constructorCalls: string[] = [];

function makeTrackedClass(name: string) {
  return vi.fn().mockImplementation(function (this: any) {
    constructorCalls.push(name);
    return {};
  });
}

vi.mock('../../core/models/event.js', () => ({ EventModel: makeTrackedClass('EventModel') }));
vi.mock('../../core/models/task.js', () => ({ TaskModel: makeTrackedClass('TaskModel') }));
vi.mock('../../core/models/plan.js', () => ({ PlanModel: makeTrackedClass('PlanModel') }));
vi.mock('../../core/models/context.js', () => ({ ContextModel: makeTrackedClass('ContextModel') }));
vi.mock('../../core/models/task-metrics.js', () => ({ TaskMetricsModel: makeTrackedClass('TaskMetricsModel') }));
vi.mock('../../core/models/skill-usage.js', () => ({ SkillUsageModel: makeTrackedClass('SkillUsageModel') }));
vi.mock('../../core/models/qa-run.js', () => ({ QARunModel: makeTrackedClass('QARunModel') }));
vi.mock('../../core/models/qa-scenario.js', () => ({ QAScenarioModel: makeTrackedClass('QAScenarioModel') }));
vi.mock('../../core/models/qa-finding.js', () => ({ QAFindingModel: makeTrackedClass('QAFindingModel') }));
vi.mock('../../core/models/backlog.js', () => ({ BacklogModel: makeTrackedClass('BacklogModel') }));
vi.mock('../../core/models/merge-report.js', () => ({ MergeReportModel: makeTrackedClass('MergeReportModel') }));
vi.mock('../../core/models/agent-handoff.js', () => ({ AgentHandoffModel: makeTrackedClass('AgentHandoffModel') }));
vi.mock('../../core/models/wave-gate.js', () => ({ WaveGateModel: makeTrackedClass('WaveGateModel') }));
vi.mock('../../core/models/plan-revision.js', () => ({ PlanRevisionModel: makeTrackedClass('PlanRevisionModel') }));
vi.mock('../../core/engine/dashboard.js', () => ({ DashboardEngine: makeTrackedClass('DashboardEngine') }));
vi.mock('../../core/engine/alerts.js', () => ({ AlertsEngine: makeTrackedClass('AlertsEngine') }));
vi.mock('../../core/engine/stats.js', () => ({ StatsEngine: makeTrackedClass('StatsEngine') }));
vi.mock('../../core/engine/insights.js', () => ({ InsightsEngine: makeTrackedClass('InsightsEngine') }));
vi.mock('../../core/engine/self-improve.js', () => ({ SelfImproveEngine: makeTrackedClass('SelfImproveEngine') }));
vi.mock('../../core/engine/lifecycle.js', () => ({ LifecycleEngine: makeTrackedClass('LifecycleEngine') }));

describe('initModels lazy getter', () => {
  beforeEach(() => {
    constructorCalls.length = 0;
  });

  it('AC01: initModels should return an object where non-events models are lazily instantiated', async () => {
    const { initModels } = await import('../shared.js');
    constructorCalls.length = 0;

    const models = initModels();

    // Before accessing any property (besides events), only EventModel should be constructed
    const eagersOnly = constructorCalls.filter(name => name !== 'EventModel');
    expect(eagersOnly).toHaveLength(0);

    // Accessing a lazy property should trigger its construction
    void models.planModel;
    expect(constructorCalls).toContain('PlanModel');
  });

  it('AC02: events should be eagerly created on initModels() call', async () => {
    const { initModels } = await import('../shared.js');
    constructorCalls.length = 0;

    initModels();

    expect(constructorCalls).toContain('EventModel');
  });

  it('AC03: Models type should expose all the same property keys as before', async () => {
    const { initModels } = await import('../shared.js');
    const models = initModels();

    const expectedKeys = [
      'db', 'events', 'planModel', 'taskModel', 'contextModel',
      'taskMetricsModel', 'skillUsageModel', 'lifecycle', 'dashboard',
      'alerts', 'stats', 'insights', 'qaRunModel', 'qaScenarioModel',
      'qaFindingModel', 'backlogModel', 'mergeReportModel',
      'agentHandoffModel', 'waveGateModel', 'planRevisionModel',
    ];

    for (const key of expectedKeys) {
      // Each key should be accessible and not throw
      expect(() => (models as any)[key]).not.toThrow();
    }
  });

  it('AC01: lazy getter should only instantiate a model once (memoize)', async () => {
    const { initModels } = await import('../shared.js');
    constructorCalls.length = 0;

    const models = initModels();

    void models.stats;
    void models.stats;
    void models.stats;

    const statsCount = constructorCalls.filter(n => n === 'StatsEngine').length;
    expect(statsCount).toBe(1);
  });

  it('AC04: CLI commands that destructure initModels() result should still work', async () => {
    const { initModels } = await import('../shared.js');
    const models = initModels();

    // Simulate what CLI commands do: destructure specific models
    const { planModel, taskModel, events } = models;
    expect(planModel).toBeDefined();
    expect(taskModel).toBeDefined();
    expect(events).toBeDefined();
  });
});
