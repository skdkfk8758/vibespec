import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { TaskModel } from '../../models/task.js';
import { WaveCoordinator } from '../wave-coordinator.js';
import type Database from 'better-sqlite3';
import type { WaveExecutionPlan } from '../../types.js';

describe('WaveCoordinator', () => {
  let db: Database.Database;
  let taskModel: TaskModel;
  let coordinator: WaveCoordinator;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare('INSERT INTO plans (id, title, status) VALUES (?, ?, ?)').run(
      'test-plan',
      'Test Plan',
      'active',
    );
    taskModel = new TaskModel(db);
    coordinator = new WaveCoordinator(db);
  });

  describe('detectFileConflicts', () => {
    it('allowed_files가 겹치지 않는 태스크들은 충돌이 없다', () => {
      const t1 = taskModel.create('test-plan', 'Task 1', {
        allowedFiles: ['src/a.ts', 'src/b.ts'],
      });
      const t2 = taskModel.create('test-plan', 'Task 2', {
        allowedFiles: ['src/c.ts', 'src/d.ts'],
      });

      const result = coordinator.detectFileConflicts([t1.id, t2.id]);

      expect(result.conflicts).toHaveLength(0);
    });

    it('allowed_files가 겹치는 태스크들은 충돌로 감지된다', () => {
      const t1 = taskModel.create('test-plan', 'Task 1', {
        allowedFiles: ['src/a.ts', 'src/shared.ts'],
      });
      const t2 = taskModel.create('test-plan', 'Task 2', {
        allowedFiles: ['src/b.ts', 'src/shared.ts'],
      });

      const result = coordinator.detectFileConflicts([t1.id, t2.id]);

      expect(result.conflicts).toHaveLength(1);
      const ids = [result.conflicts[0].taskA, result.conflicts[0].taskB].sort();
      const expected = [t1.id, t2.id].sort();
      expect(ids).toEqual(expected);
      expect(result.conflicts[0].sharedFiles).toContain('src/shared.ts');
    });

    it('allowed_files가 null인 태스크는 충돌 감지 시 다른 태스크와 충돌 없이 처리된다', () => {
      const t1 = taskModel.create('test-plan', 'Task 1', {
        allowedFiles: ['src/a.ts'],
      });
      const t2 = taskModel.create('test-plan', 'Task 2'); // allowed_files is null

      const result = coordinator.detectFileConflicts([t1.id, t2.id]);

      // null 태스크는 "모든 파일 충돌" 취급하지 않음, 단지 충돌 계산에서 건너뜀
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('buildExecutionPlan', () => {
    it('AC01: allowed_files가 겹치지 않는 태스크는 같은 parallelGroup에 배치된다', () => {
      const t1 = taskModel.create('test-plan', 'Task 1', {
        sortOrder: 0,
        allowedFiles: ['src/a.ts'],
      });
      const t2 = taskModel.create('test-plan', 'Task 2', {
        sortOrder: 1,
        allowedFiles: ['src/b.ts'],
      });

      const plans = coordinator.buildExecutionPlan('test-plan');

      expect(plans).toHaveLength(1);
      const wave0 = plans[0];
      expect(wave0.waveIndex).toBe(0);

      // t1과 t2는 파일 충돌 없으므로 parallelGroups에 배치됨
      const allParallelIds = wave0.parallelGroups.flat();
      expect(allParallelIds).toContain(t1.id);
      expect(allParallelIds).toContain(t2.id);
      expect(wave0.sequentialTasks).not.toContain(t1.id);
      expect(wave0.sequentialTasks).not.toContain(t2.id);
    });

    it('AC02: allowed_files가 겹치는 태스크는 sequentialTasks에 배치된다', () => {
      const t1 = taskModel.create('test-plan', 'Task 1', {
        sortOrder: 0,
        allowedFiles: ['src/a.ts', 'src/shared.ts'],
      });
      const t2 = taskModel.create('test-plan', 'Task 2', {
        sortOrder: 1,
        allowedFiles: ['src/b.ts', 'src/shared.ts'],
      });

      const plans = coordinator.buildExecutionPlan('test-plan');

      expect(plans).toHaveLength(1);
      const wave0 = plans[0];

      // 충돌하는 태스크들은 sequentialTasks에 배치됨
      expect(wave0.sequentialTasks).toContain(t1.id);
      expect(wave0.sequentialTasks).toContain(t2.id);
    });

    it('AC03: allowed_files가 미정의인 태스크는 sequentialTasks로 분류된다', () => {
      taskModel.create('test-plan', 'Task with files', {
        sortOrder: 0,
        allowedFiles: ['src/a.ts'],
      });
      const t2 = taskModel.create('test-plan', 'Task without files', {
        sortOrder: 1,
        // allowed_files not set -> null
      });

      const plans = coordinator.buildExecutionPlan('test-plan');

      expect(plans).toHaveLength(1);
      const wave0 = plans[0];

      // null allowed_files 태스크는 항상 sequential
      expect(wave0.sequentialTasks).toContain(t2.id);
    });

    it('AC04: buildExecutionPlan이 wave 순서대로 WaveExecutionPlan[]을 반환한다', () => {
      const t1 = taskModel.create('test-plan', 'Wave 0 Task', { sortOrder: 0 });
      const t2 = taskModel.create('test-plan', 'Wave 1 Task', {
        sortOrder: 1,
        dependsOn: [t1.id],
      });
      const t3 = taskModel.create('test-plan', 'Wave 2 Task', {
        sortOrder: 2,
        dependsOn: [t2.id],
      });

      const plans = coordinator.buildExecutionPlan('test-plan');

      expect(plans).toHaveLength(3);
      expect(plans[0].waveIndex).toBe(0);
      expect(plans[1].waveIndex).toBe(1);
      expect(plans[2].waveIndex).toBe(2);

      // 각 wave는 해당 태스크 포함
      const allIds0 = [...plans[0].parallelGroups.flat(), ...plans[0].sequentialTasks];
      const allIds1 = [...plans[1].parallelGroups.flat(), ...plans[1].sequentialTasks];
      const allIds2 = [...plans[2].parallelGroups.flat(), ...plans[2].sequentialTasks];

      expect(allIds0).toContain(t1.id);
      expect(allIds1).toContain(t2.id);
      expect(allIds2).toContain(t3.id);
    });

    it('AC04: 빈 플랜에서 buildExecutionPlan은 빈 배열을 반환한다', () => {
      const plans = coordinator.buildExecutionPlan('test-plan');
      expect(plans).toEqual([]);
    });

    it('AC05: 세 태스크 중 두 태스크가 충돌 없으면 parallelGroup으로 묶인다', () => {
      const t1 = taskModel.create('test-plan', 'Task 1', {
        sortOrder: 0,
        allowedFiles: ['src/a.ts'],
      });
      const t2 = taskModel.create('test-plan', 'Task 2', {
        sortOrder: 1,
        allowedFiles: ['src/b.ts'],
      });
      const t3 = taskModel.create('test-plan', 'Task 3', {
        sortOrder: 2,
        allowedFiles: ['src/c.ts'],
      });

      const plans = coordinator.buildExecutionPlan('test-plan');

      expect(plans).toHaveLength(1);
      const allParallelIds = plans[0].parallelGroups.flat();
      expect(allParallelIds).toContain(t1.id);
      expect(allParallelIds).toContain(t2.id);
      expect(allParallelIds).toContain(t3.id);
      expect(plans[0].sequentialTasks).toHaveLength(0);
    });
  });

  describe('executeWaveParallel', () => {
    function makePlan(parallelGroups: string[][], sequentialTasks: string[]): WaveExecutionPlan {
      return { waveIndex: 0, parallelGroups, sequentialTasks };
    }

    it('AC01: parallelGroups 내 태스크가 실제로 동시 실행된다 (Promise.allSettled)', async () => {
      const started: string[] = [];
      const resolvers: Record<string, () => void> = {};
      const executeFn = (taskId: string) =>
        new Promise<void>(resolve => {
          started.push(taskId);
          resolvers[taskId] = resolve;
        });

      const plan = makePlan([['t1', 't2']], []);
      const runPromise = coordinator.executeWaveParallel(plan, executeFn);

      // Flush microtasks so both tasks can start
      for (let i = 0; i < 10; i++) await Promise.resolve();

      // Both should have started before either finishes
      expect(started).toContain('t1');
      expect(started).toContain('t2');

      resolvers['t1']?.();
      resolvers['t2']?.();
      await runPromise;
    });

    it('AC02: max_concurrent=2일 때 최대 2개만 동시 실행됨을 확인', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;
      const delays: (() => void)[] = [];

      const executeFn = (_taskId: string) =>
        new Promise<void>(resolve => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          delays.push(() => { concurrentCount--; resolve(); });
        });

      const plan = makePlan([['t1', 't2', 't3', 't4']], []);
      const runPromise = coordinator.executeWaveParallel(plan, executeFn, { maxConcurrent: 2 });

      // Flush microtasks to let semaphore start tasks
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(maxConcurrent).toBeLessThanOrEqual(2);

      // Drain all tasks
      while (delays.length > 0) {
        delays.shift()!();
        for (let i = 0; i < 5; i++) await Promise.resolve();
      }
      await runPromise;

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('AC03: 1건 실패 시 나머지 태스크가 정상 완료된다', async () => {
      const completed: string[] = [];
      const executeFn = (taskId: string) => {
        if (taskId === 't1') return Promise.reject(new Error('t1 failed'));
        completed.push(taskId);
        return Promise.resolve();
      };

      const plan = makePlan([['t1', 't2', 't3']], []);
      const result = await coordinator.executeWaveParallel(plan, executeFn);

      expect(completed).toContain('t2');
      expect(completed).toContain('t3');
      const t1Result = result.results.find(r => r.taskId === 't1');
      expect(t1Result?.status).toBe('failed');
      expect(t1Result?.error).toBeDefined();
    });

    it('AC04: sequentialTasks는 순차적으로 실행된다', async () => {
      const order: string[] = [];
      const executeFn = async (taskId: string) => {
        order.push(`start:${taskId}`);
        await new Promise(r => setTimeout(r, 0));
        order.push(`end:${taskId}`);
      };

      const plan = makePlan([], ['s1', 's2', 's3']);
      await coordinator.executeWaveParallel(plan, executeFn);

      // Sequential: s1 must fully finish before s2 starts
      expect(order.indexOf('end:s1')).toBeLessThan(order.indexOf('start:s2'));
      expect(order.indexOf('end:s2')).toBeLessThan(order.indexOf('start:s3'));
    });

    it('AC05: blocked 태스크의 의존 태스크만 blocked로 전파된다', async () => {
      const executeFn = (taskId: string) => {
        if (taskId === 't1') return Promise.reject(Object.assign(new Error('blocked'), { isBlocked: true }));
        return Promise.resolve();
      };

      const plan = makePlan([['t1', 't3']], []);
      const result = await coordinator.executeWaveParallel(plan, executeFn, {
        dependsOn: { t2: ['t1'] },
      });

      const t2Result = result.results.find(r => r.taskId === 't2');
      const t3Result = result.results.find(r => r.taskId === 't3');

      expect(t2Result?.status).toBe('blocked');
      expect(t3Result?.status).toBe('success');
    });
  });
});
