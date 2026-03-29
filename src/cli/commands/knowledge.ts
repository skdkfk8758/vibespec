import { Command } from 'commander';
import { findProjectRoot } from '../../core/db/connection.js';
import { ErrorKBEngine } from '../../core/engine/error-kb.js';
import { SelfImproveEngine } from '../../core/engine/self-improve.js';
import { formatErrorSearchResults, formatErrorDetail, formatErrorKBStats } from '../formatters.js';
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
}
