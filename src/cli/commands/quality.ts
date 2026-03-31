import { Command } from 'commander';
import * as fs from 'node:fs';
import { output, outputError, withErrorHandler, initModels, initDb } from '../shared.js';
import type { Models } from '../shared.js';
import type { QARunTrigger, QAScenarioCategory, QAScenarioPriority, QAScenarioStatus, QAFindingSeverity, QAFindingCategory, QAFindingStatus, PlanStatus } from '../../core/types.js';
import { VALID_QA_RUN_TERMINAL_STATUSES } from '../../core/types.js';
import { resolveConfig, validateConfig, detectProfile, QaRulesSchema, PROFILE_PRESETS, DEFAULT_QA_CONFIG } from '../../core/engine/qa-config.js';
import type { ResolvedQaConfig } from '../../core/engine/qa-config.js';
import * as YAML from 'yaml';

function getQAModels() {
  const m = initModels();
  return { qaRun: m.qaRunModel, qaScenario: m.qaScenarioModel, qaFinding: m.qaFindingModel, planModel: m.planModel };
}

export function registerQualityCommands(program: Command, getModels: () => Models): void {
  const qa = program.command('qa').description('Manage QA runs, scenarios, and findings');

  // qa run
  const qaRun = qa.command('run').description('Manage QA runs');

  qaRun
    .command('create')
    .argument('[plan_id]', 'Plan ID (optional for --mode security-only)')
    .option('--trigger <type>', 'Trigger type (manual, auto, milestone)', 'manual')
    .option('--mode <mode>', 'Run mode (full, security-only)')
    .description('Create a new QA run')
    .action((planId: string | undefined, opts: { trigger: string; mode?: string }) => withErrorHandler(() => {
      const { qaRun: qaRunModel } = getQAModels();
      if (opts.mode === 'security-only') {
        // security-only 모드: sentinel plan 자동 생성 후 Run 연결
        const { planModel } = initModels();
        let sentinelPlan = planModel.list({ status: 'active' as PlanStatus }).find(p => p.title === '__security_audit__');
        if (!sentinelPlan) {
          sentinelPlan = planModel.create('__security_audit__', 'Auto-created sentinel plan for standalone security audits');
        }
        const run = qaRunModel.create(sentinelPlan.id, opts.trigger as QARunTrigger);
        output(run, `Created security-only QA run: ${run.id} (sentinel plan: ${sentinelPlan.id})`);
        return;
      }
      if (!planId) return outputError('Plan ID is required (use --mode security-only for standalone)');
      const { planModel } = initModels();
      const plan = planModel.getById(planId);
      if (!plan) return outputError(`Plan not found: ${planId}`);
      const run = qaRunModel.create(planId, opts.trigger as QARunTrigger);
      output(run, `Created QA run: ${run.id} (plan: ${planId}, trigger: ${opts.trigger})`);
    }));

  qaRun
    .command('list')
    .option('--plan <plan_id>', 'Filter by plan ID')
    .description('List QA runs')
    .action((opts: { plan?: string }) => withErrorHandler(() => {
      const { qaRun: qaRunModel } = getQAModels();
      const runs = qaRunModel.list(opts.plan);
      if (runs.length === 0) {
        output(runs, 'No QA runs found.');
        return;
      }
      output(runs, runs.map(r =>
        `${r.id}  ${r.status.padEnd(10)}  risk:${r.risk_score.toFixed(2)}  ${r.passed_scenarios}/${r.total_scenarios} passed  ${r.created_at}`
      ).join('\n'));
    }));

  qaRun
    .command('show')
    .argument('<run_id>', 'QA Run ID')
    .description('Show QA run details with scenarios and findings')
    .action((runId: string) => withErrorHandler(() => {
      const { qaRun: qaRunModel, qaScenario, qaFinding } = getQAModels();
      const run = qaRunModel.get(runId);
      if (!run) return outputError(`QA run not found: ${runId}`);
      const summary = qaRunModel.getSummary(runId);
      const scenarios = qaScenario.listByRun(runId);
      const findings = qaFinding.list({ runId });
      output({ run, summary, scenarios, findings }, [
        `QA Run: ${run.id} (${run.status})`,
        `Plan: ${run.plan_id} | Trigger: ${run.trigger} | Risk: ${run.risk_score.toFixed(2)}`,
        `Scenarios: ${run.passed_scenarios}/${run.total_scenarios} passed, ${run.failed_scenarios} failed`,
        findings.length > 0 ? `Findings: ${findings.length} total` : 'Findings: none',
        run.summary ? `Summary: ${run.summary}` : '',
      ].filter(Boolean).join('\n'));
    }));

  qaRun
    .command('complete')
    .argument('<run_id>', 'QA Run ID')
    .option('--summary <text>', 'Summary of the QA run results')
    .option('--status <status>', 'Final status (completed, failed)', 'completed')
    .description('Complete a QA run and set its final status')
    .action((runId: string, opts: { summary?: string; status?: string }) => withErrorHandler(() => {
      const statusInput = opts.status!;
      if (!VALID_QA_RUN_TERMINAL_STATUSES.includes(statusInput as typeof VALID_QA_RUN_TERMINAL_STATUSES[number])) {
        return outputError(`Invalid status: ${statusInput}. Must be one of: ${VALID_QA_RUN_TERMINAL_STATUSES.join(', ')}`);
      }
      const status = statusInput as typeof VALID_QA_RUN_TERMINAL_STATUSES[number];
      const { qaRun: qaRunModel } = getQAModels();
      const run = qaRunModel.get(runId);
      if (!run) return outputError(`QA run not found: ${runId}`);
      if ((VALID_QA_RUN_TERMINAL_STATUSES as readonly string[]).includes(run.status)) {
        return outputError(`QA run ${runId} is already ${run.status}`);
      }
      const updated = qaRunModel.updateStatus(runId, status, opts.summary);
      output(updated, `QA run ${runId} marked as ${status}${opts.summary ? ` — ${opts.summary}` : ''}`);
    }));

  // qa scenario
  const qaScenarioCmd = qa.command('scenario').description('Manage QA scenarios');

  qaScenarioCmd
    .command('create')
    .argument('<run_id>', 'QA Run ID')
    .requiredOption('--title <title>', 'Scenario title')
    .requiredOption('--description <desc>', 'Scenario description')
    .requiredOption('--category <cat>', 'Category (functional, integration, flow, regression, edge_case)')
    .option('--priority <p>', 'Priority (critical, high, medium, low)', 'medium')
    .option('--related-tasks <ids>', 'Comma-separated related task IDs')
    .option('--agent <name>', 'Assigned agent name')
    .description('Create a QA scenario')
    .action((runId: string, opts: { title: string; description: string; category: string; priority: string; relatedTasks?: string; agent?: string }) => withErrorHandler(() => {
      const { qaRun: qaRunModel, qaScenario } = getQAModels();
      const run = qaRunModel.get(runId);
      if (!run) return outputError(`QA run not found: ${runId}`);
      if (run.status !== 'pending' && run.status !== 'running') {
        return outputError(`Cannot add scenarios to ${run.status} run`);
      }
      const scenario = qaScenario.create(runId, {
        category: opts.category as QAScenarioCategory,
        title: opts.title,
        description: opts.description,
        priority: opts.priority as QAScenarioPriority,
        related_tasks: opts.relatedTasks ? JSON.stringify(opts.relatedTasks.split(',').map(s => s.trim())) : undefined,
      });
      output(scenario, `Created scenario: ${scenario.id} [${scenario.category}] ${scenario.title}`);
    }));

  qaScenarioCmd
    .command('update')
    .argument('<id>', 'Scenario ID')
    .requiredOption('--status <status>', 'Status (pending, running, pass, fail, skip, warn)')
    .option('--evidence <text>', 'Evidence text')
    .description('Update scenario status')
    .action((id: string, opts: { status: string; evidence?: string }) => withErrorHandler(() => {
      const { qaScenario } = getQAModels();
      const existing = qaScenario.get(id);
      if (!existing) return outputError(`Scenario not found: ${id}`);
      qaScenario.updateStatus(id, opts.status as QAScenarioStatus, opts.evidence);
      const updated = qaScenario.get(id)!;
      output(updated, `Updated scenario ${id}: ${updated.status}`);
    }));

  qaScenarioCmd
    .command('list')
    .argument('<run_id>', 'QA Run ID')
    .option('--category <cat>', 'Filter by category')
    .option('--status <status>', 'Filter by status')
    .description('List scenarios for a QA run')
    .action((runId: string, opts: { category?: string; status?: string }) => withErrorHandler(() => {
      const { qaScenario } = getQAModels();
      const scenarios = qaScenario.listByRun(runId, {
        category: opts.category,
        status: opts.status,
      });
      if (scenarios.length === 0) {
        output(scenarios, 'No scenarios found.');
        return;
      }
      output(scenarios, scenarios.map(s =>
        `${s.id}  [${s.category}]  ${s.status.padEnd(7)}  ${s.priority.padEnd(8)}  ${s.title}`
      ).join('\n'));
    }));

  // qa finding
  const qaFindingCmd = qa.command('finding').description('Manage QA findings');

  qaFindingCmd
    .command('create')
    .argument('<run_id>', 'QA Run ID')
    .requiredOption('--title <title>', 'Finding title')
    .requiredOption('--description <desc>', 'Finding description')
    .requiredOption('--severity <s>', 'Severity (critical, high, medium, low)')
    .requiredOption('--category <cat>', 'Category (bug, regression, missing_feature, inconsistency, performance, security, ux_issue, spec_gap)')
    .option('--scenario-id <id>', 'Related scenario ID')
    .option('--affected-files <files>', 'Comma-separated affected files')
    .option('--related-task-id <id>', 'Related task ID')
    .option('--fix-suggestion <text>', 'Fix suggestion')
    .description('Create a QA finding')
    .action((runId: string, opts: { title: string; description: string; severity: string; category: string; scenarioId?: string; affectedFiles?: string; relatedTaskId?: string; fixSuggestion?: string }) => withErrorHandler(() => {
      const { qaRun: qaRunModel, qaFinding } = getQAModels();
      const run = qaRunModel.get(runId);
      if (!run) return outputError(`QA run not found: ${runId}`);
      const finding = qaFinding.create(runId, {
        scenario_id: opts.scenarioId,
        severity: opts.severity as QAFindingSeverity,
        category: opts.category as QAFindingCategory,
        title: opts.title,
        description: opts.description,
        affected_files: opts.affectedFiles ? JSON.stringify(opts.affectedFiles.split(',').map(s => s.trim())) : undefined,
        related_task_id: opts.relatedTaskId,
        fix_suggestion: opts.fixSuggestion,
      });
      output(finding, `Created finding: ${finding.id} [${finding.severity}] ${finding.title}`);
    }));

  qaFindingCmd
    .command('update')
    .argument('<id>', 'Finding ID')
    .requiredOption('--status <status>', 'Status (open, planned, fixed, wontfix, duplicate)')
    .option('--fix-plan-id <id>', 'Fix plan ID')
    .description('Update finding status')
    .action((id: string, opts: { status: string; fixPlanId?: string }) => withErrorHandler(() => {
      const { qaFinding } = getQAModels();
      const existing = qaFinding.get(id);
      if (!existing) return outputError(`Finding not found: ${id}`);
      qaFinding.updateStatus(id, opts.status as QAFindingStatus, opts.fixPlanId);
      const updated = qaFinding.get(id)!;
      output(updated, `Updated finding ${id}: ${updated.status}`);
    }));

  qaFindingCmd
    .command('list')
    .option('--run <run_id>', 'Filter by QA run ID')
    .option('--severity <s>', 'Filter by severity')
    .option('--status <s>', 'Filter by status')
    .option('--category <cat>', 'Filter by category')
    .description('List QA findings')
    .action((opts: { run?: string; severity?: string; status?: string; category?: string }) => withErrorHandler(() => {
      const { qaFinding } = getQAModels();
      const findings = qaFinding.list({
        runId: opts.run,
        severity: opts.severity,
        status: opts.status,
        category: opts.category,
      });
      if (findings.length === 0) {
        output(findings, 'No findings found.');
        return;
      }
      output(findings, findings.map(f =>
        `${f.id}  [${f.severity}]  ${f.status.padEnd(9)}  ${f.category.padEnd(16)}  ${f.title}`
      ).join('\n'));
    }));

  // qa stats
  qa
    .command('stats')
    .option('--plan <plan_id>', 'Filter by plan ID')
    .description('Show QA statistics')
    .action((opts: { plan?: string }) => withErrorHandler(() => {
      const { qaRun: qaRunModel, qaFinding } = getQAModels();
      const runs = qaRunModel.list(opts.plan);
      const completedRuns = runs.filter(r => r.status === 'completed');
      const avgRisk = completedRuns.length > 0
        ? completedRuns.reduce((sum, r) => sum + r.risk_score, 0) / completedRuns.length
        : 0;
      const allFindings = opts.plan
        ? runs.flatMap(r => qaFinding.list({ runId: r.id }))
        : qaFinding.list();
      const openFindings = allFindings.filter(f => f.status === 'open');

      const statsData = {
        total_runs: runs.length,
        completed_runs: completedRuns.length,
        avg_risk_score: Math.round(avgRisk * 100) / 100,
        total_findings: allFindings.length,
        open_findings: openFindings.length,
        findings_by_severity: {
          critical: openFindings.filter(f => f.severity === 'critical').length,
          high: openFindings.filter(f => f.severity === 'high').length,
          medium: openFindings.filter(f => f.severity === 'medium').length,
          low: openFindings.filter(f => f.severity === 'low').length,
        },
      };

      output(statsData, [
        `QA Statistics${opts.plan ? ` (plan: ${opts.plan})` : ''}`,
        `Runs: ${statsData.total_runs} total, ${statsData.completed_runs} completed`,
        `Avg Risk Score: ${statsData.avg_risk_score}`,
        `Findings: ${statsData.total_findings} total, ${statsData.open_findings} open`,
        `  critical: ${statsData.findings_by_severity.critical}  high: ${statsData.findings_by_severity.high}  medium: ${statsData.findings_by_severity.medium}  low: ${statsData.findings_by_severity.low}`,
      ].join('\n'));
    }));

  // qa config
  const qaConfig = qa.command('config').description('Manage QA configuration');

  // qa config resolve [plan_id]
  qaConfig
    .command('resolve')
    .argument('[plan_id]', 'Plan ID for L2 overrides')
    .description('Resolve and display merged QA configuration')
    .action((planId?: string) => withErrorHandler(() => {
      const options: { planId?: string; db?: any } = {};
      if (planId) {
        options.planId = planId;
        options.db = initDb();
      }
      const config = resolveConfig(options);
      output(config, formatConfigHuman(config));
    }));

  // qa config validate
  qaConfig
    .command('validate')
    .description('Validate .claude/qa-rules.yaml')
    .action(() => withErrorHandler(() => {
      const yamlPath = '.claude/qa-rules.yaml';
      if (!fs.existsSync(yamlPath)) {
        return outputError(`Configuration file not found: ${yamlPath}`);
      }

      const rawContent = fs.readFileSync(yamlPath, 'utf-8');
      const parsed = YAML.parse(rawContent);
      const zodResult = QaRulesSchema.safeParse(parsed);

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!zodResult.success) {
        for (const issue of zodResult.error.issues) {
          errors.push(`Schema error at ${issue.path.join('.')}: ${issue.message}`);
        }
      }

      // Even if Zod fails, try to validate what we can from resolved config
      if (zodResult.success) {
        const config = resolveConfig({ yamlPath });
        const validation = validateConfig(config);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
      }

      const result = { errors, warnings, valid: errors.length === 0 };
      output(result, [
        `Validation: ${result.valid ? 'PASS' : 'FAIL'}`,
        errors.length > 0 ? `Errors (${errors.length}):` : '',
        ...errors.map(e => `  - ${e}`),
        warnings.length > 0 ? `Warnings (${warnings.length}):` : '',
        ...warnings.map(w => `  - ${w}`),
      ].filter(Boolean).join('\n'));
    }));

  // qa config init
  qaConfig
    .command('init')
    .description('Auto-detect profile and create .claude/qa-rules.yaml')
    .action(() => withErrorHandler(() => {
      const yamlPath = '.claude/qa-rules.yaml';
      if (fs.existsSync(yamlPath)) {
        return outputError(`Configuration file already exists: ${yamlPath}`);
      }

      // Detect profile from package.json
      let profile = 'library';
      try {
        const pkgContent = fs.readFileSync('package.json', 'utf-8');
        const pkgJson = JSON.parse(pkgContent);
        profile = detectProfile(pkgJson);
      } catch {
        // No package.json or parse error; default to library
      }

      // Build initial config
      const preset = PROFILE_PRESETS[profile] ?? {};
      const config = {
        profile,
        ...DEFAULT_QA_CONFIG,
        ...preset,
      };

      // Ensure .claude directory exists
      if (!fs.existsSync('.claude')) {
        fs.mkdirSync('.claude', { recursive: true });
      }

      const yamlContent = YAML.stringify(config);
      fs.writeFileSync(yamlPath, yamlContent, 'utf-8');

      output(
        { profile, path: yamlPath },
        `Created ${yamlPath} with profile: ${profile}`,
      );
    }));

  // qa config show
  qaConfig
    .command('show')
    .argument('[plan_id]', 'Plan ID for L2 overrides')
    .description('Show resolved QA configuration in formatted view')
    .action((planId?: string) => withErrorHandler(() => {
      const options: { planId?: string; db?: any } = {};
      if (planId) {
        options.planId = planId;
        options.db = initDb();
      }
      const config = resolveConfig(options);
      output(config, formatConfigHuman(config));
    }));
}

function formatConfigHuman(config: ResolvedQaConfig): string {
  const lines: string[] = [];

  if (config.profile) {
    lines.push(`Profile: ${config.profile}`);
    lines.push('');
  }

  lines.push('Risk Thresholds:');
  lines.push(`  green:  ${config.risk_thresholds.green}`);
  lines.push(`  yellow: ${config.risk_thresholds.yellow}`);
  lines.push(`  orange: ${config.risk_thresholds.orange}`);
  lines.push('');

  lines.push('Severity Weights:');
  lines.push(`  critical: ${config.severity_weights.critical}`);
  lines.push(`  high:     ${config.severity_weights.high}`);
  lines.push(`  medium:   ${config.severity_weights.medium}`);
  lines.push(`  low:      ${config.severity_weights.low}`);
  lines.push('');

  lines.push('Modules:');
  for (const [key, val] of Object.entries(config.modules)) {
    lines.push(`  ${key}: ${val ? 'enabled' : 'disabled'}`);
  }
  lines.push('');

  lines.push(`Regression Bonus: ${config.regression_bonus}`);

  if (config.custom_rules && config.custom_rules.length > 0) {
    lines.push('');
    lines.push(`Custom Rules (${config.custom_rules.length}):`);
    for (const rule of config.custom_rules) {
      lines.push(`  [${rule.severity}] ${rule.id}: ${rule.message}`);
    }
  }

  if (config.ignore && config.ignore.length > 0) {
    lines.push('');
    lines.push(`Ignore Rules (${config.ignore.length}):`);
    for (const rule of config.ignore) {
      lines.push(`  ${rule.rule_id}: ${rule.reason} (${rule.paths.join(', ')})`);
    }
  }

  return lines.join('\n');
}
