import type Database from 'better-sqlite3';
import type { SkillUsage, SkillStats } from '../types.js';
import { generateId } from '../utils.js';
import { BaseRepository } from './base-repository.js';

export class SkillUsageModel extends BaseRepository<SkillUsage> {
  constructor(db: Database.Database) {
    super(db, 'skill_usage');
  }

  record(skillName: string, opts?: { planId?: string; sessionId?: string }): SkillUsage {
    const id = generateId();
    const planId = opts?.planId ?? null;
    const sessionId = opts?.sessionId ?? null;
    const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    this.db
      .prepare(
        `INSERT INTO skill_usage (id, skill_name, plan_id, session_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, skillName, planId, sessionId, createdAt);

    return { id, skill_name: skillName, plan_id: planId, session_id: sessionId, created_at: createdAt };
  }

  getStats(days?: number): SkillStats[] {
    const base = `SELECT skill_name, COUNT(*) as count, MAX(created_at) as last_used FROM skill_usage`;
    const suffix = `GROUP BY skill_name ORDER BY count DESC`;
    if (days !== undefined) {
      return this.db.prepare(`${base} WHERE created_at >= datetime('now', '-' || ? || ' days') ${suffix}`).all(days) as SkillStats[];
    }
    return this.db.prepare(`${base} ${suffix}`).all() as SkillStats[];
  }

  getRecentUsage(limit?: number): SkillUsage[] {
    return this.db
      .prepare(
        `SELECT * FROM skill_usage
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit ?? 20) as SkillUsage[];
  }
}
