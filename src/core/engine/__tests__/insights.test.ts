import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { InsightsEngine } from '../insights.js';
import type Database from 'better-sqlite3';

/**
 * Helper: insert a task_metrics row directly.
 * Requires a plan and task to exist for FK constraints.
 */
function insertPlan(db: Database.Database, id: string, title: string): void {
  db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, 'active')").run(id, title);
}

function insertTask(db: Database.Database, id: string, planId: string, title: string): void {
  db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES (?, ?, ?, 'done')").run(
    id,
    planId,
    title,
  );
}

function insertMetric(
  db: Database.Database,
  opts: {
    taskId: string;
    planId: string;
    finalStatus: string;
    durationMin?: number | null;
    blockReason?: string | null;
    hasConcerns?: boolean;
  },
): void {
  db.prepare(
    `INSERT INTO task_metrics (task_id, plan_id, duration_min, final_status, block_reason, has_concerns)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.taskId,
    opts.planId,
    opts.durationMin ?? null,
    opts.finalStatus,
    opts.blockReason ?? null,
    opts.hasConcerns ? 1 : 0,
  );
}

describe('InsightsEngine', () => {
  let db: Database.Database;
  let engine: InsightsEngine;
  let taskCounter: number;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    engine = new InsightsEngine(db);
    taskCounter = 0;
  });

  /** Helper to create a plan+task+metric in one go */
  function addMetric(
    planId: string,
    planTitle: string,
    finalStatus: string,
    opts?: { durationMin?: number | null; blockReason?: string | null; hasConcerns?: boolean },
  ): void {
    // Ensure plan exists (ignore if already exists)
    db.prepare("INSERT OR IGNORE INTO plans (id, title, status) VALUES (?, ?, 'active')").run(
      planId,
      planTitle,
    );
    const taskId = `t-${++taskCounter}`;
    insertTask(db, taskId, planId, `Task ${taskCounter}`);
    insertMetric(db, {
      taskId,
      planId,
      finalStatus,
      durationMin: opts?.durationMin ?? null,
      blockReason: opts?.blockReason ?? null,
      hasConcerns: opts?.hasConcerns ?? false,
    });
  }

  // ── AC: Empty DB returns defaults without error ──

  describe('empty DB', () => {
    it('should return empty blocked patterns on empty DB', () => {
      expect(engine.getBlockedPatterns()).toEqual([]);
    });

    it('should return zero duration stats on empty DB', () => {
      expect(engine.getDurationStats()).toEqual({ avg_min: 0, median_min: 0, sample_count: 0 });
    });

    it('should return zero success rates on empty DB', () => {
      expect(engine.getSuccessRates()).toEqual({ overall: 0, by_plan: [] });
    });

    it('should return empty recommendations on empty DB', () => {
      expect(engine.getRecommendations()).toEqual([]);
    });

    it('should return low confidence on empty DB', () => {
      expect(engine.getConfidenceLevel()).toBe('low');
    });
  });

  // ── AC: Confidence levels ──

  describe('getConfidenceLevel', () => {
    it('should return low when sample count < 5', () => {
      for (let i = 0; i < 4; i++) {
        addMetric('p1', 'Plan 1', 'done');
      }
      expect(engine.getConfidenceLevel()).toBe('low');
    });

    it('should return medium when sample count is 5-19', () => {
      for (let i = 0; i < 5; i++) {
        addMetric('p1', 'Plan 1', 'done');
      }
      expect(engine.getConfidenceLevel()).toBe('medium');
    });

    it('should return medium when sample count is 19', () => {
      for (let i = 0; i < 19; i++) {
        addMetric('p1', 'Plan 1', 'done');
      }
      expect(engine.getConfidenceLevel()).toBe('medium');
    });

    it('should return high when sample count >= 20', () => {
      for (let i = 0; i < 20; i++) {
        addMetric('p1', 'Plan 1', 'done');
      }
      expect(engine.getConfidenceLevel()).toBe('high');
    });
  });

  // ── AC: Blocked patterns sorted by frequency descending ──

  describe('getBlockedPatterns', () => {
    it('should aggregate block reasons by frequency descending', () => {
      addMetric('p1', 'Plan 1', 'blocked', { blockReason: 'dependency' });
      addMetric('p1', 'Plan 1', 'blocked', { blockReason: 'dependency' });
      addMetric('p1', 'Plan 1', 'blocked', { blockReason: 'dependency' });
      addMetric('p1', 'Plan 1', 'blocked', { blockReason: 'unclear spec' });
      addMetric('p1', 'Plan 1', 'done');

      const patterns = engine.getBlockedPatterns();
      expect(patterns).toHaveLength(2);
      expect(patterns[0].reason).toBe('dependency');
      expect(patterns[0].count).toBe(3);
      expect(patterns[0].pct).toBe(75); // 3 out of 4 blocked
      expect(patterns[1].reason).toBe('unclear spec');
      expect(patterns[1].count).toBe(1);
      expect(patterns[1].pct).toBe(25);
    });

    it('should treat null block_reason as "unspecified"', () => {
      addMetric('p1', 'Plan 1', 'blocked', { blockReason: null });
      addMetric('p1', 'Plan 1', 'blocked', { blockReason: null });

      const patterns = engine.getBlockedPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].reason).toBe('unspecified');
      expect(patterns[0].count).toBe(2);
      expect(patterns[0].pct).toBe(100);
    });
  });

  // ── AC: Success rates in 0-100 range ──

  describe('getSuccessRates', () => {
    it('should calculate overall and by_plan success rates', () => {
      addMetric('p1', 'Plan A', 'done');
      addMetric('p1', 'Plan A', 'done');
      addMetric('p1', 'Plan A', 'blocked');
      addMetric('p2', 'Plan B', 'done');
      addMetric('p2', 'Plan B', 'skipped');

      const rates = engine.getSuccessRates();
      // overall: 3 done / 5 total * 100 = 60
      expect(rates.overall).toBe(60);
      expect(rates.by_plan).toHaveLength(2);

      const planA = rates.by_plan.find((p) => p.title === 'Plan A')!;
      expect(planA.rate).toBe(67); // 2/3 * 100 rounded
      expect(planA.count).toBe(3);

      const planB = rates.by_plan.find((p) => p.title === 'Plan B')!;
      expect(planB.rate).toBe(50); // 1/2 * 100 rounded
      expect(planB.count).toBe(2);
    });

    it('should return 0 overall when no terminal tasks exist', () => {
      expect(engine.getSuccessRates().overall).toBe(0);
    });
  });

  // ── AC: Median calculation (odd and even cases) ──

  describe('getDurationStats', () => {
    it('should calculate avg and median for odd sample count', () => {
      addMetric('p1', 'Plan 1', 'done', { durationMin: 10 });
      addMetric('p1', 'Plan 1', 'done', { durationMin: 20 });
      addMetric('p1', 'Plan 1', 'done', { durationMin: 30 });

      const stats = engine.getDurationStats();
      expect(stats.sample_count).toBe(3);
      expect(stats.avg_min).toBe(20.0); // (10+20+30)/3 = 20.0
      expect(stats.median_min).toBe(20);
    });

    it('should calculate median for even sample count', () => {
      addMetric('p1', 'Plan 1', 'done', { durationMin: 10 });
      addMetric('p1', 'Plan 1', 'done', { durationMin: 20 });
      addMetric('p1', 'Plan 1', 'done', { durationMin: 30 });
      addMetric('p1', 'Plan 1', 'done', { durationMin: 40 });

      const stats = engine.getDurationStats();
      expect(stats.sample_count).toBe(4);
      expect(stats.avg_min).toBe(25.0);
      expect(stats.median_min).toBe(25); // (20+30)/2
    });

    it('should ignore rows with null duration_min', () => {
      addMetric('p1', 'Plan 1', 'done', { durationMin: 10 });
      addMetric('p1', 'Plan 1', 'done', { durationMin: null });
      addMetric('p1', 'Plan 1', 'done', { durationMin: 30 });

      const stats = engine.getDurationStats();
      expect(stats.sample_count).toBe(2);
      expect(stats.avg_min).toBe(20.0);
      expect(stats.median_min).toBe(20); // (10+30)/2
    });

    it('should return zeros when no duration data exists', () => {
      addMetric('p1', 'Plan 1', 'done', { durationMin: null });
      expect(engine.getDurationStats()).toEqual({ avg_min: 0, median_min: 0, sample_count: 0 });
    });
  });

  // ── AC: Recommendations rules ──

  describe('getRecommendations', () => {
    it('should return empty array when sample < 5', () => {
      for (let i = 0; i < 4; i++) {
        addMetric('p1', 'Plan 1', 'done', { durationMin: 100 });
      }
      expect(engine.getRecommendations()).toEqual([]);
    });

    it('should warn when blocked ratio >= 30%', () => {
      // 2 blocked out of 5 = 40%
      addMetric('p1', 'Plan 1', 'blocked');
      addMetric('p1', 'Plan 1', 'blocked');
      addMetric('p1', 'Plan 1', 'done');
      addMetric('p1', 'Plan 1', 'done');
      addMetric('p1', 'Plan 1', 'done');

      const recs = engine.getRecommendations();
      expect(recs.some((r) => r.includes('Blocked') && r.includes('40%'))).toBe(true);
    });

    it('should warn when avg duration > 60 min', () => {
      for (let i = 0; i < 5; i++) {
        addMetric('p1', 'Plan 1', 'done', { durationMin: 90 });
      }

      const recs = engine.getRecommendations();
      expect(recs.some((r) => r.includes('90') && r.includes('분'))).toBe(true);
    });

    it('should warn when concerns ratio >= 50%', () => {
      // 3 out of 5 have concerns = 60%
      addMetric('p1', 'Plan 1', 'done', { hasConcerns: true });
      addMetric('p1', 'Plan 1', 'done', { hasConcerns: true });
      addMetric('p1', 'Plan 1', 'done', { hasConcerns: true });
      addMetric('p1', 'Plan 1', 'done', { hasConcerns: false });
      addMetric('p1', 'Plan 1', 'done', { hasConcerns: false });

      const recs = engine.getRecommendations();
      expect(recs.some((r) => r.includes('우려사항') && r.includes('60%'))).toBe(true);
    });

    it('should return no recommendations when all metrics are healthy', () => {
      for (let i = 0; i < 5; i++) {
        addMetric('p1', 'Plan 1', 'done', { durationMin: 30 });
      }

      const recs = engine.getRecommendations();
      expect(recs).toEqual([]);
    });
  });
});
