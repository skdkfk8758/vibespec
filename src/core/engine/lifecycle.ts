import type Database from 'better-sqlite3';
import { PlanModel } from '../models/plan.js';
import { TaskModel } from '../models/task.js';
import { EventModel } from '../models/event.js';
import type { Plan, Task } from '../types.js';

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

  private getLeafTasks(tasks: Task[]): Task[] {
    const parentIds = new Set(
      tasks.filter((t) => t.parent_id !== null).map((t) => t.parent_id!),
    );
    return tasks.filter((t) => !parentIds.has(t.id));
  }
}
