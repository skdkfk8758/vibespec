import { Command } from 'commander';
import { createRequire } from 'node:module';
import { getDb, findProjectRoot } from '../core/db/connection.js';
import { initSchema } from '../core/db/schema.js';
import { DashboardEngine } from '../core/engine/dashboard.js';
import { AlertsEngine } from '../core/engine/alerts.js';
import { StatsEngine } from '../core/engine/stats.js';
import { InsightsEngine } from '../core/engine/insights.js';
import { ErrorKBEngine } from '../core/engine/error-kb.js';
import { getConfig, setConfig, deleteConfig, listConfig } from '../core/config.js';
import { TaskModel } from '../core/models/task.js';
import { EventModel } from '../core/models/event.js';
import { PlanModel } from '../core/models/plan.js';
import { ContextModel } from '../core/models/context.js';
import { TaskMetricsModel } from '../core/models/task-metrics.js';
import { SkillUsageModel } from '../core/models/skill-usage.js';
import { LifecycleEngine } from '../core/engine/lifecycle.js';
import { formatDashboard, formatStats, formatHistory, formatPlanTree, formatPlanList, formatErrorSearchResults, formatErrorDetail, formatErrorKBStats, formatSkillUsage } from './formatters.js';
import type { TaskStatus, PlanStatus, ErrorSeverity } from '../core/types.js';
import { VALID_PLAN_STATUSES } from '../core/types.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

let jsonMode = false;

function output(data: unknown, formatted?: string) {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatted ?? JSON.stringify(data, null, 2));
  }
}

function outputError(message: string) {
  if (jsonMode) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error(message);
  }
  process.exit(1);
}

function withErrorHandler(fn: () => void): void {
  try {
    fn();
  } catch (e: unknown) {
    outputError(e instanceof Error ? e.message : String(e));
  }
}

function initModels() {
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
  return { db, events, planModel, taskModel, contextModel, taskMetricsModel, skillUsageModel, lifecycle, dashboard, alerts, stats, insights };
}

const program = new Command();
program
  .name('vp')
  .description('VibeSpec CLI')
  .version(pkg.version)
  .option('--json', 'Output in JSON format')
  .hook('preAction', () => {
    jsonMode = program.opts().json === true;
  });

// ── dashboard ──────────────────────────────────────────────────────────

program
  .command('dashboard')
  .description('Show all active plans overview')
  .action(() => {
    const { dashboard, alerts } = initModels();
    const overview = dashboard.getOverview();
    const alertList = alerts.getAlerts();
    const skillUsage = dashboard.getSkillUsageSummary(7);
    const dashboardText = formatDashboard(overview, alertList);
    const skillText = formatSkillUsage(skillUsage);
    const combined = skillText ? `${dashboardText}\n\n${skillText}` : dashboardText;
    output({ overview, alerts: alertList, skill_usage: skillUsage }, combined);
  });

// ── plan ───────────────────────────────────────────────────────────────

const plan = program.command('plan').description('Manage plans');

plan
  .command('list')
  .option('--status <status>', 'Filter by status (draft, active, approved, completed, archived)')
  .option('--branch <branch>', 'Filter by branch')
  .description('List plans')
  .action((opts: { status?: string; branch?: string }) => {
    const { planModel } = initModels();
    const filter: { status?: PlanStatus; branch?: string } = {};
    if (opts.status) {
      if (!VALID_PLAN_STATUSES.includes(opts.status as PlanStatus)) {
        return outputError(`Invalid status. Must be: ${VALID_PLAN_STATUSES.join(', ')}`);
      }
      filter.status = opts.status as PlanStatus;
    }
    if (opts.branch) filter.branch = opts.branch;
    const plans = planModel.list(Object.keys(filter).length > 0 ? filter : undefined);
    output(plans, formatPlanList(plans));
  });

plan
  .command('show')
  .argument('<id>', 'Plan ID')
  .description('Show plan details with task tree and waves')
  .action((id: string) => {
    const { planModel, taskModel } = initModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const tree = taskModel.getTree(id);
    const waves = taskModel.getWaves(id);
    output({ plan: p, tasks: tree, waves }, formatPlanTree(p, tree));
  });

plan
  .command('create')
  .requiredOption('--title <title>', 'Plan title')
  .option('--spec <spec>', 'Plan specification')
  .option('--summary <summary>', 'Plan summary')
  .description('Create a new plan and activate it')
  .action((opts: { title: string; spec?: string; summary?: string }) => {
    const { planModel } = initModels();
    const created = planModel.create(opts.title, opts.spec, opts.summary);
    const activated = planModel.activate(created.id);
    output(activated, `Created plan: ${activated.id} "${activated.title}" (${activated.status})`);
  });

plan
  .command('complete')
  .argument('<id>', 'Plan ID')
  .description('Complete a plan')
  .action((id: string) => {
    withErrorHandler(() => {
      const { lifecycle } = initModels();
      const completed = lifecycle.completePlan(id);
      output(completed, `Plan completed: ${completed.id} "${completed.title}"`);
    });
  });

plan
  .command('approve')
  .argument('<id>', 'Plan ID')
  .description('Approve a plan (active → approved)')
  .action((id: string) => {
    withErrorHandler(() => {
      const { planModel } = initModels();
      const approved = planModel.approve(id);
      output(approved, `Plan approved: ${approved.id} "${approved.title}"`);
    });
  });

plan
  .command('archive')
  .argument('<id>', 'Plan ID')
  .description('Archive a plan')
  .action((id: string) => {
    const { planModel } = initModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const archived = planModel.archive(id);
    output(archived, `Plan archived: ${archived.id} "${archived.title}"`);
  });

plan
  .command('update')
  .argument('<id>', 'Plan ID')
  .option('--title <title>', 'New title')
  .option('--spec <spec>', 'New spec')
  .option('--summary <summary>', 'New summary')
  .description('Update plan title, spec, or summary')
  .action((id: string, opts: { title?: string; spec?: string; summary?: string }) => {
    const { planModel } = initModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const updated = planModel.update(id, opts);
    output(updated, `Plan updated: ${updated.id} "${updated.title}"`);
  });

plan
  .command('delete')
  .argument('<id>', 'Plan ID')
  .description('Delete a draft plan and all its tasks')
  .action((id: string) => {
    withErrorHandler(() => {
      const { planModel } = initModels();
      planModel.delete(id);
      output({ deleted: true, plan_id: id }, `Plan deleted: ${id}`);
    });
  });

// ── task ───────────────────────────────────────────────────────────────

const task = program.command('task').description('Manage tasks');

task
  .command('create')
  .requiredOption('--plan <plan_id>', 'Plan ID')
  .requiredOption('--title <title>', 'Task title')
  .option('--parent <parent_id>', 'Parent task ID for subtasks')
  .option('--spec <spec>', 'Task specification')
  .option('--acceptance <acceptance>', 'Acceptance criteria')
  .option('--depends-on <ids>', 'Comma-separated task IDs this task depends on')
  .option('--allowed-files <files>', 'Comma-separated list of allowed files')
  .option('--forbidden-patterns <patterns>', 'Comma-separated list of forbidden patterns')
  .description('Create a new task')
  .action((opts: { plan: string; title: string; parent?: string; spec?: string; acceptance?: string; dependsOn?: string; allowedFiles?: string; forbiddenPatterns?: string }) => {
    withErrorHandler(() => {
      const { taskModel } = initModels();
      const dependsOn = opts.dependsOn ? opts.dependsOn.split(',').map(s => s.trim()) : undefined;
      const allowedFiles = opts.allowedFiles ? opts.allowedFiles.split(',').map(s => s.trim()) : undefined;
      const forbiddenPatterns = opts.forbiddenPatterns ? opts.forbiddenPatterns.split(',').map(s => s.trim()) : undefined;
      const created = taskModel.create(opts.plan, opts.title, {
        parentId: opts.parent,
        spec: opts.spec,
        acceptance: opts.acceptance,
        dependsOn,
        allowedFiles,
        forbiddenPatterns,
      });
      output(created, `Created task: ${created.id} "${created.title}" (${created.status})`);
    });
  });

task
  .command('update')
  .argument('<id>', 'Task ID')
  .argument('<status>', 'New status (todo, in_progress, done, blocked, skipped)')
  .option('--impl-status <status>', 'Implementation status (DONE, DONE_WITH_CONCERNS, BLOCKED)')
  .option('--test-count <count>', 'Number of tests written')
  .option('--files-changed <count>', 'Number of files changed')
  .option('--has-concerns', 'Whether there are concerns')
  .option('--changed-files-detail <json>', 'JSON string of changed files detail')
  .option('--scope-violations <json>', 'JSON string of scope violations')
  .description('Update task status with optional metrics')
  .action((id: string, status: string, opts: { implStatus?: string; testCount?: string; filesChanged?: string; hasConcerns?: boolean; changedFilesDetail?: string; scopeViolations?: string }) => {
    const VALID: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked', 'skipped'];
    if (!VALID.includes(status as TaskStatus)) {
      return outputError(`Invalid status. Must be: ${VALID.join(', ')}`);
    }
    const { taskModel, taskMetricsModel, lifecycle } = initModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);

    const updated = taskModel.updateStatus(id, status as TaskStatus);
    const completionCheck = lifecycle.autoCheckCompletion(updated.plan_id);

    if (['done', 'blocked', 'skipped'].includes(status)) {
      try {
        const metrics: Record<string, unknown> = {};
        if (opts.implStatus) metrics.impl_status = opts.implStatus;
        if (opts.testCount) metrics.test_count = parseInt(opts.testCount, 10);
        if (opts.filesChanged) metrics.files_changed = parseInt(opts.filesChanged, 10);
        if (opts.hasConcerns) metrics.has_concerns = true;
        if (opts.changedFilesDetail) metrics.changed_files_detail = opts.changedFilesDetail;
        if (opts.scopeViolations) metrics.scope_violations = opts.scopeViolations;
        taskMetricsModel.record(id, updated.plan_id, status, Object.keys(metrics).length > 0 ? metrics as any : undefined);
      } catch {
        // Metrics recording is non-blocking
      }
    }

    output(
      { task: updated, completion_check: completionCheck },
      `Task ${updated.id}: ${updated.title} → ${updated.status}`,
    );
  });

task
  .command('next')
  .argument('<plan_id>', 'Plan ID')
  .description('Get the next pending task')
  .action((planId: string) => {
    const { taskModel } = initModels();
    const next = taskModel.getNextAvailable(planId);
    if (!next) {
      output(
        { message: 'No pending tasks', hint: 'All tasks are done or blocked. Use vs plan complete to finish the plan.' },
        'No pending tasks.',
      );
      return;
    }
    output(next, [
      `Next: ${next.id} "${next.title}"`,
      next.spec ? `Spec: ${next.spec}` : '',
      next.acceptance ? `Acceptance: ${next.acceptance}` : '',
    ].filter(Boolean).join('\n'));
  });

task
  .command('show')
  .argument('<id>', 'Task ID')
  .description('Show task details')
  .action((id: string) => {
    const { taskModel } = initModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);
    output(t, [
      `ID:         ${t.id}`,
      `Title:      ${t.title}`,
      `Status:     ${t.status}`,
      `Plan:       ${t.plan_id}`,
      `Depth:      ${t.depth}`,
      t.spec ? `Spec:       ${t.spec}` : '',
      t.acceptance ? `Acceptance: ${t.acceptance}` : '',
      t.allowed_files ? `Allowed:    ${t.allowed_files}` : '',
      t.forbidden_patterns ? `Forbidden:  ${t.forbidden_patterns}` : '',
      `Created:    ${t.created_at}`,
      t.completed_at ? `Completed:  ${t.completed_at}` : '',
    ].filter(Boolean).join('\n'));
  });

task
  .command('block')
  .argument('<id>', 'Task ID')
  .option('--reason <reason>', 'Reason for blocking')
  .description('Mark a task as blocked')
  .action((id: string, opts: { reason?: string }) => {
    const { taskModel, events } = initModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);
    const blocked = taskModel.updateStatus(id, 'blocked');
    if (opts.reason) {
      events.record('task', id, 'blocked_reason', null, JSON.stringify({ reason: opts.reason }));
    }
    output(
      { ...blocked, block_reason: opts.reason ?? null },
      `Task blocked: ${blocked.id} "${blocked.title}"${opts.reason ? ` (reason: ${opts.reason})` : ''}`,
    );
  });

task
  .command('edit')
  .argument('<id>', 'Task ID')
  .option('--title <title>', 'New title')
  .option('--spec <spec>', 'New spec')
  .option('--acceptance <acceptance>', 'New acceptance criteria')
  .option('--allowed-files <files>', 'Comma-separated list of allowed files')
  .option('--forbidden-patterns <patterns>', 'Comma-separated list of forbidden patterns')
  .description('Edit task title, spec, acceptance, or scope')
  .action((id: string, opts: { title?: string; spec?: string; acceptance?: string; allowedFiles?: string; forbiddenPatterns?: string }) => {
    const { taskModel } = initModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);
    const fields: Record<string, unknown> = {};
    if (opts.title !== undefined) fields.title = opts.title;
    if (opts.spec !== undefined) fields.spec = opts.spec;
    if (opts.acceptance !== undefined) fields.acceptance = opts.acceptance;
    if (opts.allowedFiles !== undefined) {
      fields.allowed_files = JSON.stringify(opts.allowedFiles.split(',').map(s => s.trim()));
    }
    if (opts.forbiddenPatterns !== undefined) {
      fields.forbidden_patterns = JSON.stringify(opts.forbiddenPatterns.split(',').map(s => s.trim()));
    }
    const edited = taskModel.update(id, fields as any);
    output(edited, `Task edited: ${edited.id} "${edited.title}"`);
  });

task
  .command('delete')
  .argument('<id>', 'Task ID')
  .description('Delete a task and its subtasks')
  .action((id: string) => {
    const { taskModel } = initModels();
    withErrorHandler(() => {
      taskModel.delete(id);
      output({ deleted: true, task_id: id }, `Task deleted: ${id}`);
    });
  });

// ── context ────────────────────────────────────────────────────────────

const context = program.command('context').description('Manage session context');

context
  .command('resume')
  .option('--session-id <id>', 'Optional session ID to filter')
  .description('Resume context from previous sessions')
  .action((opts: { sessionId?: string }) => {
    const { contextModel, dashboard, alerts } = initModels();
    const contextLogs = opts.sessionId
      ? [contextModel.getBySession(opts.sessionId)].filter(Boolean)
      : contextModel.getLatest(3);
    const overview = dashboard.getOverview();
    const alertList = alerts.getAlerts();
    output({ context_logs: contextLogs, overview, alerts: alertList });
  });

context
  .command('save')
  .requiredOption('--summary <summary>', 'Summary of context to save')
  .option('--plan-id <id>', 'Plan ID to link context to')
  .option('--session-id <id>', 'Session ID')
  .description('Save a context log entry')
  .action((opts: { summary: string; planId?: string; sessionId?: string }) => {
    const { contextModel } = initModels();
    const log = contextModel.save(opts.summary, {
      planId: opts.planId,
      sessionId: opts.sessionId,
    });
    output(log, `Context saved: ${log.id} "${log.summary.slice(0, 50)}..."`);
  });

// ── stats ──────────────────────────────────────────────────────────────

program
  .command('stats')
  .argument('[plan_id]', 'Optional plan ID')
  .description('Show velocity and estimates')
  .action((planId?: string) => {
    const { stats } = initModels();
    const velocity = stats.getVelocity(planId);
    const estimate = planId ? stats.getEstimatedCompletion(planId) : undefined;
    const timeline = stats.getTimeline(planId);
    output(
      { velocity, ...(estimate ? { estimated_completion: estimate } : {}), ...(timeline.length > 0 ? { timeline } : {}) },
      formatStats(velocity, estimate, timeline.length > 0 ? timeline : undefined),
    );
  });

// ── history ────────────────────────────────────────────────────────────

program
  .command('history')
  .argument('<type>', 'Entity type (plan, task)')
  .argument('<id>', 'Entity ID')
  .description('Show change history')
  .action((type: string, id: string) => {
    const validTypes = ['plan', 'task'];
    if (!validTypes.includes(type)) {
      return outputError(`Invalid entity type. Must be: ${validTypes.join(', ')}`);
    }
    const { events } = initModels();
    const eventList = events.getByEntity(type as 'plan' | 'task', id);
    output(eventList, formatHistory(eventList));
  });

// ── insights ───────────────────────────────────────────────────────────

program
  .command('insights')
  .option('--scope <scope>', 'Scope: blocked_patterns, duration_stats, success_rates, all (default: all)')
  .description('Get learning insights from task history')
  .action((opts: { scope?: string }) => {
    const { insights } = initModels();
    const validScopes = ['blocked_patterns', 'duration_stats', 'success_rates', 'all'];
    const scope = opts.scope && validScopes.includes(opts.scope) ? opts.scope : 'all';

    const result: Record<string, unknown> = {};
    if (scope === 'all' || scope === 'blocked_patterns') {
      result.blocked_patterns = insights.getBlockedPatterns();
    }
    if (scope === 'all' || scope === 'duration_stats') {
      result.duration_stats = insights.getDurationStats();
    }
    if (scope === 'all' || scope === 'success_rates') {
      result.success_rates = insights.getSuccessRates();
    }
    if (scope === 'all') {
      result.recommendations = insights.getRecommendations();
      result.confidence = insights.getConfidenceLevel();
    }

    output(result);
  });

// ── config ────────────────────────────────────────────────────────────

const config = program.command('config').description('Manage configuration');

config
  .command('set')
  .argument('<key>', 'Config key')
  .argument('<value>', 'Config value')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    const db = getDb();
    initSchema(db);
    setConfig(db, key, value);
    output({ key, value }, `${key} = ${value}`);
  });

config
  .command('get')
  .argument('<key>', 'Config key')
  .description('Get a configuration value')
  .action((key: string) => {
    const db = getDb();
    initSchema(db);
    const value = getConfig(db, key);
    if (value === null) return outputError(`Config not found: ${key}`);
    output({ key, value }, `${key} = ${value}`);
  });

config
  .command('list')
  .description('List all configuration values')
  .action(() => {
    const db = getDb();
    initSchema(db);
    const items = listConfig(db);
    if (items.length === 0) {
      output(items, 'No configuration values set.');
      return;
    }
    const formatted = items.map(i => `${i.key} = ${i.value}`).join('\n');
    output(items, formatted);
  });

config
  .command('delete')
  .argument('<key>', 'Config key')
  .description('Delete a configuration value')
  .action((key: string) => {
    const db = getDb();
    initSchema(db);
    deleteConfig(db, key);
    output({ deleted: true, key }, `Deleted: ${key}`);
  });

// ── error-kb ──────────────────────────────────────────────────────────

const errorKb = program.command('error-kb').description('Manage error knowledge base');

function getErrorKBEngine(): ErrorKBEngine {
  const root = findProjectRoot(process.cwd());
  return new ErrorKBEngine(root);
}

errorKb
  .command('search')
  .argument('<query>', 'Search query')
  .option('--tag <tag>', 'Filter by tag')
  .option('--severity <level>', 'Filter by severity (critical, high, medium, low)')
  .description('Search error knowledge base')
  .action((query: string, opts: { tag?: string; severity?: string }) => {
    const engine = getErrorKBEngine();
    const searchOpts: { tags?: string[]; severity?: ErrorSeverity } = {};
    if (opts.tag) searchOpts.tags = [opts.tag];
    if (opts.severity) searchOpts.severity = opts.severity as ErrorSeverity;

    const results = engine.search(query, searchOpts);
    output(results, formatErrorSearchResults(results));
  });

errorKb
  .command('add')
  .requiredOption('--title <title>', 'Error title')
  .requiredOption('--cause <cause>', 'Error cause')
  .requiredOption('--solution <solution>', 'Error solution')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--severity <level>', 'Severity level (critical, high, medium, low)', 'medium')
  .description('Add a new error entry')
  .action((opts: { title: string; cause: string; solution: string; tags?: string; severity: string }) => {
    const engine = getErrorKBEngine();
    const tags = opts.tags ? opts.tags.split(',').map(t => t.trim()) : [];
    const entry = engine.add({
      title: opts.title,
      cause: opts.cause,
      solution: opts.solution,
      tags,
      severity: opts.severity as ErrorSeverity,
    });
    output(entry, `Created error: ${entry.id}\nTitle: ${entry.title}\nFile: .claude/error-kb/errors/${entry.id}.md`);
  });

errorKb
  .command('show')
  .argument('<id>', 'Error ID')
  .description('Show error entry details')
  .action((id: string) => {
    const engine = getErrorKBEngine();
    const entry = engine.show(id);
    if (!entry) return outputError(`Error not found: ${id}`);
    output(entry, formatErrorDetail(entry));
  });

errorKb
  .command('update')
  .argument('<id>', 'Error ID')
  .option('--occurrence <context>', 'Record a new occurrence with context')
  .option('--status <status>', 'Update status (open, resolved, recurring, wontfix)')
  .option('--severity <level>', 'Update severity (critical, high, medium, low)')
  .description('Update an error entry or record occurrence')
  .action((id: string, opts: { occurrence?: string; status?: string; severity?: string }) => {
    const engine = getErrorKBEngine();
    const existing = engine.show(id);
    if (!existing) return outputError(`Error not found: ${id}`);

    if (opts.occurrence) {
      engine.recordOccurrence(id, opts.occurrence);
      const updated = engine.show(id);
      output(updated, `Recorded occurrence for ${id}: ${opts.occurrence}`);
    } else {
      const patch: Record<string, unknown> = {};
      if (opts.status) patch.status = opts.status;
      if (opts.severity) patch.severity = opts.severity;
      engine.update(id, patch as any);
      const updated = engine.show(id);
      output(updated, `Updated error: ${id}`);
    }
  });

errorKb
  .command('stats')
  .description('Show error knowledge base statistics')
  .action(() => {
    const engine = getErrorKBEngine();
    const stats = engine.getStats();
    output(stats, formatErrorKBStats(stats));
  });

errorKb
  .command('delete')
  .argument('<id>', 'Error ID')
  .description('Delete an error entry')
  .action((id: string) => {
    const engine = getErrorKBEngine();
    const deleted = engine.delete(id);
    if (!deleted) return outputError(`Error not found: ${id}`);
    output({ deleted: true, error_id: id }, `Error deleted: ${id}`);
  });

// ── skill-log ─────────────────────────────────────────────────────────

program
  .command('skill-log')
  .argument('<name>', 'Skill name to record')
  .option('--plan-id <id>', 'Plan ID to associate')
  .option('--session-id <id>', 'Session ID to associate')
  .description('Record a skill usage')
  .action((name: string, opts: { planId?: string; sessionId?: string }) => {
    const { skillUsageModel } = initModels();
    const record = skillUsageModel.record(name, {
      planId: opts.planId,
      sessionId: opts.sessionId,
    });
    output(record, `Recorded skill: ${record.skill_name} (${record.id})`);
  });

// ── skill-stats ───────────────────────────────────────────────────────

program
  .command('skill-stats')
  .option('--days <days>', 'Filter by recent N days')
  .description('Show skill usage statistics')
  .action((opts: { days?: string }) => {
    const { skillUsageModel } = initModels();
    const days = opts.days ? parseInt(opts.days, 10) : undefined;
    const stats = skillUsageModel.getStats(days);

    if (stats.length === 0) {
      output(stats, 'No skill usage data.');
      return;
    }

    output(stats, formatSkillUsage(stats));
  });

program.parse();
