import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type Database from 'better-sqlite3';

import { PlanModel } from '../core/models/plan.js';
import { TaskModel } from '../core/models/task.js';
import { EventModel } from '../core/models/event.js';
import { ContextModel } from '../core/models/context.js';
import { TaskMetricsModel } from '../core/models/task-metrics.js';
import { DashboardEngine } from '../core/engine/dashboard.js';
import { AlertsEngine } from '../core/engine/alerts.js';
import { LifecycleEngine } from '../core/engine/lifecycle.js';
import { StatsEngine } from '../core/engine/stats.js';
import { InsightsEngine } from '../core/engine/insights.js';
import { getDb } from '../core/db/connection.js';
import { initSchema } from '../core/db/schema.js';
import type { TaskStatus } from '../core/types.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked', 'skipped'];

function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(error: string, hint?: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(hint ? { error, hint } : { error }) }],
    isError: true,
  };
}

function requireArgs<T extends Record<string, unknown>>(
  args: Record<string, unknown> | undefined,
  required: string[],
): { valid: true; parsed: T } | { valid: false; response: ReturnType<typeof err> } {
  const safeArgs = (args ?? {}) as Record<string, unknown>;
  for (const key of required) {
    if (safeArgs[key] === undefined || safeArgs[key] === null || safeArgs[key] === '') {
      return {
        valid: false,
        response: err(
          `Missing required parameter: ${key}`,
          `Required parameters: ${required.join(', ')}`,
        ),
      };
    }
  }
  return { valid: true, parsed: safeArgs as T };
}

export function createServer(db: Database.Database): Server {
  // Instantiate models
  const eventModel = new EventModel(db);
  const planModel = new PlanModel(db, eventModel);
  const taskModel = new TaskModel(db, eventModel);
  const contextModel = new ContextModel(db);
  const taskMetricsModel = new TaskMetricsModel(db);

  // Instantiate engines
  const dashboardEngine = new DashboardEngine(db);
  const alertsEngine = new AlertsEngine(db);
  const lifecycleEngine = new LifecycleEngine(db, planModel, taskModel, eventModel);
  const statsEngine = new StatsEngine(db);
  const insightsEngine = new InsightsEngine(db);

  // Create MCP Server
  const server = new Server(
    { name: 'vibespec', version: pkg.version },
    { capabilities: { tools: {} } },
  );

  // Register ListTools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'vp_dashboard',
          description: 'Get overview of all active plans with progress and alerts',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
        {
          name: 'vp_context_resume',
          description:
            'Resume context from previous sessions with recent context logs, dashboard overview, and alerts',
          inputSchema: {
            type: 'object' as const,
            properties: {
              session_id: {
                type: 'string',
                description: 'Optional session ID to filter context logs',
              },
            },
            required: [],
          },
        },
        {
          name: 'vp_plan_create',
          description: 'Create a new plan and activate it',
          inputSchema: {
            type: 'object' as const,
            properties: {
              title: { type: 'string', description: 'Plan title' },
              spec: { type: 'string', description: 'Optional plan specification' },
              summary: { type: 'string', description: 'Optional plan summary' },
            },
            required: ['title'],
          },
        },
        {
          name: 'vp_plan_get',
          description: 'Get a plan by ID with its task tree',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: { type: 'string', description: 'Plan ID' },
            },
            required: ['plan_id'],
          },
        },
        {
          name: 'vp_plan_complete',
          description: 'Complete a plan if all tasks are done',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: { type: 'string', description: 'Plan ID' },
            },
            required: ['plan_id'],
          },
        },
        {
          name: 'vp_plan_archive',
          description: 'Archive a plan',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: { type: 'string', description: 'Plan ID' },
            },
            required: ['plan_id'],
          },
        },
        {
          name: 'vp_plan_approve',
          description: 'Approve a plan after spec review (changes status from active to approved)',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: { type: 'string', description: 'Plan ID' },
            },
            required: ['plan_id'],
          },
        },
        {
          name: 'vp_plan_list',
          description: 'List plans, optionally filtered by status and/or branch',
          inputSchema: {
            type: 'object' as const,
            properties: {
              status: { type: 'string', description: 'Optional status filter' },
              branch: { type: 'string', description: 'Optional branch filter' },
            },
            required: [],
          },
        },
        {
          name: 'vp_task_create',
          description: 'Create a new task within a plan',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: { type: 'string', description: 'Plan ID to add task to' },
              title: { type: 'string', description: 'Task title' },
              parent_id: { type: 'string', description: 'Optional parent task ID for subtasks' },
              spec: { type: 'string', description: 'Optional task specification' },
              acceptance: { type: 'string', description: 'Optional acceptance criteria' },
            },
            required: ['plan_id', 'title'],
          },
        },
        {
          name: 'vp_task_update',
          description: 'Update a task status',
          inputSchema: {
            type: 'object' as const,
            properties: {
              task_id: { type: 'string', description: 'Task ID' },
              status: { type: 'string', description: 'New status: todo, in_progress, done, blocked, skipped' },
              metrics: {
                type: 'object',
                description: 'Optional implementation metrics to record',
                properties: {
                  impl_status: { type: 'string', description: 'DONE, DONE_WITH_CONCERNS, or BLOCKED' },
                  test_count: { type: 'number', description: 'Number of tests written' },
                  files_changed: { type: 'number', description: 'Number of files changed' },
                  has_concerns: { type: 'boolean', description: 'Whether there are concerns' },
                },
              },
            },
            required: ['task_id', 'status'],
          },
        },
        {
          name: 'vp_task_get',
          description: 'Get a task by ID',
          inputSchema: {
            type: 'object' as const,
            properties: {
              task_id: { type: 'string', description: 'Task ID' },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'vp_task_next',
          description: 'Get the next pending (todo) task for a plan',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: { type: 'string', description: 'Plan ID' },
            },
            required: ['plan_id'],
          },
        },
        {
          name: 'vp_task_block',
          description: 'Mark a task as blocked with an optional reason',
          inputSchema: {
            type: 'object' as const,
            properties: {
              task_id: { type: 'string', description: 'Task ID' },
              reason: { type: 'string', description: 'Optional reason for blocking' },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'vp_plan_update',
          description: 'Update a plan title, spec, or summary',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: { type: 'string', description: 'Plan ID' },
              title: { type: 'string', description: 'New title' },
              spec: { type: 'string', description: 'New spec' },
              summary: { type: 'string', description: 'New summary' },
            },
            required: ['plan_id'],
          },
        },
        {
          name: 'vp_plan_delete',
          description: 'Delete a draft plan and all its tasks',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: { type: 'string', description: 'Plan ID (must be in draft status)' },
            },
            required: ['plan_id'],
          },
        },
        {
          name: 'vp_task_edit',
          description: 'Edit a task title, spec, or acceptance criteria',
          inputSchema: {
            type: 'object' as const,
            properties: {
              task_id: { type: 'string', description: 'Task ID' },
              title: { type: 'string', description: 'New title' },
              spec: { type: 'string', description: 'New spec' },
              acceptance: { type: 'string', description: 'New acceptance criteria' },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'vp_task_delete',
          description: 'Delete a task and its subtasks',
          inputSchema: {
            type: 'object' as const,
            properties: {
              task_id: { type: 'string', description: 'Task ID' },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'vp_context_save',
          description: 'Save a context log entry for the current session',
          inputSchema: {
            type: 'object' as const,
            properties: {
              summary: { type: 'string', description: 'Summary of the context to save' },
              plan_id: { type: 'string', description: 'Optional plan ID to link context to' },
              session_id: { type: 'string', description: 'Optional session ID' },
            },
            required: ['summary'],
          },
        },
        {
          name: 'vp_stats',
          description: 'Get velocity statistics and optionally estimated completion for a plan',
          inputSchema: {
            type: 'object' as const,
            properties: {
              plan_id: {
                type: 'string',
                description:
                  'Optional plan ID to get plan-specific stats and estimated completion',
              },
            },
            required: [],
          },
        },
        {
          name: 'vp_history',
          description: 'Get event history for a specific entity',
          inputSchema: {
            type: 'object' as const,
            properties: {
              entity_type: {
                type: 'string',
                description: 'Type of entity (e.g. "plan", "task")',
              },
              entity_id: { type: 'string', description: 'ID of the entity' },
            },
            required: ['entity_type', 'entity_id'],
          },
        },
        {
          name: 'vp_insights',
          description:
            'Get learning insights from task completion history — blocked patterns, duration stats, success rates, and recommendations',
          inputSchema: {
            type: 'object' as const,
            properties: {
              scope: {
                type: 'string',
                description:
                  'What insights to return: blocked_patterns, duration_stats, success_rates, or all (default: all)',
              },
            },
            required: [],
          },
        },
      ],
    };
  });

  // Helper to find plan or return error
  function getPlanOrError(planId: string) {
    const plan = planModel.getById(planId);
    if (!plan) {
      return { found: false as const, response: err('Plan not found', 'Use vp_plan_list to see available plans') };
    }
    return { found: true as const, plan };
  }

  function getTaskOrError(taskId: string) {
    const task = taskModel.getById(taskId);
    if (!task) {
      return { found: false as const, response: err('Task not found', 'Use vp_plan_get with a plan_id to see its tasks') };
    }
    return { found: true as const, task };
  }

  // Register CallTool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'vp_dashboard': {
        const overview = dashboardEngine.getOverview();
        const alerts = alertsEngine.getAlerts();
        return ok({ overview, alerts });
      }

      case 'vp_context_resume': {
        const sessionId = (args as { session_id?: string } | undefined)?.session_id;
        const contextLogs = sessionId
          ? [contextModel.getBySession(sessionId)].filter(Boolean)
          : contextModel.getLatest(3);
        const overview = dashboardEngine.getOverview();
        const alerts = alertsEngine.getAlerts();
        return ok({ context_logs: contextLogs, overview, alerts });
      }

      case 'vp_plan_create': {
        const check = requireArgs<{ title: string; spec?: string; summary?: string }>(
          args as Record<string, unknown>, ['title'],
        );
        if (!check.valid) return check.response;
        const { title, spec, summary } = check.parsed;
        const plan = planModel.create(title, spec, summary);
        const activePlan = planModel.activate(plan.id);
        return ok(activePlan);
      }

      case 'vp_plan_get': {
        const check = requireArgs<{ plan_id: string }>(args as Record<string, unknown>, ['plan_id']);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        const tasks = taskModel.getTree(check.parsed.plan_id);
        return ok({ plan: result.plan, tasks });
      }

      case 'vp_plan_complete': {
        const check = requireArgs<{ plan_id: string }>(args as Record<string, unknown>, ['plan_id']);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        try {
          const completed = lifecycleEngine.completePlan(check.parsed.plan_id);
          return ok(completed);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }

      case 'vp_plan_archive': {
        const check = requireArgs<{ plan_id: string }>(args as Record<string, unknown>, ['plan_id']);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        const archived = planModel.archive(check.parsed.plan_id);
        return ok(archived);
      }

      case 'vp_plan_approve': {
        const check = requireArgs<{ plan_id: string }>(args as Record<string, unknown>, ['plan_id']);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        try {
          const approved = planModel.approve(check.parsed.plan_id);
          return ok(approved);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }

      case 'vp_plan_list': {
        const { status, branch } = (args as { status?: string; branch?: string } | undefined) ?? {};
        const filter: { status?: import('../core/types.js').PlanStatus; branch?: string } = {};
        if (status) filter.status = status as import('../core/types.js').PlanStatus;
        if (branch) filter.branch = branch;
        const plans = planModel.list(Object.keys(filter).length > 0 ? filter : undefined);
        return ok(plans);
      }

      case 'vp_plan_update': {
        const check = requireArgs<{ plan_id: string; title?: string; spec?: string; summary?: string }>(
          args as Record<string, unknown>, ['plan_id'],
        );
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        const { plan_id: _pid, ...fields } = check.parsed;
        const updated = planModel.update(check.parsed.plan_id, fields);
        return ok(updated);
      }

      case 'vp_plan_delete': {
        const check = requireArgs<{ plan_id: string }>(args as Record<string, unknown>, ['plan_id']);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        try {
          planModel.delete(check.parsed.plan_id);
          return ok({ deleted: true, plan_id: check.parsed.plan_id });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }

      case 'vp_task_create': {
        const check = requireArgs<{
          plan_id: string;
          title: string;
          parent_id?: string;
          spec?: string;
          acceptance?: string;
        }>(args as Record<string, unknown>, ['plan_id', 'title']);
        if (!check.valid) return check.response;
        const { plan_id, title, parent_id, spec, acceptance } = check.parsed;
        try {
          const task = taskModel.create(plan_id, title, {
            parentId: parent_id,
            spec,
            acceptance,
          });
          return ok(task);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }

      case 'vp_task_update': {
        const check = requireArgs<{
          task_id: string;
          status: string;
          metrics?: {
            impl_status?: string;
            test_count?: number;
            files_changed?: number;
            has_concerns?: boolean;
          };
        }>(
          args as Record<string, unknown>, ['task_id', 'status'],
        );
        if (!check.valid) return check.response;
        const { task_id, status, metrics } = check.parsed;
        if (!VALID_STATUSES.includes(status as TaskStatus)) {
          return err(
            'Invalid status. Must be: todo, in_progress, done, blocked, skipped',
          );
        }
        const taskResult = getTaskOrError(task_id);
        if (!taskResult.found) return taskResult.response;
        const updatedTask = taskModel.updateStatus(task_id, status as TaskStatus);
        const completionCheck = lifecycleEngine.autoCheckCompletion(updatedTask.plan_id);

        // Auto-record metrics for terminal statuses
        if (['done', 'blocked', 'skipped'].includes(status)) {
          try {
            taskMetricsModel.record(task_id, updatedTask.plan_id, status, metrics);
          } catch {
            // Metrics recording is non-blocking; main status update takes priority
          }
        }

        return ok({ task: updatedTask, completion_check: completionCheck });
      }

      case 'vp_task_get': {
        const check = requireArgs<{ task_id: string }>(args as Record<string, unknown>, ['task_id']);
        if (!check.valid) return check.response;
        const taskResult = getTaskOrError(check.parsed.task_id);
        if (!taskResult.found) return taskResult.response;
        return ok(taskResult.task);
      }

      case 'vp_task_next': {
        const check = requireArgs<{ plan_id: string }>(args as Record<string, unknown>, ['plan_id']);
        if (!check.valid) return check.response;
        const todoTasks = taskModel.getByPlan(check.parsed.plan_id, { status: 'todo' });
        if (todoTasks.length === 0) {
          return ok({ message: 'No pending tasks', hint: 'All tasks are done. Use vp_plan_complete to finish the plan.' });
        }
        return ok(todoTasks[0]);
      }

      case 'vp_task_block': {
        const check = requireArgs<{ task_id: string; reason?: string }>(
          args as Record<string, unknown>, ['task_id'],
        );
        if (!check.valid) return check.response;
        const taskResult = getTaskOrError(check.parsed.task_id);
        if (!taskResult.found) return taskResult.response;
        const blockedTask = taskModel.updateStatus(check.parsed.task_id, 'blocked');
        if (check.parsed.reason) {
          eventModel.record(
            'task', check.parsed.task_id, 'blocked_reason',
            null, JSON.stringify({ reason: check.parsed.reason }),
          );
        }
        return ok({ ...blockedTask, block_reason: check.parsed.reason ?? null });
      }

      case 'vp_task_edit': {
        const check = requireArgs<{ task_id: string; title?: string; spec?: string; acceptance?: string }>(
          args as Record<string, unknown>, ['task_id'],
        );
        if (!check.valid) return check.response;
        const taskResult3 = getTaskOrError(check.parsed.task_id);
        if (!taskResult3.found) return taskResult3.response;
        const { task_id: _tid, ...editFields } = check.parsed;
        const editedTask = taskModel.update(check.parsed.task_id, editFields);
        return ok(editedTask);
      }

      case 'vp_task_delete': {
        const check = requireArgs<{ task_id: string }>(args as Record<string, unknown>, ['task_id']);
        if (!check.valid) return check.response;
        const taskResult4 = getTaskOrError(check.parsed.task_id);
        if (!taskResult4.found) return taskResult4.response;
        try {
          taskModel.delete(check.parsed.task_id);
          return ok({ deleted: true, task_id: check.parsed.task_id });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }

      case 'vp_context_save': {
        const check = requireArgs<{ summary: string; plan_id?: string; session_id?: string }>(
          args as Record<string, unknown>, ['summary'],
        );
        if (!check.valid) return check.response;
        const { summary, plan_id, session_id } = check.parsed;
        const contextLog = contextModel.save(summary, {
          planId: plan_id,
          sessionId: session_id,
        });
        return ok(contextLog);
      }

      case 'vp_stats': {
        const { plan_id } = (args as { plan_id?: string } | undefined) ?? {};
        const velocity = statsEngine.getVelocity(plan_id);
        const result: Record<string, unknown> = { velocity };
        if (plan_id) {
          result.estimated_completion = statsEngine.getEstimatedCompletion(plan_id);
        }
        return ok(result);
      }

      case 'vp_history': {
        const check = requireArgs<{ entity_type: string; entity_id: string }>(
          args as Record<string, unknown>, ['entity_type', 'entity_id'],
        );
        if (!check.valid) return check.response;
        const events = eventModel.getByEntity(check.parsed.entity_type, check.parsed.entity_id);
        return ok(events);
      }

      case 'vp_insights': {
        const { scope } = (args as { scope?: string } | undefined) ?? {};
        const validScopes = ['blocked_patterns', 'duration_stats', 'success_rates', 'all'];
        const selectedScope = scope && validScopes.includes(scope) ? scope : 'all';

        const result: Record<string, unknown> = {};

        if (selectedScope === 'all' || selectedScope === 'blocked_patterns') {
          result.blocked_patterns = insightsEngine.getBlockedPatterns();
        }
        if (selectedScope === 'all' || selectedScope === 'duration_stats') {
          result.duration_stats = insightsEngine.getDurationStats();
        }
        if (selectedScope === 'all' || selectedScope === 'success_rates') {
          result.success_rates = insightsEngine.getSuccessRates();
        }
        if (selectedScope === 'all') {
          result.recommendations = insightsEngine.getRecommendations();
          result.confidence = insightsEngine.getConfidenceLevel();
        }

        return ok(result);
      }

      default:
        return err(`Unknown tool: ${name}`);
    }
  });

  return server;
}

export async function main(): Promise<void> {
  console.error(`[vibespec] CWD: ${process.cwd()}`);
  const db = getDb();
  console.error(`[vibespec] DB: ${db.name}`);
  initSchema(db);
  const server = createServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only runs when file is executed directly (not when imported)
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isDirectRun) {
  main().catch(console.error);
}
