/**
 * 통합 테스트: RetryEngine + WaveCoordinator
 *
 * SC01: 에이전트 1회 실패 → 재시도 → 2회째 성공
 * SC02: 3회 실패 → 에스컬레이션 → fallback 성공
 * SC03: 모든 재시도 실패 → error-kb 기록 확인
 * SC04: 2개 비충돌 태스크 병렬 실행 확인
 * SC05: 충돌 태스크 순차 실행 확인
 * SC06: 병렬 중 1건 실패 → 나머지 정상
 * SC07/Edge#1: 재시도 중 태스크 수동 완료 → 루프 중단
 * Edge#3: allowed_files 미정의 → 순차 fallback
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type Database from 'better-sqlite3';

import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { TaskModel } from '../../models/task.js';
import { RetryEngine } from '../retry.js';
import { WaveCoordinator } from '../wave-coordinator.js';
import { ErrorKBEngine } from '../error-kb.js';
import type { WaveExecutionPlan } from '../../types.js';

// ────────────────────────────────────────────────────────────
// 공통 헬퍼
// ────────────────────────────────────────────────────────────
function setupDb() {
  const db = createMemoryDb();
  initSchema(db);
  return db;
}

function insertPlan(db: Database.Database, planId: string) {
  db.prepare('INSERT INTO plans (id, title, status) VALUES (?, ?, ?)').run(planId, 'Test Plan', 'active');
}

function insertTask(db: Database.Database, taskId: string, planId: string, opts: {
  status?: string;
  allowedFiles?: string[] | null;
  sortOrder?: number;
  dependsOn?: string[];
  wave?: number;
} = {}) {
  const { status = 'in_progress', allowedFiles = null, sortOrder = 1, dependsOn } = opts;
  const taskModel = new TaskModel(db);
  const task = taskModel.create(planId, taskId, {
    sortOrder,
    allowedFiles: allowedFiles !== null ? allowedFiles : undefined,
    dependsOn,
  });
  // status를 원하는 값으로 직접 세팅 (create는 'todo'로 생성)
  if (status !== 'todo') {
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, task.id);
  }
  // taskId를 고정값으로 재지정 (테스트 편의상)
  db.prepare('UPDATE tasks SET id = ? WHERE id = ?').run(taskId, task.id);
  return taskId;
}

function makeRetryEngine(db: Database.Database, tmpDir: string, opts: {
  maxRetries?: number;
  fallbackAgentMap?: Record<string, string>;
} = {}) {
  const noopSleep = () => Promise.resolve();
  return new RetryEngine(
    db,
    {
      maxRetries: opts.maxRetries ?? 3,
      backoffMs: [1, 1, 1],
      fallbackAgentMap: opts.fallbackAgentMap ?? {},
    },
    noopSleep,
    tmpDir,
  );
}

// ────────────────────────────────────────────────────────────
// SC01: 1회 실패 → 2회째 성공
// ────────────────────────────────────────────────────────────
describe('SC01: 1회 실패 → 재시도 → 2회째 성공', () => {
  let db: Database.Database;
  let tmpDir: string;
  const planId = 'sc01-plan';
  const taskId = 'sc01-task';

  beforeEach(() => {
    db = setupDb();
    insertPlan(db, planId);
    insertTask(db, taskId, planId);
    tmpDir = join(tmpdir(), `sc01-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('AC01: SC01 — executeFn이 1회 실패 후 2회째 성공한다', async () => {
    const engine = makeRetryEngine(db, tmpDir);
    const executeFn = vi.fn()
      .mockRejectedValueOnce(new Error('첫 번째 실패'))
      .mockResolvedValue('성공');

    const result = await engine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn);

    expect(result).toBe('성공');
    expect(executeFn).toHaveBeenCalledTimes(2);
  });

  it('AC02: SC01 — attempt 1(실패), attempt 2(성공)가 agent_handoffs에 기록된다', async () => {
    const engine = makeRetryEngine(db, tmpDir);
    const executeFn = vi.fn()
      .mockRejectedValueOnce(new Error('첫 번째 실패'))
      .mockResolvedValue('성공');

    await engine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn);

    const handoffs = db
      .prepare('SELECT attempt, verdict FROM agent_handoffs WHERE task_id = ? ORDER BY attempt ASC')
      .all(taskId) as { attempt: number; verdict: string }[];

    expect(handoffs).toHaveLength(2);
    expect(handoffs[0]).toMatchObject({ attempt: 1, verdict: 'failure' });
    expect(handoffs[1]).toMatchObject({ attempt: 2, verdict: 'success' });
  });
});

// ────────────────────────────────────────────────────────────
// SC02: 3회 실패 → 에스컬레이션 → fallback 성공
// ────────────────────────────────────────────────────────────
describe('SC02: 3회 실패 → 에스컬레이션 → fallback 성공', () => {
  let db: Database.Database;
  let tmpDir: string;
  const planId = 'sc02-plan';
  const taskId = 'sc02-task';

  beforeEach(() => {
    db = setupDb();
    insertPlan(db, planId);
    insertTask(db, taskId, planId);
    tmpDir = join(tmpdir(), `sc02-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('AC01, AC02: SC02 — 3회 실패 후 escalate로 fallback 성공 시 escalated=true', async () => {
    const engine = makeRetryEngine(db, tmpDir, {
      fallbackAgentMap: { 'tdd-implementer': 'codex' },
    });

    const executeFn = vi.fn().mockRejectedValue(new Error('항상 실패'));
    const fallbackFn = vi.fn().mockResolvedValue('fallback 성공');

    // 먼저 3회 실패
    await expect(
      engine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn),
    ).rejects.toThrow();

    // 에스컬레이션
    const result = await engine.escalate(taskId, planId, 'tdd-implementer', executeFn, fallbackFn);

    expect(result.escalated).toBe(true);
    expect(result.fallbackAgent).toBe('codex');
    expect(fallbackFn).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────
// SC03: 모든 재시도 실패 → error-kb 기록
// ────────────────────────────────────────────────────────────
describe('SC03: 모든 재시도 실패 → error-kb 기록 확인', () => {
  let db: Database.Database;
  let tmpDir: string;
  const planId = 'sc03-plan';
  const taskId = 'sc03-task';

  beforeEach(() => {
    db = setupDb();
    insertPlan(db, planId);
    insertTask(db, taskId, planId);
    tmpDir = join(tmpdir(), `sc03-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('AC01, AC02: SC03 — 모든 재시도 실패 + fallback 실패 시 error-kb에 기록된다', async () => {
    const engine = makeRetryEngine(db, tmpDir, {
      fallbackAgentMap: { 'tdd-implementer': 'codex' },
    });

    const executeFn = vi.fn().mockRejectedValue(new Error('항상 실패'));
    const fallbackFn = vi.fn().mockRejectedValue(new Error('fallback도 실패'));

    // 원래 에이전트로 3회 실패
    await expect(
      engine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn),
    ).rejects.toThrow();

    // 에스컬레이션 + fallback도 실패
    await engine.escalate(taskId, planId, 'tdd-implementer', executeFn, fallbackFn);

    // error-kb에 escalation 실패 기록 확인
    const errorKb = new ErrorKBEngine(tmpDir);
    const entries = errorKb.search('escalation');
    expect(entries.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
// SC04: 2개 비충돌 태스크 병렬 실행 확인
// ────────────────────────────────────────────────────────────
describe('SC04: 2개 비충돌 태스크 병렬 실행 확인', () => {
  let db: Database.Database;
  const planId = 'sc04-plan';

  beforeEach(() => {
    db = setupDb();
    insertPlan(db, planId);
  });

  it('AC01, AC02: SC04 — 비충돌 태스크 둘 다 parallelGroups에 포함된다', () => {
    insertTask(db, 'sc04-taskA', planId, { allowedFiles: ['src/a.ts'], sortOrder: 1, wave: 0 });
    insertTask(db, 'sc04-taskB', planId, { allowedFiles: ['src/b.ts'], sortOrder: 2, wave: 0 });

    const coordinator = new WaveCoordinator(db);
    const plans = coordinator.buildExecutionPlan(planId);

    expect(plans).toHaveLength(1);
    const wave = plans[0];
    expect(wave.parallelGroups.length).toBeGreaterThan(0);
    const allParallel = wave.parallelGroups.flat();
    expect(allParallel).toContain('sc04-taskA');
    expect(allParallel).toContain('sc04-taskB');
    expect(wave.sequentialTasks).not.toContain('sc04-taskA');
    expect(wave.sequentialTasks).not.toContain('sc04-taskB');
  });

  it('AC02: SC04 — executeWaveParallel로 두 태스크가 모두 success로 완료된다', async () => {
    insertTask(db, 'sc04-taskC', planId, { allowedFiles: ['src/c.ts'], sortOrder: 3 });
    insertTask(db, 'sc04-taskD', planId, { allowedFiles: ['src/d.ts'], sortOrder: 4 });

    const coordinator = new WaveCoordinator(db);
    const plans = coordinator.buildExecutionPlan(planId);
    // sc04-taskA, B, C, D 모두 wave 0에 있으므로 첫 번째 wave 사용
    const wave = plans[0];

    const executeFn = vi.fn().mockImplementation(async (_taskId: string) => {
      // 정상 실행
    });

    const result = await coordinator.executeWaveParallel(wave, executeFn);

    // sc04-taskC와 sc04-taskD가 success인지 확인
    const cResult = result.results.find(r => r.taskId === 'sc04-taskC');
    const dResult = result.results.find(r => r.taskId === 'sc04-taskD');
    expect(cResult?.status).toBe('success');
    expect(dResult?.status).toBe('success');
  });
});

// ────────────────────────────────────────────────────────────
// SC05: 충돌 태스크 순차 실행 확인
// ────────────────────────────────────────────────────────────
describe('SC05: 충돌 태스크 순차 실행 확인', () => {
  let db: Database.Database;
  const planId = 'sc05-plan';

  beforeEach(() => {
    db = setupDb();
    insertPlan(db, planId);
  });

  it('AC01, AC02: SC05 — 충돌하는 태스크들은 sequentialTasks에 배치된다', () => {
    insertTask(db, 'sc05-taskA', planId, { allowedFiles: ['src/shared.ts', 'src/a.ts'], sortOrder: 1, wave: 0 });
    insertTask(db, 'sc05-taskB', planId, { allowedFiles: ['src/shared.ts', 'src/b.ts'], sortOrder: 2, wave: 0 });

    const coordinator = new WaveCoordinator(db);
    const plans = coordinator.buildExecutionPlan(planId);

    expect(plans).toHaveLength(1);
    const wave = plans[0];
    expect(wave.sequentialTasks).toContain('sc05-taskA');
    expect(wave.sequentialTasks).toContain('sc05-taskB');

    const allParallel = wave.parallelGroups.flat();
    expect(allParallel).not.toContain('sc05-taskA');
    expect(allParallel).not.toContain('sc05-taskB');
  });

  it('AC02: SC05 — 충돌 태스크들이 순차로 각각 실행된다', async () => {
    insertTask(db, 'sc05-taskC', planId, { allowedFiles: ['src/shared2.ts'], sortOrder: 3 });
    insertTask(db, 'sc05-taskD', planId, { allowedFiles: ['src/shared2.ts'], sortOrder: 4 });

    const coordinator = new WaveCoordinator(db);
    const plans = coordinator.buildExecutionPlan(planId);
    const wave = plans[0];

    const callOrder: string[] = [];
    const executeFn = vi.fn().mockImplementation(async (taskId: string) => {
      callOrder.push(taskId);
    });

    const result = await coordinator.executeWaveParallel(wave, executeFn);

    expect(callOrder).toContain('sc05-taskC');
    expect(callOrder).toContain('sc05-taskD');
    expect(result.results.every(r => r.status === 'success')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// SC06: 병렬 중 1건 실패 → 나머지 정상
// ────────────────────────────────────────────────────────────
describe('SC06: 병렬 중 1건 실패 → 나머지 정상', () => {
  let db: Database.Database;
  const planId = 'sc06-plan';

  beforeEach(() => {
    db = setupDb();
    insertPlan(db, planId);
  });

  it('AC01, AC02: SC06 — 병렬 그룹 중 1건 실패 시 나머지는 success로 완료된다', async () => {
    insertTask(db, 'sc06-taskA', planId, { allowedFiles: ['src/a.ts'], sortOrder: 1, wave: 0 });
    insertTask(db, 'sc06-taskB', planId, { allowedFiles: ['src/b.ts'], sortOrder: 2, wave: 0 });
    insertTask(db, 'sc06-taskC', planId, { allowedFiles: ['src/c.ts'], sortOrder: 3, wave: 0 });

    const coordinator = new WaveCoordinator(db);
    const plans = coordinator.buildExecutionPlan(planId);
    const wave = plans[0];

    const executeFn = vi.fn().mockImplementation(async (taskId: string) => {
      if (taskId === 'sc06-taskB') {
        throw new Error('sc06-taskB 실패');
      }
    });

    const result = await coordinator.executeWaveParallel(wave, executeFn);

    const successResults = result.results.filter(r => r.status === 'success');
    const failedResults = result.results.filter(r => r.status === 'failed');

    expect(successResults.length).toBe(2);
    expect(failedResults.length).toBe(1);
    expect(failedResults[0].taskId).toBe('sc06-taskB');
  });
});

// ────────────────────────────────────────────────────────────
// Edge Case #1 (SC07): 재시도 중 태스크 수동 완료 → 루프 중단
// ────────────────────────────────────────────────────────────
describe('Edge Case #1: 재시도 중 태스크 수동 완료 → 루프 중단', () => {
  let db: Database.Database;
  let tmpDir: string;
  const planId = 'ec1-plan';
  const taskId = 'ec1-task';

  beforeEach(() => {
    db = setupDb();
    insertPlan(db, planId);
    insertTask(db, taskId, planId);
    tmpDir = join(tmpdir(), `ec1-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('AC01, AC03: Edge#1 — 1회 실패 후 태스크가 done으로 변경되면 2회째 시도 전에 중단된다', async () => {
    const engine = makeRetryEngine(db, tmpDir);

    let callCount = 0;
    const executeFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // 1회 실패 후 태스크를 done으로 수동 변경
        db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('done', taskId);
        throw new Error('1회 실패');
      }
      return '2회째는 실행되지 않아야 함';
    });

    await expect(
      engine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn),
    ).rejects.toThrow(/done|skipped|중단/i);

    // executeFn은 1번만 호출됨
    expect(executeFn).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────
// Edge Case #3: allowed_files 미정의 → 순차 fallback
// ────────────────────────────────────────────────────────────
describe('Edge Case #3: allowed_files 미정의 → 순차 fallback', () => {
  let db: Database.Database;
  const planId = 'ec3-plan';

  beforeEach(() => {
    db = setupDb();
    insertPlan(db, planId);
  });

  it('AC01, AC03: Edge#3 — allowed_files가 null인 태스크는 sequentialTasks에 배치된다', () => {
    // allowed_files 없는 태스크
    insertTask(db, 'ec3-taskA', planId, { allowedFiles: null, sortOrder: 1, wave: 0 });
    // allowed_files 있는 태스크
    insertTask(db, 'ec3-taskB', planId, { allowedFiles: ['src/b.ts'], sortOrder: 2, wave: 0 });

    const coordinator = new WaveCoordinator(db);
    const plans = coordinator.buildExecutionPlan(planId);

    expect(plans).toHaveLength(1);
    const wave = plans[0];

    // null 태스크는 sequential
    expect(wave.sequentialTasks).toContain('ec3-taskA');
    // defined 파일 태스크는 parallel (충돌 없으므로)
    const allParallel = wave.parallelGroups.flat();
    expect(allParallel).toContain('ec3-taskB');
  });

  it('AC03: Edge#3 — allowed_files 미정의 태스크도 executeWaveParallel에서 정상 실행된다', async () => {
    insertTask(db, 'ec3-taskC', planId, { allowedFiles: null, sortOrder: 3 });

    const coordinator = new WaveCoordinator(db);
    const plans = coordinator.buildExecutionPlan(planId);
    const wave = plans[0];

    const executeFn = vi.fn().mockResolvedValue(undefined);
    const result = await coordinator.executeWaveParallel(wave, executeFn);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ taskId: 'ec3-taskC', status: 'success' });
  });
});
