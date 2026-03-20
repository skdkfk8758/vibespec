import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../core/db/connection.js';
import { initSchema } from '../../core/db/schema.js';
import { createServer } from '../server.js';
import { PlanModel } from '../../core/models/plan.js';
import { TaskModel } from '../../core/models/task.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type Database from 'better-sqlite3';

function parseResult(result: { content: unknown }) {
  return JSON.parse((result.content as Array<{ text: string }>)[0].text);
}

describe('MCP Plan Tools', () => {
  let db: Database.Database;
  let client: Client;
  let planModel: PlanModel;
  let taskModel: TaskModel;

  beforeEach(async () => {
    db = createMemoryDb();
    initSchema(db);

    planModel = new PlanModel(db);
    taskModel = new TaskModel(db);

    const server = createServer(db);
    const client_ = new Client({ name: 'test-client', version: '0.1.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client_.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    client = client_;
  });

  describe('vs_plan_create', () => {
    it('should create a plan with active status', async () => {
      const result = await client.callTool({
        name: 'vs_plan_create',
        arguments: { title: 'My Plan', spec: 'Some spec', summary: 'A summary' },
      });
      const parsed = parseResult(result);

      expect(parsed.title).toBe('My Plan');
      expect(parsed.status).toBe('active');
      expect(parsed.spec).toBe('Some spec');
      expect(parsed.summary).toBe('A summary');
      expect(parsed.id).toBeDefined();
    });
  });

  describe('vs_plan_get', () => {
    it('should return plan with task tree', async () => {
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);
      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      taskModel.create(plan.id, 'Subtask 1', { parentId: t1.id });

      const result = await client.callTool({
        name: 'vs_plan_get',
        arguments: { plan_id: plan.id },
      });
      const parsed = parseResult(result);

      expect(parsed.plan.id).toBe(plan.id);
      expect(parsed.plan.title).toBe('Test Plan');
      expect(parsed.tasks).toHaveLength(2); // 2 root tasks
      expect(parsed.tasks[0].children).toHaveLength(1); // 1 subtask
    });

    it('should return error for non-existent plan', async () => {
      const result = await client.callTool({
        name: 'vs_plan_get',
        arguments: { plan_id: 'nonexistent' },
      });
      const parsed = parseResult(result);

      expect(parsed.error).toBe('Plan not found');
      expect(result.isError).toBe(true);
    });
  });

  describe('vs_plan_list', () => {
    it('should return all plans', async () => {
      planModel.create('Plan A');
      planModel.create('Plan B');

      const result = await client.callTool({
        name: 'vs_plan_list',
        arguments: {},
      });
      const parsed = parseResult(result);

      expect(parsed).toHaveLength(2);
    });

    it('should return filtered plans by status', async () => {
      const p1 = planModel.create('Draft Plan');
      const p2 = planModel.create('Active Plan');
      planModel.activate(p2.id);

      const result = await client.callTool({
        name: 'vs_plan_list',
        arguments: { status: 'active' },
      });
      const parsed = parseResult(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].status).toBe('active');
      expect(parsed[0].title).toBe('Active Plan');
    });
  });

  describe('vs_plan_complete', () => {
    it('should complete plan when all tasks are done', async () => {
      const plan = planModel.create('Completable Plan');
      planModel.activate(plan.id);
      const t1 = taskModel.create(plan.id, 'Task 1');
      const t2 = taskModel.create(plan.id, 'Task 2');
      taskModel.updateStatus(t1.id, 'done');
      taskModel.updateStatus(t2.id, 'done');

      const result = await client.callTool({
        name: 'vs_plan_complete',
        arguments: { plan_id: plan.id },
      });
      const parsed = parseResult(result);

      expect(parsed.status).toBe('completed');
      expect(parsed.id).toBe(plan.id);
    });

    it('should return error when tasks are incomplete', async () => {
      const plan = planModel.create('Incomplete Plan');
      planModel.activate(plan.id);
      taskModel.create(plan.id, 'Undone Task');

      const result = await client.callTool({
        name: 'vs_plan_complete',
        arguments: { plan_id: plan.id },
      });
      const parsed = parseResult(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('cannot be completed');
      expect(result.isError).toBe(true);
    });
  });

  describe('vs_plan_archive', () => {
    it('should archive a plan', async () => {
      const plan = planModel.create('To Archive');
      planModel.activate(plan.id);

      const result = await client.callTool({
        name: 'vs_plan_archive',
        arguments: { plan_id: plan.id },
      });
      const parsed = parseResult(result);

      expect(parsed.status).toBe('archived');
      expect(parsed.id).toBe(plan.id);
    });
  });
});
