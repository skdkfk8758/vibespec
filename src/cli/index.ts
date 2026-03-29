import { Command } from 'commander';
import { createRequire } from 'node:module';
import { formatDashboard, formatSkillUsage } from './formatters.js';
import { output, setJsonMode, initModels } from './shared.js';
import { registerGovernanceCommands } from './commands/governance.js';
import { registerBacklogCommands } from './commands/backlog.js';
import { registerPlanningCommands } from './commands/planning.js';
import { registerAuxiliaryCommands } from './commands/auxiliary.js';
import { registerKnowledgeCommands } from './commands/knowledge.js';
import { registerQualityCommands } from './commands/quality.js';
import { registerGenerationCommands } from './commands/generation.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

const program = new Command();
program
  .name('vp')
  .description('VibeSpec CLI')
  .version(pkg.version)
  .option('--json', 'Output in JSON format')
  .hook('preAction', () => {
    setJsonMode(program.opts().json === true);
  });

// ── dashboard ──────────────────────────────────────────────────────────

program
  .command('dashboard')
  .description('Show all active plans overview')
  .action(() => {
    const { dashboard, alerts } = initModels();
    const overview = dashboard.getOverview();
    const alertList = alerts.getAlerts();
    const skillUsage = dashboard.getSkillUsageSummary(7);
    const dashboardText = formatDashboard(overview, alertList);
    const skillText = formatSkillUsage(skillUsage);
    const combined = skillText ? `${dashboardText}\n\n${skillText}` : dashboardText;
    output({ overview, alerts: alertList, skill_usage: skillUsage }, combined);
  });

// ── plan + task (→ commands/planning.ts) ──────────────────────────────
registerPlanningCommands(program, initModels);

// ── context + config + stats + history + insights + skill-log + skill-stats + merge-report (→ commands/auxiliary.ts) ──
registerAuxiliaryCommands(program, initModels);

// ── careful / freeze / guard (→ commands/governance.ts) ─────────────
registerGovernanceCommands(program, initModels);

// ── error-kb + self-improve (→ commands/knowledge.ts) ────────────────
registerKnowledgeCommands(program, initModels);

// ── qa (→ commands/quality.ts) ───────────────────────────────────────
registerQualityCommands(program, initModels);

// ── ideate (→ commands/generation.ts) ────────────────────────────────
registerGenerationCommands(program, initModels);

// ── backlog (→ commands/backlog.ts) ──────────────────────────────────
registerBacklogCommands(program, initModels);

program.parse();
