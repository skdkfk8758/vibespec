import { Command } from 'commander';
import { findProjectRoot } from '../../core/db/connection.js';
import { GCEngine } from '../../core/engine/gc.js';
import { RuleRetroScanner } from '../../core/engine/scanners/rule-retro-scanner.js';
import { PolicyScanner } from '../../core/engine/scanners/policy-scanner.js';
import { DeadCodeScanner } from '../../core/engine/scanners/dead-code-scanner.js';
import { RefactorScanner } from '../../core/engine/scanners/refactor-scanner.js';
import { output, outputError, initDb } from '../shared.js';
import type { Models } from '../shared.js';

function getGCEngine(): GCEngine {
  const db = initDb();
  const root = findProjectRoot(process.cwd());
  const engine = new GCEngine(db, root);
  engine.registerScanner(new RuleRetroScanner(root));
  engine.registerScanner(new PolicyScanner(root));
  engine.registerScanner(new DeadCodeScanner());
  engine.registerScanner(new RefactorScanner());
  return engine;
}

export function registerGCCommands(program: Command, _getModels: () => Models): void {
  const gc = program.command('gc').description('Garbage Collection — codebase quality scanner');

  gc
    .command('scan')
    .option('--full', 'Full scan (default)')
    .option('--incremental', 'Incremental scan (changed files only)')
    .option('--path <dir>', 'Target directory')
    .description('Run GC scan on codebase')
    .action(async (opts: { full?: boolean; incremental?: boolean; path?: string }) => {
      try {
        const engine = getGCEngine();
        const scanType = opts.incremental ? 'incremental' as const : 'full' as const;
        const result = await engine.scan({ scan_type: scanType, path: opts.path });

        output(result, [
          `✅ GC Scan completed (${result.scan_type})`,
          `   Files scanned: ${result.files_scanned}`,
          `   Findings: ${result.findings_count}`,
          `   Scan ID: ${result.id}`,
        ].join('\n'));
      } catch (e) {
        outputError(e instanceof Error ? e.message : String(e));
      }
    });

  gc
    .command('report')
    .option('--severity <level>', 'Minimum severity (critical, high, medium, low)', 'high')
    .option('--format <fmt>', 'Output format (json, md)', 'md')
    .option('--scan-id <id>', 'Specific scan ID (default: latest)')
    .description('Show GC scan results')
    .action((opts: { severity: string; format: string; scanId?: string }) => {
      const engine = getGCEngine();
      let scanId = opts.scanId;

      if (!scanId) {
        const scans = engine.listScans();
        if (scans.length === 0) {
          outputError('No scans found. Run `vs gc scan` first.');
        }
        scanId = scans[0].id;
      }

      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const minLevel = severityOrder[opts.severity] ?? 1;

      const allFindings = engine.getFindings(scanId);
      const filtered = allFindings.filter(f => (severityOrder[f.severity] ?? 3) <= minLevel);

      if (opts.format === 'json') {
        output(filtered);
        return;
      }

      // Markdown format
      const lines = [`## GC Report — Scan ${scanId}`, `Findings: ${filtered.length} (${opts.severity}+ severity)`, ''];
      const byCategory: Record<string, typeof filtered> = {};
      for (const f of filtered) {
        (byCategory[f.category] ??= []).push(f);
      }
      for (const [cat, findings] of Object.entries(byCategory)) {
        lines.push(`### ${cat} (${findings.length})`);
        for (const f of findings) {
          lines.push(`- [${f.severity}] ${f.file_path}:${f.line_start} — ${f.description} (${f.safety_level})`);
        }
        lines.push('');
      }
      output(filtered, lines.join('\n'));
    });

  gc
    .command('apply')
    .option('--auto-only', 'Apply only SAFE fixes')
    .option('--all', 'Apply all fixes (requires approval for RISKY)')
    .option('--dry-run', 'Show what would be changed without applying')
    .option('--scan-id <id>', 'Specific scan ID (default: latest)')
    .description('Apply GC fixes')
    .action(async (opts: { autoOnly?: boolean; all?: boolean; dryRun?: boolean; scanId?: string }) => {
      try {
        const engine = getGCEngine();
        let scanId = opts.scanId;

        if (!scanId) {
          const scans = engine.listScans();
          if (scans.length === 0) {
            outputError('No scans found. Run `vs gc scan` first.');
          }
          scanId = scans[0].id;
        }

        if (opts.dryRun) {
          const findings = engine.getFindings(scanId);
          const safe = findings.filter(f => f.safety_level === 'SAFE' && f.suggested_fix && f.status === 'detected');
          output(safe, [
            `🔍 Dry run — ${safe.length} SAFE fixes would be applied:`,
            ...safe.map(f => `  - ${f.file_path}:${f.line_start} — ${f.description}`),
          ].join('\n'));
          return;
        }

        const changes = await engine.applySafeFixes(scanId);
        output(changes, [
          `✅ Applied ${changes.length} safe fixes`,
          ...changes.map(c => `  - ${c.file_path}`),
        ].join('\n'));
      } catch (e) {
        outputError(e instanceof Error ? e.message : String(e));
      }
    });

  gc
    .command('history')
    .description('Show GC scan history')
    .action(() => {
      const engine = getGCEngine();
      const scans = engine.listScans();

      if (scans.length === 0) {
        output([], 'No GC scans found.');
        return;
      }

      const lines = ['## GC Scan History', ''];
      for (const s of scans) {
        lines.push(`- ${s.id} | ${s.scan_type} | ${s.status} | findings: ${s.findings_count} | fixed: ${s.auto_fixed_count} | ${s.started_at}`);
      }
      output(scans, lines.join('\n'));
    });

  gc
    .command('revert')
    .argument('<scan_id>', 'Scan ID to revert')
    .description('Revert all changes from a GC scan')
    .action(async (scanId: string) => {
      try {
        const engine = getGCEngine();
        await engine.revertScan(scanId);
        output({ reverted: scanId }, `✅ Reverted scan ${scanId}`);
      } catch (e) {
        outputError(e instanceof Error ? e.message : String(e));
      }
    });
}
