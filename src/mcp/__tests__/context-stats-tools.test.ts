import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../core/db/connection.js';
import { initSchema } from '../../core/db/schema.js';
import { createServer } from '../server.js';
import { PlanModel } from '../../core/models/plan.js';
import { TaskModel } from '../../core/models/task.js';
import { EventModel } from '../../core/models/event.js';
import { ContextModel } from '../../core/models/context.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type Database from 'better-sqlite3';

describe('MCP Context + Stats Tools', () => {
  let db: Database.Database;
  let client: Client;

  beforeEach(async () => {
    db = createMemoryDb();
    initSchema(db);

    const server = createServer(db);
    const client_ = new Client({ name: 'test-client', version: '0.1.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client_.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    client = client_;
  });

  function parseResult(result: Awaited<ReturnType<typeof client.callTool>>): unknown {
    return JSON.parse((result.content as Array<{ text: string }>)[0].text);
  }

  describe('vp_context_save', () => {
    it('should save and return a context log', async () => {
      const result = await client.callTool({
        name: 'vp_context_save',
        arguments: { summary: 'Implemented feature X' },
      });
      const parsed = parseResult(result) as Record<string, unknown>;

      expect(parsed.summary).toBe('Implemented feature X');
      expect(parsed.id).toBeDefined();
      expect(parsed.created_at).toBeDefined();
    });

    it('should save context linked to a plan', async () => {
      const planModel = new PlanModel(db, new EventModel(db));
      const plan = planModel.create('Test Plan');

      const result = await client.callTool({
        name: 'vp_context_save',
        arguments: { summary: 'Working on plan tasks', plan_id: plan.id },
      });
      const parsed = parseResult(result) as Record<string, unknown>;

      expect(parsed.summary).toBe('Working on plan tasks');
      expect(parsed.plan_id).toBe(plan.id);
    });

    it('should save context with session_id', async () => {
      const result = await client.callTool({
        name: 'vp_context_save',
        arguments: { summary: 'Session work', session_id: 'sess-abc' },
      });
      const parsed = parseResult(result) as Record<string, unknown>;

      expect(parsed.summary).toBe('Session work');
      expect(parsed.session_id).toBe('sess-abc');
    });
  });

  describe('vp_stats', () => {
    it('should return velocity only when no plan_id provided', async () => {
      const result = await client.callTool({
        name: 'vp_stats',
        arguments: {},
      });
      const parsed = parseResult(result) as Record<string, unknown>;

      expect(parsed.velocity).toBeDefined();
      expect(parsed.estimated_completion).toBeUndefined();

      const velocity = parsed.velocity as { daily: number; total_completed: number };
      expect(velocity.daily).toBeTypeOf('number');
      expect(velocity.total_completed).toBeTypeOf('number');
    });

    it('should return velocity and estimated completion when plan_id provided', async () => {
      const eventModel = new EventModel(db);
      const planModel = new PlanModel(db, eventModel);
      const taskModel = new TaskModel(db, eventModel);

      const plan = planModel.create('Stats Plan');
      planModel.activate(plan.id);
      taskModel.create(plan.id, 'Task 1');
      taskModel.create(plan.id, 'Task 2');
      taskModel.create(plan.id, 'Task 3');

      const result = await client.callTool({
        name: 'vp_stats',
        arguments: { plan_id: plan.id },
      });
      const parsed = parseResult(result) as Record<string, unknown>;

      expect(parsed.velocity).toBeDefined();
      expect(parsed.estimated_completion).toBeDefined();

      const ec = parsed.estimated_completion as {
        remaining_tasks: number;
        velocity: number;
        estimated_days: number | null;
        estimated_date: string | null;
      };
      expect(ec.remaining_tasks).toBe(3);
    });
  });

  describe('vp_history', () => {
    it('should return event list for an entity', async () => {
      const eventModel = new EventModel(db);
      const planModel = new PlanModel(db, eventModel);
      const taskModel = new TaskModel(db, eventModel);

      const plan = planModel.create('History Plan');
      planModel.activate(plan.id);
      const task = taskModel.create(plan.id, 'History Task');
      taskModel.updateStatus(task.id, 'in_progress');
      taskModel.updateStatus(task.id, 'done');

      const result = await client.callTool({
        name: 'vp_history',
        arguments: { entity_type: 'task', entity_id: task.id },
      });
      const parsed = parseResult(result) as Array<Record<string, unknown>>;

      expect(Array.isArray(parsed)).toBe(true);
      // created + status_changed to in_progress + status_changed to done
      expect(parsed.length).toBeGreaterThanOrEqual(3);
      expect(parsed[0].entity_type).toBe('task');
      expect(parsed[0].entity_id).toBe(task.id);
    });

    it('should return empty array for non-existent entity', async () => {
      const result = await client.callTool({
        name: 'vp_history',
        arguments: { entity_type: 'task', entity_id: 'nonexistent' },
      });
      const parsed = parseResult(result) as Array<Record<string, unknown>>;

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(0);
    });
  });
});
