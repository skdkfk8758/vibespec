#!/usr/bin/env node

// src/cli/index.ts
import { Command } from "commander";
import { createRequire } from "module";

// src/core/db/connection.ts
import Database from "better-sqlite3";
import { existsSync, statSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
var _db = null;
function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    const gitPath = resolve(dir, ".git");
    if (existsSync(gitPath)) {
      const stat = statSync(gitPath);
      if (stat.isFile()) {
        const content = readFileSync(gitPath, "utf-8").trim();
        const match = content.match(/^gitdir:\s*(.+)/);
        if (match) {
          const absGitDir = resolve(dir, match[1]);
          return absGitDir.replace(/[/\\]\.git[/\\]worktrees[/\\].*$/, "");
        }
      }
      return dir;
    }
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
    for (const task2 of this.getStaleTasks()) {
      alerts.push({
        type: "stale",
        entity_type: "task",
        entity_id: task2.id,
        message: `Task "${task2.title}" has been in progress for ${task2.days_stale} days with no activity`
      });
    }
    for (const plan2 of this.getBlockedPlans()) {
      alerts.push({
        type: "blocked",
        entity_type: "plan",
        entity_id: plan2.id,
        message: `Plan "${plan2.title}" has ${plan2.blocked_tasks} blocked task(s)`
      });
    }
    for (const plan2 of this.getCompletablePlans()) {
      alerts.push({
        type: "completable",
        entity_type: "plan",
        entity_id: plan2.id,
        message: `Plan "${plan2.title}" has all tasks done and can be completed`
      });
    }
    for (const plan2 of this.getForgottenPlans()) {
      alerts.push({
        type: "forgotten",
        entity_type: "plan",
        entity_id: plan2.id,
        message: `Plan "${plan2.title}" has had no activity for ${plan2.days_inactive} days`
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

// src/core/models/task.ts
import { nanoid } from "nanoid";
var TaskModel = class {
  constructor(db, events) {
    this.db = db;
    this.events = events;
  }
  events;
  create(planId, title, opts) {
    const id = nanoid(12);
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
    const task2 = this.getById(id);
    this.events?.record("task", task2.id, "created", null, JSON.stringify({ title, status: "todo" }));
    return task2;
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
    for (const task2 of tasks) {
      map.set(task2.id, { ...task2, children: [] });
    }
    for (const task2 of tasks) {
      const node = map.get(task2.id);
      if (task2.parent_id === null) {
        roots.push(node);
      } else {
        const parent = map.get(task2.parent_id);
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
    const task2 = this.getById(id);
    if (!task2) throw new Error(`Task not found: ${id}`);
    this.db.prepare(
      "DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE parent_id = ?)"
    ).run(id);
    this.db.prepare("DELETE FROM tasks WHERE parent_id = ?").run(id);
    this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(id);
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    this.events?.record("task", id, "deleted", JSON.stringify({ title: task2.title }), null);
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

// src/core/models/plan.ts
import { nanoid as nanoid2 } from "nanoid";
var PlanModel = class {
  db;
  events;
  constructor(db, events) {
    this.db = db;
    this.events = events;
  }
  create(title, spec, summary) {
    const id = nanoid2(12);
    const stmt = this.db.prepare(
      `INSERT INTO plans (id, title, status, spec, summary) VALUES (?, ?, 'draft', ?, ?)`
    );
    stmt.run(id, title, spec ?? null, summary ?? null);
    const plan2 = this.getById(id);
    this.events?.record("plan", plan2.id, "created", null, JSON.stringify({ title, status: "draft" }));
    return plan2;
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
    const plan2 = this.getById(id);
    if (!plan2) throw new Error(`Plan not found: ${id}`);
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
    if (sets.length === 0) return plan2;
    const oldFields = {};
    const newFields = {};
    for (const key of Object.keys(fields)) {
      if (fields[key] !== void 0) {
        oldFields[key] = plan2[key];
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
    const plan2 = this.getById(id);
    if (!plan2) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan2.status;
    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run("active", id);
    this.events?.record("plan", id, "activated", JSON.stringify({ status: oldStatus }), JSON.stringify({ status: "active" }));
    return this.getById(id);
  }
  complete(id) {
    const plan2 = this.getById(id);
    if (!plan2) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan2.status;
    const stmt = this.db.prepare(
      `UPDATE plans SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
    );
    stmt.run(id);
    this.events?.record("plan", id, "completed", JSON.stringify({ status: oldStatus }), JSON.stringify({ status: "completed" }));
    return this.getById(id);
  }
  delete(id) {
    const plan2 = this.getById(id);
    if (!plan2) throw new Error(`Plan not found: ${id}`);
    if (plan2.status !== "draft") {
      throw new Error(`Only draft plans can be deleted. Current status: ${plan2.status}`);
    }
    this.db.prepare(
      "DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE plan_id = ?)"
    ).run(id);
    this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(id);
    this.db.prepare("DELETE FROM tasks WHERE plan_id = ?").run(id);
    this.db.prepare("DELETE FROM plans WHERE id = ?").run(id);
  }
  approve(id) {
    const plan2 = this.getById(id);
    if (!plan2) throw new Error(`Plan not found: ${id}`);
    if (plan2.status !== "active") {
      throw new Error(`Only active plans can be approved. Current status: ${plan2.status}`);
    }
    const oldStatus = plan2.status;
    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run("approved", id);
    this.events?.record("plan", id, "approved", JSON.stringify({ status: oldStatus }), JSON.stringify({ status: "approved" }));
    return this.getById(id);
  }
  archive(id) {
    const plan2 = this.getById(id);
    if (!plan2) throw new Error(`Plan not found: ${id}`);
    const oldStatus = plan2.status;
    const stmt = this.db.prepare(`UPDATE plans SET status = ? WHERE id = ?`);
    stmt.run("archived", id);
    this.events?.record("plan", id, "archived", JSON.stringify({ status: oldStatus }), JSON.stringify({ status: "archived" }));
    return this.getById(id);
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
    const plan2 = this.planModel.complete(planId);
    this.events?.record(
      "plan",
      planId,
      "lifecycle_completed",
      null,
      JSON.stringify({ status: "completed" })
    );
    return plan2;
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

// src/cli/formatters.ts
var FILLED = "\u2588";
var EMPTY = "\u2591";
function formatProgressBar(pct, width = 20) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 100 * width);
  const empty = width - filled;
  return `${FILLED.repeat(filled)}${EMPTY.repeat(empty)} ${Math.round(clamped)}%`;
}
function formatDashboard(overview, alerts) {
  const lines = [];
  if (overview.plans.length === 0) {
    lines.push("No active plans.");
  } else {
    const boxWidth = 55;
    const inner = boxWidth - 2;
    lines.push(`\u250C\u2500 Active Plans ${"\u2500".repeat(inner - 14)}\u2510`);
    lines.push(`\u2502${" ".repeat(inner)}\u2502`);
    overview.plans.forEach((plan2, index) => {
      const num = numCircle(index + 1);
      const bar = formatProgressBar(plan2.progress_pct, 12);
      const titleLine = `  ${num} ${plan2.title}`;
      const gap = inner - titleLine.length - bar.length - 2;
      const paddedTitle = `${titleLine}${" ".repeat(Math.max(1, gap))}${bar}  `;
      lines.push(`\u2502${padRight(paddedTitle, inner)}\u2502`);
      const todoCount = plan2.total_tasks - plan2.done_tasks - plan2.active_tasks - plan2.blocked_tasks;
      const countsLine = `    done ${plan2.done_tasks} \xB7 active ${plan2.active_tasks} \xB7 blocked ${plan2.blocked_tasks} \xB7 todo ${todoCount}`;
      lines.push(`\u2502${padRight(countsLine, inner)}\u2502`);
      lines.push(`\u2502${" ".repeat(inner)}\u2502`);
    });
    lines.push(`\u2514${"\u2500".repeat(inner)}\u2518`);
  }
  if (alerts.length > 0) {
    lines.push("\u26A0 Alerts:");
    for (const alert of alerts) {
      lines.push(`  - [${alert.type}] ${alert.message}`);
    }
  }
  return lines.join("\n");
}
function numCircle(n) {
  const circles = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464", "\u2465", "\u2466", "\u2467", "\u2468", "\u2469"];
  return circles[n - 1] ?? `(${n})`;
}
function padRight(str, len) {
  if (str.length >= len) return str.slice(0, len);
  return str + " ".repeat(len - str.length);
}
function formatStats(velocity, estimate, timeline) {
  const lines = [];
  lines.push(
    `Velocity: ${velocity.daily.toFixed(1)} tasks/day (${velocity.total_completed} completed in last 7 days)`
  );
  if (estimate) {
    lines.push(`Remaining: ${estimate.remaining_tasks} tasks`);
    if (estimate.estimated_days !== null && estimate.estimated_date !== null) {
      lines.push(`Estimated: ~${estimate.estimated_days} days (${estimate.estimated_date})`);
    } else {
      lines.push("Estimated: unknown (no velocity)");
    }
  }
  if (timeline && timeline.length > 0) {
    lines.push("");
    lines.push("Timeline:");
    const maxTasks = Math.max(...timeline.map((e) => e.tasks_completed));
    const maxBarWidth = 10;
    for (const entry of timeline) {
      const datePart = entry.date.slice(5).replace("-", "/");
      const barWidth = maxTasks > 0 ? Math.max(1, Math.round(entry.tasks_completed / maxTasks * maxBarWidth)) : 1;
      const bar = FILLED.repeat(barWidth);
      const label = entry.tasks_completed === 1 ? "1 task" : `${entry.tasks_completed} tasks`;
      lines.push(`  ${datePart}  ${bar}  ${label}`);
    }
  }
  return lines.join("\n");
}
function formatHistory(events) {
  if (events.length === 0) {
    return "No history found.";
  }
  const lines = ["History:"];
  for (const event of events) {
    const dt = event.created_at.replace("T", " ").slice(0, 16);
    const oldPart = event.old_value ?? "";
    const newPart = event.new_value ?? "";
    let detail = "";
    if (oldPart && newPart) {
      detail = ` ${oldPart} \u2192 ${newPart}`;
    } else if (newPart) {
      detail = ` \u2192 ${newPart}`;
    } else if (oldPart) {
      detail = ` ${oldPart}`;
    }
    lines.push(
      `  ${dt}  ${event.entity_type}    ${event.event_type}  ${detail}`.trimEnd()
    );
  }
  return lines.join("\n");
}
var STATUS_ICONS = {
  done: "[x]",
  in_progress: "[>]",
  blocked: "[!]",
  todo: "[ ]",
  skipped: "[-]"
};
function formatPlanTree(plan2, tasks) {
  const lines = [];
  const totalTasks = countTasks(tasks);
  const doneTasks = countTasksByStatus(tasks, ["done", "skipped"]);
  const pct = totalTasks === 0 ? 0 : Math.round(doneTasks / totalTasks * 100);
  lines.push(`${plan2.title} (${plan2.status})${" ".repeat(5)}${pct}%`);
  for (let i = 0; i < tasks.length; i++) {
    const isLast = i === tasks.length - 1;
    renderNode(tasks[i], "", isLast, lines);
  }
  return lines.join("\n");
}
function renderNode(node, prefix, isLast, lines) {
  const connector = isLast ? "\u2514\u2500" : "\u251C\u2500";
  const icon = STATUS_ICONS[node.status];
  lines.push(`${prefix}${connector} ${icon} ${node.title}${" ".repeat(4)}${node.status}`);
  const childPrefix = prefix + (isLast ? "   " : "\u2502  ");
  for (let i = 0; i < node.children.length; i++) {
    const childIsLast = i === node.children.length - 1;
    renderNode(node.children[i], childPrefix, childIsLast, lines);
  }
}
function countTasks(nodes) {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countTasks(node.children);
  }
  return count;
}
function countTasksByStatus(nodes, statuses) {
  let count = 0;
  for (const node of nodes) {
    if (statuses.includes(node.status)) count++;
    count += countTasksByStatus(node.children, statuses);
  }
  return count;
}
function formatPlanList(plans) {
  if (plans.length === 0) return "No plans found.";
  const lines = [];
  const header = `${padRight("ID", 14)}${padRight("Title", 26)}${padRight("Status", 12)}Created`;
  lines.push(header);
  for (const plan2 of plans) {
    const created = plan2.created_at.split("T")[0] ?? plan2.created_at.slice(0, 10);
    lines.push(
      `${padRight(plan2.id, 14)}${padRight(plan2.title, 26)}${padRight(plan2.status, 12)}${created}`
    );
  }
  return lines.join("\n");
}

// src/cli/index.ts
var require2 = createRequire(import.meta.url);
var pkg = require2("../../package.json");
function initModels() {
  const db = getDb();
  initSchema(db);
  const events = new EventModel(db);
  const planModel = new PlanModel(db, events);
  const taskModel = new TaskModel(db, events);
  const lifecycle = new LifecycleEngine(db, planModel, taskModel, events);
  return { db, events, planModel, taskModel, lifecycle };
}
var program = new Command();
program.name("vp").description("VibeSpec CLI").version(pkg.version);
program.command("dashboard").description("Show all active plans overview").action(() => {
  const { db } = initModels();
  const dashboard = new DashboardEngine(db);
  const alerts = new AlertsEngine(db);
  const overview = dashboard.getOverview();
  const alertList = alerts.getAlerts();
  console.log(formatDashboard(overview, alertList));
});
var task = program.command("task").description("Manage tasks");
task.command("update").argument("<id>", "Task ID").argument("<status>", "New status (todo, in_progress, done, blocked, skipped)").description("Update task status").action((id, status) => {
  const { taskModel } = initModels();
  const updated = taskModel.updateStatus(id, status);
  console.log(`Task ${updated.id}: ${updated.title} \u2192 ${updated.status}`);
});
task.command("create").requiredOption("--plan <plan_id>", "Plan ID").requiredOption("--title <title>", "Task title").option("--parent <parent_id>", "Parent task ID for subtasks").option("--spec <spec>", "Task specification").option("--acceptance <acceptance>", "Acceptance criteria").description("Create a new task").action((opts) => {
  const { taskModel } = initModels();
  try {
    const created = taskModel.create(opts.plan, opts.title, {
      parentId: opts.parent,
      spec: opts.spec,
      acceptance: opts.acceptance
    });
    console.log(`Created task: ${created.id} "${created.title}" (${created.status})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(message);
    process.exit(1);
  }
});
task.command("next").argument("<plan_id>", "Plan ID").description("Get the next pending task").action((planId) => {
  const { taskModel } = initModels();
  const todos = taskModel.getByPlan(planId, { status: "todo" });
  if (todos.length === 0) {
    console.log("No pending tasks.");
    return;
  }
  const t = todos[0];
  console.log(`Next: ${t.id} "${t.title}"`);
  if (t.spec) console.log(`Spec: ${t.spec}`);
  if (t.acceptance) console.log(`Acceptance: ${t.acceptance}`);
});
task.command("show").argument("<id>", "Task ID").description("Show task details").action((id) => {
  const { taskModel } = initModels();
  const t = taskModel.getById(id);
  if (!t) {
    console.error(`Task not found: ${id}`);
    process.exit(1);
  }
  console.log(`ID:         ${t.id}`);
  console.log(`Title:      ${t.title}`);
  console.log(`Status:     ${t.status}`);
  console.log(`Plan:       ${t.plan_id}`);
  console.log(`Depth:      ${t.depth}`);
  if (t.spec) console.log(`Spec:       ${t.spec}`);
  if (t.acceptance) console.log(`Acceptance: ${t.acceptance}`);
  console.log(`Created:    ${t.created_at}`);
  if (t.completed_at) console.log(`Completed:  ${t.completed_at}`);
});
program.command("stats").argument("[plan_id]", "Optional plan ID to scope stats").description("Show velocity and estimates").action((planId) => {
  const { db } = initModels();
  const stats = new StatsEngine(db);
  const velocity = stats.getVelocity(planId);
  const estimate = planId ? stats.getEstimatedCompletion(planId) : void 0;
  const timeline = stats.getTimeline(planId);
  console.log(formatStats(velocity, estimate, timeline.length > 0 ? timeline : void 0));
});
program.command("history").argument("<type>", "Entity type (plan, task)").argument("<id>", "Entity ID").description("Show change history").action((type, id) => {
  const { events } = initModels();
  const eventList = events.getByEntity(type, id);
  console.log(formatHistory(eventList));
});
var plan = program.command("plan").description("Manage plans");
plan.command("list").option("--status <status>", "Filter by status (draft, active, completed, archived)").description("List plans").action((opts) => {
  const { planModel } = initModels();
  const plans = planModel.list(opts.status ? { status: opts.status } : void 0);
  console.log(formatPlanList(plans));
});
plan.command("show").argument("<id>", "Plan ID").description("Show plan details with task tree").action((id) => {
  const { planModel, taskModel } = initModels();
  const p = planModel.getById(id);
  if (!p) {
    console.error(`Plan not found: ${id}`);
    process.exit(1);
  }
  const tree = taskModel.getTree(id);
  console.log(formatPlanTree(p, tree));
});
plan.command("create").requiredOption("--title <title>", "Plan title").option("--spec <spec>", "Plan specification").description("Create a new plan and activate it").action((opts) => {
  const { planModel } = initModels();
  const created = planModel.create(opts.title, opts.spec);
  const activated = planModel.activate(created.id);
  console.log(`Created plan: ${activated.id} "${activated.title}" (${activated.status})`);
});
plan.command("complete").argument("<id>", "Plan ID").description("Complete a plan").action((id) => {
  const { lifecycle } = initModels();
  try {
    const completed = lifecycle.completePlan(id);
    console.log(`Plan completed: ${completed.id} "${completed.title}"`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(message);
    process.exit(1);
  }
});
program.parse();
//# sourceMappingURL=index.js.map