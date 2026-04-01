import { getDb } from '../core/db/connection.js';
import { initSchema } from '../core/db/schema.js';
import { DashboardEngine } from '../core/engine/dashboard.js';
import { AlertsEngine } from '../core/engine/alerts.js';
import { StatsEngine } from '../core/engine/stats.js';
import { InsightsEngine } from '../core/engine/insights.js';
import { SelfImproveEngine } from '../core/engine/self-improve.js';
import { TaskModel } from '../core/models/task.js';
import { EventModel } from '../core/models/event.js';
import { PlanModel } from '../core/models/plan.js';
import { TaskMetricsModel } from '../core/models/task-metrics.js';
import { SkillUsageModel } from '../core/models/skill-usage.js';
import { QARunModel } from '../core/models/qa-run.js';
import { QAScenarioModel } from '../core/models/qa-scenario.js';
import { QAFindingModel } from '../core/models/qa-finding.js';
import { BacklogModel } from '../core/models/backlog.js';
import { MergeReportModel } from '../core/models/merge-report.js';
import { AgentHandoffModel } from '../core/models/agent-handoff.js';
import { WaveGateModel } from '../core/models/wave-gate.js';
import { PlanRevisionModel } from '../core/models/plan-revision.js';
import { LifecycleEngine } from '../core/engine/lifecycle.js';

let jsonMode = false;

export function setJsonMode(mode: boolean) {
  jsonMode = mode;
}

export function getJsonMode(): boolean {
  return jsonMode;
}

let verboseMode = false;

export function setVerboseMode(mode: boolean): void {
  verboseMode = mode;
}

export function getVerboseMode(): boolean {
  return verboseMode;
}

export function output(data: unknown, formatted?: string) {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatted ?? JSON.stringify(data, null, 2));
  }
}

export function outputError(message: string): never {
  if (jsonMode) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error(message);
  }
  process.exit(1);
}

export function withErrorHandler(fn: () => void): void {
  try {
    fn();
  } catch (e: unknown) {
    if (verboseMode && e instanceof Error && e.stack) {
      console.error(e.stack);
    }
    outputError(e instanceof Error ? e.message : String(e));
  }
}

export function initModels() {
  const db = getDb();
  initSchema(db);

  // events is eager — required by multiple models and prevents circular dependency issues
  const events = new EventModel(db);

  // Helper: define a lazy getter that instantiates on first access, then caches
  const cache = new Map<string, unknown>();
  function lazy<T>(name: string, factory: () => T): { get: () => T } {
    return {
      get() {
        if (!cache.has(name)) cache.set(name, factory());
        return cache.get(name) as T;
      },
    };
  }

  const lazyAgentHandoff = lazy('agentHandoffModel', () => new AgentHandoffModel(db));
  const lazyPlan = lazy('planModel', () => new PlanModel(db, events, lazyAgentHandoff.get()));
  const lazyTask = lazy('taskModel', () => new TaskModel(db, events));
  const lazyTaskMetrics = lazy('taskMetricsModel', () => new TaskMetricsModel(db));
  const lazySkillUsage = lazy('skillUsageModel', () => new SkillUsageModel(db));
  const lazyLifecycle = lazy('lifecycle', () => new LifecycleEngine(db, lazyPlan.get(), lazyTask.get(), events));
  const lazyDashboard = lazy('dashboard', () => new DashboardEngine(db, lazySkillUsage.get()));
  const lazyAlerts = lazy('alerts', () => new AlertsEngine(db));
  const lazyStats = lazy('stats', () => new StatsEngine(db));
  const lazyInsights = lazy('insights', () => new InsightsEngine(db));
  const lazyQaRun = lazy('qaRunModel', () => new QARunModel(db));
  const lazyQaScenario = lazy('qaScenarioModel', () => new QAScenarioModel(db));
  const lazyQaFinding = lazy('qaFindingModel', () => new QAFindingModel(db));
  const lazyBacklog = lazy('backlogModel', () => new BacklogModel(db, events));
  const lazyMergeReport = lazy('mergeReportModel', () => new MergeReportModel(db));
  const lazyWaveGate = lazy('waveGateModel', () => new WaveGateModel(db));
  const lazyPlanRevision = lazy('planRevisionModel', () => new PlanRevisionModel(db));

  return {
    db,
    events,
    get planModel() { return lazyPlan.get(); },
    get taskModel() { return lazyTask.get(); },
    get taskMetricsModel() { return lazyTaskMetrics.get(); },
    get skillUsageModel() { return lazySkillUsage.get(); },
    get lifecycle() { return lazyLifecycle.get(); },
    get dashboard() { return lazyDashboard.get(); },
    get alerts() { return lazyAlerts.get(); },
    get stats() { return lazyStats.get(); },
    get insights() { return lazyInsights.get(); },
    get qaRunModel() { return lazyQaRun.get(); },
    get qaScenarioModel() { return lazyQaScenario.get(); },
    get qaFindingModel() { return lazyQaFinding.get(); },
    get backlogModel() { return lazyBacklog.get(); },
    get mergeReportModel() { return lazyMergeReport.get(); },
    get agentHandoffModel() { return lazyAgentHandoff.get(); },
    get waveGateModel() { return lazyWaveGate.get(); },
    get planRevisionModel() { return lazyPlanRevision.get(); },
  };
}

export type Models = ReturnType<typeof initModels>;

/** Lightweight DB init without model allocation — for pure config read/write commands */
export function initDb() {
  const db = getDb();
  initSchema(db);
  return db;
}
