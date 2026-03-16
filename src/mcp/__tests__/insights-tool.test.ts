import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../core/db/connection.js';
import { initSchema } from '../../core/db/schema.js';
import { createServer } from '../server.js';
import { PlanModel } from '../../core/models/plan.js';
import { TaskModel } from '../../core/models/task.js';
import { EventModel } from '../../core/models/event.js';
import { TaskMetricsModel } from '../../core/models/task-metrics.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type Database from 'better-sqlite3';

describe('vp_insights MCP tool', () => {
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

  it('should appear in ListTools response', async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain('vp_insights');

    const tool = result.tools.find((t) => t.name === 'vp_insights');
    expect(tool?.description).toContain('learning insights');
    expect(tool?.inputSchema.properties).toHaveProperty('scope');
  });

  it('should return all sections when scope=all', async () => {
    const result = await client.callTool({
      name: 'vp_insights',
      arguments: { scope: 'all' },
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed).toHaveProperty('blocked_patterns');
    expect(parsed).toHaveProperty('duration_stats');
    expect(parsed).toHaveProperty('success_rates');
    expect(parsed).toHaveProperty('recommendations');
    expect(parsed).toHaveProperty('confidence');
  });

  it('should return only blocked_patterns when scope=blocked_patterns', async () => {
    const result = await client.callTool({
      name: 'vp_insights',
      arguments: { scope: 'blocked_patterns' },
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed).toHaveProperty('blocked_patterns');
    expect(parsed).not.toHaveProperty('duration_stats');
    expect(parsed).not.toHaveProperty('success_rates');
    expect(parsed).not.toHaveProperty('recommendations');
    expect(parsed).not.toHaveProperty('confidence');
  });

  it('should return only duration_stats when scope=duration_stats', async () => {
    const result = await client.callTool({
      name: 'vp_insights',
      arguments: { scope: 'duration_stats' },
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed).toHaveProperty('duration_stats');
    expect(parsed).not.toHaveProperty('blocked_patterns');
    expect(parsed).not.toHaveProperty('success_rates');
    expect(parsed).not.toHaveProperty('recommendations');
    expect(parsed).not.toHaveProperty('confidence');
  });

  it('should return only success_rates when scope=success_rates', async () => {
    const result = await client.callTool({
      name: 'vp_insights',
      arguments: { scope: 'success_rates' },
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed).toHaveProperty('success_rates');
    expect(parsed).not.toHaveProperty('blocked_patterns');
    expect(parsed).not.toHaveProperty('duration_stats');
    expect(parsed).not.toHaveProperty('recommendations');
    expect(parsed).not.toHaveProperty('confidence');
  });

  it('should default to all when scope is not provided', async () => {
    const result = await client.callTool({
      name: 'vp_insights',
      arguments: {},
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed).toHaveProperty('blocked_patterns');
    expect(parsed).toHaveProperty('duration_stats');
    expect(parsed).toHaveProperty('success_rates');
    expect(parsed).toHaveProperty('recommendations');
    expect(parsed).toHaveProperty('confidence');
  });

  it('should fallback to all when scope is invalid', async () => {
    const result = await client.callTool({
      name: 'vp_insights',
      arguments: { scope: 'invalid_scope' },
    });
    const parsed = parseResult(result) as Record<string, unknown>;

    expect(parsed).toHaveProperty('blocked_patterns');
    expect(parsed).toHaveProperty('duration_stats');
    expect(parsed).toHaveProperty('success_rates');
    expect(parsed).toHaveProperty('recommendations');
    expect(parsed).toHaveProperty('confidence');
  });

  it('should return real data from InsightsEngine', async () => {
    // Seed some task metrics data
    const eventModel = new EventModel(db);
    const planModel = new PlanModel(db, eventModel);
    const taskModel = new TaskModel(db, eventModel);
    const taskMetricsModel = new TaskMetricsModel(db);

    const plan = planModel.create('Insights Plan');
    planModel.activate(plan.id);
    const task1 = taskModel.create(plan.id, 'Task 1');
    const task2 = taskModel.create(plan.id, 'Task 2');

    taskModel.updateStatus(task1.id, 'in_progress');
    taskModel.updateStatus(task1.id, 'done');
    taskMetricsModel.record(task1.id, plan.id, 'done');

    taskModel.updateStatus(task2.id, 'in_progress');
    taskModel.updateStatus(task2.id, 'blocked');
    taskMetricsModel.record(task2.id, plan.id, 'blocked');

    const result = await client.callTool({
      name: 'vp_insights',
      arguments: { scope: 'success_rates' },
    });
    const parsed = parseResult(result) as Record<string, unknown>;
    const rates = parsed.success_rates as { overall: number };

    // 1 done out of 2 terminal = 50%
    expect(rates.overall).toBe(50);
  });
});
