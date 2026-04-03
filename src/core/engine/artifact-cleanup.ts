import type Database from 'better-sqlite3';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { generateId } from '../utils.js';
import { RuleCleanup } from './rule-cleanup.js';
import { SelfImproveEngine } from './self-improve.js';

export interface CleanupOptions {
  retentionDays?: number;
  dryRun?: boolean;
  trigger?: 'vs-wrap' | 'manual';
}

export interface CleanupResult {
  handoffsRemoved: number;
  reportsRemoved: number;
  rulesArchived: number;
  rulesConflicts: number;
  emptyDirsRemoved: number;
  details: string[];
}

// Directories that should never be removed even when empty
const PRESERVED_DIRS = new Set(['archive', 'hooks', 'error-kb', 'plans', 'qa-reports', 'qa-results', 'self-improve']);

export class ArtifactCleanup {
  private db: Database.Database;
  private projectRoot: string;
  private claudeDir: string;

  constructor(db: Database.Database, projectRoot: string) {
    this.db = db;
    this.projectRoot = projectRoot;
    this.claudeDir = join(projectRoot, '.claude');
  }

  async run(options?: CleanupOptions): Promise<CleanupResult> {
    const retentionDays = options?.retentionDays ?? 7;
    const dryRun = options?.dryRun ?? false;
    const trigger = options?.trigger ?? 'manual';

    const result: CleanupResult = {
      handoffsRemoved: 0,
      reportsRemoved: 0,
      rulesArchived: 0,
      rulesConflicts: 0,
      emptyDirsRemoved: 0,
      details: [],
    };

    if (!existsSync(this.claudeDir)) {
      result.details.push('.claude/ directory not found, skipping');
      return result;
    }

    const startedAt = new Date().toISOString();

    result.handoffsRemoved = this.cleanHandoffs(retentionDays, dryRun, result.details);
    result.reportsRemoved = this.cleanReports(retentionDays, dryRun, result.details);

    const ruleResult = this.runRuleCleanup(result.details);
    result.rulesArchived = ruleResult.archived;
    result.rulesConflicts = ruleResult.conflicts;

    result.emptyDirsRemoved = this.cleanEmptyDirs(dryRun, result.details);

    this.recordCleanup(generateId(), trigger, startedAt, dryRun, result);

    return result;
  }

  private cleanHandoffs(retentionDays: number, dryRun: boolean, details: string[]): number {
    const handoffDir = join(this.claudeDir, 'handoff');
    if (!existsSync(handoffDir)) return 0;

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const activeTaskIds = this.getActiveHandoffTaskIds();
    let removed = 0;

    for (const entry of readdirSync(handoffDir)) {
      const fullPath = join(handoffDir, entry);
      try {
        const stat = statSync(fullPath);
        if (!stat.isDirectory()) continue;

        const isActive = activeTaskIds.has(entry);

        // Empty directory: remove unless linked to active plan
        const contents = readdirSync(fullPath);
        if (contents.length === 0 && !isActive) {
          if (!dryRun) rmSync(fullPath, { recursive: true });
          details.push(`${dryRun ? '[dry-run] ' : ''}removed empty handoff: ${entry}`);
          removed++;
          continue;
        }

        // Expired directory: remove unless linked to active plan
        if (stat.mtimeMs < cutoff && !isActive) {
          if (!dryRun) rmSync(fullPath, { recursive: true });
          details.push(`${dryRun ? '[dry-run] ' : ''}removed expired handoff: ${entry}`);
          removed++;
        }
      } catch (err) {
        details.push(`error cleaning handoff ${entry}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return removed;
  }

  private cleanReports(retentionDays: number, dryRun: boolean, details: string[]): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const reportDirs = ['session-reports', 'reports'];
    let removed = 0;

    for (const dirName of reportDirs) {
      const dir = join(this.claudeDir, dirName);
      if (!existsSync(dir)) continue;

      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (!stat.isFile()) continue;

          if (stat.mtimeMs < cutoff) {
            if (!dryRun) rmSync(fullPath);
            details.push(`${dryRun ? '[dry-run] ' : ''}removed ${dirName}/${entry}`);
            removed++;
          }
        } catch (err) {
          details.push(`error cleaning ${dirName}/${entry}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return removed;
  }

  private runRuleCleanup(details: string[]): { archived: number; conflicts: number } {
    try {
      const engine = new SelfImproveEngine(this.db, this.projectRoot);
      const cleanup = new RuleCleanup(this.db, engine);
      const report = cleanup.detectDuplicates();
      const conflicts = cleanup.detectConflicts();
      const staleArchived = engine.autoArchiveStale();

      details.push(`rule cleanup: ${report.length} duplicate groups, ${conflicts.length} conflicts, ${staleArchived.length} stale archived`);
      return { archived: staleArchived.length, conflicts: conflicts.length };
    } catch (err) {
      details.push(`rule cleanup error: ${err instanceof Error ? err.message : String(err)}`);
      return { archived: 0, conflicts: 0 };
    }
  }

  private cleanEmptyDirs(dryRun: boolean, details: string[]): number {
    let removed = 0;
    const dirsToCheck = ['worktrees'];

    for (const dirName of dirsToCheck) {
      const dir = join(this.claudeDir, dirName);
      if (!existsSync(dir)) continue;

      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (!stat.isDirectory()) continue;
          if (PRESERVED_DIRS.has(entry)) continue;

          const contents = readdirSync(fullPath);
          if (contents.length === 0) {
            if (!dryRun) rmSync(fullPath, { recursive: true });
            details.push(`${dryRun ? '[dry-run] ' : ''}removed empty dir: ${dirName}/${entry}`);
            removed++;
          }
        } catch (err) {
          details.push(`error cleaning ${dirName}/${entry}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return removed;
  }

  private getActiveHandoffTaskIds(): Set<string> {
    try {
      const rows = this.db.prepare(`
        SELECT DISTINCT ah.task_id
        FROM agent_handoffs ah
        JOIN plans p ON ah.plan_id = p.id
        WHERE p.status IN ('draft', 'active', 'approved')
      `).all() as Array<{ task_id: string }>;
      return new Set(rows.map(r => r.task_id));
    } catch {
      return new Set();
    }
  }

  private recordCleanup(
    id: string,
    trigger: string,
    startedAt: string,
    dryRun: boolean,
    result: CleanupResult,
  ): void {
    try {
      const summary = [
        `handoffs: ${result.handoffsRemoved}`,
        `reports: ${result.reportsRemoved}`,
        `rules archived: ${result.rulesArchived}`,
        `conflicts: ${result.rulesConflicts}`,
        `empty dirs: ${result.emptyDirsRemoved}`,
      ].join(', ');

      this.db.prepare(`
        INSERT INTO artifact_cleanups (id, trigger, started_at, completed_at, handoffs_removed, reports_removed, rules_archived, rules_conflicts, empty_dirs_removed, dry_run, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, trigger, startedAt, new Date().toISOString(),
        result.handoffsRemoved, result.reportsRemoved,
        result.rulesArchived, result.rulesConflicts,
        result.emptyDirsRemoved, dryRun ? 1 : 0, summary,
      );
    } catch {
      // DB recording failure is non-fatal
    }
  }
}
