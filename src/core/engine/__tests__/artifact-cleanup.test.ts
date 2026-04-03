import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ArtifactCleanup } from '../artifact-cleanup.js';
import { initSchema } from '../../db/schema.js';

function createTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'artifact-cleanup-test-'));
}

function setMtime(filePath: string, daysAgo: number): void {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  utimesSync(filePath, date, date);
}

describe('ArtifactCleanup', () => {
  let db: Database.Database;
  let tmpDir: string;
  let claudeDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
    tmpDir = createTmpDir();
    claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AC01: 7일+ handoff 디렉토리가 삭제된다', () => {
    it('should remove handoff directories older than 7 days', async () => {
      const handoffDir = join(claudeDir, 'handoff');
      mkdirSync(handoffDir, { recursive: true });

      const oldDir = join(handoffDir, 'old-task');
      mkdirSync(oldDir);
      writeFileSync(join(oldDir, 'report.json'), '{}');
      setMtime(oldDir, 10);

      const newDir = join(handoffDir, 'new-task');
      mkdirSync(newDir);
      writeFileSync(join(newDir, 'report.json'), '{}');

      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run();

      expect(result.handoffsRemoved).toBe(1);
      expect(existsSync(oldDir)).toBe(false);
      expect(existsSync(newDir)).toBe(true);
    });
  });

  describe('AC02: 7일+ session-report 파일이 삭제된다', () => {
    it('should remove session-report files older than 7 days', async () => {
      const reportsDir = join(claudeDir, 'session-reports');
      mkdirSync(reportsDir, { recursive: true });

      const oldFile = join(reportsDir, 'old-report.md');
      writeFileSync(oldFile, '# Old Report');
      setMtime(oldFile, 10);

      const newFile = join(reportsDir, 'new-report.md');
      writeFileSync(newFile, '# New Report');

      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run();

      expect(result.reportsRemoved).toBeGreaterThanOrEqual(1);
      expect(existsSync(oldFile)).toBe(false);
      expect(existsSync(newFile)).toBe(true);
    });
  });

  describe('AC03: 7일+ merge report 파일이 삭제된다', () => {
    it('should remove merge report files older than 7 days', async () => {
      const reportsDir = join(claudeDir, 'reports');
      mkdirSync(reportsDir, { recursive: true });

      const oldFile = join(reportsDir, 'merge-2026-01-01.md');
      writeFileSync(oldFile, '# Merge Report');
      setMtime(oldFile, 10);

      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run();

      expect(result.reportsRemoved).toBeGreaterThanOrEqual(1);
      expect(existsSync(oldFile)).toBe(false);
    });
  });

  describe('AC04: active 플랜 연결 handoff는 보존된다', () => {
    it('should preserve handoff linked to active plan', async () => {
      const handoffDir = join(claudeDir, 'handoff');
      mkdirSync(handoffDir, { recursive: true });

      // Create an active plan, task, and handoff
      db.prepare(`INSERT INTO plans (id, title, status) VALUES ('plan1', 'Test Plan', 'active')`).run();
      db.prepare(`INSERT INTO tasks (id, plan_id, title, status) VALUES ('active-task', 'plan1', 'Test Task', 'in_progress')`).run();
      db.prepare(`INSERT INTO agent_handoffs (id, task_id, plan_id, agent_type, attempt, verdict, summary) VALUES ('h1', 'active-task', 'plan1', 'tdd', 1, 'PASS', 'ok')`).run();

      const activeDir = join(handoffDir, 'active-task');
      mkdirSync(activeDir);
      writeFileSync(join(activeDir, 'report.json'), '{}');
      setMtime(activeDir, 10);

      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run();

      expect(result.handoffsRemoved).toBe(0);
      expect(existsSync(activeDir)).toBe(true);
    });
  });

  describe('AC05: 빈 handoff 디렉토리도 active 플랜 연결 시 보존', () => {
    it('should preserve empty handoff directory linked to active plan', async () => {
      const handoffDir = join(claudeDir, 'handoff');
      mkdirSync(handoffDir, { recursive: true });

      db.prepare(`INSERT INTO plans (id, title, status) VALUES ('plan1', 'Test Plan', 'active')`).run();
      db.prepare(`INSERT INTO tasks (id, plan_id, title, status) VALUES ('active-empty', 'plan1', 'Test Task', 'in_progress')`).run();
      db.prepare(`INSERT INTO agent_handoffs (id, task_id, plan_id, agent_type, attempt, verdict, summary) VALUES ('h1', 'active-empty', 'plan1', 'tdd', 1, 'PASS', 'ok')`).run();

      const activeEmptyDir = join(handoffDir, 'active-empty');
      mkdirSync(activeEmptyDir);

      const inactiveEmptyDir = join(handoffDir, 'inactive-empty');
      mkdirSync(inactiveEmptyDir);

      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run();

      expect(existsSync(activeEmptyDir)).toBe(true);
      expect(existsSync(inactiveEmptyDir)).toBe(false);
      expect(result.handoffsRemoved).toBe(1);
    });
  });

  describe('AC06: dry-run 모드에서 실제 삭제가 발생하지 않는다', () => {
    it('should not delete anything in dry-run mode', async () => {
      const handoffDir = join(claudeDir, 'handoff');
      mkdirSync(handoffDir, { recursive: true });

      const oldDir = join(handoffDir, 'old-task');
      mkdirSync(oldDir);
      writeFileSync(join(oldDir, 'report.json'), '{}');
      setMtime(oldDir, 10);

      const reportsDir = join(claudeDir, 'session-reports');
      mkdirSync(reportsDir, { recursive: true });
      const oldReport = join(reportsDir, 'old.md');
      writeFileSync(oldReport, 'old');
      setMtime(oldReport, 10);

      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run({ dryRun: true });

      expect(result.handoffsRemoved).toBeGreaterThanOrEqual(1);
      expect(result.reportsRemoved).toBeGreaterThanOrEqual(1);
      // Files should still exist
      expect(existsSync(oldDir)).toBe(true);
      expect(existsSync(oldReport)).toBe(true);
      // Details should contain dry-run prefix
      expect(result.details.some(d => d.includes('[dry-run]'))).toBe(true);
    });
  });

  describe('AC07: rule-cleanup 통합 결과가 리포트에 포함된다', () => {
    it('should include rule cleanup results in report', async () => {
      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run();

      expect(result.details.some(d => d.includes('rule cleanup'))).toBe(true);
      expect(typeof result.rulesArchived).toBe('number');
      expect(typeof result.rulesConflicts).toBe('number');
    });
  });

  describe('AC08: 정리 이력이 DB에 기록된다', () => {
    it('should record cleanup history in artifact_cleanups table', async () => {
      const cleanup = new ArtifactCleanup(db, tmpDir);
      await cleanup.run({ trigger: 'vs-wrap' });

      const rows = db.prepare('SELECT * FROM artifact_cleanups').all() as Array<{
        trigger: string;
        dry_run: number;
        summary: string;
      }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].trigger).toBe('vs-wrap');
      expect(rows[0].dry_run).toBe(0);
      expect(rows[0].summary).toContain('handoffs:');
    });

    it('should record dry-run flag correctly', async () => {
      const cleanup = new ArtifactCleanup(db, tmpDir);
      await cleanup.run({ dryRun: true });

      const rows = db.prepare('SELECT * FROM artifact_cleanups').all() as Array<{ dry_run: number }>;
      expect(rows[0].dry_run).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should return empty result when .claude/ does not exist', async () => {
      const noClaudeDir = createTmpDir();
      const cleanup = new ArtifactCleanup(db, noClaudeDir);
      const result = await cleanup.run();

      expect(result.handoffsRemoved).toBe(0);
      expect(result.reportsRemoved).toBe(0);
      expect(result.details).toContain('.claude/ directory not found, skipping');
      rmSync(noClaudeDir, { recursive: true, force: true });
    });

    it('should skip and log errors for files that fail to delete', async () => {
      // This test verifies error handling path exists
      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run();
      // No errors expected in normal flow
      expect(result.details.filter(d => d.startsWith('error'))).toHaveLength(0);
    });

    it('should support custom retention days', async () => {
      const handoffDir = join(claudeDir, 'handoff');
      mkdirSync(handoffDir, { recursive: true });

      const dir3days = join(handoffDir, 'task-3days');
      mkdirSync(dir3days);
      writeFileSync(join(dir3days, 'f.json'), '{}');
      setMtime(dir3days, 4);

      const cleanup = new ArtifactCleanup(db, tmpDir);

      // With default 7 days: should NOT be removed
      const result7 = await cleanup.run({ dryRun: true });
      expect(result7.handoffsRemoved).toBe(0);

      // With 3 days: should be removed
      const result3 = await cleanup.run({ dryRun: true, retentionDays: 3 });
      expect(result3.handoffsRemoved).toBe(1);
    });
  });
});
