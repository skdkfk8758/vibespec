// src/mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// src/core/models/plan.ts
import { nanoid } from "nanoid";
var PlanModel = class {
  db;
  events;
  constructor(db, events) {
    this.db = db;
    this.events = events;
  }
  create(title, spec, summary) {
    const id = nanoid(12);
    const stmt = this.db.prepare(
      `INSERT INTO plans (id, title, status, spec, summary) VALUES (?, ?, 'draft', ?, ?)`
    );
    stmt.run(id, title, spec ?? null, summary ?? null);
    const plan = this.getById(id);
    this.events?.record("plan", plan.id, "created", null, JSON.stringify({ title, status: "draft" }));
    return plan;
  }
  getById(id) {
    const stmt = this.db.prepare(`SELECT * FROM plans WHERE id = ?`);
    const row = stmt.get(id);
    return row ?? null;
  }
  list(filter) {
    if (filter?.status) {
      const stmt2 = this.db.prepare(`SELECT * FROM plans WHERE status = ? ORDER BY created_at DESC`);
      return stmt2.all(filter.status);
    }
    const stmt = this.db.prepare(`SELECT * FROM plans ORDER BY created_at DESC`);
    return stmt.all();
  }
  update(id, fields) {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    const sets = [];
    const values = [];
    if (fields.title !== void 0) {
      sets.push("title = ?");
      values.push(fields.title);
    }
    if (fields.summary !== void 0) {
      sets.push("summary = ?");
      values.push(fields.summary);
    }
    if (fields.spec !== void 0) {
      sets.push("spec = ?");
      values.push(fields.spec);
    }
    if (sets.length === 0) return plan;
    const oldFields = {};
    const newFields = {};
    for (const key of Object.keys(fields)) {
      if (fields[key] !== void 0) {
        oldFields[key] = plan[key];
        newFields[key] = fields[key];
      }
    }
    values.push(id);
    const stmt = this.db.prepare(`UPDATE plans SET ${sets.join(", ")} WHERE id = ?`);
    stmt.run(...values);
    this.events?.record("plan", id, "updated", JSON.stringify(oldFields), JSON.stringify(newFields));
    return this.getById(id);
  }
  activate(id) {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan.status;
    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run("active", id);
    this.events?.record("plan", id, "activated", JSON.stringify({ status: oldStatus }), JSON.stringify({ status: "active" }));
    return this.getById(id);
  }
  complete(id) {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan.status;
    const stmt = this.db.prepare(
      `UPDATE plans SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
    );
    stmt.run(id);
    this.events?.record("plan", id, "completed", JSON.stringify({ status: oldStatus }), JSON.stringify({ status: "completed" }));
    return this.getById(id);
  }
  delete(id) {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    if (plan.status !== "draft") {
      throw new Error(`Only draft plans can be deleted. Current status: ${plan.status}`);
    }
    this.db.prepare(
      "DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE plan_id = ?)"
    ).run(id);
    this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(id);
    this.db.prepare("DELETE FROM tasks WHERE plan_id = ?").run(id);
    this.db.prepare("DELETE FROM plans WHERE id = ?").run(id);
  }
  approve(id) {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    if (plan.status !== "active") {
      throw new Error(`Only active plans can be approved. Current status: ${plan.status}`);
    }
    const oldStatus = plan.status;
    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run("approved", id);
    this.events?.record("plan", id, "approved", JSON.stringify({ status: oldStatus }), JSON.stringify({ status: "approved" }));
    return this.getById(id);
  }
  archive(id) {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan.status;
    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run("archived", id);
    this.events?.record("plan", id, "archived", JSON.stringify({ status: oldStatus }), JSON.stringify({ status: "archived" }));
    return this.getById(id);
  }
};

// src/core/models/task.ts
import { nanoid as nanoid2 } from "nanoid";
var TaskModel = class {
  constructor(db, events) {
    this.db = db;
    this.events = events;
  }
  events;
  create(planId, title, opts) {
    const id = nanoid2(12);
    let depth = 0;
    if (opts?.parentId) {
      const parent = this.getById(opts.parentId);
      if (!parent) {
        throw new Error(`Parent task not found: ${opts.parentId}`);
      }
      depth = parent.depth + 1;
    }
    const sortOrder = opts?.sortOrder ?? 0;
    this.db.prepare(
      `INSERT INTO tasks (id, plan_id, parent_id, title, status, depth, sort_order, spec, acceptance)
         VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?)`
    ).run(
      id,
      planId,
      opts?.parentId ?? null,
      title,
      depth,
      sortOrder,
      opts?.spec ?? null,
      opts?.acceptance ?? null
    );
    const task = this.getById(id);
    this.events?.record("task", task.id, "created", null, JSON.stringify({ title, status: "todo" }));
    return task;
  }
  getById(id) {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    return row ?? null;
  }
  getTree(planId) {
    const rows = this.db.prepare(
      `WITH RECURSIVE task_tree AS (
           SELECT * FROM tasks WHERE plan_id = ? AND parent_id IS NULL
           UNION ALL
           SELECT t.* FROM tasks t
           INNER JOIN task_tree tt ON t.parent_id = tt.id
         )
         SELECT * FROM task_tree ORDER BY depth, sort_order`
    ).all(planId);
    return this.buildTree(rows);
  }
  buildTree(tasks) {
    const map = /* @__PURE__ */ new Map();
    const roots = [];
    for (const task of tasks) {
      map.set(task.id, { ...task, children: [] });
    }
    for (const task of tasks) {
      const node = map.get(task.id);
      if (task.parent_id === null) {
        roots.push(node);
      } else {
        const parent = map.get(task.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      }
    }
    return roots;
  }
  getChildren(parentId) {
    return this.db.prepare("SELECT * FROM tasks WHERE parent_id = ? ORDER BY sort_order").all(parentId);
  }
  update(id, fields) {
    const setClauses = [];
    const values = [];
    if (fields.title !== void 0) {
      setClauses.push("title = ?");
      values.push(fields.title);
    }
    if (fields.spec !== void 0) {
      setClauses.push("spec = ?");
      values.push(fields.spec);
    }
    if (fields.acceptance !== void 0) {
      setClauses.push("acceptance = ?");
      values.push(fields.acceptance);
    }
    if (fields.sort_order !== void 0) {
      setClauses.push("sort_order = ?");
      values.push(fields.sort_order);
    }
    if (setClauses.length === 0) {
      return this.getById(id);
    }
    values.push(id);
    this.db.prepare(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
    return this.getById(id);
  }
  updateStatus(id, status) {
    const oldTask = this.getById(id);
    const oldStatus = oldTask?.status;
    const completedAt = status === "done" ? (/* @__PURE__ */ new Date()).toISOString() : null;
    this.db.prepare("UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?").run(status, completedAt, id);
    this.events?.record("task", id, "status_changed", JSON.stringify({ status: oldStatus }), JSON.stringify({ status }));
    return this.getById(id);
  }
  delete(id) {
    const task = this.getById(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    this.db.prepare(
      "DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE parent_id = ?)"
    ).run(id);
    this.db.prepare("DELETE FROM tasks WHERE parent_id = ?").run(id);
    this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(id);
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    this.events?.record("task", id, "deleted", JSON.stringify({ title: task.title }), null);
  }
  getByPlan(planId, filter) {
    if (filter?.status) {
      return this.db.prepare(
        "SELECT * FROM tasks WHERE plan_id = ? AND status = ? ORDER BY depth, sort_order"
      ).all(planId, filter.status);
    }
    return this.db.prepare(
      "SELECT * FROM tasks WHERE plan_id = ? ORDER BY depth, sort_order"
    ).all(planId);
  }
};

// src/core/models/event.ts
var EventModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  record(entityType, entityId, eventType, oldValue, newValue, sessionId) {
    const stmt = this.db.prepare(
      `INSERT INTO events (entity_type, entity_id, event_type, old_value, new_value, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      entityType,
      entityId,
      eventType,
      oldValue ?? null,
      newValue ?? null,
      sessionId ?? null
    );
    return this.db.prepare(`SELECT * FROM events WHERE id = ?`).get(result.lastInsertRowid);
  }
  getByEntity(entityType, entityId) {
    const stmt = this.db.prepare(
      `SELECT * FROM events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC, id ASC`
    );
    return stmt.all(entityType, entityId);
  }
  getBySession(sessionId) {
    const stmt = this.db.prepare(
      `SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC, id ASC`
    );
    return stmt.all(sessionId);
  }
  getRecent(limit = 20) {
    const stmt = this.db.prepare(
      `SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT ?`
    );
    return stmt.all(limit);
  }
};

// src/core/models/context.ts
var ContextModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  save(summary, opts) {
    const stmt = this.db.prepare(
      `INSERT INTO context_log (summary, plan_id, session_id, last_task_id)
       VALUES (?, ?, ?, ?)`
    );
    const result = stmt.run(
      summary,
      opts?.planId ?? null,
      opts?.sessionId ?? null,
      opts?.lastTaskId ?? null
    );
    return this.db.prepare(`SELECT * FROM context_log WHERE id = ?`).get(result.lastInsertRowid);
  }
  getLatest(limit = 5) {
    const stmt = this.db.prepare(
      `SELECT * FROM context_log ORDER BY created_at DESC, id DESC LIMIT ?`
    );
    return stmt.all(limit);
  }
  getByPlan(planId) {
    const stmt = this.db.prepare(
      `SELECT * FROM context_log WHERE plan_id = ? ORDER BY created_at DESC, id DESC`
    );
    return stmt.all(planId);
  }
  getBySession(sessionId) {
    const stmt = this.db.prepare(
      `SELECT * FROM context_log WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`
    );
    return stmt.get(sessionId) ?? null;
  }
};

// src/core/models/task-metrics.ts
var TaskMetricsModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  record(taskId, planId, finalStatus, metrics) {
    const durationMin = this.calculateDuration(taskId);
    const blockReason = this.extractBlockReason(taskId, finalStatus);
    this.db.prepare(
      `INSERT OR REPLACE INTO task_metrics
         (task_id, plan_id, duration_min, final_status, block_reason, impl_status, test_count, files_changed, has_concerns)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      taskId,
      planId,
      durationMin,
      finalStatus,
      blockReason,
      metrics?.impl_status ?? null,
      metrics?.test_count ?? null,
      metrics?.files_changed ?? null,
      metrics?.has_concerns ? 1 : 0
    );
    return this.getByTask(taskId);
  }
  getByTask(taskId) {
    const row = this.db.prepare("SELECT * FROM task_metrics WHERE task_id = ?").get(taskId);
    return row ?? null;
  }
  getByPlan(planId) {
    return this.db.prepare("SELECT * FROM task_metrics WHERE plan_id = ? ORDER BY created_at ASC").all(planId);
  }
  calculateDuration(taskId) {
    const row = this.db.prepare(
      `SELECT created_at FROM events
         WHERE entity_type = 'task'
           AND entity_id = ?
           AND event_type = 'status_changed'
           AND JSON_EXTRACT(new_value, '$.status') = 'in_progress'
         ORDER BY created_at DESC
         LIMIT 1`
    ).get(taskId);
    if (!row) return null;
    const startTime = new Date(row.created_at).getTime();
    const now = Date.now();
    const diffMin = (now - startTime) / (1e3 * 60);
    return Math.round(diffMin * 100) / 100;
  }
  extractBlockReason(taskId, finalStatus) {
    const row = this.db.prepare(
      `SELECT new_value FROM events
         WHERE entity_type = 'task'
           AND entity_id = ?
           AND event_type = 'blocked_reason'
         ORDER BY created_at DESC
         LIMIT 1`
    ).get(taskId);
    if (row?.new_value) {
      try {
        const parsed = JSON.parse(row.new_value);
        if (parsed.reason) return parsed.reason;
      } catch {
      }
    }
    if (finalStatus === "blocked") return "unspecified";
    return null;
  }
};

// src/core/engine/dashboard.ts
var DashboardEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  getOverview() {
    const plans = this.db.prepare("SELECT * FROM plan_progress").all();
    const active_count = plans.filter((p) => p.status === "active").length;
    const total_tasks = plans.reduce((sum, p) => sum + p.total_tasks, 0);
    const done_tasks = plans.reduce((sum, p) => sum + p.done_tasks, 0);
    return { plans, active_count, total_tasks, done_tasks };
  }
  getPlanSummary(planId) {
    const row = this.db.prepare("SELECT * FROM plan_progress WHERE id = ?").get(planId);
    return row ?? null;
  }
};

// src/core/engine/alerts.ts
var AlertsEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  getAlerts() {
    const alerts = [];
    for (const task of this.getStaleTasks()) {
      alerts.push({
        type: "stale",
        entity_type: "task",
        entity_id: task.id,
        message: `Task "${task.title}" has been in progress for ${task.days_stale} days with no activity`
      });
    }
    for (const plan of this.getBlockedPlans()) {
      alerts.push({
        type: "blocked",
        entity_type: "plan",
        entity_id: plan.id,
        message: `Plan "${plan.title}" has ${plan.blocked_tasks} blocked task(s)`
      });
    }
    for (const plan of this.getCompletablePlans()) {
      alerts.push({
        type: "completable",
        entity_type: "plan",
        entity_id: plan.id,
        message: `Plan "${plan.title}" has all tasks done and can be completed`
      });
    }
    for (const plan of this.getForgottenPlans()) {
      alerts.push({
        type: "forgotten",
        entity_type: "plan",
        entity_id: plan.id,
        message: `Plan "${plan.title}" has had no activity for ${plan.days_inactive} days`
      });
    }
    return alerts;
  }
  getStaleTasks(thresholdDays = 3) {
    const rows = this.db.prepare(
      `SELECT t.*, CAST(JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) AS INTEGER) AS days_stale
         FROM tasks t
         JOIN events e ON e.entity_id = t.id
         WHERE t.status = 'in_progress'
         GROUP BY t.id
         HAVING JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) > ?`
    ).all(thresholdDays);
    return rows;
  }
  getBlockedPlans() {
    return this.db.prepare("SELECT * FROM plan_progress WHERE blocked_tasks > 0").all();
  }
  getCompletablePlans() {
    return this.db.prepare(
      "SELECT * FROM plan_progress WHERE progress_pct = 100 AND status = 'active'"
    ).all();
  }
  getForgottenPlans(thresholdDays = 7) {
    const rows = this.db.prepare(
      `SELECT p.*, CAST(JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) AS INTEGER) AS days_inactive
         FROM plans p
         JOIN events e ON (
           e.entity_id = p.id
           OR e.entity_id IN (SELECT id FROM tasks WHERE plan_id = p.id)
         )
         WHERE p.status = 'active'
         GROUP BY p.id
         HAVING JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) > ?`
    ).all(thresholdDays);
    return rows;
  }
};

// src/core/engine/lifecycle.ts
var LifecycleEngine = class {
  db;
  planModel;
  taskModel;
  events;
  constructor(db, planModel, taskModel, events) {
    this.db = db;
    this.planModel = planModel;
    this.taskModel = taskModel;
    this.events = events;
  }
  canComplete(planId) {
    const allTasks = this.taskModel.getByPlan(planId);
    const leafTasks = this.getLeafTasks(allTasks);
    const blockers = leafTasks.filter((t) => t.status !== "done" && t.status !== "skipped").map((t) => t.title);
    return {
      completable: blockers.length === 0,
      blockers
    };
  }
  completePlan(planId) {
    const { completable, blockers } = this.canComplete(planId);
    if (!completable) {
      throw new Error(
        `Plan cannot be completed. Blockers: ${blockers.join(", ")}`
      );
    }
    const plan = this.planModel.complete(planId);
    this.events?.record(
      "plan",
      planId,
      "lifecycle_completed",
      null,
      JSON.stringify({ status: "completed" })
    );
    return plan;
  }
  autoCheckCompletion(planId) {
    const allTasks = this.taskModel.getByPlan(planId);
    const leafTasks = this.getLeafTasks(allTasks);
    const total = leafTasks.length;
    const done = leafTasks.filter(
      (t) => t.status === "done" || t.status === "skipped"
    ).length;
    const pct = total === 0 ? 100 : Math.round(done / total * 100);
    return {
      all_done: total > 0 && done === total,
      progress: { total, done, pct }
    };
  }
  getLeafTasks(tasks) {
    const parentIds = new Set(
      tasks.filter((t) => t.parent_id !== null).map((t) => t.parent_id)
    );
    return tasks.filter((t) => !parentIds.has(t.id));
  }
};

// src/core/engine/stats.ts
var StatsEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  getVelocity(planId, days = 7) {
    const cutoff = /* @__PURE__ */ new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    let query;
    const params = [];
    if (planId) {
      query = `
        SELECT COUNT(*) AS total_completed
        FROM events e
        JOIN tasks t ON e.entity_id = t.id
        WHERE e.event_type = 'status_changed'
          AND JSON_EXTRACT(e.new_value, '$.status') = 'done'
          AND DATE(e.created_at) >= ?
          AND t.plan_id = ?
      `;
      params.push(cutoffStr, planId);
    } else {
      query = `
        SELECT COUNT(*) AS total_completed
        FROM events
        WHERE event_type = 'status_changed'
          AND JSON_EXTRACT(new_value, '$.status') = 'done'
          AND DATE(created_at) >= ?
      `;
      params.push(cutoffStr);
    }
    const row = this.db.prepare(query).get(...params);
    const total_completed = row.total_completed;
    const daily = total_completed / days;
    return { daily, total_completed };
  }
  getEstimatedCompletion(planId) {
    const remainingRow = this.db.prepare(
      `SELECT COUNT(*) AS remaining
         FROM tasks
         WHERE plan_id = ?
           AND status NOT IN ('done', 'skipped')`
    ).get(planId);
    const remaining_tasks = remainingRow.remaining;
    const { daily: velocity } = this.getVelocity(planId);
    if (velocity === 0) {
      return {
        remaining_tasks,
        velocity,
        estimated_days: null,
        estimated_date: null
      };
    }
    const estimated_days = Math.ceil(remaining_tasks / velocity);
    const estimatedDate = /* @__PURE__ */ new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimated_days);
    const estimated_date = estimatedDate.toISOString().split("T")[0];
    return {
      remaining_tasks,
      velocity,
      estimated_days,
      estimated_date
    };
  }
  getTimeline(planId) {
    let query;
    const params = [];
    if (planId) {
      query = `
        SELECT DATE(e.created_at) AS date, COUNT(*) AS tasks_completed
        FROM events e
        JOIN tasks t ON e.entity_id = t.id
        WHERE e.event_type = 'status_changed'
          AND JSON_EXTRACT(e.new_value, '$.status') = 'done'
          AND t.plan_id = ?
        GROUP BY DATE(e.created_at)
        ORDER BY DATE(e.created_at)
      `;
      params.push(planId);
    } else {
      query = `
        SELECT DATE(created_at) AS date, COUNT(*) AS tasks_completed
        FROM events
        WHERE event_type = 'status_changed'
          AND JSON_EXTRACT(new_value, '$.status') = 'done'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;
    }
    const rows = this.db.prepare(query).all(...params);
    let cumulative = 0;
    return rows.map((row) => {
      cumulative += row.tasks_completed;
      return {
        date: row.date,
        tasks_completed: row.tasks_completed,
        cumulative
      };
    });
  }
};

// src/core/engine/insights.ts
var InsightsEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  getBlockedPatterns() {
    const rows = this.db.prepare(
      `SELECT
           COALESCE(block_reason, 'unspecified') AS reason,
           COUNT(*) AS count
         FROM task_metrics
         WHERE final_status = 'blocked'
         GROUP BY reason
         ORDER BY count DESC`
    ).all();
    if (rows.length === 0) return [];
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return rows.map((r) => ({
      reason: r.reason,
      count: r.count,
      pct: Math.round(r.count / total * 100)
    }));
  }
  getDurationStats() {
    const statsRow = this.db.prepare(
      `SELECT
           ROUND(AVG(duration_min), 1) AS avg_min,
           COUNT(*) AS sample_count
         FROM task_metrics
         WHERE duration_min IS NOT NULL`
    ).get();
    const sampleCount = statsRow.sample_count;
    if (sampleCount === 0) {
      return { avg_min: 0, median_min: 0, sample_count: 0 };
    }
    const avgMin = statsRow.avg_min ?? 0;
    let medianMin;
    if (sampleCount % 2 === 1) {
      const offset = Math.floor(sampleCount / 2);
      const row = this.db.prepare(
        `SELECT duration_min
           FROM task_metrics
           WHERE duration_min IS NOT NULL
           ORDER BY duration_min
           LIMIT 1 OFFSET ?`
      ).get(offset);
      medianMin = row.duration_min;
    } else {
      const offset = sampleCount / 2 - 1;
      const rows = this.db.prepare(
        `SELECT duration_min
           FROM task_metrics
           WHERE duration_min IS NOT NULL
           ORDER BY duration_min
           LIMIT 2 OFFSET ?`
      ).all(offset);
      medianMin = (rows[0].duration_min + rows[1].duration_min) / 2;
    }
    return { avg_min: avgMin, median_min: medianMin, sample_count: sampleCount };
  }
  getSuccessRates() {
    const overallRow = this.db.prepare(
      `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN final_status = 'done' THEN 1 ELSE 0 END) AS done
         FROM task_metrics
         WHERE final_status IN ('done', 'blocked', 'skipped')`
    ).get();
    const overall = overallRow.total > 0 ? Math.round(overallRow.done / overallRow.total * 100) : 0;
    const byPlanRows = this.db.prepare(
      `SELECT
           p.title,
           COUNT(*) AS count,
           SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done
         FROM task_metrics tm
         JOIN plans p ON p.id = tm.plan_id
         WHERE tm.final_status IN ('done', 'blocked', 'skipped')
         GROUP BY tm.plan_id`
    ).all();
    const by_plan = byPlanRows.map((r) => ({
      title: r.title,
      rate: Math.round(r.done / r.count * 100),
      count: r.count
    }));
    return { overall, by_plan };
  }
  getRecommendations() {
    const totalRow = this.db.prepare("SELECT COUNT(*) AS total FROM task_metrics").get();
    if (totalRow.total < 5) return [];
    const recommendations = [];
    const total = totalRow.total;
    const blockedRow = this.db.prepare("SELECT COUNT(*) AS blocked FROM task_metrics WHERE final_status = 'blocked'").get();
    const blockedPct = Math.round(blockedRow.blocked / total * 100);
    if (blockedPct >= 30) {
      recommendations.push(
        `Blocked \uD0DC\uC2A4\uD06C \uBE44\uC728\uC774 ${blockedPct}%\uB85C \uB192\uC2B5\uB2C8\uB2E4. \uD0DC\uC2A4\uD06C \uBD84\uD574\uB97C \uB354 \uC138\uBD84\uD654\uD558\uAC70\uB098 \uC758\uC874\uC131\uC744 \uC0AC\uC804\uC5D0 \uD655\uC778\uD558\uC138\uC694.`
      );
    }
    const durationRow = this.db.prepare(
      `SELECT ROUND(AVG(duration_min), 1) AS avg_min
         FROM task_metrics
         WHERE duration_min IS NOT NULL`
    ).get();
    if (durationRow.avg_min !== null && durationRow.avg_min > 60) {
      recommendations.push(
        `\uD3C9\uADE0 \uD0DC\uC2A4\uD06C \uC18C\uC694 \uC2DC\uAC04\uC774 ${durationRow.avg_min}\uBD84\uC785\uB2C8\uB2E4. \uD0DC\uC2A4\uD06C\uB97C \uB354 \uC791\uC740 \uB2E8\uC704\uB85C \uBD84\uD574\uD558\uB294 \uAC83\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.`
      );
    }
    const concernsRow = this.db.prepare("SELECT SUM(CASE WHEN has_concerns = 1 THEN 1 ELSE 0 END) AS concerns FROM task_metrics").get();
    const concernsPct = Math.round(concernsRow.concerns / total * 100);
    if (concernsPct >= 50) {
      recommendations.push(
        `\uAD6C\uD604 \uC6B0\uB824\uC0AC\uD56D\uC774 ${concernsPct}%\uC758 \uD0DC\uC2A4\uD06C\uC5D0\uC11C \uBC1C\uACAC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC2A4\uD399 \uBA85\uD655\uD654\uAC00 \uD544\uC694\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`
      );
    }
    return recommendations;
  }
  getConfidenceLevel() {
    const row = this.db.prepare("SELECT COUNT(*) AS total FROM task_metrics").get();
    if (row.total < 5) return "low";
    if (row.total < 20) return "medium";
    return "high";
  }
};

// src/core/db/connection.ts
import Database from "better-sqlite3";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
var _db = null;
function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, ".git"))) return dir;
    dir = dirname(dir);
  }
  return startDir;
}
function resolveDbPath() {
  if (process.env.VIBESPEC_DB_PATH) {
    return process.env.VIBESPEC_DB_PATH;
  }
  const root = findProjectRoot(process.cwd());
  return resolve(root, "vibespec.db");
}
function getDb(dbPath) {
  if (_db) return _db;
  const path = dbPath ?? resolveDbPath();
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

// src/core/db/schema.ts
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL CHECK(status IN ('draft','active','completed','archived')) DEFAULT 'draft',
      summary     TEXT,
      spec        TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY,
      plan_id     TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      parent_id   TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL CHECK(status IN ('todo','in_progress','done','blocked','skipped')) DEFAULT 'todo',
      depth       INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      spec        TEXT,
      acceptance  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      session_id  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS context_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id     TEXT REFERENCES plans(id),
      session_id  TEXT,
      summary     TEXT NOT NULL,
      last_task_id TEXT REFERENCES tasks(id),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIEW IF NOT EXISTS plan_progress AS
    SELECT
      p.id,
      p.title,
      p.status,
      COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_tasks,
      SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS active_tasks,
      SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_tasks,
      ROUND(
        SUM(CASE WHEN t.status = 'done' THEN 1.0 ELSE 0 END)
        / MAX(COUNT(t.id), 1) * 100
      ) AS progress_pct
    FROM plans p
    LEFT JOIN tasks t ON t.plan_id = p.id
    WHERE p.status IN ('active', 'draft')
    GROUP BY p.id;

    CREATE TABLE IF NOT EXISTS task_metrics (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id         TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
      plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      duration_min    REAL,
      final_status    TEXT NOT NULL,
      block_reason    TEXT,
      impl_status     TEXT,
      test_count      INTEGER,
      files_changed   INTEGER,
      has_concerns    BOOLEAN DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIEW IF NOT EXISTS plan_metrics AS
    SELECT
      p.id,
      p.title,
      p.status,
      COUNT(tm.id) AS recorded_tasks,
      ROUND(AVG(tm.duration_min), 2) AS avg_duration_min,
      SUM(CASE WHEN tm.final_status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count,
      SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done_count,
      SUM(CASE WHEN tm.has_concerns = 1 THEN 1 ELSE 0 END) AS concern_count,
      ROUND(
        SUM(CASE WHEN tm.final_status = 'done' THEN 1.0 ELSE 0 END)
        / MAX(COUNT(tm.id), 1) * 100
      ) AS success_rate
    FROM plans p
    JOIN task_metrics tm ON tm.plan_id = p.id
    WHERE p.status IN ('completed', 'archived')
    GROUP BY p.id;

    CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_context_log_plan ON context_log(plan_id);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_plan_id ON task_metrics(plan_id);
    CREATE INDEX IF NOT EXISTS idx_task_metrics_task_id ON task_metrics(task_id);
  `);
}

// src/mcp/server.ts
import { createRequire } from "module";
var require2 = createRequire(import.meta.url);
var pkg = require2("../../package.json");
var VALID_STATUSES = ["todo", "in_progress", "done", "blocked", "skipped"];
function ok(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}
function err(error, hint) {
  return {
    content: [{ type: "text", text: JSON.stringify(hint ? { error, hint } : { error }) }],
    isError: true
  };
}
function requireArgs(args, required) {
  const safeArgs = args ?? {};
  for (const key of required) {
    if (safeArgs[key] === void 0 || safeArgs[key] === null || safeArgs[key] === "") {
      return {
        valid: false,
        response: err(
          `Missing required parameter: ${key}`,
          `Required parameters: ${required.join(", ")}`
        )
      };
    }
  }
  return { valid: true, parsed: safeArgs };
}
function createServer(db) {
  const eventModel = new EventModel(db);
  const planModel = new PlanModel(db, eventModel);
  const taskModel = new TaskModel(db, eventModel);
  const contextModel = new ContextModel(db);
  const taskMetricsModel = new TaskMetricsModel(db);
  const dashboardEngine = new DashboardEngine(db);
  const alertsEngine = new AlertsEngine(db);
  const lifecycleEngine = new LifecycleEngine(db, planModel, taskModel, eventModel);
  const statsEngine = new StatsEngine(db);
  const insightsEngine = new InsightsEngine(db);
  const server = new Server(
    { name: "vibespec", version: pkg.version },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "vp_dashboard",
          description: "Get overview of all active plans with progress and alerts",
          inputSchema: { type: "object", properties: {}, required: [] }
        },
        {
          name: "vp_context_resume",
          description: "Resume context from previous sessions with recent context logs, dashboard overview, and alerts",
          inputSchema: {
            type: "object",
            properties: {
              session_id: {
                type: "string",
                description: "Optional session ID to filter context logs"
              }
            },
            required: []
          }
        },
        {
          name: "vp_plan_create",
          description: "Create a new plan and activate it",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Plan title" },
              spec: { type: "string", description: "Optional plan specification" },
              summary: { type: "string", description: "Optional plan summary" }
            },
            required: ["title"]
          }
        },
        {
          name: "vp_plan_get",
          description: "Get a plan by ID with its task tree",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "Plan ID" }
            },
            required: ["plan_id"]
          }
        },
        {
          name: "vp_plan_complete",
          description: "Complete a plan if all tasks are done",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "Plan ID" }
            },
            required: ["plan_id"]
          }
        },
        {
          name: "vp_plan_archive",
          description: "Archive a plan",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "Plan ID" }
            },
            required: ["plan_id"]
          }
        },
        {
          name: "vp_plan_approve",
          description: "Approve a plan after spec review (changes status from active to approved)",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "Plan ID" }
            },
            required: ["plan_id"]
          }
        },
        {
          name: "vp_plan_list",
          description: "List plans, optionally filtered by status",
          inputSchema: {
            type: "object",
            properties: {
              status: { type: "string", description: "Optional status filter" }
            },
            required: []
          }
        },
        {
          name: "vp_task_create",
          description: "Create a new task within a plan",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "Plan ID to add task to" },
              title: { type: "string", description: "Task title" },
              parent_id: { type: "string", description: "Optional parent task ID for subtasks" },
              spec: { type: "string", description: "Optional task specification" },
              acceptance: { type: "string", description: "Optional acceptance criteria" }
            },
            required: ["plan_id", "title"]
          }
        },
        {
          name: "vp_task_update",
          description: "Update a task status",
          inputSchema: {
            type: "object",
            properties: {
              task_id: { type: "string", description: "Task ID" },
              status: { type: "string", description: "New status: todo, in_progress, done, blocked, skipped" },
              metrics: {
                type: "object",
                description: "Optional implementation metrics to record",
                properties: {
                  impl_status: { type: "string", description: "DONE, DONE_WITH_CONCERNS, or BLOCKED" },
                  test_count: { type: "number", description: "Number of tests written" },
                  files_changed: { type: "number", description: "Number of files changed" },
                  has_concerns: { type: "boolean", description: "Whether there are concerns" }
                }
              }
            },
            required: ["task_id", "status"]
          }
        },
        {
          name: "vp_task_get",
          description: "Get a task by ID",
          inputSchema: {
            type: "object",
            properties: {
              task_id: { type: "string", description: "Task ID" }
            },
            required: ["task_id"]
          }
        },
        {
          name: "vp_task_next",
          description: "Get the next pending (todo) task for a plan",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "Plan ID" }
            },
            required: ["plan_id"]
          }
        },
        {
          name: "vp_task_block",
          description: "Mark a task as blocked with an optional reason",
          inputSchema: {
            type: "object",
            properties: {
              task_id: { type: "string", description: "Task ID" },
              reason: { type: "string", description: "Optional reason for blocking" }
            },
            required: ["task_id"]
          }
        },
        {
          name: "vp_plan_update",
          description: "Update a plan title, spec, or summary",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "Plan ID" },
              title: { type: "string", description: "New title" },
              spec: { type: "string", description: "New spec" },
              summary: { type: "string", description: "New summary" }
            },
            required: ["plan_id"]
          }
        },
        {
          name: "vp_plan_delete",
          description: "Delete a draft plan and all its tasks",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: { type: "string", description: "Plan ID (must be in draft status)" }
            },
            required: ["plan_id"]
          }
        },
        {
          name: "vp_task_edit",
          description: "Edit a task title, spec, or acceptance criteria",
          inputSchema: {
            type: "object",
            properties: {
              task_id: { type: "string", description: "Task ID" },
              title: { type: "string", description: "New title" },
              spec: { type: "string", description: "New spec" },
              acceptance: { type: "string", description: "New acceptance criteria" }
            },
            required: ["task_id"]
          }
        },
        {
          name: "vp_task_delete",
          description: "Delete a task and its subtasks",
          inputSchema: {
            type: "object",
            properties: {
              task_id: { type: "string", description: "Task ID" }
            },
            required: ["task_id"]
          }
        },
        {
          name: "vp_context_save",
          description: "Save a context log entry for the current session",
          inputSchema: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Summary of the context to save" },
              plan_id: { type: "string", description: "Optional plan ID to link context to" },
              session_id: { type: "string", description: "Optional session ID" }
            },
            required: ["summary"]
          }
        },
        {
          name: "vp_stats",
          description: "Get velocity statistics and optionally estimated completion for a plan",
          inputSchema: {
            type: "object",
            properties: {
              plan_id: {
                type: "string",
                description: "Optional plan ID to get plan-specific stats and estimated completion"
              }
            },
            required: []
          }
        },
        {
          name: "vp_history",
          description: "Get event history for a specific entity",
          inputSchema: {
            type: "object",
            properties: {
              entity_type: {
                type: "string",
                description: 'Type of entity (e.g. "plan", "task")'
              },
              entity_id: { type: "string", description: "ID of the entity" }
            },
            required: ["entity_type", "entity_id"]
          }
        },
        {
          name: "vp_insights",
          description: "Get learning insights from task completion history \u2014 blocked patterns, duration stats, success rates, and recommendations",
          inputSchema: {
            type: "object",
            properties: {
              scope: {
                type: "string",
                description: "What insights to return: blocked_patterns, duration_stats, success_rates, or all (default: all)"
              }
            },
            required: []
          }
        }
      ]
    };
  });
  function getPlanOrError(planId) {
    const plan = planModel.getById(planId);
    if (!plan) {
      return { found: false, response: err("Plan not found", "Use vp_plan_list to see available plans") };
    }
    return { found: true, plan };
  }
  function getTaskOrError(taskId) {
    const task = taskModel.getById(taskId);
    if (!task) {
      return { found: false, response: err("Task not found", "Use vp_plan_get with a plan_id to see its tasks") };
    }
    return { found: true, task };
  }
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case "vp_dashboard": {
        const overview = dashboardEngine.getOverview();
        const alerts = alertsEngine.getAlerts();
        return ok({ overview, alerts });
      }
      case "vp_context_resume": {
        const sessionId = args?.session_id;
        const contextLogs = sessionId ? [contextModel.getBySession(sessionId)].filter(Boolean) : contextModel.getLatest(3);
        const overview = dashboardEngine.getOverview();
        const alerts = alertsEngine.getAlerts();
        return ok({ context_logs: contextLogs, overview, alerts });
      }
      case "vp_plan_create": {
        const check = requireArgs(
          args,
          ["title"]
        );
        if (!check.valid) return check.response;
        const { title, spec, summary } = check.parsed;
        const plan = planModel.create(title, spec, summary);
        const activePlan = planModel.activate(plan.id);
        return ok(activePlan);
      }
      case "vp_plan_get": {
        const check = requireArgs(args, ["plan_id"]);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        const tasks = taskModel.getTree(check.parsed.plan_id);
        return ok({ plan: result.plan, tasks });
      }
      case "vp_plan_complete": {
        const check = requireArgs(args, ["plan_id"]);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        try {
          const completed = lifecycleEngine.completePlan(check.parsed.plan_id);
          return ok(completed);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }
      case "vp_plan_archive": {
        const check = requireArgs(args, ["plan_id"]);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        const archived = planModel.archive(check.parsed.plan_id);
        return ok(archived);
      }
      case "vp_plan_approve": {
        const check = requireArgs(args, ["plan_id"]);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        try {
          const approved = planModel.approve(check.parsed.plan_id);
          return ok(approved);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }
      case "vp_plan_list": {
        const { status } = args ?? {};
        const filter = status ? { status } : void 0;
        const plans = planModel.list(filter);
        return ok(plans);
      }
      case "vp_plan_update": {
        const check = requireArgs(
          args,
          ["plan_id"]
        );
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        const { plan_id: _pid, ...fields } = check.parsed;
        const updated = planModel.update(check.parsed.plan_id, fields);
        return ok(updated);
      }
      case "vp_plan_delete": {
        const check = requireArgs(args, ["plan_id"]);
        if (!check.valid) return check.response;
        const result = getPlanOrError(check.parsed.plan_id);
        if (!result.found) return result.response;
        try {
          planModel.delete(check.parsed.plan_id);
          return ok({ deleted: true, plan_id: check.parsed.plan_id });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }
      case "vp_task_create": {
        const check = requireArgs(args, ["plan_id", "title"]);
        if (!check.valid) return check.response;
        const { plan_id, title, parent_id, spec, acceptance } = check.parsed;
        try {
          const task = taskModel.create(plan_id, title, {
            parentId: parent_id,
            spec,
            acceptance
          });
          return ok(task);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }
      case "vp_task_update": {
        const check = requireArgs(
          args,
          ["task_id", "status"]
        );
        if (!check.valid) return check.response;
        const { task_id, status, metrics } = check.parsed;
        if (!VALID_STATUSES.includes(status)) {
          return err(
            "Invalid status. Must be: todo, in_progress, done, blocked, skipped"
          );
        }
        const taskResult = getTaskOrError(task_id);
        if (!taskResult.found) return taskResult.response;
        const updatedTask = taskModel.updateStatus(task_id, status);
        const completionCheck = lifecycleEngine.autoCheckCompletion(updatedTask.plan_id);
        if (["done", "blocked", "skipped"].includes(status)) {
          try {
            taskMetricsModel.record(task_id, updatedTask.plan_id, status, metrics);
          } catch {
          }
        }
        return ok({ task: updatedTask, completion_check: completionCheck });
      }
      case "vp_task_get": {
        const check = requireArgs(args, ["task_id"]);
        if (!check.valid) return check.response;
        const taskResult = getTaskOrError(check.parsed.task_id);
        if (!taskResult.found) return taskResult.response;
        return ok(taskResult.task);
      }
      case "vp_task_next": {
        const check = requireArgs(args, ["plan_id"]);
        if (!check.valid) return check.response;
        const todoTasks = taskModel.getByPlan(check.parsed.plan_id, { status: "todo" });
        if (todoTasks.length === 0) {
          return ok({ message: "No pending tasks", hint: "All tasks are done. Use vp_plan_complete to finish the plan." });
        }
        return ok(todoTasks[0]);
      }
      case "vp_task_block": {
        const check = requireArgs(
          args,
          ["task_id"]
        );
        if (!check.valid) return check.response;
        const taskResult = getTaskOrError(check.parsed.task_id);
        if (!taskResult.found) return taskResult.response;
        const blockedTask = taskModel.updateStatus(check.parsed.task_id, "blocked");
        if (check.parsed.reason) {
          eventModel.record(
            "task",
            check.parsed.task_id,
            "blocked_reason",
            null,
            JSON.stringify({ reason: check.parsed.reason })
          );
        }
        return ok({ ...blockedTask, block_reason: check.parsed.reason ?? null });
      }
      case "vp_task_edit": {
        const check = requireArgs(
          args,
          ["task_id"]
        );
        if (!check.valid) return check.response;
        const taskResult3 = getTaskOrError(check.parsed.task_id);
        if (!taskResult3.found) return taskResult3.response;
        const { task_id: _tid, ...editFields } = check.parsed;
        const editedTask = taskModel.update(check.parsed.task_id, editFields);
        return ok(editedTask);
      }
      case "vp_task_delete": {
        const check = requireArgs(args, ["task_id"]);
        if (!check.valid) return check.response;
        const taskResult4 = getTaskOrError(check.parsed.task_id);
        if (!taskResult4.found) return taskResult4.response;
        try {
          taskModel.delete(check.parsed.task_id);
          return ok({ deleted: true, task_id: check.parsed.task_id });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return err(message);
        }
      }
      case "vp_context_save": {
        const check = requireArgs(
          args,
          ["summary"]
        );
        if (!check.valid) return check.response;
        const { summary, plan_id, session_id } = check.parsed;
        const contextLog = contextModel.save(summary, {
          planId: plan_id,
          sessionId: session_id
        });
        return ok(contextLog);
      }
      case "vp_stats": {
        const { plan_id } = args ?? {};
        const velocity = statsEngine.getVelocity(plan_id);
        const result = { velocity };
        if (plan_id) {
          result.estimated_completion = statsEngine.getEstimatedCompletion(plan_id);
        }
        return ok(result);
      }
      case "vp_history": {
        const check = requireArgs(
          args,
          ["entity_type", "entity_id"]
        );
        if (!check.valid) return check.response;
        const events = eventModel.getByEntity(check.parsed.entity_type, check.parsed.entity_id);
        return ok(events);
      }
      case "vp_insights": {
        const { scope } = args ?? {};
        const validScopes = ["blocked_patterns", "duration_stats", "success_rates", "all"];
        const selectedScope = scope && validScopes.includes(scope) ? scope : "all";
        const result = {};
        if (selectedScope === "all" || selectedScope === "blocked_patterns") {
          result.blocked_patterns = insightsEngine.getBlockedPatterns();
        }
        if (selectedScope === "all" || selectedScope === "duration_stats") {
          result.duration_stats = insightsEngine.getDurationStats();
        }
        if (selectedScope === "all" || selectedScope === "success_rates") {
          result.success_rates = insightsEngine.getSuccessRates();
        }
        if (selectedScope === "all") {
          result.recommendations = insightsEngine.getRecommendations();
          result.confidence = insightsEngine.getConfidenceLevel();
        }
        return ok(result);
      }
      default:
        return err(`Unknown tool: ${name}`);
    }
  });
  return server;
}
async function main() {
  const db = getDb();
  initSchema(db);
  const server = createServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
var isDirectRun = typeof process !== "undefined" && process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
  main().catch(console.error);
}
export {
  createServer,
  main
};
//# sourceMappingURL=server.js.map