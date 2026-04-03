import type Database from 'better-sqlite3';
import type { WaveExecutionPlan, TaskConflictMap, ConflictEntry } from '../types.js';
import { TaskModel } from '../models/task.js';
import { normalizeError } from '../utils.js';

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failed' | 'blocked';
  error?: Error;
}

export interface WaveResult {
  waveIndex: number;
  results: TaskResult[];
}

export interface ExecuteWaveOptions {
  /** Maximum concurrent tasks in a parallel group (default: 3) */
  maxConcurrent?: number;
  /** Dependency map: key depends on the listed task IDs */
  dependsOn?: Record<string, string[]>;
}

export class WaveCoordinator {
  private taskModel: TaskModel;

  constructor(db: Database.Database) {
    this.taskModel = new TaskModel(db);
  }

  /**
   * 주어진 태스크 ID 목록에서 allowed_files 교집합(충돌) 맵을 반환한다.
   * allowed_files가 null/undefined인 태스크는 충돌 계산에서 제외한다.
   */
  detectFileConflicts(taskIds: string[]): TaskConflictMap {
    const conflicts: ConflictEntry[] = [];

    // 태스크별 allowed_files 파싱
    const taskFiles = new Map<string, string[]>();
    for (const id of taskIds) {
      const task = this.taskModel.getById(id);
      if (!task || task.allowed_files === null || task.allowed_files === undefined) {
        continue;
      }
      try {
        const files: string[] = JSON.parse(task.allowed_files);
        taskFiles.set(task.id, files);
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }

    // file→taskIds 역인덱스 구축 (O(n)) 후 충돌 쌍 추출
    const fileToTasks = new Map<string, string[]>();
    for (const [taskId, files] of taskFiles) {
      for (const file of files) {
        const list = fileToTasks.get(file);
        if (list) list.push(taskId);
        else fileToTasks.set(file, [taskId]);
      }
    }

    // 공유 파일이 있는 태스크 쌍 수집
    const pairKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;
    const pairFiles = new Map<string, string[]>();
    for (const [file, tasks] of fileToTasks) {
      if (tasks.length < 2) continue;
      for (let i = 0; i < tasks.length; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
          const key = pairKey(tasks[i], tasks[j]);
          const shared = pairFiles.get(key);
          if (shared) shared.push(file);
          else pairFiles.set(key, [file]);
        }
      }
    }

    for (const [key, sharedFiles] of pairFiles) {
      const [taskA, taskB] = key.split('|');
      conflicts.push({ taskA, taskB, sharedFiles });
    }

    return { conflicts };
  }

  /**
   * planId에 대해 WaveExecutionPlan[]을 반환한다.
   * 각 wave 내 태스크를 충돌 분석하여 parallelGroups와 sequentialTasks로 분류한다.
   * - allowed_files가 null인 태스크 → sequentialTasks
   * - 충돌하는 태스크 → sequentialTasks
   * - 충돌 없는 태스크 → parallelGroups (하나의 그룹으로 묶음)
   */
  buildExecutionPlan(planId: string): WaveExecutionPlan[] {
    const waves = this.taskModel.getWaves(planId);
    if (waves.length === 0) return [];

    const result: WaveExecutionPlan[] = [];

    for (const wave of waves) {
      const taskIds = wave.task_ids;

      // batch 조회 후 allowed_files가 null인 태스크 분류
      const nullFileTasks: string[] = [];
      const definedFileTasks: string[] = [];
      const tasksInWave = taskIds.map(id => this.taskModel.getById(id)).filter(Boolean);
      const taskMap = new Map(tasksInWave.map(t => [t!.id, t!]));

      for (const id of taskIds) {
        const task = taskMap.get(id);
        if (!task || task.allowed_files === null || task.allowed_files === undefined) {
          nullFileTasks.push(id);
        } else {
          definedFileTasks.push(id);
        }
      }

      // 정의된 파일을 가진 태스크들 간 충돌 감지
      const conflictMap = this.detectFileConflicts(definedFileTasks);
      const conflictingIds = new Set<string>();

      for (const conflict of conflictMap.conflicts) {
        conflictingIds.add(conflict.taskA);
        conflictingIds.add(conflict.taskB);
      }

      // 충돌 없는 태스크 → parallelGroups, 충돌 있는 태스크 → sequentialTasks
      const parallelTaskIds = definedFileTasks.filter(id => !conflictingIds.has(id));
      const sequentialFromDefined = definedFileTasks.filter(id => conflictingIds.has(id));

      const sequentialTasks = [...nullFileTasks, ...sequentialFromDefined];
      const parallelGroups: string[][] = parallelTaskIds.length > 0 ? [parallelTaskIds] : [];

      result.push({
        waveIndex: wave.index,
        parallelGroups,
        sequentialTasks,
      });
    }

    return result;
  }

  /**
   * Executes a WaveExecutionPlan: parallel groups run concurrently (with semaphore),
   * sequential tasks run one at a time. Returns a WaveResult with per-task outcomes.
   */
  async executeWaveParallel(
    plan: WaveExecutionPlan,
    executeFn: (taskId: string) => Promise<void>,
    options: ExecuteWaveOptions = {},
  ): Promise<WaveResult> {
    const maxConcurrent = options.maxConcurrent ?? 3;
    const dependsOn = options.dependsOn ?? {};
    const results: TaskResult[] = [];

    // Execute all parallel groups
    for (const group of plan.parallelGroups) {
      const groupResults = await this.runParallelGroup(group, executeFn, maxConcurrent);
      results.push(...groupResults);
    }

    // Propagate blocked status to dependents
    const blockedTaskIds = new Set(
      results.filter(r => r.status === 'blocked' || r.status === 'failed').map(r => r.taskId),
    );

    const processedTaskIds = new Set(results.map(r => r.taskId));
    for (const [taskId, deps] of Object.entries(dependsOn)) {
      const isBlocked = deps.some(dep => blockedTaskIds.has(dep));
      if (isBlocked && !processedTaskIds.has(taskId)) {
        results.push({ taskId, status: 'blocked' });
        processedTaskIds.add(taskId);
      }
    }

    // Execute sequential tasks
    for (const taskId of plan.sequentialTasks) {
      try {
        await executeFn(taskId);
        results.push({ taskId, status: 'success' });
      } catch (err) {
        results.push({ taskId, status: 'failed', error: normalizeError(err) });
      }
    }

    return { waveIndex: plan.waveIndex, results };
  }

  private async runParallelGroup(
    taskIds: string[],
    executeFn: (taskId: string) => Promise<void>,
    maxConcurrent: number,
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    let activeCount = 0;
    let taskIndex = 0;
    const queue = [...taskIds];
    let resolved = false;

    return new Promise(resolve => {
      const tryResolve = () => {
        if (!resolved && activeCount === 0 && taskIndex >= queue.length) {
          resolved = true;
          resolve(results);
        }
      };

      const tryNext = () => {
        if (queue.length === 0) {
          tryResolve();
          return;
        }

        while (activeCount < maxConcurrent && taskIndex < queue.length) {
          const taskId = queue[taskIndex++];
          activeCount++;

          executeFn(taskId).then(
            () => {
              results.push({ taskId, status: 'success' });
              activeCount--;
              tryNext();
              tryResolve();
            },
            (err: unknown) => {
              results.push({
                taskId,
                status: 'failed',
                error: normalizeError(err),
              });
              activeCount--;
              tryNext();
              tryResolve();
            },
          );
        }
      };

      tryNext();
    });
  }
}
