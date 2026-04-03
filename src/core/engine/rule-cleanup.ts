import type Database from 'better-sqlite3';
import { generateId, normalizeError } from '../utils.js';
import type { SelfImproveEngine } from './self-improve.js';
import type { SelfImproveRule } from '../types.js';

export interface DuplicateGroup {
  id: string; // nanoid
  rules: Array<{ id: string; title: string; similarity: number }>;
}

export interface ConflictPair {
  ruleA: { id: string; title: string };
  ruleB: { id: string; title: string };
  reason: string;
}

export interface CleanupReport {
  duplicates: number;
  conflicts: number;
  archived: number;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 0)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

export class RuleCleanup {
  private db: Database.Database;
  private engine: SelfImproveEngine;

  // In-memory store for detected groups (keyed by group id)
  private groups: Map<string, DuplicateGroup> = new Map();

  constructor(db: Database.Database, engine: SelfImproveEngine) {
    this.db = db;
    this.engine = engine;
  }

  detectDuplicates(): DuplicateGroup[] {
    const rules = this.engine.listRules('active');

    if (rules.length === 0) {
      this.groups.clear();
      return [];
    }

    // Find pairs with similarity >= 0.7
    const grouped = new Map<string, Set<string>>(); // ruleId -> Set of ruleIds it's grouped with
    const similarityMap = new Map<string, number>(); // "id1:id2" -> similarity

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const ruleA = rules[i];
        const ruleB = rules[j];
        const tokensA = tokenize(ruleA.title);
        const tokensB = tokenize(ruleB.title);
        const sim = jaccardSimilarity(tokensA, tokensB);

        if (sim >= 0.7) {
          similarityMap.set(`${ruleA.id}:${ruleB.id}`, sim);
          if (!grouped.has(ruleA.id)) grouped.set(ruleA.id, new Set([ruleA.id]));
          if (!grouped.has(ruleB.id)) grouped.set(ruleB.id, new Set([ruleB.id]));
          // Merge the two sets (union-find style)
          const setA = grouped.get(ruleA.id)!;
          const setB = grouped.get(ruleB.id)!;
          const merged = new Set([...setA, ...setB]);
          for (const id of merged) {
            grouped.set(id, merged);
          }
        }
      }
    }

    // Collect unique groups (deduplicate by Set reference)
    const seen = new Set<Set<string>>();
    const result: DuplicateGroup[] = [];

    this.groups.clear();

    for (const [, set] of grouped) {
      if (seen.has(set)) continue;
      seen.add(set);

      const ids = [...set];
      if (ids.length < 2) continue;

      // Build rules array with representative similarity (max similarity to group)
      const ruleObjs: Array<{ id: string; title: string; similarity: number }> = ids.map(id => {
        const rule = rules.find(r => r.id === id)!;
        // Find max similarity with any other member of the group
        let maxSim = 0;
        for (const otherId of ids) {
          if (otherId === id) continue;
          const key1 = `${id}:${otherId}`;
          const key2 = `${otherId}:${id}`;
          const sim = similarityMap.get(key1) ?? similarityMap.get(key2) ?? 0;
          if (sim > maxSim) maxSim = sim;
        }
        return { id, title: rule.title, similarity: maxSim };
      });

      const groupId = generateId();
      const group: DuplicateGroup = { id: groupId, rules: ruleObjs };
      this.groups.set(groupId, group);
      result.push(group);
    }

    return result;
  }

  detectConflicts(): ConflictPair[] {
    const rules = this.engine.listRules('active');
    if (rules.length < 2) return [];

    const FORBIDDEN_KEYWORDS = ['하지 마', '금지', '사용하지', '피하', "don't", 'avoid', 'never'];
    const RECOMMEND_KEYWORDS = ['사용하', '해야', '필수', 'always', 'must', 'use'];

    const ALL_ACTION_KEYWORDS = [...FORBIDDEN_KEYWORDS, ...RECOMMEND_KEYWORDS];

    function classifyAction(title: string): 'forbidden' | 'recommend' | 'neutral' {
      const lower = title.toLowerCase();
      if (FORBIDDEN_KEYWORDS.some(k => lower.includes(k))) return 'forbidden';
      if (RECOMMEND_KEYWORDS.some(k => lower.includes(k))) return 'recommend';
      return 'neutral';
    }

    function stripActionKeywords(title: string): Set<string> {
      // Remove action keyword tokens before similarity comparison
      const tokens = [...tokenize(title)];
      const filtered = tokens.filter(t => !ALL_ACTION_KEYWORDS.some(k => t.includes(k.toLowerCase())));
      return new Set(filtered.length > 0 ? filtered : tokens);
    }

    const conflicts: ConflictPair[] = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const ruleA = rules[i];
        const ruleB = rules[j];

        // Same category required
        if (ruleA.category !== ruleB.category) continue;

        const actionA = classifyAction(ruleA.title);
        const actionB = classifyAction(ruleB.title);

        // Both must be classified and opposite
        if (actionA === 'neutral' || actionB === 'neutral') continue;
        if (actionA === actionB) continue;

        // Check topic similarity >= 50% (strip action keywords for fairer comparison)
        const tokensA = stripActionKeywords(ruleA.title);
        const tokensB = stripActionKeywords(ruleB.title);
        const sim = jaccardSimilarity(tokensA, tokensB);
        if (sim < 0.5) continue;

        conflicts.push({
          ruleA: { id: ruleA.id, title: ruleA.title },
          ruleB: { id: ruleB.id, title: ruleB.title },
          reason: `같은 카테고리(${ruleA.category}) 내 상반되는 action (유사도: ${Math.round(sim * 100)}%)`,
        });
      }
    }

    return conflicts;
  }

  async runSessionCleanup(): Promise<CleanupReport> {
    try {
      const duplicateGroups = this.detectDuplicates();
      const conflicts = this.detectConflicts();
      const archivedIds = this.engine.autoArchiveStale();

      const report: CleanupReport = {
        duplicates: duplicateGroups.length,
        conflicts: conflicts.length,
        archived: archivedIds.length,
      };

      console.log(
        `[Cleanup] 세션 정리 완료 — 중복: ${report.duplicates}, 충돌: ${report.conflicts}, 아카이브: ${report.archived}`
      );

      return report;
    } catch (err: unknown) {
      console.error('[Cleanup] 세션 정리 실패:', normalizeError(err).message);
      return { duplicates: 0, conflicts: 0, archived: 0 };
    }
  }

  mergeDuplicates(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    const ruleIds = group.rules.map(r => r.id);
    if (ruleIds.length < 2) return;

    // Load full rule records to get created_at
    const ruleRecords: SelfImproveRule[] = ruleIds
      .map(id => this.engine.listRules().find(r => r.id === id))
      .filter((r): r is SelfImproveRule => r !== undefined);

    if (ruleRecords.length === 0) return;

    // Pick representative: most recently created rule
    const representative = ruleRecords.reduce((latest, r) => {
      return r.created_at > latest.created_at ? r : latest;
    });

    // Sum occurrences and prevented
    const totalOccurrences = ruleRecords.reduce((sum, r) => sum + r.occurrences, 0);
    const totalPrevented = ruleRecords.reduce((sum, r) => sum + r.prevented, 0);

    // Update the representative rule with summed counts
    this.db.prepare(
      'UPDATE self_improve_rules SET occurrences = ?, prevented = ? WHERE id = ?'
    ).run(totalOccurrences, totalPrevented, representative.id);

    // Archive all other rules
    for (const rule of ruleRecords) {
      if (rule.id !== representative.id) {
        this.engine.archiveRule(rule.id);
      }
    }
  }
}
