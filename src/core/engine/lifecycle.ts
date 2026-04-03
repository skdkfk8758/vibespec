import type Database from 'better-sqlite3';
import { PlanModel } from '../models/plan.js';
import { TaskModel } from '../models/task.js';
import { EventModel } from '../models/event.js';
import type { Plan, Task } from '../types.js';
import { RetryEngine, type RetryConfig, DEFAULT_RETRY_CONFIG, type ExecuteFn } from './retry.js';
import { WaveCoordinator } from './wave-coordinator.js';
import { PlanVerifier } from './plan-verifier.js';
import { normalizeError } from '../utils.js';

export class LifecycleEngine {
  private db: Database.Database;
  private planModel: PlanModel;
  private taskModel: TaskModel;
  private events?: EventModel;

  constructor(
    db: Database.Database,
    planModel: PlanModel,
    taskModel: TaskModel,
    events?: EventModel,
  ) {
    this.db = db;
    this.planModel = planModel;
    this.taskModel = taskModel;
    this.events = events;
  }

  canComplete(planId: string): { completable: boolean; blockers: string[] } {
    const allTasks = this.taskModel.getByPlan(planId);
    const leafTasks = this.getLeafTasks(allTasks);
    const blockers = leafTasks
      .filter((t) => t.status !== 'done' && t.status !== 'skipped')
      .map((t) => t.title);

    return {
      completable: blockers.length === 0,
      blockers,
    };
  }

  completePlan(planId: string): Plan {
    const { completable, blockers } = this.canComplete(planId);
    if (!completable) {
      throw new Error(
        `Plan cannot be completed. Blockers: ${blockers.join(', ')}`,
      );
    }

    // AC 매칭 검증을 비동기로 실행 — 결과를 기다리지 않고 플랜 완료를 진행
    const verifier = new PlanVerifier(this.db);
    verifier.verify(planId).then(verification => {
      if (verification.warnings.length > 0) {
        console.log(`[lifecycle] Plan ${planId} verification warnings:`);
        for (const w of verification.warnings) {
          console.log(`  - ${w}`);
        }
      }
      if (verification.overallScore >= 0) {
        console.log(`[lifecycle] AC verification score: ${verification.overallScore}/100`);
      }
    }).catch((err: unknown) => {
      console.error(`[lifecycle] Plan ${planId} verification failed:`, normalizeError(err).message);
    });

    const plan = this.planModel.complete(planId);
    this.events?.record(
      'plan',
      planId,
      'lifecycle_completed',
      null,
      JSON.stringify({ status: 'completed' }),
    );
    return plan;
  }

  autoCheckCompletion(planId: string): {
    all_done: boolean;
    progress: { total: number; done: number; pct: number };
  } {
    const allTasks = this.taskModel.getByPlan(planId);
    const leafTasks = this.getLeafTasks(allTasks);
    const total = leafTasks.length;
    const done = leafTasks.filter(
      (t) => t.status === 'done' || t.status === 'skipped',
    ).length;
    const pct = total === 0 ? 100 : Math.round((done / total) * 100);

    return {
      all_done: total > 0 && done === total,
      progress: { total, done, pct },
    };
  }

  /**
   * 단일 태스크를 RetryEngine으로 실행한다 (재시도 + 에스컬레이션).
   * vs-next에서 호출하는 진입점.
   */
  async executeTaskWithRetry(
    taskId: string,
    planId: string,
    agentType: string,
    executeFn: ExecuteFn<any>,
    retryConfig?: RetryConfig,
  ): Promise<{ success: boolean; escalated: boolean }> {
    const engine = new RetryEngine(this.db, retryConfig ?? DEFAULT_RETRY_CONFIG);

    try {
      await engine.executeWithRetry(taskId, agentType, planId, executeFn);
      return { success: true, escalated: false };
    } catch (retryError) {
      // 재시도 모두 실패 → 에스컬레이션 시도
      const result = await engine.escalate(taskId, planId, agentType, executeFn);
      // escalated=true는 fallback을 시도했다는 의미이지 성공이 아님
      // attempts 배열에서 마지막 시도가 성공인지 확인
      const lastAttempt = result.attempts[result.attempts.length - 1];
      const success = result.escalated && lastAttempt?.success === true;
      return { success, escalated: result.escalated };
    }
  }

  /**
   * 플랜의 wave를 WaveCoordinator로 병렬 실행한다.
   * vs-exec 배치 모드에서 호출하는 진입점.
   */
  async executeWavesParallel(
    planId: string,
    executeFn: (taskId: string) => Promise<void>,
    options?: { maxConcurrent?: number },
  ): Promise<{ completed: number; failed: number; blocked: number }> {
    const coordinator = new WaveCoordinator(this.db);
    const plans = coordinator.buildExecutionPlan(planId);

    let completed = 0;
    let failed = 0;
    let blocked = 0;

    for (const wavePlan of plans) {
      const result = await coordinator.executeWaveParallel(
        wavePlan,
        executeFn,
        { maxConcurrent: options?.maxConcurrent ?? 3 },
      );

      for (const taskResult of result.results) {
        if (taskResult.status === 'success') completed++;
        else if (taskResult.status === 'failed') failed++;
        else if (taskResult.status === 'blocked') blocked++;
      }

      // wave 완료 이벤트 기록
      this.events?.record(
        'plan',
        planId,
        'wave_completed',
        null,
        JSON.stringify({
          waveIndex: wavePlan.waveIndex,
          completed,
          failed,
          blocked,
        }),
      );
    }

    return { completed, failed, blocked };
  }

  private getLeafTasks(tasks: Task[]): Task[] {
    const parentIds = new Set(
      tasks.filter((t) => t.parent_id !== null).map((t) => t.parent_id!),
    );
    return tasks.filter((t) => !parentIds.has(t.id));
  }
}
