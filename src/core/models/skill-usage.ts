import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { SkillUsage, SkillStats } from '../types.js';

export class SkillUsageModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  record(skillName: string, opts?: { planId?: string; sessionId?: string }): SkillUsage {
    const id = nanoid(12);
    this.db
      .prepare(
        `INSERT INTO skill_usage (id, skill_name, plan_id, session_id)
         VALUES (?, ?, ?, ?)`,
      )
      .run(id, skillName, opts?.planId ?? null, opts?.sessionId ?? null);

    return this.db
      .prepare('SELECT * FROM skill_usage WHERE id = ?')
      .get(id) as SkillUsage;
  }

  getStats(days?: number): SkillStats[] {
    if (days !== undefined) {
      return this.db
        .prepare(
          `SELECT skill_name, COUNT(*) as count, MAX(created_at) as last_used
           FROM skill_usage
           WHERE created_at >= datetime('now', '-' || ? || ' days')
           GROUP BY skill_name
           ORDER BY count DESC`,
        )
        .all(days) as SkillStats[];
    }

    return this.db
      .prepare(
        `SELECT skill_name, COUNT(*) as count, MAX(created_at) as last_used
         FROM skill_usage
         GROUP BY skill_name
         ORDER BY count DESC`,
      )
      .all() as SkillStats[];
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
