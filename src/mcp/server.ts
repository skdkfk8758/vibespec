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
import { DashboardEngine } from '../core/engine/dashboard.js';
import { AlertsEngine } from '../core/engine/alerts.js';
import { LifecycleEngine } from '../core/engine/lifecycle.js';
import { StatsEngine } from '../core/engine/stats.js';
import { getDb } from '../core/db/connection.js';
import { initSchema } from '../core/db/schema.js';
import type { TaskStatus } from '../core/types.js';

const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked', 'skipped'];

export function createServer(db: Database.Database): Server {
  // Instantiate models
  const eventModel = new EventModel(db);
  const planModel = new PlanModel(db, eventModel);
  const taskModel = new TaskModel(db, eventModel);
  const contextModel = new ContextModel(db);

  // Instantiate engines
  const dashboardEngine = new DashboardEngine(db);
  const alertsEngine = new AlertsEngine(db);
  const lifecycleEngine = new LifecycleEngine(db, planModel, taskModel, eventModel);
  const statsEngine = new StatsEngine(db);

  // Create MCP Server
  const server = new Server(
    { name: 'vibespec', version: '0.1.0' },
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
          name: 'vp_plan_list',
          description: 'List plans, optionally filtered by status',
          inputSchema: {
            type: 'object' as const,
            properties: {
              status: { type: 'string', description: 'Optional status filter' },
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
          description: 'Mark a task as blocked',
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
      ],
    };
  });

  // Register CallTool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'vp_dashboard': {
        const overview = dashboardEngine.getOverview();
        const alerts = alertsEngine.getAlerts();
        const result = { overview, alerts };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'vp_context_resume': {
        const sessionId = (args as { session_id?: string } | undefined)?.session_id;
        const contextLogs = sessionId
          ? [contextModel.getBySession(sessionId)].filter(Boolean)
          : contextModel.getLatest(3);
        const overview = dashboardEngine.getOverview();
        const alerts = alertsEngine.getAlerts();
        const result = { context_logs: contextLogs, overview, alerts };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'vp_plan_create': {
        const { title, spec, summary } = args as { title: string; spec?: string; summary?: string };
        const plan = planModel.create(title, spec, summary);
        const activePlan = planModel.activate(plan.id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(activePlan, null, 2) }],
        };
      }

      case 'vp_plan_get': {
        const { plan_id } = args as { plan_id: string };
        const plan = planModel.getById(plan_id);
        if (!plan) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Plan not found' }) }],
            isError: true,
          };
        }
        const tasks = taskModel.getTree(plan_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ plan, tasks }, null, 2) }],
        };
      }

      case 'vp_plan_complete': {
        const { plan_id } = args as { plan_id: string };
        const plan = planModel.getById(plan_id);
        if (!plan) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Plan not found' }) }],
            isError: true,
          };
        }
        try {
          const completed = lifecycleEngine.completePlan(plan_id);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(completed, null, 2) }],
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
            isError: true,
          };
        }
      }

      case 'vp_plan_archive': {
        const { plan_id } = args as { plan_id: string };
        const plan = planModel.getById(plan_id);
        if (!plan) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Plan not found' }) }],
            isError: true,
          };
        }
        const archived = planModel.archive(plan_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(archived, null, 2) }],
        };
      }

      case 'vp_plan_list': {
        const { status } = (args as { status?: string } | undefined) ?? {};
        const filter = status ? { status: status as import('../core/types.js').PlanStatus } : undefined;
        const plans = planModel.list(filter);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(plans, null, 2) }],
        };
      }

      case 'vp_task_create': {
        const { plan_id, title, parent_id, spec, acceptance } = args as {
          plan_id: string;
          title: string;
          parent_id?: string;
          spec?: string;
          acceptance?: string;
        };
        const task = taskModel.create(plan_id, title, {
          parentId: parent_id,
          spec,
          acceptance,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }],
        };
      }

      case 'vp_task_update': {
        const { task_id, status } = args as { task_id: string; status: string };
        if (!VALID_STATUSES.includes(status as TaskStatus)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: 'Invalid status. Must be: todo, in_progress, done, blocked, skipped',
                }),
              },
            ],
            isError: true,
          };
        }
        const existing = taskModel.getById(task_id);
        if (!existing) {
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify({ error: 'Task not found' }) },
            ],
            isError: true,
          };
        }
        const updatedTask = taskModel.updateStatus(task_id, status as TaskStatus);
        const completionCheck = lifecycleEngine.autoCheckCompletion(updatedTask.plan_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ task: updatedTask, completion_check: completionCheck }, null, 2),
            },
          ],
        };
      }

      case 'vp_task_get': {
        const { task_id } = args as { task_id: string };
        const task = taskModel.getById(task_id);
        if (!task) {
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify({ error: 'Task not found' }) },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }],
        };
      }

      case 'vp_task_next': {
        const { plan_id } = args as { plan_id: string };
        const todoTasks = taskModel.getByPlan(plan_id, { status: 'todo' });
        if (todoTasks.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ message: 'No pending tasks' }),
              },
            ],
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(todoTasks[0], null, 2) }],
        };
      }

      case 'vp_task_block': {
        const { task_id, reason } = args as { task_id: string; reason?: string };
        const existingTask = taskModel.getById(task_id);
        if (!existingTask) {
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify({ error: 'Task not found' }) },
            ],
            isError: true,
          };
        }
        const blockedTask = taskModel.updateStatus(task_id, 'blocked');
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(blockedTask, null, 2) }],
        };
      }

      case 'vp_context_save': {
        const { summary, plan_id, session_id } = args as {
          summary: string;
          plan_id?: string;
          session_id?: string;
        };
        const contextLog = contextModel.save(summary, {
          planId: plan_id,
          sessionId: session_id,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(contextLog, null, 2) }],
        };
      }

      case 'vp_stats': {
        const { plan_id } = (args as { plan_id?: string } | undefined) ?? {};
        const velocity = statsEngine.getVelocity(plan_id);
        const result: Record<string, unknown> = { velocity };
        if (plan_id) {
          result.estimated_completion = statsEngine.getEstimatedCompletion(plan_id);
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'vp_history': {
        const { entity_type, entity_id } = args as {
          entity_type: string;
          entity_id: string;
        };
        const events = eventModel.getByEntity(entity_type, entity_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(events, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

export async function main(): Promise<void> {
  const db = getDb();
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
