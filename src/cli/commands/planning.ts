import { Command } from 'commander';
import { output, outputError, withErrorHandler, getJsonMode, initModels } from '../shared.js';
import type { Models } from '../shared.js';
import { formatPlanTree, formatPlanList } from '../formatters.js';
import type { TaskStatus, PlanStatus, TaskMetricsInput, TaskUpdateInput } from '../../core/types.js';
import { VALID_PLAN_STATUSES } from '../../core/types.js';

export function registerPlanningCommands(program: Command, getModels: () => Models): void {
  // ── plan ───────────────────────────────────────────────────────────────

  const plan = program.command('plan').description('Manage plans');

  plan
    .command('list')
    .option('--status <status>', 'Filter by status (draft, active, approved, completed, archived)')
    .option('--branch <branch>', 'Filter by branch')
    .description('List plans')
    .action((opts: { status?: string; branch?: string }) => {
      const { planModel } = getModels();
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
      const { planModel, taskModel } = getModels();
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
      const { planModel } = getModels();
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
      const { planModel } = getModels();
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
        const { lifecycle } = getModels();
        const { plan: completed, verification } = lifecycle.completePlan(id);
        output({ ...completed, verification }, `Plan completed: ${completed.id} "${completed.title}"`);
      });
    });

  plan
    .command('approve')
    .argument('<id>', 'Plan ID')
    .description('Approve a plan (active → approved)')
    .action((id: string) => {
      withErrorHandler(() => {
        const { planModel } = getModels();
        const approved = planModel.approve(id);
        output(approved, `Plan approved: ${approved.id} "${approved.title}"`);
      });
    });

  plan
    .command('archive')
    .argument('<id>', 'Plan ID')
    .description('Archive a plan')
    .action((id: string) => {
      const { planModel } = getModels();
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
      const { planModel } = getModels();
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
        const { planModel } = getModels();
        planModel.delete(id);
        output({ deleted: true, plan_id: id }, `Plan deleted: ${id}`);
      });
    });

  plan
    .command('summary')
    .argument('<id>', 'Plan ID')
    .description('Show the running summary of a plan')
    .action((id: string) => {
      const { planModel } = getModels();
      const p = planModel.getById(id);
      if (!p) return outputError(`Plan not found: ${id}`);
      if (!p.running_summary) {
        output({ plan_id: id, running_summary: null }, `No running summary for plan: ${id}`);
        return;
      }
      output({ plan_id: id, running_summary: p.running_summary }, p.running_summary);
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
        const { taskModel } = getModels();
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
        if (getJsonMode()) {
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
      const { taskModel, taskMetricsModel, lifecycle } = getModels();
      const t = taskModel.getById(id);
      if (!t) return outputError(`Task not found: ${id}`);

      const updated = taskModel.updateStatus(id, status as TaskStatus);
      const completionCheck = lifecycle.autoCheckCompletion(updated.plan_id);

      if (['done', 'blocked', 'skipped'].includes(status)) {
        try {
          const metrics: TaskMetricsInput = {};
          if (opts.implStatus) metrics.impl_status = opts.implStatus;
          if (opts.testCount) metrics.test_count = parseInt(opts.testCount, 10);
          if (opts.filesChanged) metrics.files_changed = parseInt(opts.filesChanged, 10);
          if (opts.hasConcerns) metrics.has_concerns = true;
          if (opts.changedFilesDetail) metrics.changed_files_detail = opts.changedFilesDetail;
          if (opts.scopeViolations) metrics.scope_violations = opts.scopeViolations;
          taskMetricsModel.record(id, updated.plan_id, status, Object.keys(metrics).length > 0 ? metrics : undefined);
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
      const { taskModel } = getModels();
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
      const { taskModel } = getModels();
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
      const { taskModel, events } = getModels();
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
      const { taskModel } = getModels();
      const t = taskModel.getById(id);
      if (!t) return outputError(`Task not found: ${id}`);
      const fields: TaskUpdateInput = {};
      if (opts.title !== undefined) fields.title = opts.title;
      if (opts.spec !== undefined) fields.spec = opts.spec;
      if (opts.acceptance !== undefined) fields.acceptance = opts.acceptance;
      if (opts.allowedFiles !== undefined) {
        fields.allowed_files = JSON.stringify(opts.allowedFiles.split(',').map(s => s.trim()));
      }
      if (opts.forbiddenPatterns !== undefined) {
        fields.forbidden_patterns = JSON.stringify(opts.forbiddenPatterns.split(',').map(s => s.trim()));
      }
      const edited = taskModel.update(id, fields);
      output(edited, `Task edited: ${edited.id} "${edited.title}"`);
    });

  task
    .command('delete')
    .argument('<id>', 'Task ID')
    .description('Delete a task and its subtasks')
    .action((id: string) => {
      const { taskModel } = getModels();
      withErrorHandler(() => {
        taskModel.delete(id);
        output({ deleted: true, task_id: id }, `Task deleted: ${id}`);
      });
    });
}
