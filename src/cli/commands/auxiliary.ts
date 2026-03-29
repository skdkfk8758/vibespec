import { Command } from 'commander';
import { getDb } from '../../core/db/connection.js';
import { initSchema } from '../../core/db/schema.js';
import { getConfig, setConfig, deleteConfig, listConfig } from '../../core/config.js';
import { output, outputError, withErrorHandler, initModels } from '../shared.js';
import type { Models } from '../shared.js';
import { formatDashboard, formatStats, formatHistory, formatSkillUsage } from '../formatters.js';
import type { MergeReport } from '../../core/types.js';

export function registerAuxiliaryCommands(program: Command, getModels: () => Models): void {
  // ── context ────────────────────────────────────────────────────────────

  const context = program.command('context').description('Manage session context');

  context
    .command('resume')
    .option('--session-id <id>', 'Optional session ID to filter')
    .description('Resume context from previous sessions')
    .action((opts: { sessionId?: string }) => {
      const { contextModel, dashboard, alerts } = getModels();
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
      const { contextModel } = getModels();
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
      const { contextModel } = getModels();
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

  // ── stats ──────────────────────────────────────────────────────────────

  program
    .command('stats')
    .argument('[plan_id]', 'Optional plan ID')
    .description('Show velocity and estimates')
    .action((planId?: string) => {
      const { stats } = getModels();
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
      const { events } = getModels();
      const eventList = events.getByEntity(type as 'plan' | 'task', id);
      output(eventList, formatHistory(eventList));
    });

  // ── insights ───────────────────────────────────────────────────────────

  program
    .command('insights')
    .option('--scope <scope>', 'Scope: blocked_patterns, duration_stats, success_rates, all (default: all)')
    .description('Get learning insights from task history')
    .action((opts: { scope?: string }) => {
      const { insights } = getModels();
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

  // ── skill-log ─────────────────────────────────────────────────────────

  program
    .command('skill-log')
    .argument('<name>', 'Skill name to record')
    .option('--plan-id <id>', 'Plan ID to associate')
    .option('--session-id <id>', 'Session ID to associate')
    .description('Record a skill usage')
    .action((name: string, opts: { planId?: string; sessionId?: string }) => {
      const { skillUsageModel } = getModels();
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
      const { skillUsageModel } = getModels();
      const days = opts.days ? parseInt(opts.days, 10) : undefined;
      const skillStats = skillUsageModel.getStats(days);

      if (skillStats.length === 0) {
        output(skillStats, 'No skill usage data.');
        return;
      }

      output(skillStats, formatSkillUsage(skillStats));
    });

  // ── merge-report ──────────────────────────────────────────────────────

  const mergeReport = program.command('merge-report').description('Manage merge reports');

  mergeReport
    .command('show')
    .argument('<id>', 'Report ID or commit hash')
    .description('Show a merge report')
    .action((id: string) => withErrorHandler(() => {
      const { mergeReportModel } = getModels();
      const report = mergeReportModel.get(id) ?? mergeReportModel.getByCommit(id);
      if (!report) return outputError(`Merge report not found: ${id}`);
      output(report, formatMergeReportSummary(report));
    }));

  mergeReport
    .command('list')
    .option('--plan-id <plan_id>', 'Filter by plan ID')
    .option('--limit <n>', 'Limit results', '20')
    .description('List merge reports')
    .action((opts: { planId?: string; limit: string }) => withErrorHandler(() => {
      const { mergeReportModel } = getModels();
      const reports = mergeReportModel.list({ planId: opts.planId, limit: parseInt(opts.limit, 10) });
      output(reports, formatMergeReportList(reports));
    }));

  mergeReport
    .command('latest')
    .description('Show the latest merge report')
    .action(() => withErrorHandler(() => {
      const { mergeReportModel } = getModels();
      const reports = mergeReportModel.getLatest(1);
      if (reports.length === 0) {
        output(null, '리포트가 없습니다. vs-merge로 머지를 완료하면 자동으로 생성됩니다.');
        return;
      }
      output(reports[0], formatMergeReportSummary(reports[0]));
    }));

  mergeReport
    .command('create')
    .description('Create a merge report (used internally by vs-merge)')
    .requiredOption('--commit <hash>', 'Commit hash')
    .requiredOption('--source <branch>', 'Source branch')
    .requiredOption('--target <branch>', 'Target branch')
    .requiredOption('--changes <json>', 'Changes summary JSON')
    .requiredOption('--checklist <json>', 'Review checklist JSON')
    .requiredOption('--verification <json>', 'Verification result JSON')
    .requiredOption('--report-path <path>', 'Path to MD report file')
    .option('--plan-id <id>', 'Plan ID')
    .option('--conflict-log <json>', 'Conflict log JSON')
    .option('--ai-judgments <json>', 'AI judgments JSON')
    .option('--task-ids <json>', 'Task IDs JSON')
    .action((opts: {
      commit: string; source: string; target: string;
      changes: string; checklist: string; verification: string;
      reportPath: string; planId?: string; conflictLog?: string;
      aiJudgments?: string; taskIds?: string;
    }) => withErrorHandler(() => {
      const { mergeReportModel } = getModels();
      const report = mergeReportModel.create({
        commit_hash: opts.commit,
        source_branch: opts.source,
        target_branch: opts.target,
        changes_summary: JSON.parse(opts.changes),
        review_checklist: JSON.parse(opts.checklist),
        verification: JSON.parse(opts.verification),
        report_path: opts.reportPath,
        plan_id: opts.planId,
        conflict_log: opts.conflictLog ? JSON.parse(opts.conflictLog) : undefined,
        ai_judgments: opts.aiJudgments ? JSON.parse(opts.aiJudgments) : undefined,
        task_ids: opts.taskIds ? JSON.parse(opts.taskIds) : undefined,
      });
      output(report, `Created merge report: ${report.id}`);
    }));
}

function formatMergeReportSummary(r: MergeReport): string {
  const lines: string[] = [];
  lines.push(`# Merge Report: ${r.source_branch} → ${r.target_branch}`);
  lines.push(`> ${r.created_at} | Commit: ${r.commit_hash.slice(0, 8)}`);
  if (r.plan_id) lines.push(`> Plan: ${r.plan_id}`);
  lines.push('');

  lines.push('## 변경 요약');
  for (const c of r.changes_summary) {
    lines.push(`- [${c.category}] ${c.file} — ${c.description}`);
  }
  lines.push('');

  lines.push('## Review Checklist');
  const levelIcon = { must: '🔴', should: '🟡', info: '🟢' } as const;
  for (const item of r.review_checklist) {
    const loc = item.line ? `${item.file}:${item.line}` : item.file;
    lines.push(`- ${levelIcon[item.level]} ${loc} — ${item.description}`);
    lines.push(`  └ ${item.reason}`);
  }
  lines.push('');

  if (r.conflict_log && r.conflict_log.length > 0) {
    lines.push('## 충돌 해결 기록');
    for (const c of r.conflict_log) {
      lines.push(`- ${c.file} (${c.hunks} hunks) → ${c.resolution}: ${c.choice_reason}`);
    }
    lines.push('');
  }

  if (r.ai_judgments && r.ai_judgments.length > 0) {
    lines.push('## AI 판단 로그');
    for (const j of r.ai_judgments) {
      const loc = j.line ? `${j.file}:${j.line}` : j.file;
      lines.push(`- [${j.confidence}] ${loc} — ${j.description} (${j.type})`);
    }
    lines.push('');
  }

  const v = r.verification;
  lines.push('## 검증 결과');
  lines.push(`- Build: ${v.build}`);
  lines.push(`- Test: ${v.test.status}${v.test.passed != null ? ` (${v.test.passed} passed${v.test.failed ? `, ${v.test.failed} failed` : ''})` : ''}`);
  lines.push(`- Lint: ${v.lint}`);
  lines.push(`- Acceptance: ${v.acceptance}`);

  if (r.task_ids && r.task_ids.length > 0) {
    lines.push('');
    lines.push(`## 관련 태스크: ${r.task_ids.join(', ')}`);
  }

  return lines.join('\n');
}

function formatMergeReportList(reports: MergeReport[]): string {
  if (reports.length === 0) return '리포트가 없습니다.';
  const header = '| # | 날짜 | 브랜치 | 커밋 | Checklist | 충돌 |';
  const sep = '|---|------|--------|------|-----------|------|';
  const rows = reports.map((r, i) => {
    const date = r.created_at.split('T')[0] || r.created_at.split(' ')[0];
    const must = r.review_checklist.filter(c => c.level === 'must').length;
    const should = r.review_checklist.filter(c => c.level === 'should').length;
    const info = r.review_checklist.filter(c => c.level === 'info').length;
    const conflicts = r.conflict_log?.length ?? 0;
    return `| ${i + 1} | ${date} | ${r.source_branch} → ${r.target_branch} | ${r.commit_hash.slice(0, 8)} | 🔴${must} 🟡${should} 🟢${info} | ${conflicts} |`;
  });
  return [header, sep, ...rows].join('\n');
}
