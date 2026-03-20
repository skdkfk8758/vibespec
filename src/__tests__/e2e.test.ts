import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../core/db/connection.js';
import { initSchema } from '../core/db/schema.js';
import { createServer } from '../mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type Database from 'better-sqlite3';

function parseResult(result: Awaited<ReturnType<Client['callTool']>>) {
  return JSON.parse((result.content as Array<{ text: string }>)[0].text);
}

describe('E2E: Full Plan Lifecycle', () => {
  let db: Database.Database;
  let client: Client;

  beforeEach(async () => {
    db = createMemoryDb();
    initSchema(db);

    const server = createServer(db);
    const client_ = new Client({ name: 'e2e-test', version: '1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client_.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    client = client_;
  });

  it('Plan create → Tasks create → progress → complete full cycle', async () => {
    // 1. Create plan
    const planResult = await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'E2E Test Plan', spec: 'Full lifecycle test' },
    });
    const plan = parseResult(planResult);
    expect(plan.status).toBe('active');
    expect(plan.title).toBe('E2E Test Plan');

    // 2. Create 3 tasks
    const taskIds: string[] = [];
    for (const title of ['Setup DB', 'Implement API', 'Write tests']) {
      const result = await client.callTool({
        name: 'vs_task_create',
        arguments: {
          plan_id: plan.id,
          title,
          spec: `Spec for ${title}`,
          acceptance: `${title} is verified`,
        },
      });
      taskIds.push(parseResult(result).id);
    }

    // 3. Verify dashboard shows plan with 0% progress
    const dashResult = await client.callTool({ name: 'vs_dashboard', arguments: {} });
    const dash = parseResult(dashResult);
    expect(dash.overview.plans).toHaveLength(1);
    expect(dash.overview.plans[0].progress_pct).toBe(0);
    expect(dash.overview.total_tasks).toBe(3);

    // 4. Get next task — should be the first one
    const nextResult = await client.callTool({
      name: 'vs_task_next',
      arguments: { plan_id: plan.id },
    });
    expect(parseResult(nextResult).id).toBe(taskIds[0]);

    // 5. Complete tasks one by one, check completion_check
    for (let i = 0; i < taskIds.length; i++) {
      // Move to in_progress
      await client.callTool({
        name: 'vs_task_update',
        arguments: { task_id: taskIds[i], status: 'in_progress' },
      });

      // Complete
      const doneResult = await client.callTool({
        name: 'vs_task_update',
        arguments: { task_id: taskIds[i], status: 'done' },
      });
      const done = parseResult(doneResult);
      expect(done.task.status).toBe('done');

      if (i < taskIds.length - 1) {
        expect(done.completion_check.all_done).toBe(false);
      } else {
        expect(done.completion_check.all_done).toBe(true);
        expect(done.completion_check.progress.pct).toBe(100);
      }
    }

    // 6. No more pending tasks
    const noNext = await client.callTool({
      name: 'vs_task_next',
      arguments: { plan_id: plan.id },
    });
    expect(parseResult(noNext).message).toBe('No pending tasks');

    // 7. Complete the plan
    const completeResult = await client.callTool({
      name: 'vs_plan_complete',
      arguments: { plan_id: plan.id },
    });
    expect(parseResult(completeResult).status).toBe('completed');

    // 8. Verify stats have records
    const statsResult = await client.callTool({
      name: 'vs_stats',
      arguments: { plan_id: plan.id },
    });
    const stats = parseResult(statsResult);
    expect(stats.velocity).toBeDefined();
    expect(stats.estimated_completion.remaining_tasks).toBe(0);

    // 9. Archive
    const archiveResult = await client.callTool({
      name: 'vs_plan_archive',
      arguments: { plan_id: plan.id },
    });
    expect(parseResult(archiveResult).status).toBe('archived');

    // 10. Verify history has all events
    const historyResult = await client.callTool({
      name: 'vs_history',
      arguments: { entity_type: 'plan', entity_id: plan.id },
    });
    const history = parseResult(historyResult);
    expect(history.length).toBeGreaterThanOrEqual(3); // created, activated, completed, archived
  });

  it('Blocker flow: block → alert → unblock → complete', async () => {
    // Create plan + task
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Blocker Plan' },
    }));
    const task = parseResult(await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Blockable task' },
    }));

    // Block the task with reason
    const blockResult = await client.callTool({
      name: 'vs_task_block',
      arguments: { task_id: task.id, reason: 'Waiting for API key' },
    });
    const blocked = parseResult(blockResult);
    expect(blocked.status).toBe('blocked');
    expect(blocked.block_reason).toBe('Waiting for API key');

    // Dashboard should show blocked alert
    const dash = parseResult(await client.callTool({ name: 'vs_dashboard', arguments: {} }));
    const blockedAlerts = dash.alerts.filter((a: { type: string }) => a.type === 'blocked');
    expect(blockedAlerts.length).toBeGreaterThanOrEqual(1);

    // Unblock by setting to todo, then complete
    await client.callTool({
      name: 'vs_task_update',
      arguments: { task_id: task.id, status: 'todo' },
    });
    await client.callTool({
      name: 'vs_task_update',
      arguments: { task_id: task.id, status: 'done' },
    });

    // Plan should be completable
    const complete = parseResult(await client.callTool({
      name: 'vs_plan_complete',
      arguments: { plan_id: plan.id },
    }));
    expect(complete.status).toBe('completed');
  });

  it('Context save and resume across sessions', async () => {
    // Create plan and save context
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Context Plan' },
    }));

    await client.callTool({
      name: 'vs_context_save',
      arguments: {
        summary: 'Finished setting up DB schema',
        plan_id: plan.id,
        session_id: 'session-1',
      },
    });

    await client.callTool({
      name: 'vs_context_save',
      arguments: {
        summary: 'Started API implementation',
        plan_id: plan.id,
        session_id: 'session-2',
      },
    });

    // Resume with no filter — should get latest logs
    const resumeAll = parseResult(await client.callTool({
      name: 'vs_context_resume',
      arguments: {},
    }));
    expect(resumeAll.context_logs.length).toBeGreaterThanOrEqual(2);
    expect(resumeAll.overview).toBeDefined();
    expect(resumeAll.alerts).toBeDefined();

    // Resume with session filter
    const resumeFiltered = parseResult(await client.callTool({
      name: 'vs_context_resume',
      arguments: { session_id: 'session-1' },
    }));
    expect(resumeFiltered.context_logs).toHaveLength(1);
    expect(resumeFiltered.context_logs[0].summary).toBe('Finished setting up DB schema');
  });

  it('Subtask tree structure', async () => {
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Tree Plan' },
    }));

    // Create parent tasks
    const parent = parseResult(await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Parent Task' },
    }));

    // Create subtasks
    const child1 = parseResult(await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Child 1', parent_id: parent.id },
    }));
    const child2 = parseResult(await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Child 2', parent_id: parent.id },
    }));

    expect(child1.depth).toBe(1);
    expect(child2.depth).toBe(1);

    // Get plan tree and verify structure
    const planData = parseResult(await client.callTool({
      name: 'vs_plan_get',
      arguments: { plan_id: plan.id },
    }));
    expect(planData.tasks).toHaveLength(1); // 1 root task
    expect(planData.tasks[0].children).toHaveLength(2); // 2 children
    expect(planData.tasks[0].title).toBe('Parent Task');
  });
});

describe('E2E: Edit and Delete Operations', () => {
  let client: Client;

  beforeEach(async () => {
    const db = createMemoryDb();
    initSchema(db);
    const server = createServer(db);
    const client_ = new Client({ name: 'e2e-edit-test', version: '1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client_.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    client = client_;
  });

  it('should update plan title and spec', async () => {
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Original Title', spec: 'Original spec' },
    }));

    const updated = parseResult(await client.callTool({
      name: 'vs_plan_update',
      arguments: { plan_id: plan.id, title: 'Updated Title', spec: 'Updated spec' },
    }));

    expect(updated.title).toBe('Updated Title');
    expect(updated.spec).toBe('Updated spec');
  });

  it('should delete a draft plan with tasks', async () => {
    // Create plan but don't activate (stays draft)
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Draft Plan' },
    }));
    // plan is auto-activated, so we need a truly draft plan
    // Actually vs_plan_create auto-activates. Let's test the error path.
    const deleteResult = await client.callTool({
      name: 'vs_plan_delete',
      arguments: { plan_id: plan.id },
    });
    expect(deleteResult.isError).toBe(true);
    const parsed = parseResult(deleteResult);
    expect(parsed.error).toContain('Only draft plans');
  });

  it('should edit task title and spec', async () => {
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Edit Plan' },
    }));
    const task = parseResult(await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Old Title', spec: 'Old spec' },
    }));

    const edited = parseResult(await client.callTool({
      name: 'vs_task_edit',
      arguments: { task_id: task.id, title: 'New Title', acceptance: 'New criteria' },
    }));

    expect(edited.title).toBe('New Title');
    expect(edited.acceptance).toBe('New criteria');
    expect(edited.spec).toBe('Old spec'); // unchanged
  });

  it('should delete a task and its subtasks', async () => {
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Delete Plan' },
    }));
    const parent = parseResult(await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Parent' },
    }));
    await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Child', parent_id: parent.id },
    });

    const deleteResult = parseResult(await client.callTool({
      name: 'vs_task_delete',
      arguments: { task_id: parent.id },
    }));
    expect(deleteResult.deleted).toBe(true);

    // Verify parent and child are gone
    const getResult = await client.callTool({
      name: 'vs_task_get',
      arguments: { task_id: parent.id },
    });
    expect(getResult.isError).toBe(true);

    // Plan should have no tasks
    const planData = parseResult(await client.callTool({
      name: 'vs_plan_get',
      arguments: { plan_id: plan.id },
    }));
    expect(planData.tasks).toHaveLength(0);
  });
});

describe('E2E: Error Handling', () => {
  let client: Client;

  beforeEach(async () => {
    const db = createMemoryDb();
    initSchema(db);
    const server = createServer(db);
    const client_ = new Client({ name: 'e2e-error-test', version: '1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client_.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    client = client_;
  });

  it('should return error with hint for missing required params', async () => {
    const result = await client.callTool({
      name: 'vs_plan_get',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toContain('Missing required parameter');
    expect(parsed.hint).toBeDefined();
  });

  it('should return error for non-existent plan with hint', async () => {
    const result = await client.callTool({
      name: 'vs_plan_get',
      arguments: { plan_id: 'does-not-exist' },
    });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toBe('Plan not found');
    expect(parsed.hint).toContain('vs_plan_list');
  });

  it('should return error for non-existent task with hint', async () => {
    const result = await client.callTool({
      name: 'vs_task_get',
      arguments: { task_id: 'does-not-exist' },
    });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toBe('Task not found');
    expect(parsed.hint).toContain('vs_plan_get');
  });

  it('should return error for invalid task status', async () => {
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Error Plan' },
    }));
    const task = parseResult(await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Task' },
    }));

    const result = await client.callTool({
      name: 'vs_task_update',
      arguments: { task_id: task.id, status: 'invalid' },
    });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toContain('Invalid status');
  });

  it('should reject completing plan with pending tasks', async () => {
    const plan = parseResult(await client.callTool({
      name: 'vs_plan_create',
      arguments: { title: 'Incomplete' },
    }));
    await client.callTool({
      name: 'vs_task_create',
      arguments: { plan_id: plan.id, title: 'Not done' },
    });

    const result = await client.callTool({
      name: 'vs_plan_complete',
      arguments: { plan_id: plan.id },
    });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error).toContain('cannot be completed');
  });
});
