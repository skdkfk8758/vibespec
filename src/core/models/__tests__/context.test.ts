import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { ContextModel } from '../context.js';
import type Database from 'better-sqlite3';

describe('ContextModel', () => {
  let db: Database.Database;
  let context: ContextModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    context = new ContextModel(db);

    // Insert dummy records to satisfy foreign key constraints
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('plan-1', 'Test', 'active');
    db.prepare("INSERT INTO tasks (id, plan_id, title, status) VALUES (?, ?, ?, ?)").run('task-1', 'plan-1', 'Test Task', 'todo');
  });

  it('should save with all options and getLatest returns it', () => {
    const log = context.save('Completed setup phase', {
      planId: 'plan-1',
      sessionId: 'session-1',
      lastTaskId: 'task-1',
    });

    expect(log.id).toBeDefined();
    expect(log.summary).toBe('Completed setup phase');
    expect(log.plan_id).toBe('plan-1');
    expect(log.session_id).toBe('session-1');
    expect(log.last_task_id).toBe('task-1');
    expect(log.created_at).toBeDefined();

    const latest = context.getLatest();
    expect(latest).toHaveLength(1);
    expect(latest[0].id).toBe(log.id);
  });

  it('should return only the most recent entry when getLatest(1) is called with 3 entries', () => {
    context.save('First entry');
    context.save('Second entry');
    const third = context.save('Third entry');

    const latest = context.getLatest(1);
    expect(latest).toHaveLength(1);
    expect(latest[0].summary).toBe('Third entry');
    expect(latest[0].id).toBe(third.id);
  });

  it('should filter by plan_id with getByPlan', () => {
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run('plan-2', 'Other Plan', 'draft');

    context.save('Log for plan 1', { planId: 'plan-1' });
    context.save('Log for plan 2', { planId: 'plan-2' });
    context.save('Another log for plan 1', { planId: 'plan-1' });

    const plan1Logs = context.getByPlan('plan-1');
    expect(plan1Logs).toHaveLength(2);
    expect(plan1Logs.every((l) => l.plan_id === 'plan-1')).toBe(true);
    // Most recent first
    expect(plan1Logs[0].summary).toBe('Another log for plan 1');
    expect(plan1Logs[1].summary).toBe('Log for plan 1');

    const plan2Logs = context.getByPlan('plan-2');
    expect(plan2Logs).toHaveLength(1);
    expect(plan2Logs[0].summary).toBe('Log for plan 2');
  });

  it('should return single most recent log for a session with getBySession', () => {
    context.save('First session log', { sessionId: 'session-a' });
    context.save('Second session log', { sessionId: 'session-a' });

    const result = context.getBySession('session-a');
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('Second session log');
    expect(result!.session_id).toBe('session-a');

    // Non-existent session returns null
    const noResult = context.getBySession('non-existent');
    expect(noResult).toBeNull();
  });

  it('should save without optional fields (null values)', () => {
    const log = context.save('Minimal log entry');

    expect(log.summary).toBe('Minimal log entry');
    expect(log.plan_id).toBeNull();
    expect(log.session_id).toBeNull();
    expect(log.last_task_id).toBeNull();
  });
});
