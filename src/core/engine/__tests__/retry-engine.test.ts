import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { RetryEngine } from '../retry.js';
import { AgentHandoffModel } from '../../models/agent-handoff.js';
import { TaskModel } from '../../models/task.js';
import type Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ErrorKBEngine } from '../error-kb.js';

describe('RetryEngine', () => {
  let db: Database.Database;
  let _handoffModel: AgentHandoffModel;
  let _taskModel: TaskModel;
  let retryEngine: RetryEngine;
  let testBaseDir: string;
  const planId = 'test-plan';
  const taskId = 'test-task';

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare('INSERT INTO plans (id, title, status) VALUES (?, ?, ?)').run(planId, 'Test Plan', 'active');
    db.prepare(
      'INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(taskId, planId, 'Test Task', 'in_progress', 0, 1);

    testBaseDir = join(tmpdir(), `retry-engine-test-${Date.now()}`);
    mkdirSync(testBaseDir, { recursive: true });

    _handoffModel = new AgentHandoffModel(db, testBaseDir);
    _taskModel = new TaskModel(db);

    // sleep 함수를 no-op으로 주입하여 테스트 속도 보장
    const noopSleep = () => Promise.resolve();
    retryEngine = new RetryEngine(db, { maxRetries: 3, backoffMs: [10, 20, 40], fallbackAgentMap: {} }, noopSleep);
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('AC01: 실패 시 최대 3회까지 재호출', () => {
    it('AC01: executeFn이 계속 실패하면 최대 maxRetries회 호출된다', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('항상 실패'));

      await expect(
        retryEngine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn),
      ).rejects.toThrow();

      expect(executeFn).toHaveBeenCalledTimes(3);
    });

    it('AC01: 첫 번째 시도에 성공하면 1회만 호출된다', async () => {
      const executeFn = vi.fn().mockResolvedValue('success');

      const result = await retryEngine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn);

      expect(result).toBe('success');
      expect(executeFn).toHaveBeenCalledTimes(1);
    });

    it('AC01: 두 번째 시도에 성공하면 2회만 호출된다', async () => {
      const executeFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('첫 번째 실패'))
        .mockResolvedValue('success on second');

      const result = await retryEngine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn);

      expect(result).toBe('success on second');
      expect(executeFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('AC02: backoffMs에 맞는 대기 시간 적용', () => {
    it('AC02: 각 재시도 전에 backoffMs 배열 인덱스에 해당하는 시간만큼 sleep이 호출된다', async () => {
      const sleepCalls: number[] = [];
      const trackingSleep = (ms: number) => {
        sleepCalls.push(ms);
        return Promise.resolve();
      };

      const engine = new RetryEngine(
        db,
        { maxRetries: 3, backoffMs: [100, 200, 400], fallbackAgentMap: {} },
        trackingSleep,
      );

      const executeFn = vi.fn().mockRejectedValue(new Error('실패'));

      await expect(
        engine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn),
      ).rejects.toThrow();

      // 3번 시도, 2번 재시도 전에 sleep (첫 번째 시도 전엔 sleep 없음)
      expect(sleepCalls).toEqual([100, 200]);
    });

    it('AC02: backoffMs 인덱스 범위를 초과하면 마지막 값으로 clamp된다', async () => {
      const sleepCalls: number[] = [];
      const trackingSleep = (ms: number) => {
        sleepCalls.push(ms);
        return Promise.resolve();
      };

      const engine = new RetryEngine(
        db,
        { maxRetries: 4, backoffMs: [100, 200], fallbackAgentMap: {} },
        trackingSleep,
      );

      // task를 4회 재시도 가능하도록 상태 유지
      const engine4TaskId = 'task-for-clamp';
      db.prepare(
        'INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(engine4TaskId, planId, 'Clamp Task', 'in_progress', 0, 2);

      const executeFn = vi.fn().mockRejectedValue(new Error('실패'));

      await expect(
        engine.executeWithRetry(engine4TaskId, 'tdd-implementer', planId, executeFn),
      ).rejects.toThrow();

      // 4번 시도 -> 3번 sleep: [100, 200, 200(clamp)]
      expect(sleepCalls).toEqual([100, 200, 200]);
    });
  });

  describe('AC03: attempt 기록', () => {
    it('AC03: 재시도마다 AgentHandoffModel에 attempt가 1씩 증가하여 기록된다', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('실패'));

      await expect(
        retryEngine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn),
      ).rejects.toThrow();

      const handoffs = db
        .prepare('SELECT attempt FROM agent_handoffs WHERE task_id = ? ORDER BY attempt ASC')
        .all(taskId) as { attempt: number }[];

      expect(handoffs).toHaveLength(3);
      expect(handoffs[0].attempt).toBe(1);
      expect(handoffs[1].attempt).toBe(2);
      expect(handoffs[2].attempt).toBe(3);
    });

    it('AC03: 성공 시에도 attempt가 기록된다', async () => {
      const successTaskId = 'task-success';
      db.prepare(
        'INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(successTaskId, planId, 'Success Task', 'in_progress', 0, 3);

      const executeFn = vi.fn().mockResolvedValue('ok');

      await retryEngine.executeWithRetry(successTaskId, 'tdd-implementer', planId, executeFn);

      const handoffs = db
        .prepare('SELECT attempt FROM agent_handoffs WHERE task_id = ? ORDER BY attempt ASC')
        .all(successTaskId) as { attempt: number }[];

      expect(handoffs).toHaveLength(1);
      expect(handoffs[0].attempt).toBe(1);
    });
  });

  describe('AC04: done/skipped 상태이면 재시도 루프 즉시 중단', () => {
    it('AC04: 태스크가 done 상태이면 executeFn을 호출하지 않고 즉시 중단된다', async () => {
      const doneTaskId = 'task-done';
      db.prepare(
        'INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(doneTaskId, planId, 'Done Task', 'done', 0, 4);

      const executeFn = vi.fn().mockRejectedValue(new Error('실패'));

      await expect(
        retryEngine.executeWithRetry(doneTaskId, 'tdd-implementer', planId, executeFn),
      ).rejects.toThrow(/done|skipped|중단/i);

      expect(executeFn).not.toHaveBeenCalled();
    });

    it('AC04: 태스크가 skipped 상태이면 executeFn을 호출하지 않고 즉시 중단된다', async () => {
      const skippedTaskId = 'task-skipped';
      db.prepare(
        'INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(skippedTaskId, planId, 'Skipped Task', 'skipped', 0, 5);

      const executeFn = vi.fn();

      await expect(
        retryEngine.executeWithRetry(skippedTaskId, 'tdd-implementer', planId, executeFn),
      ).rejects.toThrow(/done|skipped|중단/i);

      expect(executeFn).not.toHaveBeenCalled();
    });

    it('AC04: 재시도 중 태스크가 done으로 변경되면 루프가 중단된다', async () => {
      const midTaskId = 'task-mid';
      db.prepare(
        'INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(midTaskId, planId, 'Mid Task', 'in_progress', 0, 6);

      let callCount = 0;
      const executeFn = vi.fn().mockImplementation(async () => {
        callCount++;
        // 첫 번째 호출 후 태스크를 done으로 변경
        if (callCount === 1) {
          db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('done', midTaskId);
          throw new Error('첫 번째 실패');
        }
        return 'should not reach';
      });

      await expect(
        retryEngine.executeWithRetry(midTaskId, 'tdd-implementer', planId, executeFn),
      ).rejects.toThrow();

      // 첫 번째 시도만 호출됨 (두 번째 시도 전에 done 상태 감지로 중단)
      expect(executeFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC05: 두 번째 시도부터 이전 실패 정보 포함', () => {
    it('AC05: 첫 번째 시도 시 previousErrors는 빈 배열이다', async () => {
      let capturedErrors: Error[] = [];
      const executeFn = vi.fn().mockImplementation(async (attempt: number, previousErrors: Error[]) => {
        capturedErrors = previousErrors;
        return 'ok';
      });

      await retryEngine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn);

      expect(capturedErrors).toHaveLength(0);
    });

    it('AC05: 두 번째 시도 시 첫 번째 에러가 previousErrors에 포함된다', async () => {
      const firstError = new Error('첫 번째 에러');
      const capturedPreviousErrors: Error[][] = [];

      const executeFn = vi.fn().mockImplementation(async (_attempt: number, previousErrors: Error[]) => {
        capturedPreviousErrors.push([...previousErrors]);
        if (capturedPreviousErrors.length === 1) {
          throw firstError;
        }
        return 'ok';
      });

      await retryEngine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn);

      // 두 번째 호출 시 이전 에러가 포함됨
      expect(capturedPreviousErrors[1]).toHaveLength(1);
      expect(capturedPreviousErrors[1][0]).toBe(firstError);
    });

    it('AC05: 세 번째 시도 시 이전 두 에러가 모두 previousErrors에 포함된다', async () => {
      const err1 = new Error('에러1');
      const err2 = new Error('에러2');
      const capturedPreviousErrors: Error[][] = [];

      const executeFn = vi.fn().mockImplementation(async (_attempt: number, previousErrors: Error[]) => {
        capturedPreviousErrors.push([...previousErrors]);
        if (capturedPreviousErrors.length === 1) throw err1;
        if (capturedPreviousErrors.length === 2) throw err2;
        return 'ok';
      });

      await retryEngine.executeWithRetry(taskId, 'tdd-implementer', planId, executeFn);

      expect(capturedPreviousErrors[2]).toHaveLength(2);
      expect(capturedPreviousErrors[2][0]).toBe(err1);
      expect(capturedPreviousErrors[2][1]).toBe(err2);
    });
  });
});

describe('RetryEngine.escalate', () => {
  let db: Database.Database;
  let retryEngine: RetryEngine;
  let testBaseDir: string;
  const planId = 'esc-plan';
  const taskId = 'esc-task';

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare('INSERT INTO plans (id, title, status) VALUES (?, ?, ?)').run(planId, 'Esc Plan', 'active');
    db.prepare(
      'INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(taskId, planId, 'Esc Task', 'in_progress', 0, 1);

    testBaseDir = join(tmpdir(), `retry-escalate-test-${Date.now()}`);
    mkdirSync(testBaseDir, { recursive: true });

    const noopSleep = () => Promise.resolve();
    retryEngine = new RetryEngine(
      db,
      {
        maxRetries: 3,
        backoffMs: [10, 20, 40],
        fallbackAgentMap: { 'tdd-implementer': 'codex' },
      },
      noopSleep,
      testBaseDir,
    );
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  it('AC01: 3회 실패 후 fallbackAgentMap에서 대체 에이전트를 찾아 에스컬레이션한다', async () => {
    const fallbackFn = vi.fn().mockResolvedValue('fallback success');
    const executeFn = vi.fn().mockRejectedValue(new Error('항상 실패'));

    const result = await retryEngine.escalate(taskId, planId, 'tdd-implementer', executeFn, fallbackFn);

    expect(result.escalated).toBe(true);
    expect(result.fallbackAgent).toBe('codex');
    expect(fallbackFn).toHaveBeenCalled();
  });

  it('AC02: 에스컬레이션 대상도 실패 시 error-kb에 실패 패턴이 기록된다', async () => {
    const errorKb = new ErrorKBEngine(testBaseDir);
    const fallbackFn = vi.fn().mockRejectedValue(new Error('fallback 실패'));
    const executeFn = vi.fn().mockRejectedValue(new Error('항상 실패'));

    await retryEngine.escalate(taskId, planId, 'tdd-implementer', executeFn, fallbackFn);

    const entries = errorKb.search('escalation');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('AC03: 최종 실패 시 사용자 알림 메시지가 출력된다', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fallbackFn = vi.fn().mockRejectedValue(new Error('fallback 실패'));
    const executeFn = vi.fn().mockRejectedValue(new Error('항상 실패'));

    await retryEngine.escalate(taskId, planId, 'tdd-implementer', executeFn, fallbackFn);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`[retry] Task ${taskId}: 모든 재시도 실패. error-kb에 기록됨`),
    );
    // 에러 세부정보도 포함되어야 함
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('fallback 실패'),
    );
    consoleSpy.mockRestore();
  });

  it('AC04: fallbackAgentMap에 매핑이 없으면 즉시 escalated=false + error-kb 기록', async () => {
    const errorKb = new ErrorKBEngine(testBaseDir);
    const noopSleep = () => Promise.resolve();
    const engineNoFallback = new RetryEngine(
      db,
      { maxRetries: 3, backoffMs: [10, 20, 40], fallbackAgentMap: {} },
      noopSleep,
      testBaseDir,
    );

    const unknownTaskId = 'esc-task-2';
    db.prepare(
      'INSERT INTO tasks (id, plan_id, title, status, depth, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(unknownTaskId, planId, 'Unknown Agent Task', 'in_progress', 0, 2);

    const executeFn = vi.fn().mockRejectedValue(new Error('실패'));

    const result = await engineNoFallback.escalate(unknownTaskId, planId, 'unknown-agent', executeFn);

    expect(result.escalated).toBe(false);
    const entries = errorKb.search('escalation');
    expect(entries.length).toBeGreaterThan(0);
  });
});
