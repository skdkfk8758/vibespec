import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SelfImproveEngine } from '../self-improve.js';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type Database from 'better-sqlite3';

describe('SelfImproveEngine', () => {
  let db: Database.Database;
  let tmpDir: string;
  let engine: SelfImproveEngine;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-improve-test-'));
    engine = new SelfImproveEngine(db, tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AC06: directory auto-creation', () => {
    it('should create all required directories on construction', () => {
      expect(fs.existsSync(path.join(tmpDir, '.claude', 'rules'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.claude', 'rules', 'archive'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.claude', 'self-improve', 'pending'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.claude', 'self-improve', 'processed'))).toBe(true);
    });

    it('should not throw if directories already exist', () => {
      expect(() => new SelfImproveEngine(db, tmpDir)).not.toThrow();
    });
  });

  describe('AC01: v7 migration and table creation', () => {
    it('should create self_improve_rules table via v7 migration', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      expect(tables.map(t => t.name)).toContain('self_improve_rules');
    });

    it('should have correct columns', () => {
      const columns = db.pragma('table_info(self_improve_rules)') as Array<{ name: string }>;
      const colNames = columns.map(c => c.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('error_kb_id');
      expect(colNames).toContain('title');
      expect(colNames).toContain('category');
      expect(colNames).toContain('rule_path');
      expect(colNames).toContain('occurrences');
      expect(colNames).toContain('prevented');
      expect(colNames).toContain('status');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('last_triggered_at');
    });

    it('should set user_version to latest', () => {
      const version = db.pragma('user_version', { simple: true }) as number;
      expect(version).toBeGreaterThanOrEqual(7);
    });
  });

  describe('AC02: createRule() DB + file', () => {
    it('should create rule file and DB record simultaneously', () => {
      const rule = engine.createRule({
        title: '외부 API null check',
        category: 'LOGIC_ERROR',
        error_kb_id: 'ERR-001',
        ruleContent: '## Rule\n외부 API 응답은 null safe하게 처리하라\n',
      });

      expect(rule.id).toHaveLength(12);
      expect(rule.title).toBe('외부 API null check');
      expect(rule.category).toBe('LOGIC_ERROR');
      expect(rule.status).toBe('active');
      expect(rule.error_kb_id).toBe('ERR-001');

      // Verify file exists
      const fullPath = path.join(tmpDir, rule.rule_path);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toContain('외부 API 응답은 null safe하게 처리하라');

      // Verify DB record
      const dbRule = engine.getRule(rule.id);
      expect(dbRule).not.toBeNull();
      expect(dbRule!.title).toBe('외부 API null check');
    });

    it('should handle rule without error_kb_id', () => {
      const rule = engine.createRule({
        title: 'Test rule',
        category: 'TEST_GAP',
        ruleContent: '## Rule\nTest content\n',
      });

      expect(rule.error_kb_id).toBeNull();
    });
  });

  describe('AC03: archiveRule() status + file move', () => {
    it('should change status to archived and move file', () => {
      const rule = engine.createRule({
        title: 'Archive test',
        category: 'TYPE_ERROR',
        ruleContent: '## Rule\nTest\n',
      });

      const srcPath = path.join(tmpDir, rule.rule_path);
      expect(fs.existsSync(srcPath)).toBe(true);

      const result = engine.archiveRule(rule.id);
      expect(result).toBe(true);

      // File should be moved to archive
      expect(fs.existsSync(srcPath)).toBe(false);
      const archivePath = path.join(tmpDir, '.claude', 'rules', 'archive', path.basename(rule.rule_path));
      expect(fs.existsSync(archivePath)).toBe(true);

      // DB status should be archived
      const updated = engine.getRule(rule.id);
      expect(updated!.status).toBe('archived');
    });

    it('should return false for already archived rule', () => {
      const rule = engine.createRule({
        title: 'Already archived',
        category: 'CONFIG_ERROR',
        ruleContent: '## Rule\nTest\n',
      });
      engine.archiveRule(rule.id);
      expect(engine.archiveRule(rule.id)).toBe(false);
    });

    it('should return false for non-existent rule', () => {
      expect(engine.archiveRule('nonexistent')).toBe(false);
    });
  });

  describe('AC04: listRules() status filtering', () => {
    it('should filter by active status', () => {
      engine.createRule({ title: 'Active 1', category: 'LOGIC_ERROR', ruleContent: 'test' });
      const rule2 = engine.createRule({ title: 'To archive', category: 'TYPE_ERROR', ruleContent: 'test' });
      engine.archiveRule(rule2.id);

      const active = engine.listRules('active');
      expect(active).toHaveLength(1);
      expect(active[0].title).toBe('Active 1');
    });

    it('should filter by archived status', () => {
      engine.createRule({ title: 'Active', category: 'LOGIC_ERROR', ruleContent: 'test' });
      const rule2 = engine.createRule({ title: 'Archived', category: 'TYPE_ERROR', ruleContent: 'test' });
      engine.archiveRule(rule2.id);

      const archived = engine.listRules('archived');
      expect(archived).toHaveLength(1);
      expect(archived[0].title).toBe('Archived');
    });

    it('should return all rules when no filter', () => {
      engine.createRule({ title: 'Rule 1', category: 'LOGIC_ERROR', ruleContent: 'test' });
      engine.createRule({ title: 'Rule 2', category: 'TYPE_ERROR', ruleContent: 'test' });

      const all = engine.listRules();
      expect(all).toHaveLength(2);
    });
  });

  describe('AC05: getRuleStats()', () => {
    it('should return correct aggregate stats', () => {
      engine.createRule({ title: 'R1', category: 'LOGIC_ERROR', ruleContent: 'test' });
      const r2 = engine.createRule({ title: 'R2', category: 'TYPE_ERROR', ruleContent: 'test' });
      engine.createRule({ title: 'R3', category: 'API_MISUSE', ruleContent: 'test' });

      engine.archiveRule(r2.id);
      engine.incrementPrevented(r2.id);
      engine.incrementPrevented(r2.id);

      const stats = engine.getRuleStats();
      expect(stats.active).toBe(2);
      expect(stats.archived).toBe(1);
      expect(stats.total_prevented).toBe(2);
    });

    it('should return zeros when no rules', () => {
      const stats = engine.getRuleStats();
      expect(stats.active).toBe(0);
      expect(stats.archived).toBe(0);
      expect(stats.total_prevented).toBe(0);
    });
  });

  describe('pending management', () => {
    it('should count pending files', () => {
      expect(engine.getPendingCount()).toBe(0);

      // Create a pending file
      const pendingDir = engine.getPendingDir();
      fs.writeFileSync(path.join(pendingDir, '2026-03-25T10-00-00.json'), '{}');
      expect(engine.getPendingCount()).toBe(1);
    });

    it('should list pending files sorted', () => {
      const pendingDir = engine.getPendingDir();
      fs.writeFileSync(path.join(pendingDir, 'b.json'), '{}');
      fs.writeFileSync(path.join(pendingDir, 'a.json'), '{}');

      const files = engine.listPending();
      expect(files).toHaveLength(2);
      expect(path.basename(files[0])).toBe('a.json');
    });

    it('should move pending to processed', () => {
      const pendingDir = engine.getPendingDir();
      const filePath = path.join(pendingDir, 'test.json');
      fs.writeFileSync(filePath, '{"test": true}');

      engine.movePendingToProcessed(filePath);

      expect(fs.existsSync(filePath)).toBe(false);
      const processedPath = path.join(engine.getProcessedDir(), 'test.json');
      expect(fs.existsSync(processedPath)).toBe(true);
    });
  });

  describe('timestamps', () => {
    it('should get/set last run timestamp', () => {
      expect(engine.getLastRunTimestamp()).toBeNull();

      engine.setLastRunTimestamp();
      const ts = engine.getLastRunTimestamp();
      expect(ts).not.toBeNull();
      expect(new Date(ts!).getTime()).toBeGreaterThan(0);
    });
  });

  describe('effectiveness', () => {
    it('should calculate effectiveness ratio', () => {
      const rule = engine.createRule({ title: 'E test', category: 'LOGIC_ERROR', ruleContent: 'test' });
      engine.updateOccurrences(rule.id, 3);
      engine.incrementPrevented(rule.id);

      // prevented=1, occurrences=3, total=4, effectiveness=0.25
      expect(engine.getEffectiveness(rule.id)).toBe(0.25);
    });

    it('should return 0 for rule with no data', () => {
      const rule = engine.createRule({ title: 'No data', category: 'LOGIC_ERROR', ruleContent: 'test' });
      expect(engine.getEffectiveness(rule.id)).toBe(0);
    });
  });

  describe('capacity', () => {
    it('should detect when at capacity', () => {
      expect(engine.isAtCapacity()).toBe(false);

      for (let i = 0; i < 30; i++) {
        engine.createRule({ title: `Rule ${i}`, category: 'LOGIC_ERROR', ruleContent: 'test' });
      }
      expect(engine.isAtCapacity()).toBe(true);
    });
  });

  describe('AC02: createRule with enforcement parameter', () => {
    it('AC02: createRule defaults enforcement to SOFT', () => {
      const rule = engine.createRule({
        title: 'Default enforcement',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nTest\n',
      });
      expect(rule.enforcement).toBe('SOFT');
      expect(rule.escalated_at).toBeNull();

      const dbRule = engine.getRule(rule.id);
      expect(dbRule!.enforcement).toBe('SOFT');
    });

    it('AC02: createRule accepts explicit HARD enforcement', () => {
      const rule = engine.createRule({
        title: 'Hard rule',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nTest\n',
        enforcement: 'HARD',
      });
      expect(rule.enforcement).toBe('HARD');

      const dbRule = engine.getRule(rule.id);
      expect(dbRule!.enforcement).toBe('HARD');
    });
  });

  describe('AC03: escalateRule()', () => {
    it('AC03: escalateRule updates DB enforcement to HARD and sets escalated_at', () => {
      const rule = engine.createRule({
        title: 'Escalate test',
        category: 'LOGIC_ERROR',
        ruleContent: '---\nApplies When: always\nEnforcement: SOFT\n---\n## Rule\nTest\n',
      });

      const result = engine.escalateRule(rule.id);
      expect(result).toBe(true);

      const updated = engine.getRule(rule.id);
      expect(updated!.enforcement).toBe('HARD');
      expect(updated!.escalated_at).not.toBeNull();
    });

    it('AC03: escalateRule updates Enforcement line in rule file', () => {
      const rule = engine.createRule({
        title: 'File update test',
        category: 'LOGIC_ERROR',
        ruleContent: '---\nApplies When: always\nEnforcement: SOFT\n---\n## Rule\nTest\n',
      });

      engine.escalateRule(rule.id);

      const filePath = path.join(tmpDir, rule.rule_path);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('Enforcement: HARD');
      expect(content).not.toContain('Enforcement: SOFT');
    });

    it('AC03: escalateRule returns false for non-existent rule', () => {
      expect(engine.escalateRule('nonexistent')).toBe(false);
    });

    it('AC03: escalateRule returns false for already HARD rule', () => {
      const rule = engine.createRule({
        title: 'Already hard',
        category: 'LOGIC_ERROR',
        ruleContent: '---\nEnforcement: HARD\n---\nTest',
        enforcement: 'HARD',
      });
      expect(engine.escalateRule(rule.id)).toBe(false);
    });
  });

  describe('AC04: checkEscalation()', () => {
    it('AC04: returns rules matching 30d+violations>=3+prevented=0 criteria', () => {
      // Create a rule that matches criteria: 31 days old, 3 occurrences, 0 prevented
      const rule = engine.createRule({
        title: 'Should escalate',
        category: 'LOGIC_ERROR',
        ruleContent: 'test',
      });

      // Manually set created_at to 31 days ago and occurrences to 3
      const daysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE self_improve_rules SET created_at = ?, occurrences = 3, prevented = 0 WHERE id = ?')
        .run(daysAgo, rule.id);

      const candidates = engine.checkEscalation();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe(rule.id);
      expect(candidates[0].title).toBe('Should escalate');
      expect(candidates[0].occurrences).toBe(3);
      expect(candidates[0].prevented).toBe(0);
      expect(candidates[0].days_since_creation).toBeGreaterThanOrEqual(31);
    });

    it('AC04: excludes rules that do not meet all criteria', () => {
      // Rule with prevented > 0
      const rule1 = engine.createRule({ title: 'Has prevention', category: 'LOGIC_ERROR', ruleContent: 'test' });
      const daysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE self_improve_rules SET created_at = ?, occurrences = 5, prevented = 1 WHERE id = ?')
        .run(daysAgo, rule1.id);

      // Rule with < 3 occurrences
      const rule2 = engine.createRule({ title: 'Few occurrences', category: 'LOGIC_ERROR', ruleContent: 'test' });
      db.prepare('UPDATE self_improve_rules SET created_at = ?, occurrences = 2, prevented = 0 WHERE id = ?')
        .run(daysAgo, rule2.id);

      // Rule too young (< 30 days)
      const rule3 = engine.createRule({ title: 'Too young', category: 'LOGIC_ERROR', ruleContent: 'test' });
      db.prepare('UPDATE self_improve_rules SET occurrences = 5, prevented = 0 WHERE id = ?')
        .run(rule3.id);

      // Rule that is archived
      const rule4 = engine.createRule({ title: 'Archived', category: 'LOGIC_ERROR', ruleContent: 'test' });
      db.prepare('UPDATE self_improve_rules SET created_at = ?, occurrences = 5, prevented = 0, status = ? WHERE id = ?')
        .run(daysAgo, 'archived', rule4.id);

      const candidates = engine.checkEscalation();
      expect(candidates).toHaveLength(0);
    });
  });

  describe('AC05: autoArchiveStale()', () => {
    it('AC05: archives rules with 0 occurrences and 0 prevented older than threshold', () => {
      const rule = engine.createRule({ title: 'Stale rule', category: 'LOGIC_ERROR', ruleContent: 'test' });
      const daysAgo = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE self_improve_rules SET created_at = ?, occurrences = 0, prevented = 0 WHERE id = ?')
        .run(daysAgo, rule.id);

      const archived = engine.autoArchiveStale(60);
      expect(archived).toContain(rule.id);

      const updated = engine.getRule(rule.id);
      expect(updated!.status).toBe('archived');
    });

    it('AC05: does not archive rules with occurrences > 0', () => {
      const rule = engine.createRule({ title: 'Active rule', category: 'LOGIC_ERROR', ruleContent: 'test' });
      const daysAgo = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE self_improve_rules SET created_at = ?, occurrences = 1, prevented = 0 WHERE id = ?')
        .run(daysAgo, rule.id);

      const archived = engine.autoArchiveStale(60);
      expect(archived).toHaveLength(0);
    });

    it('AC05: does not archive rules younger than threshold', () => {
      const rule = engine.createRule({ title: 'Young rule', category: 'LOGIC_ERROR', ruleContent: 'test' });

      const archived = engine.autoArchiveStale(60);
      expect(archived).toHaveLength(0);
    });
  });

  describe('AC06: recordViolation and recordPrevention', () => {
    it('AC06: recordViolation increments occurrences and updates last_triggered_at', () => {
      const rule = engine.createRule({ title: 'Violation test', category: 'LOGIC_ERROR', ruleContent: 'test' });
      expect(engine.getRule(rule.id)!.occurrences).toBe(0);

      engine.recordViolation(rule.id);
      const after1 = engine.getRule(rule.id)!;
      expect(after1.occurrences).toBe(1);
      expect(after1.last_triggered_at).not.toBeNull();

      engine.recordViolation(rule.id);
      expect(engine.getRule(rule.id)!.occurrences).toBe(2);
    });

    it('AC06: recordPrevention increments prevented counter', () => {
      const rule = engine.createRule({ title: 'Prevention test', category: 'LOGIC_ERROR', ruleContent: 'test' });
      expect(engine.getRule(rule.id)!.prevented).toBe(0);

      engine.recordPrevention(rule.id);
      expect(engine.getRule(rule.id)!.prevented).toBe(1);

      engine.recordPrevention(rule.id);
      expect(engine.getRule(rule.id)!.prevented).toBe(2);
    });
  });
});
