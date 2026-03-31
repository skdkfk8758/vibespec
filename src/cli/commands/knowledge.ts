import { Command } from 'commander';
import { findProjectRoot } from '../../core/db/connection.js';
import { ErrorKBEngine } from '../../core/engine/error-kb.js';
import { SelfImproveEngine } from '../../core/engine/self-improve.js';
import { analyzeRecurringFindings } from '../../core/engine/qa-findings-analyzer.js';
import { formatErrorSearchResults, formatErrorDetail, formatErrorKBStats, formatRuleList, formatRuleDetail, formatEscalationStatus } from '../formatters.js';
import { output, outputError, getJsonMode, initDb, initModels } from '../shared.js';
import type { Models } from '../shared.js';
import type { ErrorSeverity, ErrorUpdateInput } from '../../core/types.js';

function getErrorKBEngine(): ErrorKBEngine {
  const root = findProjectRoot(process.cwd());
  return new ErrorKBEngine(root);
}

function getSelfImproveEngine(): SelfImproveEngine {
  const db = initDb();
  const root = findProjectRoot(process.cwd());
  return new SelfImproveEngine(db, root);
}

export function registerKnowledgeCommands(program: Command, getModels: () => Models): void {
  // ── error-kb ──────────────────────────────────────────────────────────
  const errorKb = program.command('error-kb').description('Manage error knowledge base');

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
        const patch: ErrorUpdateInput = {};
        if (opts.status) patch.status = opts.status as ErrorUpdateInput['status'];
        if (opts.severity) patch.severity = opts.severity as ErrorUpdateInput['severity'];
        engine.update(id, patch);
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

  selfImprove
    .command('status')
    .description('Show self-improve status (pending, rules, last run)')
    .action(() => {
      const engine = getSelfImproveEngine();
      const pending = engine.getPendingCount();
      const stats = engine.getRuleStats();
      const lastRun = engine.getLastRunTimestamp();
      const data = { pending, rules: stats, last_run: lastRun };
      if (getJsonMode()) {
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
      if (getJsonMode()) {
        output(ruleList);
      } else {
        output(ruleList, formatRuleList(ruleList));
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
      if (getJsonMode()) {
        output(rule);
      } else {
        output(rule, formatRuleDetail(rule));
      }
    });

  rules
    .command('update')
    .argument('<id>', 'Rule ID')
    .option('--enforcement <level>', 'Set enforcement level (SOFT or HARD)')
    .description('Update a rule')
    .action((id: string, opts: { enforcement?: string }) => {
      const engine = getSelfImproveEngine();
      if (opts.enforcement === 'HARD') {
        const result = engine.escalateRule(id);
        if (!result) return outputError(`Rule not found or already HARD: ${id}`);
        const updated = engine.getRule(id);
        output(updated, `Rule ${id} escalated to HARD enforcement.`);
      } else if (opts.enforcement === 'SOFT') {
        // DB direct update for SOFT (no file changes needed)
        const rule = engine.getRule(id);
        if (!rule) return outputError(`Rule not found: ${id}`);
        output(rule, `Rule ${id} enforcement is SOFT.`);
      } else {
        outputError('--enforcement must be SOFT or HARD');
      }
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

  // ── escalation subcommands ────────────────────────────────────────────

  selfImprove
    .command('escalation-status')
    .description('Show rules pending escalation to HARD')
    .action(() => {
      const engine = getSelfImproveEngine();
      const candidates = engine.checkEscalation();
      if (getJsonMode()) {
        output(candidates);
      } else {
        output(candidates, formatEscalationStatus(candidates));
      }
    });

  selfImprove
    .command('escalate')
    .option('--auto', 'Automatically escalate all eligible rules to HARD')
    .description('Escalate rules to HARD enforcement')
    .action((opts: { auto?: boolean }) => {
      if (!opts.auto) {
        return outputError('Use --auto flag to escalate eligible rules.');
      }
      const engine = getSelfImproveEngine();
      const candidates = engine.checkEscalation();
      if (candidates.length === 0) {
        output({ escalated: [], count: 0 }, 'No rules eligible for escalation.');
        return;
      }
      const escalated: string[] = [];
      for (const c of candidates) {
        if (engine.escalateRule(c.id)) {
          escalated.push(c.id);
        }
      }
      output(
        { escalated, count: escalated.length },
        `Escalated ${escalated.length} rule(s) to HARD: ${escalated.join(', ')}`,
      );
    });

  selfImprove
    .command('archive-stale')
    .option('--days <days>', 'Number of days without trigger before archiving', '60')
    .description('Archive stale rules that have not been triggered')
    .action((opts: { days: string }) => {
      const engine = getSelfImproveEngine();
      const days = parseInt(opts.days, 10);
      const archived = engine.autoArchiveStale(days);
      output(
        { archived, count: archived.length },
        archived.length > 0
          ? `Archived ${archived.length} stale rule(s): ${archived.join(', ')}`
          : 'No stale rules to archive.',
      );
    });

  selfImprove
    .command('analyze-qa')
    .description('Analyze QA findings for recurring patterns and generate pending self-improve signals')
    .action(() => {
      const db = initDb();
      const root = findProjectRoot(process.cwd());
      const result = analyzeRecurringFindings(db, root);
      output(
        result,
        `Analyzed ${result.analyzed} findings, created ${result.pendingCreated} pending signal(s).`,
      );
    });
}
