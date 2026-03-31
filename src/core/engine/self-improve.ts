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

    // Write rule file
    fs.writeFileSync(fullPath, newRule.ruleContent, 'utf-8');

    // Insert DB record
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO self_improve_rules (id, error_kb_id, title, category, rule_path, occurrences, prevented, status, enforcement, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)
    `).run(id, newRule.error_kb_id ?? null, newRule.title, newRule.category, rulePath, enforcement, now);

    return {
      id,
      error_kb_id: newRule.error_kb_id ?? null,
      title: newRule.title,
      category: newRule.category,
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

  listRules(status?: 'active' | 'archived'): SelfImproveRule[] {
    if (status) {
      return this.db.prepare(
        'SELECT * FROM self_improve_rules WHERE status = ? ORDER BY created_at DESC'
      ).all(status) as SelfImproveRule[];
    }
    return this.db.prepare(
      'SELECT * FROM self_improve_rules ORDER BY status ASC, created_at DESC'
    ).all() as SelfImproveRule[];
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

  getRulesDir(): string {
    return this.rulesDir;
  }

  getPendingDir(): string {
    return this.pendingDir;
  }

  getProcessedDir(): string {
    return this.processedDir;
  }
}
