import { Command } from 'commander';
import { createRequire } from 'node:module';
import { getDb } from '../core/db/connection.js';
import { initSchema } from '../core/db/schema.js';
import { DashboardEngine } from '../core/engine/dashboard.js';
import { AlertsEngine } from '../core/engine/alerts.js';
import { StatsEngine } from '../core/engine/stats.js';
import { TaskModel } from '../core/models/task.js';
import { EventModel } from '../core/models/event.js';
import { PlanModel } from '../core/models/plan.js';
import { LifecycleEngine } from '../core/engine/lifecycle.js';
import { formatDashboard, formatStats, formatHistory, formatPlanTree, formatPlanList } from './formatters.js';
import type { TaskStatus, PlanStatus } from '../core/types.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

function initModels() {
  const db = getDb();
  initSchema(db);
  const events = new EventModel(db);
  const planModel = new PlanModel(db, events);
  const taskModel = new TaskModel(db, events);
  const lifecycle = new LifecycleEngine(db, planModel, taskModel, events);
  return { db, events, planModel, taskModel, lifecycle };
}

const program = new Command();
program.name('vp').description('VibeSpec CLI').version(pkg.version);

program
  .command('dashboard')
  .description('Show all active plans overview')
  .action(() => {
    const { db } = initModels();
    const dashboard = new DashboardEngine(db);
    const alerts = new AlertsEngine(db);
    const overview = dashboard.getOverview();
    const alertList = alerts.getAlerts();
    console.log(formatDashboard(overview, alertList));
  });

const task = program.command('task').description('Manage tasks');

task
  .command('update')
  .argument('<id>', 'Task ID')
  .argument('<status>', 'New status (todo, in_progress, done, blocked, skipped)')
  .description('Update task status')
  .action((id: string, status: string) => {
    const { taskModel } = initModels();
    const updated = taskModel.updateStatus(id, status as TaskStatus);
    console.log(`Task ${updated.id}: ${updated.title} → ${updated.status}`);
  });

task
  .command('show')
  .argument('<id>', 'Task ID')
  .description('Show task details')
  .action((id: string) => {
    const { taskModel } = initModels();
    const t = taskModel.getById(id);
    if (!t) {
      console.error(`Task not found: ${id}`);
      process.exit(1);
    }
    console.log(`ID:         ${t.id}`);
    console.log(`Title:      ${t.title}`);
    console.log(`Status:     ${t.status}`);
    console.log(`Plan:       ${t.plan_id}`);
    console.log(`Depth:      ${t.depth}`);
    if (t.spec) console.log(`Spec:       ${t.spec}`);
    if (t.acceptance) console.log(`Acceptance: ${t.acceptance}`);
    console.log(`Created:    ${t.created_at}`);
    if (t.completed_at) console.log(`Completed:  ${t.completed_at}`);
  });

program
  .command('stats')
  .argument('[plan_id]', 'Optional plan ID to scope stats')
  .description('Show velocity and estimates')
  .action((planId?: string) => {
    const { db } = initModels();
    const stats = new StatsEngine(db);
    const velocity = stats.getVelocity(planId);
    const estimate = planId ? stats.getEstimatedCompletion(planId) : undefined;
    const timeline = stats.getTimeline(planId);
    console.log(formatStats(velocity, estimate, timeline.length > 0 ? timeline : undefined));
  });

program
  .command('history')
  .argument('<type>', 'Entity type (plan, task)')
  .argument('<id>', 'Entity ID')
  .description('Show change history')
  .action((type: string, id: string) => {
    const { events } = initModels();
    const eventList = events.getByEntity(type, id);
    console.log(formatHistory(eventList));
  });

const plan = program.command('plan').description('Manage plans');

plan
  .command('list')
  .option('--status <status>', 'Filter by status (draft, active, completed, archived)')
  .description('List plans')
  .action((opts: { status?: string }) => {
    const { planModel } = initModels();
    const plans = planModel.list(opts.status ? { status: opts.status as PlanStatus } : undefined);
    console.log(formatPlanList(plans));
  });

plan
  .command('show')
  .argument('<id>', 'Plan ID')
  .description('Show plan details with task tree')
  .action((id: string) => {
    const { planModel, taskModel } = initModels();
    const p = planModel.getById(id);
    if (!p) {
      console.error(`Plan not found: ${id}`);
      process.exit(1);
    }
    const tree = taskModel.getTree(id);
    console.log(formatPlanTree(p, tree));
  });

plan
  .command('create')
  .requiredOption('--title <title>', 'Plan title')
  .option('--spec <spec>', 'Plan specification')
  .description('Create a new plan and activate it')
  .action((opts: { title: string; spec?: string }) => {
    const { planModel } = initModels();
    const created = planModel.create(opts.title, opts.spec);
    const activated = planModel.activate(created.id);
    console.log(`Created plan: ${activated.id} "${activated.title}" (${activated.status})`);
  });

plan
  .command('complete')
  .argument('<id>', 'Plan ID')
  .description('Complete a plan')
  .action((id: string) => {
    const { lifecycle } = initModels();
    try {
      const completed = lifecycle.completePlan(id);
      console.log(`Plan completed: ${completed.id} "${completed.title}"`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(message);
      process.exit(1);
    }
  });

program.parse();
