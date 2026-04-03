import { z } from 'zod';
import type Database from 'better-sqlite3';
import { AgentHandoffModel } from '../models/agent-handoff.js';
import { TaskModel } from '../models/task.js';
import { ErrorKBEngine } from './error-kb.js';
import { normalizeError } from '../utils.js';

/**
 * Zod 스키마 — RetryConfig 런타임 검증.
 * maxRetries >= 1, backoffMs 최소 1개 요소 필수.
 */
export const RetryConfigSchema = z.object({
  maxRetries: z.number().int().min(1),
  backoffMs: z.array(z.number().int().positive()).min(1),
  fallbackAgentMap: z.record(z.string(), z.string()),
});

/**
 * RetryConfig 인터페이스.
 */
export type RetryConfig = z.infer<typeof RetryConfigSchema>;

/**
 * 기본 재시도 설정.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: [1000, 2000, 4000],
  fallbackAgentMap: {},
};

/**
 * 단일 재시도 결과.
 */
export interface RetryResult {
  success: boolean;
  attempt: number;
  error?: Error;
}

/**
 * 모든 재시도 소진 후 에스컬레이션 결과.
 */
export interface EscalationResult {
  escalated: boolean;
  fallbackAgent?: string;
  attempts: RetryResult[];
}

/**
 * executeFn 시그니처: attempt 번호(1-based)와 이전 실패 에러 목록을 받아 비동기로 실행.
 */
export type ExecuteFn<T> = (attempt: number, previousErrors: Error[]) => Promise<T>;

/**
 * RetryEngine — executeWithRetry를 통해 exponential backoff + attempt 기록 + 상태 체크 제공.
 */
export class RetryEngine {
  private db: Database.Database;
  private config: RetryConfig;
  private sleep: (ms: number) => Promise<void>;
  private projectRoot: string;

  constructor(
    db: Database.Database,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    sleep?: (ms: number) => Promise<void>,
    projectRoot: string = process.cwd(),
  ) {
    this.db = db;
    this.config = config;
    this.sleep = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.projectRoot = projectRoot;
  }

  /**
   * 태스크 실행을 최대 maxRetries회 재시도한다.
   *
   * - done/skipped 상태이면 즉시 에러를 던지고 중단한다
   * - 각 시도마다 AgentHandoffModel에 attempt를 기록한다
   * - 재시도 전 backoffMs에 맞는 대기 시간을 적용한다
   * - 이전 실패 에러를 다음 시도의 executeFn에 전달한다
   */
  async executeWithRetry<T>(
    taskId: string,
    agentType: string,
    planId: string,
    executeFn: ExecuteFn<T>,
  ): Promise<T> {
    const taskModel = new TaskModel(this.db);
    const handoffModel = new AgentHandoffModel(this.db);
    const { maxRetries, backoffMs } = this.config;

    const previousErrors: Error[] = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 매 시도 전 태스크 상태 확인 (Edge Case #1)
      const task = taskModel.getById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      if (task.status === 'done' || task.status === 'skipped') {
        throw new Error(
          `태스크가 ${task.status} 상태이므로 재시도를 중단합니다: ${taskId}`,
        );
      }

      // 첫 번째 시도가 아니면 backoff 대기
      if (attempt > 1) {
        const backoffIndex = Math.min(attempt - 2, backoffMs.length - 1);
        await this.sleep(backoffMs[backoffIndex]);
      }

      try {
        const result = await executeFn(attempt, previousErrors);

        // 성공 시 attempt 기록
        handoffModel.create(
          taskId,
          planId,
          agentType,
          attempt,
          'success',
          `Attempt ${attempt} succeeded`,
        );

        return result;
      } catch (err) {
        const error = normalizeError(err);
        previousErrors.push(error);

        // 실패 attempt 기록
        handoffModel.create(
          taskId,
          planId,
          agentType,
          attempt,
          'failure',
          `Attempt ${attempt} failed: ${error.message}`,
        );
      }
    }

    // 모든 재시도 소진
    throw previousErrors[previousErrors.length - 1] ?? new Error('모든 재시도가 소진되었습니다');
  }

  /**
   * 에스컬레이션 — fallbackAgentMap에서 대체 에이전트를 찾아 executeWithRetry 재실행.
   * 대체 에이전트도 실패하거나 매핑이 없으면 error-kb에 기록하고 결과를 반환한다.
   *
   * @param taskId 태스크 ID
   * @param planId 플랜 ID
   * @param originalAgent 원래 에이전트 타입
   * @param executeFn 원래 실행 함수 (fallback 실행에도 재사용)
   * @param fallbackExecuteFn 대체 에이전트용 실행 함수 (선택적, 없으면 executeFn 사용)
   */
  async escalate(
    taskId: string,
    planId: string,
    originalAgent: string,
    executeFn: ExecuteFn<any>,
    fallbackExecuteFn?: ExecuteFn<any>,
  ): Promise<EscalationResult> {
    const fallbackAgent = this.config.fallbackAgentMap[originalAgent];
    const errorKb = new ErrorKBEngine(this.projectRoot);

    // 매핑이 없으면 즉시 반환 + error-kb 기록
    if (!fallbackAgent) {
      errorKb.add({
        title: `escalation failure: ${originalAgent} — no fallback`,
        severity: 'high',
        tags: ['escalation', originalAgent, taskId],
        cause: `Task ${taskId} failed and no fallback agent is configured for ${originalAgent}`,
        solution: `Add a fallback agent mapping for ${originalAgent} in RetryConfig.fallbackAgentMap`,
      });
      return { escalated: false, attempts: [] };
    }

    // fallback 에이전트로 재실행
    const attempts: RetryResult[] = [];
    const fn = fallbackExecuteFn ?? executeFn;

    try {
      await this.executeWithRetry(taskId, fallbackAgent, planId, async (attempt, previousErrors) => {
        const result = await fn(attempt, previousErrors);
        attempts.push({ success: true, attempt });
        return result;
      });
      return { escalated: true, fallbackAgent, attempts };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      attempts.push({ success: false, attempt: attempts.length + 1, error });

      // 최종 실패 시 error-kb 기록
      errorKb.add({
        title: `escalation failure: ${originalAgent} -> ${fallbackAgent}`,
        severity: 'high',
        tags: ['escalation', originalAgent, fallbackAgent, taskId],
        cause: `Task ${taskId} failed with both ${originalAgent} and fallback ${fallbackAgent}: ${error.message}`,
        solution: `Investigate the root cause of failure in task ${taskId}`,
      });

      // 사용자 알림 메시지 (에러 세부정보 포함)
      console.error(`[retry] Task ${taskId}: 모든 재시도 실패. error-kb에 기록됨 (${error.message})`);

      return { escalated: true, fallbackAgent, attempts };
    }
  }
}
