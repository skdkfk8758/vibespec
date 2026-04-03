import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';
import { generateId } from '../utils.js';
import { getConfig, setConfig } from '../config.js';
import type {
  SelfImproveRule,
  RuleStats,
  NewRule,
  EscalationCandidate,
} from '../types.js';

const RULES_DIR = '.claude/rules';
const ARCHIVE_DIR = '.claude/rules/archive';
const PENDING_DIR = '.claude/self-improve/pending';
const PROCESSED_DIR = '.claude/self-improve/processed';

const CONFIG_LAST_RUN = 'self_improve_last_run';
const MAX_ACTIVE_RULES = 30;

export class SelfImproveEngine {
  private db: Database.Database;
  private projectRoot: string;
  private rulesDir: string;
  private archiveDir: string;
  private pendingDir: string;
  private processedDir: string;

  constructor(db: Database.Database, projectRoot: string) {
    this.db = db;
    this.projectRoot = projectRoot;
    this.rulesDir = path.join(projectRoot, RULES_DIR);
    this.archiveDir = path.join(projectRoot, ARCHIVE_DIR);
    this.pendingDir = path.join(projectRoot, PENDING_DIR);
    this.processedDir = path.join(projectRoot, PROCESSED_DIR);
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    fs.mkdirSync(this.rulesDir, { recursive: true });
    fs.mkdirSync(this.archiveDir, { recursive: true });
    fs.mkdirSync(this.pendingDir, { recursive: true });
    fs.mkdirSync(this.processedDir, { recursive: true });
  }

  createRule(newRule: NewRule): SelfImproveRule {
    const id = generateId();
    const slug = newRule.title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const filename = `${newRule.category.toLowerCase()}-${slug}.md`;
    const rulePath = path.join(RULES_DIR, filename);
    const fullPath = path.join(this.projectRoot, rulePath);
    const enforcement = newRule.enforcement ?? 'SOFT';
    const ruleType = newRule.rule_type ?? 'preventive';

    // Write rule file — use procedural template if rule_type is 'procedural'
    const content = ruleType === 'procedural'
      ? this.buildProceduralTemplate(newRule.title, newRule.ruleContent)
      : newRule.ruleContent;
    fs.writeFileSync(fullPath, content, 'utf-8');

    // Insert DB record
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO self_improve_rules (id, error_kb_id, title, category, rule_type, rule_path, occurrences, prevented, status, enforcement, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)
    `).run(id, newRule.error_kb_id ?? null, newRule.title, newRule.category, ruleType, rulePath, enforcement, now);

    return {
      id,
      error_kb_id: newRule.error_kb_id ?? null,
      title: newRule.title,
      category: newRule.category,
      rule_type: ruleType,
      rule_path: rulePath,
      occurrences: 0,
      prevented: 0,
      status: 'active',
      enforcement,
      escalated_at: null,
      created_at: now,
      last_triggered_at: null,
    };
  }

  listRules(status?: 'active' | 'archived', type?: 'preventive' | 'procedural'): SelfImproveRule[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (type) { conditions.push('rule_type = ?'); params.push(type); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const order = status ? 'ORDER BY created_at DESC' : 'ORDER BY status ASC, created_at DESC';
    return this.db.prepare(`SELECT * FROM self_improve_rules ${where} ${order}`).all(...params) as SelfImproveRule[];
  }

  getRule(id: string): SelfImproveRule | null {
    return (this.db.prepare(
      'SELECT * FROM self_improve_rules WHERE id = ?'
    ).get(id) as SelfImproveRule) ?? null;
  }

  archiveRule(id: string): boolean {
    const rule = this.getRule(id);
    if (!rule || rule.status === 'archived') return false;

    // Move file to archive
    const srcPath = path.join(this.projectRoot, rule.rule_path);
    const destPath = path.join(this.archiveDir, path.basename(rule.rule_path));

    if (fs.existsSync(srcPath)) {
      fs.renameSync(srcPath, destPath);
    }

    // Update DB
    const newRulePath = path.join(ARCHIVE_DIR, path.basename(rule.rule_path));
    this.db.prepare(
      'UPDATE self_improve_rules SET status = ?, rule_path = ? WHERE id = ?'
    ).run('archived', newRulePath, id);

    return true;
  }

  incrementPrevented(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE self_improve_rules SET prevented = prevented + 1, last_triggered_at = ? WHERE id = ?'
    ).run(now, id);
  }

  updateOccurrences(id: string, occurrences: number): void {
    this.db.prepare(
      'UPDATE self_improve_rules SET occurrences = ? WHERE id = ?'
    ).run(occurrences, id);
  }

  getPendingCount(): number {
    if (!fs.existsSync(this.pendingDir)) return 0;
    return fs.readdirSync(this.pendingDir)
      .filter(f => f.endsWith('.json'))
      .length;
  }

  listPending(): string[] {
    if (!fs.existsSync(this.pendingDir)) return [];
    return fs.readdirSync(this.pendingDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(this.pendingDir, f))
      .sort();
  }

  movePendingToProcessed(pendingPath: string): void {
    const filename = path.basename(pendingPath);
    const destPath = path.join(this.processedDir, filename);
    if (fs.existsSync(pendingPath)) {
      fs.renameSync(pendingPath, destPath);
    }
  }

  getLastRunTimestamp(): string | null {
    return getConfig(this.db, CONFIG_LAST_RUN);
  }

  setLastRunTimestamp(): void {
    setConfig(this.db, CONFIG_LAST_RUN, new Date().toISOString());
  }

  getRuleStats(): RuleStats {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived,
        COALESCE(SUM(prevented), 0) AS total_prevented
      FROM self_improve_rules
    `).get() as { active: number; archived: number; total_prevented: number } | undefined;

    return {
      active: row?.active ?? 0,
      archived: row?.archived ?? 0,
      total_prevented: row?.total_prevented ?? 0,
    };
  }

  getEffectiveness(id: string): number {
    const rule = this.getRule(id);
    if (!rule) return 0;
    const total = rule.prevented + rule.occurrences;
    if (total === 0) return 0;
    return rule.prevented / total;
  }

  isAtCapacity(): boolean {
    const stats = this.getRuleStats();
    return stats.active >= MAX_ACTIVE_RULES;
  }

  getMaxActiveRules(): number {
    return MAX_ACTIVE_RULES;
  }

  escalateRule(id: string): boolean {
    const rule = this.getRule(id);
    if (!rule || rule.enforcement === 'HARD') return false;

    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE self_improve_rules SET enforcement = ?, escalated_at = ? WHERE id = ?'
    ).run('HARD', now, id);

    // Update rule file: replace Enforcement: SOFT with Enforcement: HARD
    const fullPath = path.join(this.projectRoot, rule.rule_path);
    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      content = content.replace(/Enforcement:\s*SOFT/g, 'Enforcement: HARD');
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    return true;
  }

  checkEscalation(): EscalationCandidate[] {
    const rows = this.db.prepare(`
      SELECT id, title, rule_path, created_at, occurrences, prevented,
        CAST((julianday('now') - julianday(created_at)) AS INTEGER) AS days_since_creation
      FROM self_improve_rules
      WHERE status = 'active'
        AND enforcement = 'SOFT'
        AND occurrences >= 3
        AND prevented = 0
        AND CAST((julianday('now') - julianday(created_at)) AS INTEGER) >= 30
      ORDER BY occurrences DESC
    `).all() as EscalationCandidate[];

    return rows;
  }

  autoArchiveStale(days: number = 60): string[] {
    const rows = this.db.prepare(`
      SELECT id, rule_path FROM self_improve_rules
      WHERE status = 'active'
        AND occurrences = 0
        AND prevented = 0
        AND CAST((julianday('now') - julianday(created_at)) AS INTEGER) >= ?
    `).all(days) as Array<{ id: string; rule_path: string }>;

    const archivedIds: string[] = [];
    for (const row of rows) {
      if (this.archiveRule(row.id)) {
        archivedIds.push(row.id);
      }
    }

    return archivedIds;
  }

  recordViolation(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE self_improve_rules SET occurrences = occurrences + 1, last_triggered_at = ? WHERE id = ?'
    ).run(now, id);
  }

  recordPrevention(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE self_improve_rules SET prevented = prevented + 1, last_triggered_at = ? WHERE id = ?'
    ).run(now, id);
  }

  private buildProceduralTemplate(title: string, content: string): string {
    return `# ${title}\n\n## When to Use\n${content}\n\n## Procedure\n(절차를 기술하세요)\n\n## Pitfalls\n(알려진 함정을 기술하세요)\n`;
  }

  getRulesDir(): string {
    return this.rulesDir;
  }

  getPendingDir(): string {
    return this.pendingDir;
  }

  getProcessedDir(): string {
    return this.processedDir;
  }

  // --- Dream: auto-cleanup of duplicate/conflicting rules ---

  dream(): DreamResult {
    const ruleFiles = this.listRuleFiles();
    if (ruleFiles.length === 0) {
      return new DreamResult([], [], ruleFiles.map(r => r.filename), this);
    }

    const merged: RulePair[] = [];
    const archived: string[] = [];
    const kept: string[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < ruleFiles.length; i++) {
      if (processed.has(i)) continue;
      let foundDuplicate = false;

      for (let j = i + 1; j < ruleFiles.length; j++) {
        if (processed.has(j)) continue;

        const overlap = this.keywordOverlap(ruleFiles[i].keywords, ruleFiles[j].keywords);
        if (overlap >= 0.5) {
          merged.push({
            source: [ruleFiles[i].filename, ruleFiles[j].filename],
            mergedContent: this.mergeContents(ruleFiles[i], ruleFiles[j]),
            mergedFilename: ruleFiles[i].filename,
          });
          archived.push(ruleFiles[j].filename);
          processed.add(j);
          foundDuplicate = true;
          break; // Only merge first found duplicate pair
        }
      }

      if (!foundDuplicate) {
        kept.push(ruleFiles[i].filename);
      } else {
        processed.add(i);
      }
    }

    // Add remaining unprocessed as kept
    for (let i = 0; i < ruleFiles.length; i++) {
      if (!processed.has(i) && !kept.includes(ruleFiles[i].filename)) {
        kept.push(ruleFiles[i].filename);
      }
    }

    return new DreamResult(merged, archived, kept, this);
  }

  private listRuleFiles(): RuleFileInfo[] {
    if (!fs.existsSync(this.rulesDir)) return [];
    const files = fs.readdirSync(this.rulesDir).filter(f => f.endsWith('.md'));
    const results: RuleFileInfo[] = [];

    for (const file of files) {
      const fullPath = path.join(this.rulesDir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const keywords = this.extractKeywords(content);
        results.push({ filename: file, content, keywords, fullPath });
      } catch {
        // Skip unreadable files with warning
        console.warn(`[dream] Skipping unreadable rule file: ${file}`);
      }
    }

    return results;
  }

  private extractKeywords(content: string): Set<string> {
    const words = content
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
    return new Set(words);
  }

  private keywordOverlap(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let overlap = 0;
    for (const word of a) {
      if (b.has(word)) overlap++;
    }
    const minSize = Math.min(a.size, b.size);
    return overlap / minSize;
  }

  private mergeContents(a: RuleFileInfo, b: RuleFileInfo): string {
    return `${a.content}\n\n---\n## Merged from: ${b.filename}\n${b.content}`;
  }

  /** Move a file to archive directory (used by DreamResult.apply) */
  moveToArchive(filename: string): void {
    const srcPath = path.join(this.rulesDir, filename);
    const destPath = path.join(this.archiveDir, filename);
    if (fs.existsSync(srcPath)) {
      fs.renameSync(srcPath, destPath);
    }
  }

  /** Overwrite a rule file's content (used by DreamResult.apply) */
  writeRuleFile(filename: string, content: string): void {
    const fullPath = path.join(this.rulesDir, filename);
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
}

interface RuleFileInfo {
  filename: string;
  content: string;
  keywords: Set<string>;
  fullPath: string;
}

export interface RulePair {
  source: [string, string];
  mergedContent: string;
  mergedFilename: string;
}

export class DreamResult {
  readonly merged: RulePair[];
  readonly archived: string[];
  readonly kept: string[];
  private engine: SelfImproveEngine;

  constructor(merged: RulePair[], archived: string[], kept: string[], engine: SelfImproveEngine) {
    this.merged = merged;
    this.archived = archived;
    this.kept = kept;
    this.engine = engine;
  }

  get isEmpty(): boolean {
    return this.merged.length === 0 && this.archived.length === 0;
  }

  apply(): void {
    // Archive duplicate files
    for (const filename of this.archived) {
      this.engine.moveToArchive(filename);
    }

    // Write merged content to primary file
    for (const pair of this.merged) {
      this.engine.writeRuleFile(pair.mergedFilename, pair.mergedContent);
    }
  }

  /** Generate a human-readable diff summary for display */
  formatDiff(): string {
    if (this.isEmpty) return '';

    const lines: string[] = [];
    lines.push(`## Dream 결과: ${this.merged.length}건 병합, ${this.archived.length}건 아카이브\n`);

    for (const pair of this.merged) {
      lines.push(`### 병합: ${pair.source[0]} + ${pair.source[1]}`);
      lines.push(`→ ${pair.mergedFilename} (통합본)`);
      lines.push(`  - ${pair.source[1]} → archive/ 이동`);
      lines.push('');
    }

    if (this.kept.length > 0) {
      lines.push(`### 유지: ${this.kept.length}개 규칙 변경 없음`);
    }

    return lines.join('\n');
  }
}
