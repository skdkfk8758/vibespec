import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../core/db/connection.js';
import { initSchema } from '../../core/db/schema.js';
import { createServer } from '../server.js';
import { PlanModel } from '../../core/models/plan.js';
import { TaskModel } from '../../core/models/task.js';
import { TaskMetricsModel } from '../../core/models/task-metrics.js';
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

  describe('vp_task_update metrics integration', () => {
    let taskMetricsModel: TaskMetricsModel;

    beforeEach(() => {
      taskMetricsModel = new TaskMetricsModel(db);
    });

    it('should have metrics as optional field in inputSchema', async () => {
      const tools = await client.listTools();
      const taskUpdateTool = tools.tools.find((t) => t.name === 'vp_task_update');
      expect(taskUpdateTool).toBeDefined();
      const props = taskUpdateTool!.inputSchema.properties as Record<string, unknown>;
      expect(props.metrics).toBeDefined();
      // metrics should not be in required
      const required = taskUpdateTool!.inputSchema.required as string[];
      expect(required).not.toContain('metrics');
    });

    it('should auto-record task_metrics when status changes to done', async () => {
      const task = taskModel.create(planId, 'Metrics Task');

      await client.callTool({
        name: 'vp_task_update',
        arguments: { task_id: task.id, status: 'done' },
      });

      const metrics = taskMetricsModel.getByTask(task.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.task_id).toBe(task.id);
      expect(metrics!.plan_id).toBe(planId);
      expect(metrics!.final_status).toBe('done');
    });

    it('should store impl_status and test_count when metrics provided', async () => {
      const task = taskModel.create(planId, 'Metrics Detail Task');

      await client.callTool({
        name: 'vp_task_update',
        arguments: {
          task_id: task.id,
          status: 'done',
          metrics: {
            impl_status: 'DONE',
            test_count: 5,
            files_changed: 3,
            has_concerns: false,
          },
        },
      });

      const metrics = taskMetricsModel.getByTask(task.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.impl_status).toBe('DONE');
      expect(metrics!.test_count).toBe(5);
      expect(metrics!.files_changed).toBe(3);
      expect(metrics!.has_concerns).toBe(0);
    });

    it('should record metrics without metrics param (duration/final_status only)', async () => {
      const task = taskModel.create(planId, 'No Metrics Param Task');

      await client.callTool({
        name: 'vp_task_update',
        arguments: { task_id: task.id, status: 'done' },
      });

      const metrics = taskMetricsModel.getByTask(task.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.final_status).toBe('done');
      expect(metrics!.impl_status).toBeNull();
      expect(metrics!.test_count).toBeNull();
    });

    it('should record metrics when status changes to blocked', async () => {
      const task = taskModel.create(planId, 'Blocked Metrics Task');

      await client.callTool({
        name: 'vp_task_update',
        arguments: { task_id: task.id, status: 'blocked' },
      });

      const metrics = taskMetricsModel.getByTask(task.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.final_status).toBe('blocked');
    });

    it('should record metrics when status changes to skipped', async () => {
      const task = taskModel.create(planId, 'Skipped Metrics Task');

      await client.callTool({
        name: 'vp_task_update',
        arguments: { task_id: task.id, status: 'skipped' },
      });

      const metrics = taskMetricsModel.getByTask(task.id);
      expect(metrics).not.toBeNull();
      expect(metrics!.final_status).toBe('skipped');
    });

    it('should NOT record metrics when status changes to in_progress', async () => {
      const task = taskModel.create(planId, 'In Progress Task');

      await client.callTool({
        name: 'vp_task_update',
        arguments: { task_id: task.id, status: 'in_progress' },
      });

      const metrics = taskMetricsModel.getByTask(task.id);
      expect(metrics).toBeNull();
    });

    it('should not block main status update if metrics recording fails', async () => {
      const task = taskModel.create(planId, 'Resilient Task');

      // Drop the task_metrics table to simulate a failure
      db.exec('DROP TABLE IF EXISTS task_metrics');

      const result = await client.callTool({
        name: 'vp_task_update',
        arguments: { task_id: task.id, status: 'done' },
      });

      // Main update should still succeed
      const parsed = parseResult(result);
      expect(parsed.task.status).toBe('done');
      expect(parsed.task.id).toBe(task.id);
      expect(parsed.completion_check).toBeDefined();
    });
  });

  describe('vp_task_create with depends_on', () => {
    it('should save depends_on when valid task IDs are provided', async () => {
      const taskA = taskModel.create(planId, 'Task A');

      const result = await client.callTool({
        name: 'vp_task_create',
        arguments: {
          plan_id: planId,
          title: 'Task B',
          depends_on: [taskA.id],
        },
      });

      const parsed = parseResult(result);
      expect(parsed.title).toBe('Task B');
      expect(parsed.depends_on).toBeDefined();
      const deps = JSON.parse(parsed.depends_on);
      expect(deps).toEqual([taskA.id]);
    });

    it('should return error when depends_on contains non-existent task ID', async () => {
      const result = await client.callTool({
        name: 'vp_task_create',
        arguments: {
          plan_id: planId,
          title: 'Task with bad dep',
          depends_on: ['nonexistent-id'],
        },
      });

      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error).toContain('Dependency task not found');
    });

    it('should work without depends_on (backward compatibility)', async () => {
      const result = await client.callTool({
        name: 'vp_task_create',
        arguments: {
          plan_id: planId,
          title: 'Task without deps',
        },
      });

      const parsed = parseResult(result);
      expect(parsed.title).toBe('Task without deps');
      expect(parsed.status).toBe('todo');
      expect(parsed.depends_on).toBeNull();
    });

    it('should have depends_on in inputSchema', async () => {
      const tools = await client.listTools();
      const createTool = tools.tools.find((t) => t.name === 'vp_task_create');
      expect(createTool).toBeDefined();
      const props = createTool!.inputSchema.properties as Record<string, unknown>;
      expect(props.depends_on).toBeDefined();
      // depends_on should not be required
      const required = createTool!.inputSchema.required as string[];
      expect(required).not.toContain('depends_on');
    });
  });

  describe('vp_task_next with dependencies', () => {
    it('should skip tasks whose dependencies are not done', async () => {
      const taskA = taskModel.create(planId, 'Task A', { sortOrder: 1 });
      taskModel.create(planId, 'Task B', {
        sortOrder: 2,
        dependsOn: [taskA.id],
      });

      const result = await client.callTool({
        name: 'vp_task_next',
        arguments: { plan_id: planId },
      });

      const parsed = parseResult(result);
      // Task A has no deps, so it should be returned (not Task B)
      expect(parsed.title).toBe('Task A');
    });

    it('should return dependent task after its dependency is done', async () => {
      const taskA = taskModel.create(planId, 'Task A', { sortOrder: 1 });
      taskModel.create(planId, 'Task B', {
        sortOrder: 2,
        dependsOn: [taskA.id],
      });

      // Complete Task A
      taskModel.updateStatus(taskA.id, 'done');

      const result = await client.callTool({
        name: 'vp_task_next',
        arguments: { plan_id: planId },
      });

      const parsed = parseResult(result);
      expect(parsed.title).toBe('Task B');
    });

    it('should return no pending tasks when all remaining tasks are blocked by deps', async () => {
      const taskA = taskModel.create(planId, 'Task A', { sortOrder: 1 });
      taskModel.create(planId, 'Task B', {
        sortOrder: 2,
        dependsOn: [taskA.id],
      });

      // Block Task A (not done)
      taskModel.updateStatus(taskA.id, 'blocked');

      const result = await client.callTool({
        name: 'vp_task_next',
        arguments: { plan_id: planId },
      });

      const parsed = parseResult(result);
      expect(parsed.message).toBe('No pending tasks');
    });
  });

  describe('vp_plan_get with waves', () => {
    it('should include waves array in response', async () => {
      const taskA = taskModel.create(planId, 'Task A', { sortOrder: 1 });
      taskModel.create(planId, 'Task B', {
        sortOrder: 2,
        dependsOn: [taskA.id],
      });

      const result = await client.callTool({
        name: 'vp_plan_get',
        arguments: { plan_id: planId },
      });

      const parsed = parseResult(result);
      expect(parsed.plan).toBeDefined();
      expect(parsed.tasks).toBeDefined();
      expect(parsed.waves).toBeDefined();
      expect(Array.isArray(parsed.waves)).toBe(true);
      expect(parsed.waves.length).toBe(2);
      expect(parsed.waves[0].index).toBe(0);
      expect(parsed.waves[1].index).toBe(1);
    });
  });
});
