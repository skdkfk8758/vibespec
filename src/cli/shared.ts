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
import { ContextModel } from '../core/models/context.js';
import { TaskMetricsModel } from '../core/models/task-metrics.js';
import { SkillUsageModel } from '../core/models/skill-usage.js';
import { QARunModel } from '../core/models/qa-run.js';
import { QAScenarioModel } from '../core/models/qa-scenario.js';
import { QAFindingModel } from '../core/models/qa-finding.js';
import { BacklogModel } from '../core/models/backlog.js';
import { MergeReportModel } from '../core/models/merge-report.js';
import { LifecycleEngine } from '../core/engine/lifecycle.js';

let jsonMode = false;

export function setJsonMode(mode: boolean) {
  jsonMode = mode;
}

export function getJsonMode(): boolean {
  return jsonMode;
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
    outputError(e instanceof Error ? e.message : String(e));
  }
}

export function initModels() {
  const db = getDb();
  initSchema(db);
  const events = new EventModel(db);
  const planModel = new PlanModel(db, events);
  const taskModel = new TaskModel(db, events);
  const contextModel = new ContextModel(db);
  const taskMetricsModel = new TaskMetricsModel(db);
  const skillUsageModel = new SkillUsageModel(db);
  const lifecycle = new LifecycleEngine(db, planModel, taskModel, events);
  const dashboard = new DashboardEngine(db, skillUsageModel);
  const alerts = new AlertsEngine(db);
  const stats = new StatsEngine(db);
  const insights = new InsightsEngine(db);
  const qaRunModel = new QARunModel(db);
  const qaScenarioModel = new QAScenarioModel(db);
  const qaFindingModel = new QAFindingModel(db);
  const backlogModel = new BacklogModel(db, events);
  const mergeReportModel = new MergeReportModel(db);
  return { db, events, planModel, taskModel, contextModel, taskMetricsModel, skillUsageModel, lifecycle, dashboard, alerts, stats, insights, qaRunModel, qaScenarioModel, qaFindingModel, backlogModel, mergeReportModel };
}

export type Models = ReturnType<typeof initModels>;

/** Lightweight DB init without model allocation — for pure config read/write commands */
export function initDb() {
  const db = getDb();
  initSchema(db);
  return db;
}
