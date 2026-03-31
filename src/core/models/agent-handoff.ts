import type Database from 'better-sqlite3';
import type { AgentHandoff, AgentType, HandoffVerdict } from '../types.js';
import { generateId } from '../utils.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_HANDOFF_DIR = join(process.cwd(), '.claude', 'handoff');

export class AgentHandoffModel {
  private db: Database.Database;
  private baseDir: string;

  constructor(db: Database.Database, baseDir?: string) {
    this.db = db;
    this.baseDir = baseDir ?? DEFAULT_HANDOFF_DIR;
  }

  create(
    taskId: string,
    planId: string,
    agentType: string,
    attempt: number,
    verdict: string,
    summary: string,
    reportPath?: string,
    changedFiles?: string,
    inputHash?: string,
  ): AgentHandoff {
    // Check for duplicate task+agent+attempt
    const existing = this.db.prepare(
      `SELECT id FROM agent_handoffs WHERE task_id = ? AND agent_type = ? AND attempt = ?`
    ).get(taskId, agentType, attempt);
    if (existing) {
      throw new Error(`Duplicate handoff: task=${taskId}, agent=${agentType}, attempt=${attempt}`);
    }

    const id = generateId();
    this.db.prepare(
      `INSERT INTO agent_handoffs (id, task_id, plan_id, agent_type, attempt, verdict, summary, report_path, changed_files, input_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, taskId, planId, agentType, attempt, verdict, summary, reportPath ?? null, changedFiles ?? null, inputHash ?? null);
    return this.get(id)!;
  }

  get(id: string): AgentHandoff | null {
    const row = this.db.prepare(`SELECT * FROM agent_handoffs WHERE id = ?`).get(id) as AgentHandoff | undefined;
    return row ?? null;
  }

  getByTask(taskId: string, agentType?: string, attempt?: number): AgentHandoff[] {
    const conditions = ['task_id = ?'];
    const params: unknown[] = [taskId];

    if (agentType) {
      conditions.push('agent_type = ?');
      params.push(agentType);
    }
    if (attempt !== undefined) {
      conditions.push('attempt = ?');
      params.push(attempt);
    }

    return this.db.prepare(
      `SELECT * FROM agent_handoffs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`
    ).all(...params) as AgentHandoff[];
  }

  list(planId?: string, taskId?: string): AgentHandoff[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (planId) {
      conditions.push('plan_id = ?');
      params.push(planId);
    }
    if (taskId) {
      conditions.push('task_id = ?');
      params.push(taskId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.prepare(
      `SELECT * FROM agent_handoffs ${where} ORDER BY created_at DESC`
    ).all(...params) as AgentHandoff[];
  }

  cleanByPlan(planId: string): void {
    // Get all task IDs for this plan to clean files
    const handoffs = this.list(planId);
    const taskIds = new Set(handoffs.map(h => h.task_id).filter(Boolean));

    // Delete DB records
    this.db.prepare(`DELETE FROM agent_handoffs WHERE plan_id = ?`).run(planId);

    // Clean handoff directories for each task
    for (const tid of taskIds) {
      const taskDir = join(this.baseDir, tid!);
      if (existsSync(taskDir)) {
        rmSync(taskDir, { recursive: true, force: true });
      }
    }
  }

  writeHandoffReport(taskId: string, agentType: string, attempt: number, data: unknown): string {
    const taskDir = join(this.baseDir, taskId);
    if (!existsSync(taskDir)) {
      mkdirSync(taskDir, { recursive: true });
    }
    const filePath = join(taskDir, `${agentType}_${attempt}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  readHandoffReport(taskId: string, agentType: string, attempt: number): unknown | null {
    const filePath = join(this.baseDir, taskId, `${agentType}_${attempt}.json`);
    if (!existsSync(filePath)) {
      return null;
    }
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  cleanHandoffFiles(planId: string): void {
    // Alias for cleanByPlan's file cleaning portion
    // Get task IDs from DB
    const handoffs = this.list(planId);
    const taskIds = new Set(handoffs.map(h => h.task_id).filter(Boolean));
    for (const tid of taskIds) {
      const taskDir = join(this.baseDir, tid!);
      if (existsSync(taskDir)) {
        rmSync(taskDir, { recursive: true, force: true });
      }
    }
  }
}
