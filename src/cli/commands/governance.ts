import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { getConfig, setConfig, deleteConfig } from '../../core/config.js';
import { output, outputError, initDb, withErrorHandler } from '../shared.js';
import type { Models } from '../shared.js';
import { listDeferredSkills, promoteSkill, demoteSkill } from './skill-deferred-helpers.js';
import { AgentHandoffModel } from '../../core/models/agent-handoff.js';
import { ArtifactCleanup } from '../../core/engine/artifact-cleanup.js';
import type { RevisionStatus, RevisionTriggerType } from '../../core/types.js';

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

export function registerGovernanceCommands(program: Command, _getModels: () => Models): void {
  // ── careful ──
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

  // ── freeze ──
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

  // ── guard ──
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

  // ── handoff ──
  const handoff = program.command('handoff').description('Manage agent handoff records and files');

  handoff
    .command('write')
    .argument('<task_id>', 'Task ID')
    .requiredOption('--agent <type>', 'Agent type')
    .requiredOption('--attempt <n>', 'Attempt number', parseInt)
    .requiredOption('--verdict <v>', 'Verdict')
    .requiredOption('--summary <text>', 'Summary text')
    .option('--report-path <path>', 'Report file path')
    .description('Create a handoff record and JSON report file')
    .action((taskId: string, opts: { agent: string; attempt: number; verdict: string; summary: string; reportPath?: string }) => {
      withErrorHandler(() => {
        const models = _getModels();
        const handoffModel = new AgentHandoffModel(models.db);

        // Determine plan_id from task
        const task = models.taskModel.getById(taskId);
        if (!task) return outputError(`Task not found: ${taskId}`);
        const planId = task.plan_id;

        const record = handoffModel.create(
          taskId, planId, opts.agent, opts.attempt,
          opts.verdict, opts.summary, opts.reportPath,
        );

        // Also write JSON report file
        const reportData = {
          id: record.id,
          task_id: taskId,
          plan_id: planId,
          agent_type: opts.agent,
          attempt: opts.attempt,
          verdict: opts.verdict,
          summary: opts.summary,
          created_at: record.created_at,
        };
        const filePath = handoffModel.writeHandoffReport(taskId, opts.agent, opts.attempt, reportData);

        output(
          { ...record, report_file: filePath },
          `Handoff created: ${record.id} (file: ${filePath})`,
        );
      });
    });

  handoff
    .command('read')
    .argument('<task_id>', 'Task ID')
    .option('--agent <type>', 'Agent type')
    .option('--attempt <n>', 'Attempt number', parseInt)
    .description('Read handoff records and report files')
    .action((taskId: string, opts: { agent?: string; attempt?: number }) => {
      withErrorHandler(() => {
        const models = _getModels();
        const handoffModel = new AgentHandoffModel(models.db);

        const records = handoffModel.getByTask(taskId, opts.agent, opts.attempt);
        if (records.length === 0) return outputError(`No handoff records found for task: ${taskId}`);

        const results = records.map((rec) => {
          let reportContent: unknown = null;
          if (rec.agent_type && rec.attempt) {
            reportContent = handoffModel.readHandoffReport(taskId, rec.agent_type, rec.attempt);
          }
          return { ...rec, report_content: reportContent };
        });

        output(results, results.map((r) =>
          `[${r.agent_type}#${r.attempt}] ${r.verdict} — ${r.summary}`,
        ).join('\n'));
      });
    });

  handoff
    .command('clean')
    .argument('<plan_id>', 'Plan ID')
    .description('Delete all handoff records and files for a plan')
    .action((planId: string) => {
      withErrorHandler(() => {
        const models = _getModels();
        const handoffModel = new AgentHandoffModel(models.db);

        const before = handoffModel.list(planId).length;
        handoffModel.cleanByPlan(planId);

        output(
          { plan_id: planId, deleted: before },
          `Cleaned ${before} handoff record(s) for plan: ${planId}`,
        );
      });
    });

  // ── skill-deferred ──
  const skillDeferred = program.command('skill-deferred').description('Manage deferred skill loading (promote/demote)');

  skillDeferred
    .command('list')
    .description('List skills with invocation: deferred')
    .action(() => {
      const skillsDir = join(process.cwd(), 'skills');
      const skills = listDeferredSkills(skillsDir);
      output(
        skills,
        skills.length === 0
          ? 'deferred 스킬이 없습니다.'
          : skills.map((s) => `  - ${s.name}: ${s.description}`).join('\n'),
      );
    });

  skillDeferred
    .command('promote')
    .argument('<skill>', 'Skill name to promote (deferred → user)')
    .description('Promote a deferred skill to user invocation')
    .action((skillName: string) => {
      withErrorHandler(() => {
        const skillsDir = join(process.cwd(), 'skills');
        const result = promoteSkill(skillsDir, skillName);
        output(result, `${result.name}: deferred → user 전환 완료`);
      });
    });

  skillDeferred
    .command('demote')
    .argument('<skill>', 'Skill name to demote (user → deferred)')
    .description('Demote a user skill to deferred invocation')
    .action((skillName: string) => {
      withErrorHandler(() => {
        const skillsDir = join(process.cwd(), 'skills');
        const result = demoteSkill(skillsDir, skillName);
        output(result, `${result.name}: ${result.previous} → deferred 전환 완료`);
      });
    });

  // ── plan revision ──
  const planCmd = program.commands.find((c: Command) => c.name() === 'plan');
  if (!planCmd) {
    throw new Error('plan command must be registered before governance commands');
  }
  const revision = planCmd.command('revision').description('Manage plan revisions');

  revision
    .command('create')
    .argument('<plan_id>', 'Plan ID')
    .requiredOption('--trigger-type <type>', 'Trigger type (assumption_violation|scope_explosion|design_flaw|complexity_exceeded|dependency_shift)')
    .requiredOption('--description <text>', 'Revision description')
    .requiredOption('--changes <json>', 'Changes as JSON string')
    .option('--trigger-source <id>', 'Source ID that triggered the revision')
    .description('Create a plan revision')
    .action((planId: string, opts: { triggerType: string; description: string; changes: string; triggerSource?: string }) => {
      withErrorHandler(() => {
        const models = _getModels();
        const rev = models.planRevisionModel.create(
          planId,
          opts.triggerType as RevisionTriggerType,
          opts.triggerSource ?? null,
          opts.description,
          opts.changes,
        );
        output(rev, `Revision created: ${rev.id} (${rev.trigger_type}) — ${rev.status}`);
      });
    });

  revision
    .command('list')
    .argument('<plan_id>', 'Plan ID')
    .description('List revisions for a plan')
    .action((planId: string) => {
      withErrorHandler(() => {
        const models = _getModels();
        const revisions = models.planRevisionModel.listByPlan(planId);
        if (revisions.length === 0) {
          output([], `No revisions found for plan: ${planId}`);
          return;
        }
        output(
          revisions,
          revisions.map((r) => `[${r.id}] ${r.trigger_type} — ${r.status}: ${r.description}`).join('\n'),
        );
      });
    });

  revision
    .command('update')
    .argument('<id>', 'Revision ID')
    .requiredOption('--status <status>', 'New status (approved|rejected)')
    .description('Update revision status')
    .action((id: string, opts: { status: string }) => {
      withErrorHandler(() => {
        const models = _getModels();
        const rev = models.planRevisionModel.updateStatus(id, opts.status as RevisionStatus);
        output(rev, `Revision ${rev.id} updated to: ${rev.status}`);
      });
    });

  // ── artifact cleanup ──
  const artifact = program.command('artifact').description('Manage .claude/ artifacts');

  artifact
    .command('cleanup')
    .description('Clean up expired artifacts (handoffs, reports, rules)')
    .option('--retention-days <days>', 'Retention period in days', '7')
    .option('--dry-run', 'Show what would be removed without deleting')
    .action(async (opts: { retentionDays: string; dryRun?: boolean }) => {
      try {
        const db = initDb();
        const cleanup = new ArtifactCleanup(db, process.cwd());
        const result = await cleanup.run({
          retentionDays: parseInt(opts.retentionDays, 10),
          dryRun: opts.dryRun ?? false,
          trigger: 'manual',
        });

        const total = result.handoffsRemoved + result.reportsRemoved + result.emptyDirsRemoved;
        output(result, [
          opts.dryRun ? '[DRY RUN] ' : '',
          `Artifact cleanup: ${total} items removed`,
          `  handoffs: ${result.handoffsRemoved}, reports: ${result.reportsRemoved}, empty dirs: ${result.emptyDirsRemoved}`,
          `  rules — archived: ${result.rulesArchived}, conflicts: ${result.rulesConflicts}`,
        ].join('\n'));
      } catch (err) {
        outputError(`Artifact cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}
