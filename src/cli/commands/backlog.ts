import { Command } from 'commander';
import { output, outputError, withErrorHandler, initModels } from '../shared.js';
import type { Models } from '../shared.js';
import { formatBacklogList, formatBacklogDetail, formatBacklogStats, formatBacklogBoard, formatImportPreview } from '../formatters.js';
import { importFromGithub, importFromFile, importFromSlack } from '../importers.js';
import { VALID_BACKLOG_PRIORITIES, VALID_BACKLOG_CATEGORIES, VALID_BACKLOG_COMPLEXITIES, VALID_BACKLOG_STATUSES } from '../../core/types.js';
import type { BacklogPriority, BacklogCategory, BacklogComplexity, BacklogStatus } from '../../core/types.js';

export function registerBacklogCommands(program: Command, getModels: () => Models): void {
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
      const { backlogModel } = getModels();

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
      const { backlogModel } = getModels();
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
      const { backlogModel } = getModels();
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
      const { backlogModel } = getModels();

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
      const { backlogModel } = getModels();
      backlogModel.delete(id);
      output({ deleted: id }, `Deleted backlog item: ${id}`);
    }));

  backlog
    .command('promote')
    .description('Promote a backlog item to a plan')
    .argument('<id>', 'Backlog item ID')
    .requiredOption('--plan <planId>', 'Plan ID to link')
    .action((id, opts) => withErrorHandler(() => {
      const { backlogModel } = getModels();
      const item = backlogModel.promote(id, opts.plan);
      output(item, `Promoted backlog item ${item.id} → plan ${opts.plan}`);
    }));

  backlog
    .command('stats')
    .description('Show backlog statistics')
    .action(() => withErrorHandler(() => {
      const { backlogModel } = getModels();
      const statsData = backlogModel.getStats();
      output(statsData, formatBacklogStats(statsData));
    }));

  backlog
    .command('board')
    .description('Show backlog in kanban board view')
    .option('--category <category>', 'Filter by category')
    .option('--status <status>', 'Filter by status', 'open')
    .action((opts) => withErrorHandler(() => {
      const { backlogModel } = getModels();
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
      const { backlogModel } = getModels();
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
      const { backlogModel } = getModels();
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
}
