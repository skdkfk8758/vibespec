import { Command } from 'commander';
import { output, outputError, withErrorHandler, initModels } from '../shared.js';
import type { Models } from '../shared.js';
import { CodexDetector } from '../../core/engine/codex-detect.js';
import { buildCodexPrompt } from '../../core/engine/codex-prompt-builder.js';
import { initCodexIntegrationSchema, getByFindingId, listByRunId } from '../../core/engine/codex-integration-db.js';
import { initDb } from '../shared.js';

export function registerCodexCommands(program: Command, _getModels: () => Models): void {
  const codex = program.command('codex').description('Codex plugin integration');

  codex
    .command('detect')
    .option('--invalidate-cache', 'Invalidate cache and re-detect')
    .description('Detect Codex plugin availability and auth status')
    .action((opts: { invalidateCache?: boolean }) => withErrorHandler(() => {
      const detector = new CodexDetector();
      if (opts.invalidateCache) detector.clearCache();
      const result = detector.detect();
      output(result, result.available
        ? `Codex: available, ${result.authenticated ? 'authenticated' : 'NOT authenticated'}${result.plugin_path ? ` (${result.plugin_path})` : ''}`
        : 'Codex: not available');
    }));

  // qa autofix subcommands — registered under the existing 'qa' command
  const qa = program.commands.find((c) => c.name() === 'qa');
  if (!qa) return;

  const autofix = qa.command('autofix').description('Codex-powered autofix for QA findings');

  autofix
    .command('status')
    .argument('<finding_id>', 'Finding ID')
    .description('Show autofix status for a finding')
    .action((findingId: string) => withErrorHandler(() => {
      const db = initDb();
      initCodexIntegrationSchema(db);
      const record = getByFindingId(db, findingId);
      if (!record) return outputError(`No autofix record for finding: ${findingId}`);
      output(record, `Autofix ${findingId}: status=${record.status}, attempt=${record.attempt}, verification=${record.verification_result ?? 'pending'}`);
    }));

  autofix
    .command('list')
    .argument('<run_id>', 'QA Run ID')
    .option('--severity <levels>', 'Filter by severity (comma-separated)', 'critical,high')
    .description('List autofix records for a QA run')
    .action((runId: string, _opts: { severity: string }) => withErrorHandler(() => {
      const db = initDb();
      initCodexIntegrationSchema(db);
      const records = listByRunId(db, runId);
      output(records, records.length > 0
        ? `${records.length} autofix record(s) for run ${runId}`
        : `No autofix records for run ${runId}`);
    }));

  autofix
    .command('dry-run')
    .argument('<finding_id>', 'Finding ID')
    .description('Generate Codex prompt without executing (dry run)')
    .action((findingId: string) => withErrorHandler(() => {
      const m = initModels();
      const finding = m.qaFindingModel.getById(findingId);
      if (!finding) return outputError(`Finding not found: ${findingId}`);
      const result = buildCodexPrompt(finding, process.cwd());
      if (result.escalation) return outputError(`Cannot generate prompt: ${result.escalation.reason}`);
      output(result, `[DRY RUN] Prompt for ${findingId}:\n\n${result.prompt.substring(0, 500)}${result.prompt.length > 500 ? '\n... (truncated)' : ''}`);
    }));
}
