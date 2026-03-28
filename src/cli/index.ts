import { Command } from 'commander';
import { createRequire } from 'node:module';
import { getDb, findProjectRoot } from '../core/db/connection.js';
import { initSchema } from '../core/db/schema.js';
import { DashboardEngine } from '../core/engine/dashboard.js';
import { AlertsEngine } from '../core/engine/alerts.js';
import { StatsEngine } from '../core/engine/stats.js';
import { InsightsEngine } from '../core/engine/insights.js';
import { ErrorKBEngine } from '../core/engine/error-kb.js';
import { SelfImproveEngine } from '../core/engine/self-improve.js';
import { getConfig, setConfig, deleteConfig, listConfig } from '../core/config.js';
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
import { LifecycleEngine } from '../core/engine/lifecycle.js';
import { formatDashboard, formatStats, formatHistory, formatPlanTree, formatPlanList, formatErrorSearchResults, formatErrorDetail, formatErrorKBStats, formatSkillUsage, formatBacklogList, formatBacklogDetail, formatBacklogStats, formatBacklogBoard, formatImportPreview } from './formatters.js';
import { importFromGithub, importFromFile, importFromSlack } from './importers.js';
import type { TaskStatus, PlanStatus, ErrorSeverity, BacklogPriority, BacklogCategory, BacklogComplexity, BacklogStatus } from '../core/types.js';
import type { QARunTrigger, QAScenarioCategory, QAScenarioPriority, QAScenarioStatus, QAFindingSeverity, QAFindingCategory, QAFindingStatus } from '../core/types.js';
import { VALID_PLAN_STATUSES, VALID_BACKLOG_PRIORITIES, VALID_BACKLOG_CATEGORIES, VALID_BACKLOG_COMPLEXITIES, VALID_BACKLOG_STATUSES, VALID_QA_RUN_TERMINAL_STATUSES } from '../core/types.js';

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
  const qaRunModel = new QARunModel(db);
  const qaScenarioModel = new QAScenarioModel(db);
  const qaFindingModel = new QAFindingModel(db);
  const backlogModel = new BacklogModel(db, events);
  return { db, events, planModel, taskModel, contextModel, taskMetricsModel, skillUsageModel, lifecycle, dashboard, alerts, stats, insights, qaRunModel, qaScenarioModel, qaFindingModel, backlogModel };
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
  .command('edit')
  .argument('<id>', 'Plan ID')
  .option('--title <title>', 'New title')
  .option('--spec <spec>', 'Replace spec')
  .option('--append-spec <text>', 'Append text to existing spec')
  .option('--summary <summary>', 'New summary')
  .description('Edit plan title, spec, or summary')
  .action((id: string, opts: { title?: string; spec?: string; appendSpec?: string; summary?: string }) => {
    const { planModel } = initModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const updates: Record<string, string> = {};
    if (opts.title) updates.title = opts.title;
    if (opts.spec) updates.spec = opts.spec;
    if (opts.appendSpec) updates.spec = (p.spec ?? '') + '\n\n' + opts.appendSpec;
    if (opts.summary) updates.summary = opts.summary;
    if (Object.keys(updates).length === 0) return outputError('No changes specified');
    const updated = planModel.update(id, updates);
    output(updated, `Plan updated: ${updated.id} "${updated.title}"`);
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
  .option('--force', 'Skip acceptance criteria validation warnings')
  .description('Create a new task')
  .action((opts: { plan: string; title: string; parent?: string; spec?: string; acceptance?: string; dependsOn?: string; allowedFiles?: string; forbiddenPatterns?: string; force?: boolean }) => {
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
      const { warnings, ...taskData } = created;
      if (warnings.length > 0 && !opts.force) {
        for (const w of warnings) {
          console.error(`⚠ AC Warning: ${w}`);
        }
      }
      if (jsonMode) {
        output({ ...taskData, warnings }, `Created task: ${created.id} "${created.title}" (${created.status})`);
      } else {
        output(taskData, `Created task: ${created.id} "${created.title}" (${created.status})`);
      }
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

context
  .command('search')
  .argument('<query>', 'Search query (tag or keyword)')
  .option('--limit <n>', 'Max results', '10')
  .description('Search context log entries by tag or keyword')
  .action((query: string, opts: { limit: string }) => {
    const { contextModel } = initModels();
    const results = contextModel.search(query);
    const limited = results.slice(0, parseInt(opts.limit, 10));
    if (limited.length === 0) {
      output([], `No context logs matching "${query}".`);
      return;
    }
    const formatted = limited.map((l: { id: number; summary: string; created_at: string }, i: number) =>
      `${i + 1}. [#${l.id}] ${l.summary.slice(0, 100)} (${l.created_at})`
    ).join('\n');
    output(limited, `## Context Search: "${query}"\n\n${formatted}`);
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

// ── careful / freeze / guard ─────────────────────────────────────────

import { resolve, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

/** Lightweight DB init without model allocation — for pure config read/write commands */
function initDb() {
  const db = getDb();
  initSchema(db);
  return db;
}

/** Register/unregister PreToolUse hooks in .claude/settings.local.json */
function manageHook(action: 'add' | 'remove', hookId: string, toolName: string, scriptPath: string) {
  const settingsDir = join(process.cwd(), '.claude');
  const settingsPath = join(settingsDir, 'settings.local.json');
  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch { settings = {}; }
  }
  if (!settings.hooks) settings.hooks = {};
  const hooks = settings.hooks as Record<string, unknown[]>;
  if (!hooks.PreToolUse) hooks.PreToolUse = [];
  const preToolUse = hooks.PreToolUse as Array<Record<string, unknown>>;

  if (action === 'add') {
    // Remove existing hook with same id before adding
    hooks.PreToolUse = preToolUse.filter((h) => h.id !== hookId);
    (hooks.PreToolUse as Array<Record<string, unknown>>).push({
      id: hookId,
      type: 'command',
      matcher: toolName,
      command: scriptPath,
    });
    // Ensure script is executable
    if (existsSync(scriptPath)) {
      try { chmodSync(scriptPath, 0o755); } catch { /* ignore */ }
    }
  } else {
    hooks.PreToolUse = preToolUse.filter((h) => h.id !== hookId);
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

const careful = program.command('careful').description('Manage careful mode (destructive command guard)');

careful
  .command('on')
  .description('Enable careful mode')
  .action(() => {
    const db = initDb();
    setConfig(db, 'careful.enabled', 'true');
    const scriptPath = join(process.cwd(), 'bin', 'check-careful.sh');
    manageHook('add', 'vs-careful', 'Bash', scriptPath);
    output({ careful: true }, '⚠️ careful 모드 활성화됨 — 파괴적 명령이 차단됩니다.');
  });

careful
  .command('off')
  .description('Disable careful mode')
  .action(() => {
    const db = initDb();
    setConfig(db, 'careful.enabled', 'false');
    manageHook('remove', 'vs-careful', 'Bash', '');
    output({ careful: false }, 'careful 모드 비활성화됨.');
  });

careful
  .command('status')
  .description('Show careful mode status')
  .action(() => {
    const db = initDb();
    const enabled = getConfig(db, 'careful.enabled') === 'true';
    output({ careful: enabled }, enabled ? '⚠️ careful 모드: 활성화' : 'careful 모드: 비활성화');
  });

const freeze = program.command('freeze').description('Manage freeze boundary (edit scope restriction)');

freeze
  .command('set')
  .argument('<path>', 'Directory path to restrict edits to')
  .description('Set freeze boundary')
  .action((inputPath: string) => {
    const db = initDb();
    const absPath = resolve(inputPath);
    setConfig(db, 'freeze.path', absPath);
    const scriptPath = join(process.cwd(), 'bin', 'check-freeze.sh');
    manageHook('add', 'vs-freeze-edit', 'Edit', scriptPath);
    manageHook('add', 'vs-freeze-write', 'Write', scriptPath);
    output({ freeze: absPath }, `🔒 freeze 활성화됨 — 편집 범위: ${absPath}`);
  });

freeze
  .command('off')
  .description('Remove freeze boundary')
  .action(() => {
    const db = initDb();
    deleteConfig(db, 'freeze.path');
    manageHook('remove', 'vs-freeze-edit', 'Edit', '');
    manageHook('remove', 'vs-freeze-write', 'Write', '');
    output({ freeze: null }, 'freeze 비활성화됨 — 편집 범위 제한 해제.');
  });

freeze
  .command('status')
  .description('Show freeze boundary status')
  .action(() => {
    const db = initDb();
    const freezePath = getConfig(db, 'freeze.path');
    output(
      { freeze: freezePath },
      freezePath ? `🔒 freeze: ${freezePath}` : 'freeze: 비활성화'
    );
  });

const guard = program.command('guard').description('Enable/disable careful + freeze combined');

guard
  .command('on')
  .argument('<path>', 'Directory path to restrict edits to')
  .description('Enable careful mode and set freeze boundary')
  .action((inputPath: string) => {
    const db = initDb();
    const absPath = resolve(inputPath);
    setConfig(db, 'careful.enabled', 'true');
    setConfig(db, 'freeze.path', absPath);
    const carefulScript = join(process.cwd(), 'bin', 'check-careful.sh');
    const freezeScript = join(process.cwd(), 'bin', 'check-freeze.sh');
    manageHook('add', 'vs-careful', 'Bash', carefulScript);
    manageHook('add', 'vs-freeze-edit', 'Edit', freezeScript);
    manageHook('add', 'vs-freeze-write', 'Write', freezeScript);
    output(
      { careful: true, freeze: absPath },
      `🛡️ guard 활성화됨 — careful + freeze: ${absPath}`
    );
  });

guard
  .command('off')
  .description('Disable both careful mode and freeze boundary')
  .action(() => {
    const db = initDb();
    setConfig(db, 'careful.enabled', 'false');
    deleteConfig(db, 'freeze.path');
    manageHook('remove', 'vs-careful', 'Bash', '');
    manageHook('remove', 'vs-freeze-edit', 'Edit', '');
    manageHook('remove', 'vs-freeze-write', 'Write', '');
    output({ careful: false, freeze: null }, 'guard 비활성화됨 — careful + freeze 모두 해제.');
  });

guard
  .command('status')
  .description('Show guard status')
  .action(() => {
    const db = initDb();
    const carefulEnabled = getConfig(db, 'careful.enabled') === 'true';
    const freezePath = getConfig(db, 'freeze.path');
    output(
      { careful: carefulEnabled, freeze: freezePath },
      `🛡️ guard: careful=${carefulEnabled ? '활성화' : '비활성화'}, freeze=${freezePath ?? '비활성화'}`
    );
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

// ── self-improve ─────────────────────────────────────────────────────

const selfImprove = program.command('self-improve').description('Self-improve rules management');

function getSelfImproveEngine(): SelfImproveEngine {
  const db = getDb();
  initSchema(db);
  const root = findProjectRoot(process.cwd());
  return new SelfImproveEngine(db, root);
}

selfImprove
  .command('status')
  .description('Show self-improve status (pending, rules, last run)')
  .action(() => {
    const engine = getSelfImproveEngine();
    const pending = engine.getPendingCount();
    const stats = engine.getRuleStats();
    const lastRun = engine.getLastRunTimestamp();
    const data = { pending, rules: stats, last_run: lastRun };
    if (jsonMode) {
      output(data);
    } else {
      const lines = [
        `Pending: ${pending}건`,
        `Rules: active ${stats.active}, archived ${stats.archived}, prevented ${stats.total_prevented}`,
        `Last run: ${lastRun ?? 'never'}`,
      ];
      if (stats.active > engine.getMaxActiveRules()) {
        lines.push(`⚠ 활성 규칙이 ${engine.getMaxActiveRules()}개 상한을 초과했습니다.`);
      }
      output(data, lines.join('\n'));
    }
  });

const rules = selfImprove.command('rules').description('Manage self-improve rules');

rules
  .command('list')
  .option('--status <status>', 'Filter by status (active, archived)')
  .description('List self-improve rules')
  .action((opts: { status?: string }) => {
    const engine = getSelfImproveEngine();
    const status = opts.status as 'active' | 'archived' | undefined;
    const ruleList = engine.listRules(status);
    if (ruleList.length === 0) {
      output(ruleList, 'No rules found.');
      return;
    }
    if (jsonMode) {
      output(ruleList);
    } else {
      const lines = ruleList.map(r =>
        `[${r.status}] ${r.id} | ${r.category} | ${r.title} (prevented: ${r.prevented})`
      );
      output(ruleList, lines.join('\n'));
    }
  });

rules
  .command('show')
  .argument('<id>', 'Rule ID')
  .description('Show rule details')
  .action((id: string) => {
    const engine = getSelfImproveEngine();
    const rule = engine.getRule(id);
    if (!rule) return outputError(`Rule not found: ${id}`);
    output(rule);
  });

rules
  .command('archive')
  .argument('<id>', 'Rule ID')
  .description('Archive a rule')
  .action((id: string) => {
    const engine = getSelfImproveEngine();
    const result = engine.archiveRule(id);
    if (!result) return outputError(`Rule not found or already archived: ${id}`);
    output({ archived: true, rule_id: id }, `Rule archived: ${id}`);
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

// ── qa ───────────────────────────────────────────────────────────────

const qa = program.command('qa').description('Manage QA runs, scenarios, and findings');

function getQAModels() {
  const m = initModels();
  return { qaRun: m.qaRunModel, qaScenario: m.qaScenarioModel, qaFinding: m.qaFindingModel, planModel: m.planModel };
}

// qa run
const qaRun = qa.command('run').description('Manage QA runs');

qaRun
  .command('create')
  .argument('[plan_id]', 'Plan ID (optional for --mode security-only)')
  .option('--trigger <type>', 'Trigger type (manual, auto, milestone)', 'manual')
  .option('--mode <mode>', 'Run mode (full, security-only)')
  .description('Create a new QA run')
  .action((planId: string | undefined, opts: { trigger: string; mode?: string }) => withErrorHandler(() => {
    const { qaRun: qaRunModel } = getQAModels();
    if (opts.mode === 'security-only') {
      // security-only 모드: sentinel plan 자동 생성 후 Run 연결
      const { planModel } = initModels();
      let sentinelPlan = planModel.list({ status: 'active' as PlanStatus }).find(p => p.title === '__security_audit__');
      if (!sentinelPlan) {
        sentinelPlan = planModel.create('__security_audit__', 'Auto-created sentinel plan for standalone security audits');
      }
      const run = qaRunModel.create(sentinelPlan.id, opts.trigger as QARunTrigger);
      output(run, `Created security-only QA run: ${run.id} (sentinel plan: ${sentinelPlan.id})`);
      return;
    }
    if (!planId) return outputError('Plan ID is required (use --mode security-only for standalone)');
    const { planModel } = initModels();
    const plan = planModel.getById(planId);
    if (!plan) return outputError(`Plan not found: ${planId}`);
    const run = qaRunModel.create(planId, opts.trigger as QARunTrigger);
    output(run, `Created QA run: ${run.id} (plan: ${planId}, trigger: ${opts.trigger})`);
  }));

qaRun
  .command('list')
  .option('--plan <plan_id>', 'Filter by plan ID')
  .description('List QA runs')
  .action((opts: { plan?: string }) => withErrorHandler(() => {
    const { qaRun: qaRunModel } = getQAModels();
    const runs = qaRunModel.list(opts.plan);
    if (runs.length === 0) {
      output(runs, 'No QA runs found.');
      return;
    }
    output(runs, runs.map(r =>
      `${r.id}  ${r.status.padEnd(10)}  risk:${r.risk_score.toFixed(2)}  ${r.passed_scenarios}/${r.total_scenarios} passed  ${r.created_at}`
    ).join('\n'));
  }));

qaRun
  .command('show')
  .argument('<run_id>', 'QA Run ID')
  .description('Show QA run details with scenarios and findings')
  .action((runId: string) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaScenario, qaFinding } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    const summary = qaRunModel.getSummary(runId);
    const scenarios = qaScenario.listByRun(runId);
    const findings = qaFinding.list({ runId });
    output({ run, summary, scenarios, findings }, [
      `QA Run: ${run.id} (${run.status})`,
      `Plan: ${run.plan_id} | Trigger: ${run.trigger} | Risk: ${run.risk_score.toFixed(2)}`,
      `Scenarios: ${run.passed_scenarios}/${run.total_scenarios} passed, ${run.failed_scenarios} failed`,
      findings.length > 0 ? `Findings: ${findings.length} total` : 'Findings: none',
      run.summary ? `Summary: ${run.summary}` : '',
    ].filter(Boolean).join('\n'));
  }));

qaRun
  .command('complete')
  .argument('<run_id>', 'QA Run ID')
  .option('--summary <text>', 'Summary of the QA run results')
  .option('--status <status>', 'Final status (completed, failed)', 'completed')
  .description('Complete a QA run and set its final status')
  .action((runId: string, opts: { summary?: string; status?: string }) => withErrorHandler(() => {
    const statusInput = opts.status!;
    if (!VALID_QA_RUN_TERMINAL_STATUSES.includes(statusInput as typeof VALID_QA_RUN_TERMINAL_STATUSES[number])) {
      return outputError(`Invalid status: ${statusInput}. Must be one of: ${VALID_QA_RUN_TERMINAL_STATUSES.join(', ')}`);
    }
    const status = statusInput as typeof VALID_QA_RUN_TERMINAL_STATUSES[number];
    const { qaRun: qaRunModel } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    if ((VALID_QA_RUN_TERMINAL_STATUSES as readonly string[]).includes(run.status)) {
      return outputError(`QA run ${runId} is already ${run.status}`);
    }
    const updated = qaRunModel.updateStatus(runId, status, opts.summary);
    output(updated, `QA run ${runId} marked as ${status}${opts.summary ? ` — ${opts.summary}` : ''}`);
  }));

// qa scenario
const qaScenarioCmd = qa.command('scenario').description('Manage QA scenarios');

qaScenarioCmd
  .command('create')
  .argument('<run_id>', 'QA Run ID')
  .requiredOption('--title <title>', 'Scenario title')
  .requiredOption('--description <desc>', 'Scenario description')
  .requiredOption('--category <cat>', 'Category (functional, integration, flow, regression, edge_case)')
  .option('--priority <p>', 'Priority (critical, high, medium, low)', 'medium')
  .option('--related-tasks <ids>', 'Comma-separated related task IDs')
  .option('--agent <name>', 'Assigned agent name')
  .description('Create a QA scenario')
  .action((runId: string, opts: { title: string; description: string; category: string; priority: string; relatedTasks?: string; agent?: string }) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaScenario } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    if (run.status !== 'pending' && run.status !== 'running') {
      return outputError(`Cannot add scenarios to ${run.status} run`);
    }
    const scenario = qaScenario.create(runId, {
      category: opts.category as QAScenarioCategory,
      title: opts.title,
      description: opts.description,
      priority: opts.priority as QAScenarioPriority,
      related_tasks: opts.relatedTasks ? JSON.stringify(opts.relatedTasks.split(',').map(s => s.trim())) : undefined,
    });
    output(scenario, `Created scenario: ${scenario.id} [${scenario.category}] ${scenario.title}`);
  }));

qaScenarioCmd
  .command('update')
  .argument('<id>', 'Scenario ID')
  .requiredOption('--status <status>', 'Status (pending, running, pass, fail, skip, warn)')
  .option('--evidence <text>', 'Evidence text')
  .description('Update scenario status')
  .action((id: string, opts: { status: string; evidence?: string }) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const existing = qaScenario.get(id);
    if (!existing) return outputError(`Scenario not found: ${id}`);
    qaScenario.updateStatus(id, opts.status as QAScenarioStatus, opts.evidence);
    const updated = qaScenario.get(id)!;
    output(updated, `Updated scenario ${id}: ${updated.status}`);
  }));

qaScenarioCmd
  .command('list')
  .argument('<run_id>', 'QA Run ID')
  .option('--category <cat>', 'Filter by category')
  .option('--status <status>', 'Filter by status')
  .description('List scenarios for a QA run')
  .action((runId: string, opts: { category?: string; status?: string }) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const scenarios = qaScenario.listByRun(runId, {
      category: opts.category,
      status: opts.status,
    });
    if (scenarios.length === 0) {
      output(scenarios, 'No scenarios found.');
      return;
    }
    output(scenarios, scenarios.map(s =>
      `${s.id}  [${s.category}]  ${s.status.padEnd(7)}  ${s.priority.padEnd(8)}  ${s.title}`
    ).join('\n'));
  }));

// qa finding
const qaFindingCmd = qa.command('finding').description('Manage QA findings');

qaFindingCmd
  .command('create')
  .argument('<run_id>', 'QA Run ID')
  .requiredOption('--title <title>', 'Finding title')
  .requiredOption('--description <desc>', 'Finding description')
  .requiredOption('--severity <s>', 'Severity (critical, high, medium, low)')
  .requiredOption('--category <cat>', 'Category (bug, regression, missing_feature, inconsistency, performance, security, ux_issue, spec_gap)')
  .option('--scenario-id <id>', 'Related scenario ID')
  .option('--affected-files <files>', 'Comma-separated affected files')
  .option('--related-task-id <id>', 'Related task ID')
  .option('--fix-suggestion <text>', 'Fix suggestion')
  .description('Create a QA finding')
  .action((runId: string, opts: { title: string; description: string; severity: string; category: string; scenarioId?: string; affectedFiles?: string; relatedTaskId?: string; fixSuggestion?: string }) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaFinding } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    const finding = qaFinding.create(runId, {
      scenario_id: opts.scenarioId,
      severity: opts.severity as QAFindingSeverity,
      category: opts.category as QAFindingCategory,
      title: opts.title,
      description: opts.description,
      affected_files: opts.affectedFiles ? JSON.stringify(opts.affectedFiles.split(',').map(s => s.trim())) : undefined,
      related_task_id: opts.relatedTaskId,
      fix_suggestion: opts.fixSuggestion,
    });
    output(finding, `Created finding: ${finding.id} [${finding.severity}] ${finding.title}`);
  }));

qaFindingCmd
  .command('update')
  .argument('<id>', 'Finding ID')
  .requiredOption('--status <status>', 'Status (open, planned, fixed, wontfix, duplicate)')
  .option('--fix-plan-id <id>', 'Fix plan ID')
  .description('Update finding status')
  .action((id: string, opts: { status: string; fixPlanId?: string }) => withErrorHandler(() => {
    const { qaFinding } = getQAModels();
    const existing = qaFinding.get(id);
    if (!existing) return outputError(`Finding not found: ${id}`);
    qaFinding.updateStatus(id, opts.status as QAFindingStatus, opts.fixPlanId);
    const updated = qaFinding.get(id)!;
    output(updated, `Updated finding ${id}: ${updated.status}`);
  }));

qaFindingCmd
  .command('list')
  .option('--run <run_id>', 'Filter by QA run ID')
  .option('--severity <s>', 'Filter by severity')
  .option('--status <s>', 'Filter by status')
  .option('--category <cat>', 'Filter by category')
  .description('List QA findings')
  .action((opts: { run?: string; severity?: string; status?: string; category?: string }) => withErrorHandler(() => {
    const { qaFinding } = getQAModels();
    const findings = qaFinding.list({
      runId: opts.run,
      severity: opts.severity,
      status: opts.status,
      category: opts.category,
    });
    if (findings.length === 0) {
      output(findings, 'No findings found.');
      return;
    }
    output(findings, findings.map(f =>
      `${f.id}  [${f.severity}]  ${f.status.padEnd(9)}  ${f.category.padEnd(16)}  ${f.title}`
    ).join('\n'));
  }));

// qa stats
qa
  .command('stats')
  .option('--plan <plan_id>', 'Filter by plan ID')
  .description('Show QA statistics')
  .action((opts: { plan?: string }) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaFinding } = getQAModels();
    const runs = qaRunModel.list(opts.plan);
    const completedRuns = runs.filter(r => r.status === 'completed');
    const avgRisk = completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => sum + r.risk_score, 0) / completedRuns.length
      : 0;
    const allFindings = opts.plan
      ? runs.flatMap(r => qaFinding.list({ runId: r.id }))
      : qaFinding.list();
    const openFindings = allFindings.filter(f => f.status === 'open');

    const statsData = {
      total_runs: runs.length,
      completed_runs: completedRuns.length,
      avg_risk_score: Math.round(avgRisk * 100) / 100,
      total_findings: allFindings.length,
      open_findings: openFindings.length,
      findings_by_severity: {
        critical: openFindings.filter(f => f.severity === 'critical').length,
        high: openFindings.filter(f => f.severity === 'high').length,
        medium: openFindings.filter(f => f.severity === 'medium').length,
        low: openFindings.filter(f => f.severity === 'low').length,
      },
    };

    output(statsData, [
      `QA Statistics${opts.plan ? ` (plan: ${opts.plan})` : ''}`,
      `Runs: ${statsData.total_runs} total, ${statsData.completed_runs} completed`,
      `Avg Risk Score: ${statsData.avg_risk_score}`,
      `Findings: ${statsData.total_findings} total, ${statsData.open_findings} open`,
      `  critical: ${statsData.findings_by_severity.critical}  high: ${statsData.findings_by_severity.high}  medium: ${statsData.findings_by_severity.medium}  low: ${statsData.findings_by_severity.low}`,
    ].join('\n'));
  }));

// ── ideate ────────────────────────────────────────────────────────────

const ideate = program.command('ideate').description('Manage ideation records');

ideate
  .command('list')
  .description('List ideation records from context log')
  .action(() => {
    const { contextModel } = initModels();
    const ideations = contextModel.search('[ideation]');
    if (ideations.length === 0) {
      output([], 'ideation 기록이 없습니다. /vs-ideate로 아이디어를 정리해보세요.');
      return;
    }
    const formatted = ideations.map((l, i) =>
      `${i + 1}. [#${l.id}] ${l.summary.replace('[ideation] ', '')} (${l.created_at})`
    ).join('\n');
    output(ideations, `## Ideation 이력\n\n${formatted}`);
  });

ideate
  .command('show')
  .argument('<id>', 'Context log ID')
  .description('Show ideation detail')
  .action((id: string) => {
    withErrorHandler(() => {
      const { contextModel } = initModels();
      const log = contextModel.getById(parseInt(id, 10));
      if (!log) return outputError(`Ideation not found: ${id}`);
      output(log, `## Ideation #${log.id}\n\n**Created**: ${log.created_at}\n\n${log.summary}`);
    });
  });

// ── backlog ───────────────────────────────────────────────────────────

const backlog = program.command('backlog').description('Manage backlog items');

backlog
  .command('add')
  .description('Add a backlog item')
  .requiredOption('--title <title>', 'Item title')
  .option('--description <desc>', 'Item description')
  .option('--priority <priority>', 'Priority: critical|high|medium|low', 'medium')
  .option('--category <category>', 'Category: feature|bugfix|refactor|chore|idea')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--complexity <complexity>', 'Complexity hint: simple|moderate|complex')
  .option('--source <source>', 'Source of the item')
  .action((opts) => withErrorHandler(() => {
    const { backlogModel } = initModels();

    if (opts.priority && !VALID_BACKLOG_PRIORITIES.includes(opts.priority as BacklogPriority)) {
      outputError(`Invalid priority: ${opts.priority}. Must be one of: ${VALID_BACKLOG_PRIORITIES.join(', ')}`);
    }
    if (opts.category && !VALID_BACKLOG_CATEGORIES.includes(opts.category as BacklogCategory)) {
      outputError(`Invalid category: ${opts.category}. Must be one of: ${VALID_BACKLOG_CATEGORIES.join(', ')}`);
    }
    if (opts.complexity && !VALID_BACKLOG_COMPLEXITIES.includes(opts.complexity as BacklogComplexity)) {
      outputError(`Invalid complexity: ${opts.complexity}. Must be one of: ${VALID_BACKLOG_COMPLEXITIES.join(', ')}`);
    }

    const tags = opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : undefined;
    const item = backlogModel.create({
      title: opts.title,
      description: opts.description,
      priority: opts.priority as BacklogPriority,
      category: opts.category as BacklogCategory | undefined,
      tags,
      complexity_hint: opts.complexity as BacklogComplexity | undefined,
      source: opts.source,
    });
    output(item, `Created backlog item: ${item.id} — ${item.title}`);
  }));

backlog
  .command('list')
  .description('List backlog items')
  .option('--status <status>', 'Filter by status')
  .option('--priority <priority>', 'Filter by priority')
  .option('--category <category>', 'Filter by category')
  .option('--tag <tag>', 'Filter by tag')
  .action((opts) => withErrorHandler(() => {
    const { backlogModel } = initModels();
    const items = backlogModel.list({
      status: opts.status as BacklogStatus | undefined,
      priority: opts.priority as BacklogPriority | undefined,
      category: opts.category as BacklogCategory | undefined,
      tag: opts.tag,
    });
    output(items, formatBacklogList(items));
  }));

backlog
  .command('show')
  .description('Show backlog item details')
  .argument('<id>', 'Backlog item ID')
  .action((id) => withErrorHandler(() => {
    const { backlogModel } = initModels();
    const item = backlogModel.getById(id);
    if (!item) outputError(`Backlog item not found: ${id}`);
    output(item, formatBacklogDetail(item!));
  }));

backlog
  .command('update')
  .description('Update a backlog item')
  .argument('<id>', 'Backlog item ID')
  .option('--title <title>', 'New title')
  .option('--description <desc>', 'New description')
  .option('--priority <priority>', 'New priority')
  .option('--category <category>', 'New category')
  .option('--tags <tags>', 'New comma-separated tags')
  .option('--complexity <complexity>', 'New complexity hint')
  .option('--source <source>', 'New source')
  .option('--status <status>', 'New status')
  .action((id, opts) => withErrorHandler(() => {
    const { backlogModel } = initModels();

    const fields: Record<string, unknown> = {};
    if (opts.title) fields.title = opts.title;
    if (opts.description) fields.description = opts.description;
    if (opts.priority) {
      if (!VALID_BACKLOG_PRIORITIES.includes(opts.priority as BacklogPriority)) {
        outputError(`Invalid priority: ${opts.priority}`);
      }
      fields.priority = opts.priority;
    }
    if (opts.category) {
      if (!VALID_BACKLOG_CATEGORIES.includes(opts.category as BacklogCategory)) {
        outputError(`Invalid category: ${opts.category}`);
      }
      fields.category = opts.category;
    }
    if (opts.tags) fields.tags = JSON.stringify(opts.tags.split(',').map((t: string) => t.trim()));
    if (opts.complexity) {
      if (!VALID_BACKLOG_COMPLEXITIES.includes(opts.complexity as BacklogComplexity)) {
        outputError(`Invalid complexity: ${opts.complexity}`);
      }
      fields.complexity_hint = opts.complexity;
    }
    if (opts.source) fields.source = opts.source;
    if (opts.status) {
      if (!VALID_BACKLOG_STATUSES.includes(opts.status as BacklogStatus)) {
        outputError(`Invalid status: ${opts.status}`);
      }
      fields.status = opts.status;
    }

    const item = backlogModel.update(id, fields);
    output(item, formatBacklogDetail(item));
  }));

backlog
  .command('delete')
  .description('Delete a backlog item')
  .argument('<id>', 'Backlog item ID')
  .action((id) => withErrorHandler(() => {
    const { backlogModel } = initModels();
    backlogModel.delete(id);
    output({ deleted: id }, `Deleted backlog item: ${id}`);
  }));

backlog
  .command('promote')
  .description('Promote a backlog item to a plan')
  .argument('<id>', 'Backlog item ID')
  .requiredOption('--plan <planId>', 'Plan ID to link')
  .action((id, opts) => withErrorHandler(() => {
    const { backlogModel } = initModels();
    const item = backlogModel.promote(id, opts.plan);
    output(item, `Promoted backlog item ${item.id} → plan ${opts.plan}`);
  }));

backlog
  .command('stats')
  .description('Show backlog statistics')
  .action(() => withErrorHandler(() => {
    const { backlogModel } = initModels();
    const stats = backlogModel.getStats();
    output(stats, formatBacklogStats(stats));
  }));

backlog
  .command('board')
  .description('Show backlog in kanban board view')
  .option('--category <category>', 'Filter by category')
  .option('--status <status>', 'Filter by status', 'open')
  .action((opts) => withErrorHandler(() => {
    const { backlogModel } = initModels();
    const items = backlogModel.list({
      status: opts.status as BacklogStatus | undefined,
      category: opts.category as BacklogCategory | undefined,
    });
    output(items, formatBacklogBoard(items));
  }));

const importCmd = backlog.command('import').description('Import backlog items from external sources');

importCmd
  .command('github')
  .description('Import from GitHub Issues')
  .requiredOption('--repo <repo>', 'Repository (owner/repo)')
  .option('--label <label>', 'Filter by label')
  .option('--state <state>', 'Issue state', 'open')
  .option('--dry-run', 'Preview without importing')
  .action((opts) => withErrorHandler(() => {
    const result = importFromGithub(opts.repo, { label: opts.label, state: opts.state });
    if (opts.dryRun || result.items.length === 0) {
      output(result, formatImportPreview(result));
      return;
    }
    const { backlogModel } = initModels();
    let imported = 0;
    let skipped = 0;
    const warnings: string[] = [];
    for (const item of result.items) {
      const existing = backlogModel.findByTitle(item.title, 'open');
      if (existing) {
        warnings.push(`Duplicate: "${item.title}" (existing: ${existing.id})`);
        skipped++;
        continue;
      }
      backlogModel.create(item);
      imported++;
    }
    const summary = [`Imported ${imported} items from ${result.source_prefix}`];
    if (skipped > 0) summary.push(`Skipped ${skipped} duplicates`);
    if (warnings.length > 0) summary.push(...warnings.map(w => `  ⚠ ${w}`));
    output({ imported, skipped, warnings }, summary.join('\n'));
  }));

importCmd
  .command('file')
  .description('Import from a markdown/text file')
  .requiredOption('--path <filepath>', 'File path')
  .option('--dry-run', 'Preview without importing')
  .action((opts) => withErrorHandler(() => {
    const result = importFromFile(opts.path);
    if (opts.dryRun || result.items.length === 0) {
      output(result, formatImportPreview(result));
      return;
    }
    const { backlogModel } = initModels();
    let imported = 0;
    let skipped = 0;
    const warnings: string[] = [];
    for (const item of result.items) {
      const existing = backlogModel.findByTitle(item.title, 'open');
      if (existing) {
        warnings.push(`Duplicate: "${item.title}" (existing: ${existing.id})`);
        skipped++;
        continue;
      }
      backlogModel.create(item);
      imported++;
    }
    const summary = [`Imported ${imported} items from ${result.source_prefix}`];
    if (skipped > 0) summary.push(`Skipped ${skipped} duplicates`);
    if (warnings.length > 0) summary.push(...warnings.map(w => `  ⚠ ${w}`));
    output({ imported, skipped, warnings }, summary.join('\n'));
  }));

importCmd
  .command('slack')
  .description('Import from Slack channel (requires MCP)')
  .requiredOption('--channel <channel>', 'Slack channel ID')
  .option('--since <days>', 'Days to look back', '7')
  .option('--dry-run', 'Preview without importing')
  .action((opts) => withErrorHandler(() => {
    const result = importFromSlack(opts.channel, { since: opts.since });
    output(result, formatImportPreview(result));
  }));

program.parse();
