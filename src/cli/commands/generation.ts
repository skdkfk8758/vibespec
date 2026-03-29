import { Command } from 'commander';
import { output, outputError, withErrorHandler, initModels } from '../shared.js';
import type { Models } from '../shared.js';

export function registerGenerationCommands(program: Command, getModels: () => Models): void {
  // ── ideate ────────────────────────────────────────────────────────────
  const ideate = program.command('ideate').description('Manage ideation records');

  ideate
    .command('list')
    .description('List ideation records from context log')
    .action(() => {
      const { contextModel } = initModels();
      const ideations = contextModel.search('[ideation]');
      if (ideations.length === 0) {
        output([], 'ideation 기록이 없습니다. /vs-ideate로 아이디어를 정리해보세요.');
        return;
      }
      const formatted = ideations.map((l, i) =>
        `${i + 1}. [#${l.id}] ${l.summary.replace('[ideation] ', '')} (${l.created_at})`
      ).join('\n');
      output(ideations, `## Ideation 이력\n\n${formatted}`);
    });

  ideate
    .command('show')
    .argument('<id>', 'Context log ID')
    .description('Show ideation detail')
    .action((id: string) => {
      withErrorHandler(() => {
        const { contextModel } = initModels();
        const log = contextModel.getById(parseInt(id, 10));
        if (!log) return outputError(`Ideation not found: ${id}`);
        output(log, `## Ideation #${log.id}\n\n**Created**: ${log.created_at}\n\n${log.summary}`);
      });
    });
}
