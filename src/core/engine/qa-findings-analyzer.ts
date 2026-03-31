import * as fs from 'node:fs';
import * as path from 'node:path';
import type Database from 'better-sqlite3';

const PENDING_DIR = '.claude/self-improve/pending';

interface FindingRow {
  id: string;
  run_id: string;
  category: string;
  description: string;
}

interface RecurringGroup {
  category: string;
  description_pattern: string;
  finding_ids: string[];
  run_ids: Set<string>;
}

export interface AnalyzeResult {
  analyzed: number;
  pendingCreated: number;
}

/**
 * Find the longest common prefix of two strings.
 */
function commonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return a.slice(0, i);
}

/**
 * Check if two descriptions are similar:
 * - One contains the other (substring match), OR
 * - They share a common prefix that is >= 50% of the shorter string's length
 */
function isSimilarDescription(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;

  const prefix = commonPrefix(a, b).trim();
  const minLen = Math.min(a.length, b.length);
  // Common prefix must be at least 50% of the shorter string
  return minLen > 0 && prefix.length >= minLen * 0.5;
}

/**
 * Analyze QA findings for recurring patterns across multiple runs.
 * When the same category + similar description appears in 3+ different qa_runs,
 * generates a pending self-improve JSON file.
 */
export function analyzeRecurringFindings(
  db: Database.Database,
  projectRoot: string,
): AnalyzeResult {
  const pendingDir = path.join(projectRoot, PENDING_DIR);
  fs.mkdirSync(pendingDir, { recursive: true });

  // Query all findings joined with runs
  const findings = db.prepare(`
    SELECT qf.id, qf.run_id, qf.category, qf.description
    FROM qa_findings qf
    JOIN qa_runs qr ON qr.id = qf.run_id
    ORDER BY qf.category, qf.description
  `).all() as FindingRow[];

  const analyzed = findings.length;

  // Group by category, then by description similarity (substring match)
  const groups: RecurringGroup[] = [];

  for (const finding of findings) {
    let matched = false;

    for (const group of groups) {
      if (group.category !== finding.category) continue;

      // Substring match: containment or significant common prefix
      if (isSimilarDescription(finding.description, group.description_pattern)) {
        group.finding_ids.push(finding.id);
        group.run_ids.add(finding.run_id);
        // Update pattern to common prefix for better representation
        const common = commonPrefix(finding.description, group.description_pattern).trim();
        if (common.length > 0) {
          group.description_pattern = common;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.push({
        category: finding.category,
        description_pattern: finding.description,
        finding_ids: [finding.id],
        run_ids: new Set([finding.run_id]),
      });
    }
  }

  // Filter groups that appear in 3+ different runs
  let pendingCreated = 0;

  for (const group of groups) {
    if (group.run_ids.size >= 3) {
      const pending = {
        type: 'recurring_qa_finding' as const,
        finding_ids: group.finding_ids,
        category: group.category,
        description_pattern: group.description_pattern,
        repeat_count: group.run_ids.size,
        timestamp: new Date().toISOString(),
      };

      const filename = `recurring-${group.category}-${Date.now()}-${pendingCreated}.json`;
      const filePath = path.join(pendingDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(pending, null, 2), 'utf-8');
      pendingCreated++;
    }
  }

  return { analyzed, pendingCreated };
}
