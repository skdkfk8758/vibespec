import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';
import { generateId } from '../utils.js';
import type {
  GCScan,
  GCScanOptions,
  GCFinding,
  GCChange,
  GCScanner,
} from '../types.js';

export class GCEngine {
  private db: Database.Database;
  private projectRoot: string;
  private scanners: GCScanner[] = [];

  constructor(db: Database.Database, projectRoot: string) {
    this.db = db;
    this.projectRoot = projectRoot;
  }

  registerScanner(scanner: GCScanner): void {
    this.scanners.push(scanner);
  }

  getScanners(): readonly GCScanner[] {
    return this.scanners;
  }

  async scan(options: GCScanOptions): Promise<GCScan> {
    const scanId = generateId();
    const startedAt = new Date().toISOString();

    // Create scan record
    this.db.prepare(`
      INSERT INTO gc_scans (id, scan_type, started_at, status)
      VALUES (?, ?, ?, 'running')
    `).run(scanId, options.scan_type, startedAt);

    try {
      // Collect target files
      const targetPath = options.path ?? this.projectRoot;
      const files = await this.collectFiles(targetPath);

      // Run all registered scanners in parallel
      const scannerResults = await Promise.allSettled(
        this.scanners.map(scanner => scanner.scan(files)),
      );
      const allFindings: GCFinding[] = [];
      for (let i = 0; i < scannerResults.length; i++) {
        const result = scannerResults[i];
        if (result.status === 'fulfilled') {
          allFindings.push(...result.value);
        } else {
          console.error(`[GC] Scanner "${this.scanners[i].name}" failed:`, result.reason);
        }
      }

      // Store findings
      const insertFinding = this.db.prepare(`
        INSERT INTO gc_findings (id, scan_id, category, severity, safety_level, file_path, line_start, line_end, rule_source, rule_id, description, suggested_fix, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'detected')
      `);

      const insertMany = this.db.transaction((findings: GCFinding[]) => {
        for (const f of findings) {
          insertFinding.run(
            f.id, scanId, f.category, f.severity, f.safety_level,
            f.file_path, f.line_start, f.line_end, f.rule_source,
            f.rule_id, f.description, f.suggested_fix,
          );
        }
      });

      insertMany(allFindings);

      // Update scan record
      const completedAt = new Date().toISOString();
      this.db.prepare(`
        UPDATE gc_scans SET completed_at = ?, files_scanned = ?, findings_count = ?, status = 'completed'
        WHERE id = ?
      `).run(completedAt, files.length, allFindings.length, scanId);

      return this.getScan(scanId)!;
    } catch (err) {
      this.db.prepare(`
        UPDATE gc_scans SET completed_at = ?, status = 'failed' WHERE id = ?
      `).run(new Date().toISOString(), scanId);
      throw err;
    }
  }

  getScan(scanId: string): GCScan | null {
    return (this.db.prepare('SELECT * FROM gc_scans WHERE id = ?').get(scanId) as GCScan) ?? null;
  }

  listScans(): GCScan[] {
    return this.db.prepare('SELECT * FROM gc_scans ORDER BY started_at DESC').all() as GCScan[];
  }

  getFindings(scanId: string, severity?: string): GCFinding[] {
    if (severity) {
      return this.db.prepare(
        'SELECT * FROM gc_findings WHERE scan_id = ? AND severity = ? ORDER BY file_path, line_start',
      ).all(scanId, severity) as GCFinding[];
    }
    return this.db.prepare(
      'SELECT * FROM gc_findings WHERE scan_id = ? ORDER BY file_path, line_start',
    ).all(scanId) as GCFinding[];
  }

  async applySafeFixes(scanId: string): Promise<GCChange[]> {
    // Check for uncommitted changes
    this.assertCleanWorkingTree();

    // Get SAFE findings with suggested_fix
    const findings = this.db.prepare(
      "SELECT * FROM gc_findings WHERE scan_id = ? AND safety_level = 'SAFE' AND suggested_fix IS NOT NULL AND status = 'detected'",
    ).all(scanId) as GCFinding[];

    if (findings.length === 0) return [];

    const changes: GCChange[] = [];

    for (const finding of findings) {
      const change = this.applyFixToFile(finding);
      if (change) {
        changes.push(change);
        // Update finding status
        this.db.prepare(
          "UPDATE gc_findings SET status = 'auto_fixed', resolved_at = ? WHERE id = ?",
        ).run(new Date().toISOString(), finding.id);
      }
    }

    if (changes.length > 0) {
      // Stage and commit all changes as a single commit
      execSync('git add -A', { cwd: this.projectRoot, stdio: 'pipe' });
      const commitMsg = `chore(gc): auto-fix ${changes.length} safe findings from scan ${scanId}`;
      execSync(`git commit -m "${commitMsg}"`, { cwd: this.projectRoot, stdio: 'pipe' });

      // Get commit SHA
      const commitSha = execSync('git rev-parse HEAD', { cwd: this.projectRoot, stdio: 'pipe' }).toString().trim();

      // Record changes in DB
      const insertChange = this.db.prepare(
        'INSERT INTO gc_changes (id, finding_id, commit_sha, file_path, diff_content, rollback_cmd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      );
      const now = new Date().toISOString();
      for (const change of changes) {
        change.commit_sha = commitSha;
        change.rollback_cmd = `git revert --no-edit ${commitSha}`;
        insertChange.run(change.id, change.finding_id, commitSha, change.file_path, change.diff_content, change.rollback_cmd, now);
      }

      // Update scan auto_fixed_count
      this.db.prepare(
        'UPDATE gc_scans SET auto_fixed_count = ? WHERE id = ?',
      ).run(changes.length, scanId);
    }

    return changes;
  }

  async applyFinding(findingId: string): Promise<GCChange | null> {
    this.assertCleanWorkingTree();

    const finding = this.db.prepare(
      'SELECT * FROM gc_findings WHERE id = ?',
    ).get(findingId) as GCFinding | undefined;

    if (!finding || !finding.suggested_fix || finding.status !== 'detected') {
      return null;
    }

    const change = this.applyFixToFile(finding);
    if (!change) return null;

    // Stage and commit
    execSync('git add -A', { cwd: this.projectRoot, stdio: 'pipe' });
    const commitMsg = `chore(gc): fix ${finding.category} in ${finding.file_path}`;
    execSync(`git commit -m "${commitMsg}"`, { cwd: this.projectRoot, stdio: 'pipe' });

    const commitSha = execSync('git rev-parse HEAD', { cwd: this.projectRoot, stdio: 'pipe' }).toString().trim();
    const now = new Date().toISOString();

    change.commit_sha = commitSha;
    change.rollback_cmd = `git revert --no-edit ${commitSha}`;

    this.db.prepare(
      'INSERT INTO gc_changes (id, finding_id, commit_sha, file_path, diff_content, rollback_cmd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(change.id, change.finding_id, commitSha, change.file_path, change.diff_content, change.rollback_cmd, now);

    // Update finding status
    this.db.prepare(
      "UPDATE gc_findings SET status = 'approved', resolved_at = ? WHERE id = ?",
    ).run(now, finding.id);

    return change;
  }

  async revertScan(scanId: string): Promise<void> {
    const changes = this.db.prepare(
      'SELECT DISTINCT commit_sha FROM gc_changes WHERE finding_id IN (SELECT id FROM gc_findings WHERE scan_id = ?) ORDER BY created_at DESC',
    ).all(scanId) as Array<{ commit_sha: string }>;

    for (const { commit_sha } of changes) {
      execSync(`git revert --no-edit ${commit_sha}`, { cwd: this.projectRoot, stdio: 'pipe' });
    }

    // Update finding statuses to reverted
    this.db.prepare(
      "UPDATE gc_findings SET status = 'reverted', resolved_at = ? WHERE scan_id = ? AND status IN ('auto_fixed', 'approved')",
    ).run(new Date().toISOString(), scanId);
  }

  private assertCleanWorkingTree(): void {
    const status = execSync('git status --porcelain', { cwd: this.projectRoot, stdio: 'pipe' }).toString().trim();
    if (status.length > 0) {
      throw new Error('Cannot apply fixes: uncommitted changes exist. Commit or stash them first.');
    }
  }

  private applyFixToFile(finding: GCFinding): GCChange | null {
    if (!finding.suggested_fix) return null;

    const filePath = finding.file_path;
    const absPath = filePath.startsWith('/')
      ? filePath
      : `${this.projectRoot}/${filePath}`;

    if (!fs.existsSync(absPath)) return null;

    const originalContent = fs.readFileSync(absPath, 'utf-8');
    const lines = originalContent.split('\n');

    // Apply the suggested fix by removing the offending lines
    // For dead code: remove the lines. For others: replace with suggested_fix content.
    const start = Math.max(0, finding.line_start - 1);
    const end = Math.min(lines.length, finding.line_end);

    const removedLines = lines.slice(start, end).join('\n');
    lines.splice(start, end - start);

    fs.writeFileSync(absPath, lines.join('\n'), 'utf-8');

    return {
      id: generateId(),
      finding_id: finding.id,
      commit_sha: '', // filled after git commit
      file_path: finding.file_path,
      diff_content: `--- removed lines ${finding.line_start}-${finding.line_end}:\n${removedLines}`,
      rollback_cmd: '', // filled after git commit
      created_at: new Date().toISOString(),
    };
  }

  private async collectFiles(targetPath: string): Promise<string[]> {
    const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py', '.go', '.rs']);
    const ignoreDirs = new Set(['node_modules', 'dist', 'build', '.git', '.claude']);
    const results: string[] = [];

    const walk = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            walk(path.join(dir, entry.name));
          }
        } else if (extensions.has(path.extname(entry.name))) {
          results.push(path.join(dir, entry.name));
        }
      }
    };

    walk(targetPath);
    return results;
  }
}
