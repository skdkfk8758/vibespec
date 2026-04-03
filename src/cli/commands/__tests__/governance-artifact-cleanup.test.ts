import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ArtifactCleanup } from '../../../core/engine/artifact-cleanup.js';
import { initSchema } from '../../../core/db/schema.js';

function createTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'gov-artifact-test-'));
}

function setMtime(filePath: string, daysAgo: number): void {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  utimesSync(filePath, date, date);
}

describe('Governance: artifact cleanup CLI integration', () => {
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

  describe('AC01: --dry-run 옵션 시 실제 삭제가 발생하지 않는다', () => {
    it('should report removable items without deleting them', async () => {
      // Arrange: expired handoff + expired report
      const handoffDir = join(claudeDir, 'handoff');
      mkdirSync(handoffDir, { recursive: true });
      const oldDir = join(handoffDir, 'expired-task');
      mkdirSync(oldDir);
      writeFileSync(join(oldDir, 'data.json'), '{}');
      setMtime(oldDir, 10);

      const reportsDir = join(claudeDir, 'session-reports');
      mkdirSync(reportsDir, { recursive: true });
      const oldReport = join(reportsDir, 'old-report.md');
      writeFileSync(oldReport, '# expired');
      setMtime(oldReport, 10);

      // Act: run with dryRun (simulates --dry-run CLI flag)
      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run({
        retentionDays: 7,
        dryRun: true,
        trigger: 'manual',
      });

      // Assert: counts reported but files still exist
      expect(result.handoffsRemoved).toBeGreaterThanOrEqual(1);
      expect(result.reportsRemoved).toBeGreaterThanOrEqual(1);
      expect(existsSync(oldDir)).toBe(true);
      expect(existsSync(oldReport)).toBe(true);
      expect(result.details.every(d => !d.startsWith('error'))).toBe(true);
    });
  });

  describe('AC02: 정상 실행 시 CleanupResult가 올바르게 반환된다', () => {
    it('should return complete CleanupResult with all fields populated', async () => {
      // Arrange: expired handoff
      const handoffDir = join(claudeDir, 'handoff');
      mkdirSync(handoffDir, { recursive: true });
      const oldDir = join(handoffDir, 'old-task');
      mkdirSync(oldDir);
      writeFileSync(join(oldDir, 'report.json'), '{}');
      setMtime(oldDir, 10);

      // Act: run actual cleanup (simulates CLI without --dry-run)
      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run({
        retentionDays: 7,
        dryRun: false,
        trigger: 'manual',
      });

      // Assert: result shape and values
      expect(result).toHaveProperty('handoffsRemoved');
      expect(result).toHaveProperty('reportsRemoved');
      expect(result).toHaveProperty('rulesArchived');
      expect(result).toHaveProperty('rulesConflicts');
      expect(result).toHaveProperty('emptyDirsRemoved');
      expect(result).toHaveProperty('details');
      expect(result.handoffsRemoved).toBe(1);
      expect(existsSync(oldDir)).toBe(false);

      // Verify DB record was created
      const rows = db.prepare('SELECT * FROM artifact_cleanups').all() as Array<{
        trigger: string;
        dry_run: number;
      }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].trigger).toBe('manual');
      expect(rows[0].dry_run).toBe(0);
    });

    it('should respect custom retention-days parameter', async () => {
      const handoffDir = join(claudeDir, 'handoff');
      mkdirSync(handoffDir, { recursive: true });
      const dir = join(handoffDir, 'recent-task');
      mkdirSync(dir);
      writeFileSync(join(dir, 'data.json'), '{}');
      setMtime(dir, 3);

      const cleanup = new ArtifactCleanup(db, tmpDir);

      // 7-day retention: should NOT remove 3-day-old item
      const result7 = await cleanup.run({ retentionDays: 7, dryRun: true });
      expect(result7.handoffsRemoved).toBe(0);

      // 2-day retention: should remove 3-day-old item
      const result2 = await cleanup.run({ retentionDays: 2, dryRun: true });
      expect(result2.handoffsRemoved).toBe(1);
    });
  });

  describe('AC03: 에러 처리가 적절하게 동작한다', () => {
    it('should handle missing .claude directory gracefully', async () => {
      const noClaudeDir = createTmpDir();
      const cleanup = new ArtifactCleanup(db, noClaudeDir);
      const result = await cleanup.run();

      expect(result.handoffsRemoved).toBe(0);
      expect(result.reportsRemoved).toBe(0);
      expect(result.emptyDirsRemoved).toBe(0);
      expect(result.details).toContain('.claude/ directory not found, skipping');

      rmSync(noClaudeDir, { recursive: true, force: true });
    });

    it('should continue cleanup when rule-cleanup encounters errors', async () => {
      // Even if rule cleanup has issues, the overall cleanup should complete
      const cleanup = new ArtifactCleanup(db, tmpDir);
      const result = await cleanup.run();

      // Should not throw and should have details about rule cleanup attempt
      expect(result.details.some(d => d.includes('rule cleanup'))).toBe(true);
      expect(typeof result.rulesArchived).toBe('number');
      expect(typeof result.rulesConflicts).toBe('number');
    });
  });
});
