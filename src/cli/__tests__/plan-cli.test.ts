import { describe, it, expect } from 'vitest';
import { formatPlanTree, formatPlanList } from '../formatters.js';
import type { Plan, TaskTreeNode } from '../../core/types.js';

function makePlan(overrides?: Partial<Plan>): Plan {
  return {
    id: 'plan_abc123',
    title: '인증 모듈 리팩토링',
    status: 'active',
    summary: null,
    spec: null,
    created_at: '2026-03-10T00:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

function makeTaskNode(
  overrides: Partial<TaskTreeNode> & { title: string },
): TaskTreeNode {
  return {
    id: 'task_' + Math.random().toString(36).slice(2, 8),
    plan_id: 'plan_abc123',
    parent_id: null,
    title: overrides.title,
    status: 'todo',
    depth: 0,
    sort_order: 0,
    spec: null,
    acceptance: null,
    created_at: '2026-03-10T00:00:00.000Z',
    completed_at: null,
    children: [],
    ...overrides,
  };
}

describe('formatPlanTree', () => {
  it('should render nested tasks with tree connectors and status icons', () => {
    const tasks: TaskTreeNode[] = [
      makeTaskNode({
        title: '기존 세션 기반 인증 분석',
        status: 'done',
      }),
      makeTaskNode({
        title: 'JWT 검증 미들웨어',
        status: 'in_progress',
        children: [
          makeTaskNode({
            title: '토큰 파싱 로직',
            status: 'done',
            depth: 1,
          }),
          makeTaskNode({
            title: '리프레시 토큰 구현',
            status: 'todo',
            depth: 1,
          }),
        ],
      }),
      makeTaskNode({
        title: 'OAuth 프로바이더 연동',
        status: 'blocked',
      }),
      makeTaskNode({
        title: '삭제된 기능',
        status: 'skipped',
      }),
    ];

    const plan = makePlan();
    const result = formatPlanTree(plan, tasks);

    // Tree connectors
    expect(result).toContain('├─');
    expect(result).toContain('└─');
    expect(result).toContain('│');

    // Status icons
    expect(result).toContain('[x]');
    expect(result).toContain('[>]');
    expect(result).toContain('[!]');
    expect(result).toContain('[ ]');
    expect(result).toContain('[-]');

    // Plan header
    expect(result).toContain('인증 모듈 리팩토링');
    expect(result).toContain('(active)');

    // Task titles
    expect(result).toContain('기존 세션 기반 인증 분석');
    expect(result).toContain('JWT 검증 미들웨어');
    expect(result).toContain('토큰 파싱 로직');
    expect(result).toContain('리프레시 토큰 구현');
    expect(result).toContain('OAuth 프로바이더 연동');
    expect(result).toContain('삭제된 기능');

    // Progress percentage (3 done/skipped out of 6 = 50%)
    expect(result).toContain('50%');
  });

  it('should show plan title only when there are no tasks', () => {
    const plan = makePlan();
    const result = formatPlanTree(plan, []);

    expect(result).toContain('인증 모듈 리팩토링');
    expect(result).toContain('(active)');
    expect(result).toContain('0%');
    // No tree connectors when no tasks
    expect(result).not.toContain('├─');
    expect(result).not.toContain('└─');
  });
});

describe('formatPlanList', () => {
  it('should display plan titles and statuses in a table', () => {
    const plans: Plan[] = [
      makePlan({
        id: 'plan_abc123',
        title: '인증 모듈 리팩토링',
        status: 'active',
        created_at: '2026-03-10T00:00:00.000Z',
      }),
      makePlan({
        id: 'plan_def456',
        title: 'API 캐싱',
        status: 'draft',
        created_at: '2026-03-12T00:00:00.000Z',
      }),
    ];

    const result = formatPlanList(plans);

    expect(result).toContain('인증 모듈 리팩토링');
    expect(result).toContain('API 캐싱');
    expect(result).toContain('active');
    expect(result).toContain('draft');
    expect(result).toContain('plan_abc123');
    expect(result).toContain('plan_def456');
    expect(result).toContain('2026-03-10');
    expect(result).toContain('2026-03-12');
    // Header row
    expect(result).toContain('ID');
    expect(result).toContain('Title');
    expect(result).toContain('Status');
    expect(result).toContain('Created');
  });

  it('should return "No plans found." for empty list', () => {
    const result = formatPlanList([]);
    expect(result).toBe('No plans found.');
  });
});
