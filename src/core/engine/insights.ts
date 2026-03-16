import type Database from 'better-sqlite3';
import type { BlockedPattern, DurationStats, SuccessRates } from '../types.js';

export class InsightsEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getBlockedPatterns(): BlockedPattern[] {
    const rows = this.db
      .prepare(
        `SELECT
           COALESCE(block_reason, 'unspecified') AS reason,
           COUNT(*) AS count
         FROM task_metrics
         WHERE final_status = 'blocked'
         GROUP BY reason
         ORDER BY count DESC`,
      )
      .all() as { reason: string; count: number }[];

    if (rows.length === 0) return [];

    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return rows.map((r) => ({
      reason: r.reason,
      count: r.count,
      pct: Math.round((r.count / total) * 100),
    }));
  }

  getDurationStats(): DurationStats {
    const statsRow = this.db
      .prepare(
        `SELECT
           ROUND(AVG(duration_min), 1) AS avg_min,
           COUNT(*) AS sample_count
         FROM task_metrics
         WHERE duration_min IS NOT NULL`,
      )
      .get() as { avg_min: number | null; sample_count: number };

    const sampleCount = statsRow.sample_count;
    if (sampleCount === 0) {
      return { avg_min: 0, median_min: 0, sample_count: 0 };
    }

    const avgMin = statsRow.avg_min ?? 0;

    // Median calculation
    let medianMin: number;
    if (sampleCount % 2 === 1) {
      // Odd: pick the middle element
      const offset = Math.floor(sampleCount / 2);
      const row = this.db
        .prepare(
          `SELECT duration_min
           FROM task_metrics
           WHERE duration_min IS NOT NULL
           ORDER BY duration_min
           LIMIT 1 OFFSET ?`,
        )
        .get(offset) as { duration_min: number };
      medianMin = row.duration_min;
    } else {
      // Even: average of two middle elements
      const offset = sampleCount / 2 - 1;
      const rows = this.db
        .prepare(
          `SELECT duration_min
           FROM task_metrics
           WHERE duration_min IS NOT NULL
           ORDER BY duration_min
           LIMIT 2 OFFSET ?`,
        )
        .all(offset) as { duration_min: number }[];
      medianMin = (rows[0].duration_min + rows[1].duration_min) / 2;
    }

    return { avg_min: avgMin, median_min: medianMin, sample_count: sampleCount };
  }

  getSuccessRates(): SuccessRates {
    const overallRow = this.db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN final_status = 'done' THEN 1 ELSE 0 END) AS done
         FROM task_metrics
         WHERE final_status IN ('done', 'blocked', 'skipped')`,
      )
      .get() as { total: number; done: number };

    const overall = overallRow.total > 0 ? Math.round((overallRow.done / overallRow.total) * 100) : 0;

    const byPlanRows = this.db
      .prepare(
        `SELECT
           p.title,
           COUNT(*) AS count,
           SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done
         FROM task_metrics tm
         JOIN plans p ON p.id = tm.plan_id
         WHERE tm.final_status IN ('done', 'blocked', 'skipped')
         GROUP BY tm.plan_id`,
      )
      .all() as { title: string; count: number; done: number }[];

    const by_plan = byPlanRows.map((r) => ({
      title: r.title,
      rate: Math.round((r.done / r.count) * 100),
      count: r.count,
    }));

    return { overall, by_plan };
  }

  getRecommendations(): string[] {
    const totalRow = this.db
      .prepare('SELECT COUNT(*) AS total FROM task_metrics')
      .get() as { total: number };

    if (totalRow.total < 5) return [];

    const recommendations: string[] = [];
    const total = totalRow.total;

    // Blocked ratio check
    const blockedRow = this.db
      .prepare("SELECT COUNT(*) AS blocked FROM task_metrics WHERE final_status = 'blocked'")
      .get() as { blocked: number };
    const blockedPct = Math.round((blockedRow.blocked / total) * 100);
    if (blockedPct >= 30) {
      recommendations.push(
        `Blocked 태스크 비율이 ${blockedPct}%로 높습니다. 태스크 분해를 더 세분화하거나 의존성을 사전에 확인하세요.`,
      );
    }

    // Average duration check
    const durationRow = this.db
      .prepare(
        `SELECT ROUND(AVG(duration_min), 1) AS avg_min
         FROM task_metrics
         WHERE duration_min IS NOT NULL`,
      )
      .get() as { avg_min: number | null };
    if (durationRow.avg_min !== null && durationRow.avg_min > 60) {
      recommendations.push(
        `평균 태스크 소요 시간이 ${durationRow.avg_min}분입니다. 태스크를 더 작은 단위로 분해하는 것을 권장합니다.`,
      );
    }

    // Concerns ratio check
    const concernsRow = this.db
      .prepare('SELECT SUM(CASE WHEN has_concerns = 1 THEN 1 ELSE 0 END) AS concerns FROM task_metrics')
      .get() as { concerns: number };
    const concernsPct = Math.round((concernsRow.concerns / total) * 100);
    if (concernsPct >= 50) {
      recommendations.push(
        `구현 우려사항이 ${concernsPct}%의 태스크에서 발견되었습니다. 스펙 명확화가 필요할 수 있습니다.`,
      );
    }

    return recommendations;
  }

  getConfidenceLevel(): 'high' | 'medium' | 'low' {
    const row = this.db
      .prepare('SELECT COUNT(*) AS total FROM task_metrics')
      .get() as { total: number };

    if (row.total < 5) return 'low';
    if (row.total < 20) return 'medium';
    return 'high';
  }
}
