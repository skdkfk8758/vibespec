import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../core/db/connection.js';
import { initSchema } from '../../core/db/schema.js';
import { createServer } from '../server.js';
import { PlanModel } from '../../core/models/plan.js';
import { TaskModel } from '../../core/models/task.js';
import { ContextModel } from '../../core/models/context.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type Database from 'better-sqlite3';

describe('MCP Server', () => {
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

  describe('tool registration', () => {
    it('should register vs_dashboard and vs_context_resume tools', async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain('vs_dashboard');
      expect(toolNames).toContain('vs_context_resume');
      expect(result.tools.length).toBeGreaterThanOrEqual(2);
    });

    it('should define correct schema for vs_dashboard', async () => {
      const result = await client.listTools();
      const dashboard = result.tools.find((t) => t.name === 'vs_dashboard');

      expect(dashboard).toBeDefined();
      expect(dashboard!.inputSchema.type).toBe('object');
    });

    it('should define correct schema for vs_context_resume', async () => {
      const result = await client.listTools();
      const resume = result.tools.find((t) => t.name === 'vs_context_resume');

      expect(resume).toBeDefined();
      expect(resume!.inputSchema.properties).toHaveProperty('session_id');
    });
  });

  describe('vs_dashboard', () => {
    it('should return empty overview when no data exists', async () => {
      const result = await client.callTool({ name: 'vs_dashboard', arguments: {} });
      const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);

      expect(parsed.overview).toBeDefined();
      expect(parsed.alerts).toBeDefined();
      expect(parsed.overview.plans).toHaveLength(0);
      expect(parsed.overview.active_count).toBe(0);
      expect(parsed.alerts).toHaveLength(0);
    });

    it('should return plans and progress data', async () => {
      const planModel = new PlanModel(db);
      const taskModel = new TaskModel(db);
      const plan = planModel.create('Test Plan');
      planModel.activate(plan.id);
      const t1 = taskModel.create(plan.id, 'Task 1');
      taskModel.updateStatus(t1.id, 'done');
      taskModel.create(plan.id, 'Task 2');

      const result = await client.callTool({ name: 'vs_dashboard', arguments: {} });
      const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);

      expect(parsed.overview.plans).toHaveLength(1);
      expect(parsed.overview.active_count).toBe(1);
      expect(parsed.overview.total_tasks).toBe(2);
      expect(parsed.overview.done_tasks).toBe(1);
    });
  });

  describe('vs_context_resume', () => {
    it('should return context logs, overview, and alerts', async () => {
      const result = await client.callTool({
        name: 'vs_context_resume',
        arguments: {},
      });
      const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);

      expect(parsed.context_logs).toBeDefined();
      expect(parsed.overview).toBeDefined();
      expect(parsed.alerts).toBeDefined();
    });

    it('should return recent context logs when no session_id provided', async () => {
      const contextModel = new ContextModel(db);
      contextModel.save('Log 1');
      contextModel.save('Log 2');
      contextModel.save('Log 3');
      contextModel.save('Log 4');

      const result = await client.callTool({
        name: 'vs_context_resume',
        arguments: {},
      });
      const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);

      // getLatest(3) returns most recent 3
      expect(parsed.context_logs).toHaveLength(3);
    });

    it('should filter by session_id when provided', async () => {
      const contextModel = new ContextModel(db);
      contextModel.save('Session log', { sessionId: 'sess-123' });
      contextModel.save('Other log', { sessionId: 'sess-456' });

      const result = await client.callTool({
        name: 'vs_context_resume',
        arguments: { session_id: 'sess-123' },
      });
      const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);

      expect(parsed.context_logs).toHaveLength(1);
      expect(parsed.context_logs[0].summary).toBe('Session log');
    });
  });
});
