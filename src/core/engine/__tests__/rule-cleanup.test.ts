import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuleCleanup, type DuplicateGroup, type ConflictPair, type CleanupReport } from '../rule-cleanup.js';
import { SelfImproveEngine } from '../self-improve.js';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type Database from 'better-sqlite3';

describe('RuleCleanup', () => {
  let db: Database.Database;
  let tmpDir: string;
  let engine: SelfImproveEngine;
  let cleanup: RuleCleanup;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-cleanup-test-'));
    engine = new SelfImproveEngine(db, tmpDir);
    cleanup = new RuleCleanup(db, engine);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AC01: 70%+ 유사한 규칙이 DuplicateGroup으로 반환된다', () => {
    it('AC01: title이 70%+ 유사한 규칙 쌍이 DuplicateGroup으로 반환된다', () => {
      // Arrange: two rules with highly similar titles
      const rule1 = engine.createRule({
        title: 'always check null before accessing property',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null\n',
      });
      const rule2 = engine.createRule({
        title: 'always check null before accessing object property',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null on object\n',
      });
      // A third rule that is NOT similar
      engine.createRule({
        title: 'use async await consistently',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nUse async\n',
      });

      // Act
      const groups = cleanup.detectDuplicates();

      // Assert
      expect(groups.length).toBeGreaterThanOrEqual(1);
      const group = groups[0];
      expect(group.id).toBeTruthy();
      const ruleIds = group.rules.map(r => r.id);
      expect(ruleIds).toContain(rule1.id);
      expect(ruleIds).toContain(rule2.id);
      // similarity should be >= 0.7
      for (const r of group.rules) {
        expect(r.similarity).toBeGreaterThanOrEqual(0.7);
        expect(typeof r.title).toBe('string');
      }
    });

    it('AC01: title 유사도가 70% 미만인 규칙은 그룹에 포함되지 않는다', () => {
      // Arrange: completely different titles
      engine.createRule({
        title: 'check null pointer before access',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null\n',
      });
      engine.createRule({
        title: 'use consistent async await pattern',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nAsync pattern\n',
      });

      // Act
      const groups = cleanup.detectDuplicates();

      // Assert: no duplicate groups (< 70% similarity)
      expect(groups).toHaveLength(0);
    });
  });

  describe('AC02: mergeDuplicates 후 occurrence/prevented가 합산된다', () => {
    it('AC02: mergeDuplicates 후 occurrence/prevented가 합산된다', () => {
      // Arrange
      const rule1 = engine.createRule({
        title: 'always check null before accessing property',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null\n',
      });
      const rule2 = engine.createRule({
        title: 'always check null before accessing object property',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null on object\n',
      });

      // Set occurrences and prevented counts
      db.prepare('UPDATE self_improve_rules SET occurrences = 5, prevented = 3 WHERE id = ?').run(rule1.id);
      db.prepare('UPDATE self_improve_rules SET occurrences = 2, prevented = 7 WHERE id = ?').run(rule2.id);

      const groups = cleanup.detectDuplicates();
      expect(groups.length).toBeGreaterThanOrEqual(1);

      // Act
      cleanup.mergeDuplicates(groups[0].id);

      // Assert: one active rule with summed counts
      const activeRules = engine.listRules('active');
      expect(activeRules).toHaveLength(1);
      const merged = activeRules[0];
      expect(merged.occurrences).toBe(7);  // 5 + 2
      expect(merged.prevented).toBe(10);   // 3 + 7
    });
  });

  describe('AC03: 병합된 규칙 외 나머지는 archived 상태가 된다', () => {
    it('AC03: 병합 후 나머지 규칙은 archived 상태가 된다', () => {
      // Arrange
      const rule1 = engine.createRule({
        title: 'always check null before accessing property',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null\n',
      });
      const rule2 = engine.createRule({
        title: 'always check null before accessing object property',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null on object\n',
      });

      const groups = cleanup.detectDuplicates();
      expect(groups.length).toBeGreaterThanOrEqual(1);

      // Act
      cleanup.mergeDuplicates(groups[0].id);

      // Assert: exactly one active, one archived
      const active = engine.listRules('active');
      const archived = engine.listRules('archived');
      expect(active).toHaveLength(1);
      expect(archived).toHaveLength(1);
      // The archived one must be one of the original rules
      const archivedIds = archived.map(r => r.id);
      const activeIds = active.map(r => r.id);
      expect([rule1.id, rule2.id]).toContain(archivedIds[0]);
      expect([rule1.id, rule2.id]).toContain(activeIds[0]);
    });
  });

  describe('AC04: 규칙이 0개일 때 빈 배열을 반환한다', () => {
    it('AC04: 규칙이 0개일 때 detectDuplicates는 빈 배열을 반환한다', () => {
      // Arrange: no rules created
      // Act
      const groups = cleanup.detectDuplicates();
      // Assert
      expect(groups).toEqual([]);
    });
  });

  describe('detectConflicts', () => {
    it('AC01: action이 상반되는 같은 카테고리 규칙 쌍이 ConflictPair로 반환된다', () => {
      // Arrange: two rules same category, same subject, opposite actions
      engine.createRule({
        title: 'async await 사용하라',
        category: 'STYLE',
        ruleContent: '## Rule\nUse async await\n',
      });
      engine.createRule({
        title: 'async await 사용하지 마라',
        category: 'STYLE',
        ruleContent: '## Rule\nAvoid async await\n',
      });

      // Act
      const conflicts = cleanup.detectConflicts();

      // Assert
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      const conflict = conflicts[0];
      expect(conflict.ruleA).toHaveProperty('id');
      expect(conflict.ruleA).toHaveProperty('title');
      expect(conflict.ruleB).toHaveProperty('id');
      expect(conflict.ruleB).toHaveProperty('title');
      expect(conflict.reason).toBeTruthy();
    });

    it('AC01: 다른 카테고리의 상반 규칙은 충돌로 감지되지 않는다', () => {
      // Arrange: rules in different categories
      engine.createRule({
        title: 'async await 사용하라',
        category: 'STYLE',
        ruleContent: '## Rule\nUse async await\n',
      });
      engine.createRule({
        title: 'async await 사용하지 마라',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nAvoid async await\n',
      });

      // Act
      const conflicts = cleanup.detectConflicts();

      // Assert: different categories → no conflict
      expect(conflicts).toHaveLength(0);
    });

    it('AC01: 유사도 50% 미만이면 충돌로 감지되지 않는다', () => {
      // Arrange: same category but very different subjects
      engine.createRule({
        title: 'null 체크 항상 사용하라',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null\n',
      });
      engine.createRule({
        title: 'promise rejection 피하라',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nAvoid rejection\n',
      });

      // Act
      const conflicts = cleanup.detectConflicts();

      // Assert: low similarity → no conflict
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('runSessionCleanup', () => {
    it('AC02: runSessionCleanup이 중복/충돌/아카이브 수를 포함한 CleanupReport를 반환한다', async () => {
      // Arrange: duplicate rules + conflicting rules + a stale rule
      engine.createRule({
        title: 'always check null before accessing property',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null\n',
      });
      engine.createRule({
        title: 'always check null before accessing object property',
        category: 'LOGIC_ERROR',
        ruleContent: '## Rule\nCheck null on object\n',
      });
      engine.createRule({
        title: 'async await 사용하라',
        category: 'STYLE',
        ruleContent: '## Rule\nUse async await\n',
      });
      engine.createRule({
        title: 'async await 사용하지 마라',
        category: 'STYLE',
        ruleContent: '## Rule\nAvoid async await\n',
      });

      // Act
      const report = await cleanup.runSessionCleanup();

      // Assert
      expect(report).toHaveProperty('duplicates');
      expect(report).toHaveProperty('conflicts');
      expect(report).toHaveProperty('archived');
      expect(typeof report.duplicates).toBe('number');
      expect(typeof report.conflicts).toBe('number');
      expect(typeof report.archived).toBe('number');
      expect(report.conflicts).toBeGreaterThanOrEqual(1);
    });

    it('AC03: DB 실패 시 에러 없이 빈 리포트를 반환한다', async () => {
      // Arrange: close the DB to simulate failure
      db.close();

      // Act & Assert: should not throw
      const report = await cleanup.runSessionCleanup();

      expect(report).toEqual({ duplicates: 0, conflicts: 0, archived: 0 });

      // Re-open to allow afterEach cleanup (create a new db to avoid double-close error)
      db = createMemoryDb();
    });

    it('AC04: 정리 결과가 context에 기록된다', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log');

      // Act
      await cleanup.runSessionCleanup();

      // Assert: console.log was called with cleanup info
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map(c => c.join(' '));
      const hasCleanupLog = calls.some(c => c.includes('cleanup') || c.includes('Cleanup') || c.includes('정리'));
      expect(hasCleanupLog).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
