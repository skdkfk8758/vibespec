import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { MergeReportModel } from '../merge-report.js';
import { PlanModel } from '../plan.js';
import type Database from 'better-sqlite3';
import type { NewMergeReport } from '../../types.js';

function makeReport(overrides?: Partial<NewMergeReport>): NewMergeReport {
  return {
    commit_hash: 'abc12345def67890',
    source_branch: 'worktree-fix_backlog',
    target_branch: 'feat/map-design',
    changes_summary: [
      { file: 'src/api/auth.ts', category: 'feat', description: '인증 필드 추가' },
    ],
    review_checklist: [
      { level: 'must', file: 'src/api/auth.ts', line: '45', description: '세션 만료 시간 확인', reason: 'AI 추측' },
      { level: 'should', file: 'src/models/user.ts', description: '테스트 없음', reason: '커버리지 갭' },
      { level: 'info', file: 'src/utils/format.ts', description: 'import 변경', reason: '기계적 변환' },
    ],
    verification: {
      build: 'pass',
      test: { status: 'pass', passed: 23, failed: 0 },
      lint: 'pass',
      acceptance: 'skip',
    },
    report_path: '.claude/reports/merge-2026-03-27-fix_backlog.md',
    ...overrides,
  };
}

describe('MergeReportModel', () => {
  let db: Database.Database;
  let model: MergeReportModel;
  let planModel: PlanModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    model = new MergeReportModel(db);
    planModel = new PlanModel(db);
  });

  describe('create and get', () => {
    it('should create a report and retrieve it by id', () => {
      const report = model.create(makeReport());

      expect(report.id).toHaveLength(12);
      expect(report.commit_hash).toBe('abc12345def67890');
      expect(report.source_branch).toBe('worktree-fix_backlog');
      expect(report.target_branch).toBe('feat/map-design');
      expect(report.report_path).toBe('.claude/reports/merge-2026-03-27-fix_backlog.md');
      expect(report.created_at).toBeTruthy();

      const fetched = model.get(report.id);
      expect(fetched).toEqual(report);
    });

    it('should return null for non-existent id', () => {
      expect(model.get('nonexistent')).toBeNull();
    });
  });

  describe('JSON serialization roundtrip', () => {
    it('should correctly serialize and deserialize changes_summary', () => {
      const report = model.create(makeReport());
      const fetched = model.get(report.id)!;

      expect(fetched.changes_summary).toEqual([
        { file: 'src/api/auth.ts', category: 'feat', description: '인증 필드 추가' },
      ]);
    });

    it('should correctly serialize and deserialize review_checklist', () => {
      const report = model.create(makeReport());
      const fetched = model.get(report.id)!;

      expect(fetched.review_checklist).toHaveLength(3);
      expect(fetched.review_checklist[0].level).toBe('must');
      expect(fetched.review_checklist[1].level).toBe('should');
      expect(fetched.review_checklist[2].level).toBe('info');
    });

    it('should correctly serialize and deserialize verification', () => {
      const report = model.create(makeReport());
      const fetched = model.get(report.id)!;

      expect(fetched.verification.build).toBe('pass');
      expect(fetched.verification.test.passed).toBe(23);
      expect(fetched.verification.acceptance).toBe('skip');
    });
  });

  describe('null field handling', () => {
    it('should store null for optional fields when omitted', () => {
      const report = model.create(makeReport());
      const fetched = model.get(report.id)!;

      expect(fetched.plan_id).toBeNull();
      expect(fetched.conflict_log).toBeNull();
      expect(fetched.ai_judgments).toBeNull();
      expect(fetched.task_ids).toBeNull();
    });

    it('should store and retrieve conflict_log when provided', () => {
      const report = model.create(makeReport({
        conflict_log: [
          { file: 'src/api/auth.ts', hunks: 3, resolution: 'ai_merge', choice_reason: '양쪽 의도 반영' },
        ],
      }));
      const fetched = model.get(report.id)!;

      expect(fetched.conflict_log).toHaveLength(1);
      expect(fetched.conflict_log![0].resolution).toBe('ai_merge');
      expect(fetched.conflict_log![0].hunks).toBe(3);
    });

    it('should store and retrieve ai_judgments when provided', () => {
      const report = model.create(makeReport({
        ai_judgments: [
          { file: 'src/api/auth.ts', line: '45', type: 'guess', description: '세션 만료 추측', confidence: 'low' },
        ],
      }));
      const fetched = model.get(report.id)!;

      expect(fetched.ai_judgments).toHaveLength(1);
      expect(fetched.ai_judgments![0].confidence).toBe('low');
    });

    it('should store and retrieve plan_id and task_ids when provided', () => {
      const plan = planModel.create('Test Plan', 'spec', 'summary');
      const report = model.create(makeReport({
        plan_id: plan.id,
        task_ids: ['T-001', 'T-002'],
      }));
      const fetched = model.get(report.id)!;

      expect(fetched.plan_id).toBe(plan.id);
      expect(fetched.task_ids).toEqual(['T-001', 'T-002']);
    });
  });

  describe('getByCommit', () => {
    it('should find report by commit hash', () => {
      const report = model.create(makeReport());
      const fetched = model.getByCommit('abc12345def67890');

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(report.id);
    });

    it('should return null for unknown commit', () => {
      expect(model.getByCommit('unknown')).toBeNull();
    });
  });

  describe('getByPlan', () => {
    it('should find reports by plan id', () => {
      const planA = planModel.create('Plan A', 'spec', 'summary');
      const planB = planModel.create('Plan B', 'spec', 'summary');
      model.create(makeReport({ plan_id: planA.id }));
      model.create(makeReport({ plan_id: planA.id, commit_hash: 'commit2' }));
      model.create(makeReport({ plan_id: planB.id, commit_hash: 'commit3' }));

      const results = model.getByPlan(planA.id);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.plan_id === planA.id)).toBe(true);
    });

    it('should return empty array for unknown plan', () => {
      expect(model.getByPlan('unknown')).toEqual([]);
    });
  });

  describe('getLatest', () => {
    it('should return latest reports with limit', () => {
      model.create(makeReport({ commit_hash: 'commit1' }));
      model.create(makeReport({ commit_hash: 'commit2' }));
      model.create(makeReport({ commit_hash: 'commit3' }));

      const latest = model.getLatest(2);
      expect(latest).toHaveLength(2);
    });

    it('should default to 5 results', () => {
      for (let i = 0; i < 7; i++) {
        model.create(makeReport({ commit_hash: `commit${i}` }));
      }
      const latest = model.getLatest();
      expect(latest).toHaveLength(5);
    });
  });

  describe('list', () => {
    it('should list all reports with limit', () => {
      for (let i = 0; i < 5; i++) {
        model.create(makeReport({ commit_hash: `commit${i}` }));
      }
      const results = model.list({ limit: 3 });
      expect(results).toHaveLength(3);
    });

    it('should filter by planId', () => {
      const planX = planModel.create('Plan X', 'spec', 'summary');
      const planY = planModel.create('Plan Y', 'spec', 'summary');
      model.create(makeReport({ plan_id: planX.id }));
      model.create(makeReport({ plan_id: planY.id, commit_hash: 'commit2' }));

      const results = model.list({ planId: planX.id });
      expect(results).toHaveLength(1);
      expect(results[0].plan_id).toBe(planX.id);
    });

    it('should return empty array when no reports exist', () => {
      expect(model.list()).toEqual([]);
    });
  });

  describe('AC09: PR fields', () => {
    it('AC09: 새 필드 없이 생성 시 모두 null로 초기화된다', () => {
      const report = model.create(makeReport());
      const fetched = model.get(report.id)!;

      expect(fetched.pr_number).toBeNull();
      expect(fetched.pr_url).toBeNull();
      expect(fetched.merge_method).toBeNull();
      expect(fetched.closed_issues).toBeNull();
      expect(fetched.auto_resolved_files).toBeNull();
      expect(fetched.conflict_levels).toBeNull();
    });

    it('AC09: pr_number와 pr_url을 생성 후 조회할 수 있다', () => {
      const report = model.create(makeReport({
        pr_number: 42,
        pr_url: 'https://github.com/owner/repo/pull/42',
      }));
      const fetched = model.get(report.id)!;

      expect(fetched.pr_number).toBe(42);
      expect(fetched.pr_url).toBe('https://github.com/owner/repo/pull/42');
    });

    it('AC09: merge_method를 squash/rebase/merge 각각 저장할 수 있다', () => {
      const r1 = model.create(makeReport({ merge_method: 'squash', commit_hash: 'c1' }));
      const r2 = model.create(makeReport({ merge_method: 'rebase', commit_hash: 'c2' }));
      const r3 = model.create(makeReport({ merge_method: 'merge', commit_hash: 'c3' }));

      expect(model.get(r1.id)!.merge_method).toBe('squash');
      expect(model.get(r2.id)!.merge_method).toBe('rebase');
      expect(model.get(r3.id)!.merge_method).toBe('merge');
    });

    it('AC09: closed_issues 배열을 JSON 직렬화하여 저장/조회할 수 있다', () => {
      const report = model.create(makeReport({
        closed_issues: ['#10', '#11', '#12'],
      }));
      const fetched = model.get(report.id)!;

      expect(fetched.closed_issues).toEqual(['#10', '#11', '#12']);
    });

    it('AC09: auto_resolved_files 배열을 JSON 직렬화하여 저장/조회할 수 있다', () => {
      const report = model.create(makeReport({
        auto_resolved_files: ['src/api/auth.ts', 'src/models/user.ts'],
      }));
      const fetched = model.get(report.id)!;

      expect(fetched.auto_resolved_files).toEqual(['src/api/auth.ts', 'src/models/user.ts']);
    });

    it('AC09: conflict_levels JSON 객체를 저장/조회할 수 있다', () => {
      const levels = { 'src/api/auth.ts': 'high', 'src/models/user.ts': 'low' };
      const report = model.create(makeReport({ conflict_levels: levels }));
      const fetched = model.get(report.id)!;

      expect(fetched.conflict_levels).toEqual(levels);
    });

    it('AC09: 모든 PR 필드를 함께 저장하고 조회할 수 있다', () => {
      const report = model.create(makeReport({
        pr_number: 99,
        pr_url: 'https://github.com/owner/repo/pull/99',
        merge_method: 'squash',
        closed_issues: ['#5'],
        auto_resolved_files: ['src/index.ts'],
        conflict_levels: { 'src/index.ts': 'medium' },
      }));
      const fetched = model.get(report.id)!;

      expect(fetched.pr_number).toBe(99);
      expect(fetched.pr_url).toBe('https://github.com/owner/repo/pull/99');
      expect(fetched.merge_method).toBe('squash');
      expect(fetched.closed_issues).toEqual(['#5']);
      expect(fetched.auto_resolved_files).toEqual(['src/index.ts']);
      expect(fetched.conflict_levels).toEqual({ 'src/index.ts': 'medium' });
    });
  });
});
