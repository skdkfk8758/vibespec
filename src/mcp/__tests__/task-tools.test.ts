import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../core/db/connection.js';
import { initSchema } from '../../core/db/schema.js';
import { createServer } from '../server.js';
import { PlanModel } from '../../core/models/plan.js';
import { TaskModel } from '../../core/models/task.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type Database from 'better-sqlite3';

function parseResult(result: Awaited<ReturnType<Client['callTool']>>) {
  return JSON.parse((result.content as Array<{ text: string }>)[0].text);
}

describe('MCP Task Tools', () => {
  let db: Database.Database;
  let client: Client;
  let planModel: PlanModel;
  let taskModel: TaskModel;
  let planId: string;

  beforeEach(async () => {
    db = createMemoryDb();
    initSchema(db);

    planModel = new PlanModel(db);
    taskModel = new TaskModel(db);

    const plan = planModel.create('Test Plan');
    planModel.activate(plan.id);
    planId = plan.id;

    const server = createServer(db);
    const client_ = new Client({ name: 'test-client', version: '0.1.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client_.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    client = client_;
  });

  describe('vp_task_create', () => {
    it('should create a task successfully', async () => {
      const result = await client.callTool({
        name: 'vp_task_create',
        arguments: { plan_id: planId, title: 'My Task', spec: 'Do stuff', acceptance: 'It works' },
      });

      const parsed = parseResult(result);
      expect(parsed.title).toBe('My Task');
      expect(parsed.status).toBe('todo');
      expect(parsed.plan_id).toBe(planId);
      expect(parsed.spec).toBe('Do stuff');
      expect(parsed.acceptance).toBe('It works');
      expect(parsed.id).toBeDefined();
    });
  });

  describe('vp_task_update', () => {
    it('should update status to done and return completion check', async () => {
      const task = taskModel.create(planId, 'Task 1');

      const result = await client.callTool({
        name: 'vp_task_update',
        arguments: { task_id: task.id, status: 'done' },
      });

      const parsed = parseResult(result);
      expect(parsed.task.status).toBe('done');
      expect(parsed.task.id).toBe(task.id);
      expect(parsed.completion_check).toBeDefined();
      expect(parsed.completion_check.all_done).toBe(true);
      expect(parsed.completion_check.progress.pct).toBe(100);
    });

    it('should return error for invalid status', async () => {
      const task = taskModel.create(planId, 'Task 1');

      const result = await client.callTool({
        name: 'vp_task_update',
        arguments: { task_id: task.id, status: 'invalid_status' },
      });

      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error).toBe('Invalid status. Must be: todo, in_progress, done, blocked, skipped');
    });
  });

  describe('vp_task_get', () => {
    it('should return task with acceptance criteria', async () => {
      const task = taskModel.create(planId, 'Get Me', {
        acceptance: 'Must pass tests',
      });

      const result = await client.callTool({
        name: 'vp_task_get',
        arguments: { task_id: task.id },
      });

      const parsed = parseResult(result);
      expect(parsed.id).toBe(task.id);
      expect(parsed.title).toBe('Get Me');
      expect(parsed.acceptance).toBe('Must pass tests');
    });

    it('should return error for non-existent task', async () => {
      const result = await client.callTool({
        name: 'vp_task_get',
        arguments: { task_id: 'nonexistent-id' },
      });

      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error).toBe('Task not found');
    });
  });

  describe('vp_task_next', () => {
    it('should return the first todo task sorted by sort_order', async () => {
      taskModel.create(planId, 'Task A', { sortOrder: 2 });
      taskModel.create(planId, 'Task B', { sortOrder: 1 });

      const result = await client.callTool({
        name: 'vp_task_next',
        arguments: { plan_id: planId },
      });

      const parsed = parseResult(result);
      expect(parsed.title).toBe('Task B');
    });

    it('should return no pending tasks message when all done', async () => {
      const task = taskModel.create(planId, 'Done Task');
      taskModel.updateStatus(task.id, 'done');

      const result = await client.callTool({
        name: 'vp_task_next',
        arguments: { plan_id: planId },
      });

      const parsed = parseResult(result);
      expect(parsed.message).toBe('No pending tasks');
    });
  });

  describe('vp_task_block', () => {
    it('should set task status to blocked', async () => {
      const task = taskModel.create(planId, 'Blockable Task');

      const result = await client.callTool({
        name: 'vp_task_block',
        arguments: { task_id: task.id, reason: 'Waiting on dependency' },
      });

      const parsed = parseResult(result);
      expect(parsed.status).toBe('blocked');
      expect(parsed.id).toBe(task.id);
    });
  });
});
