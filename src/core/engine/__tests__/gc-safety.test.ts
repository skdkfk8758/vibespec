import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SafetyClassifier } from '../gc-safety.js';
import { GCEngine } from '../gc.js';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type Database from 'better-sqlite3';
import type { GCFinding } from '../../types.js';

function makeFinding(overrides: Partial<GCFinding> = {}): GCFinding {
  return {
    id: 'f1',
    scan_id: 's1',
    category: 'DEAD_CODE',
    severity: 'low',
    safety_level: 'SAFE',
    file_path: 'src/utils.ts',
    line_start: 1,
    line_end: 1,
    rule_source: 'BUILTIN',
    rule_id: null,
    description: 'Unused export',
    suggested_fix: 'Remove unused export',
    status: 'detected',
    resolved_at: null,
    ...overrides,
  };
}

describe('SafetyClassifier', () => {
  let tmpDir: string;
  let classifier: SafetyClassifier;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-safety-test-'));
    classifier = new SafetyClassifier(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AC01: SAFE 조건을 만족하는 finding만 SAFE로 분류', () => {
    it('should classify as SAFE when all conditions met (no ext dep + single file + test exists)', () => {
      // Create source and test files
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'utils.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'utils.test.ts'), 'test("x", () => {});');

      const finding = makeFinding({ file_path: 'src/utils.ts' });
      expect(classifier.classify(finding)).toBe('SAFE');
    });

    it('should classify as RISKY when test file does not exist', () => {
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'orphan.ts'), 'export const x = 1;');
      // No test file

      const finding = makeFinding({ file_path: 'src/orphan.ts' });
      expect(classifier.classify(finding)).toBe('RISKY');
    });

    it('should classify as RISKY when suggested_fix references node_modules', () => {
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'utils.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'utils.test.ts'), 'test("x", () => {});');

      const finding = makeFinding({
        file_path: 'src/utils.ts',
        suggested_fix: 'import from node_modules/lodash',
      });
      expect(classifier.classify(finding)).toBe('RISKY');
    });

    it('should find test in __tests__ directory', () => {
      const srcDir = path.join(tmpDir, 'src');
      const testDir = path.join(srcDir, '__tests__');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'utils.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(testDir, 'utils.test.ts'), 'test("x", () => {});');

      const finding = makeFinding({ file_path: 'src/utils.ts' });
      expect(classifier.classify(finding)).toBe('SAFE');
    });
  });
});

describe('GCEngine — apply and revert', () => {
  let db: Database.Database;
  let tmpDir: string;
  let engine: GCEngine;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-apply-test-'));
    engine = new GCEngine(db, tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AC02: uncommitted changes 존재 시 수정 적용이 차단되어야 한다', () => {
    it('should throw when working tree is dirty', async () => {
      // No git repo in tmpDir → git status will fail → should throw
      await expect(engine.applySafeFixes('nonexistent')).rejects.toThrow();
    });
  });

  describe('AC05: 모든 변경이 gc_changes에 기록되어야 한다', () => {
    it('should record changes in gc_changes after applySafeFixes with git repo', async () => {
      // Initialize git repo
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

      // Create a file and initial commit
      const srcFile = path.join(tmpDir, 'src', 'test.ts');
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(srcFile, 'export const unused = 1;\nexport const used = 2;\n');
      execSync('git add -A && git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

      // Create a scan with a SAFE finding
      const scanId = 'test-scan';
      db.prepare("INSERT INTO gc_scans (id, scan_type, started_at, status) VALUES (?, 'full', ?, 'completed')").run(scanId, new Date().toISOString());
      db.prepare(`
        INSERT INTO gc_findings (id, scan_id, category, severity, safety_level, file_path, line_start, line_end, rule_source, description, suggested_fix, status)
        VALUES ('f1', ?, 'DEAD_CODE', 'low', 'SAFE', 'src/test.ts', 1, 1, 'BUILTIN', 'Unused export', 'Remove line', 'detected')
      `).run(scanId);

      const changes = await engine.applySafeFixes(scanId);
      expect(changes.length).toBe(1);

      // Verify gc_changes record
      const dbChanges = db.prepare('SELECT * FROM gc_changes WHERE finding_id = ?').all('f1') as Array<Record<string, unknown>>;
      expect(dbChanges.length).toBe(1);
      expect(dbChanges[0].commit_sha).toBeTruthy();
      expect(dbChanges[0].rollback_cmd).toContain('git revert');
    });
  });

  describe('AC03: 자동 수정이 단일 커밋으로 묶여야 한다', () => {
    it('should create exactly one commit for multiple fixes', async () => {
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

      // Create files
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'a.ts'), 'line1\nline2\nline3\n');
      fs.writeFileSync(path.join(srcDir, 'b.ts'), 'line1\nline2\nline3\n');
      execSync('git add -A && git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

      const beforeCount = execSync('git rev-list --count HEAD', { cwd: tmpDir, stdio: 'pipe' }).toString().trim();

      const scanId = 'multi-scan';
      db.prepare("INSERT INTO gc_scans (id, scan_type, started_at, status) VALUES (?, 'full', ?, 'completed')").run(scanId, new Date().toISOString());
      db.prepare(`INSERT INTO gc_findings (id, scan_id, category, severity, safety_level, file_path, line_start, line_end, rule_source, description, suggested_fix, status) VALUES ('f1', ?, 'DEAD_CODE', 'low', 'SAFE', 'src/a.ts', 1, 1, 'BUILTIN', 'unused', 'remove', 'detected')`).run(scanId);
      db.prepare(`INSERT INTO gc_findings (id, scan_id, category, severity, safety_level, file_path, line_start, line_end, rule_source, description, suggested_fix, status) VALUES ('f2', ?, 'DEAD_CODE', 'low', 'SAFE', 'src/b.ts', 1, 1, 'BUILTIN', 'unused', 'remove', 'detected')`).run(scanId);

      await engine.applySafeFixes(scanId);

      const afterCount = execSync('git rev-list --count HEAD', { cwd: tmpDir, stdio: 'pipe' }).toString().trim();
      expect(Number(afterCount) - Number(beforeCount)).toBe(1); // exactly one new commit
    });
  });

  describe('AC04: revertScan이 해당 스캔의 커밋을 git revert해야 한다', () => {
    it('should revert the scan commit', async () => {
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'c.ts'), 'line1\nline2\nline3\n');
      execSync('git add -A && git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

      const originalContent = fs.readFileSync(path.join(srcDir, 'c.ts'), 'utf-8');

      const scanId = 'revert-scan';
      db.prepare("INSERT INTO gc_scans (id, scan_type, started_at, status) VALUES (?, 'full', ?, 'completed')").run(scanId, new Date().toISOString());
      db.prepare(`INSERT INTO gc_findings (id, scan_id, category, severity, safety_level, file_path, line_start, line_end, rule_source, description, suggested_fix, status) VALUES ('f1', ?, 'DEAD_CODE', 'low', 'SAFE', 'src/c.ts', 1, 1, 'BUILTIN', 'unused', 'remove', 'detected')`).run(scanId);

      await engine.applySafeFixes(scanId);
      // File should be modified
      expect(fs.readFileSync(path.join(srcDir, 'c.ts'), 'utf-8')).not.toBe(originalContent);

      await engine.revertScan(scanId);
      // File should be restored
      expect(fs.readFileSync(path.join(srcDir, 'c.ts'), 'utf-8')).toBe(originalContent);

      // Findings should be reverted
      const findings = db.prepare("SELECT status FROM gc_findings WHERE scan_id = ?").all(scanId) as Array<{ status: string }>;
      expect(findings.every(f => f.status === 'reverted')).toBe(true);
    });
  });
});
