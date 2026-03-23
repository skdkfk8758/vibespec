import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { SkillUsageModel } from '../skill-usage';
import type Database from 'better-sqlite3';

describe('SkillUsageModel', () => {
  let db: Database.Database;
  let model: SkillUsageModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    model = new SkillUsageModel(db);
  });

  describe('record()', () => {
    it('should record a skill usage and return SkillUsage object', () => {
      const result = model.record('vs-next');

      expect(result.id).toBeTruthy();
      expect(result.skill_name).toBe('vs-next');
      expect(result.plan_id).toBeNull();
      expect(result.session_id).toBeNull();
      expect(result.created_at).toBeTruthy();
    });

    it('should record a skill usage with optional planId and sessionId', () => {
      // Create a plan for FK constraint
      db.prepare(
        "INSERT INTO plans (id, title, status) VALUES ('plan1', 'Test Plan', 'active')",
      ).run();

      const result = model.record('vs-next', { planId: 'plan1', sessionId: 'sess-123' });

      expect(result.skill_name).toBe('vs-next');
      expect(result.plan_id).toBe('plan1');
      expect(result.session_id).toBe('sess-123');
    });

    it('should generate unique IDs for each record', () => {
      const r1 = model.record('vs-next');
      const r2 = model.record('vs-next');

      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe('getStats()', () => {
    it('should return aggregated stats grouped by skill_name', () => {
      model.record('vs-next');
      model.record('vs-next');
      model.record('vs-review');

      const stats = model.getStats();

      expect(stats).toHaveLength(2);
      const vsNext = stats.find((s: { skill_name: string }) => s.skill_name === 'vs-next');
      const vsReview = stats.find((s: { skill_name: string }) => s.skill_name === 'vs-review');
      expect(vsNext?.count).toBe(2);
      expect(vsReview?.count).toBe(1);
      expect(vsNext?.last_used).toBeTruthy();
    });

    it('should return empty array when no data exists', () => {
      const stats = model.getStats();

      expect(stats).toEqual([]);
    });

    it('should filter by days when days parameter is provided', () => {
      // Insert a record with old timestamp (10 days ago)
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        "INSERT INTO skill_usage (id, skill_name, created_at) VALUES ('old1', 'old-skill', ?)",
      ).run(tenDaysAgo);

      // Insert a recent record
      model.record('new-skill');

      const stats = model.getStats(7);

      expect(stats).toHaveLength(1);
      expect(stats[0].skill_name).toBe('new-skill');
    });
  });

  describe('getRecentUsage()', () => {
    it('should return recent usage ordered by created_at DESC with default limit 20', () => {
      model.record('skill-a');
      model.record('skill-b');
      model.record('skill-c');

      const recent = model.getRecentUsage();

      expect(recent).toHaveLength(3);
      // Most recent first
      expect(recent[0].skill_name).toBe('skill-c');
      expect(recent[2].skill_name).toBe('skill-a');
    });

    it('should respect custom limit', () => {
      model.record('skill-a');
      model.record('skill-b');
      model.record('skill-c');

      const recent = model.getRecentUsage(2);

      expect(recent).toHaveLength(2);
    });
  });
});
