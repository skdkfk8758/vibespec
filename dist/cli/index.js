#!/usr/bin/env node

// src/cli/index.ts
import { Command } from "commander";
import { createRequire } from "module";

// src/core/db/connection.ts
import Database from "better-sqlite3";
import { existsSync, statSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
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
function detectGitContext() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const gitDir = execSync("git rev-parse --git-dir", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const isWorktree = gitDir.includes("/worktrees/");
    let worktreeName = null;
    if (isWorktree) {
      const match = gitDir.match(/\/worktrees\/([^/]+)$/);
      worktreeName = match ? match[1] : null;
    }
    return {
      branch: branch === "HEAD" ? null : branch,
      worktreeName,
      isWorktree
    };
  } catch {
    return { branch: null, worktreeName: null, isWorktree: false };
  }
}
function resolveDbPath() {
  if (process.env.VIBESPEC_DB_PATH) {
    return process.env.VIBESPEC_DB_PATH;
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.env.PROJECT_DIR;
  if (projectDir) {
    return resolve(findProjectRoot(projectDir), "vibespec.db");
  }
  const root = findProjectRoot(process.cwd());
  return resolve(root, "vibespec.db");
}
function getDb(dbPath) {
  if (_db) return _db;
  const path2 = dbPath ?? resolveDbPath();
  _db = new Database(path2);
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
      branch      TEXT,
      worktree_name TEXT,
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
      depends_on  TEXT,
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
      p.branch,
      p.worktree_name,
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

    CREATE TABLE IF NOT EXISTS vs_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  applyMigrations(db);
}
function applyMigrations(db) {
  const version = db.pragma("user_version", { simple: true });
  if (version < 1) {
    const columns = db.pragma("table_info(plans)");
    const hasColumn = (name) => columns.some((c) => c.name === name);
    if (!hasColumn("branch")) {
      db.exec("ALTER TABLE plans ADD COLUMN branch TEXT");
    }
    if (!hasColumn("worktree_name")) {
      db.exec("ALTER TABLE plans ADD COLUMN worktree_name TEXT");
    }
    db.exec("DROP VIEW IF EXISTS plan_progress");
    db.exec(`
      CREATE VIEW plan_progress AS
      SELECT
        p.id,
        p.title,
        p.status,
        p.branch,
        p.worktree_name,
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
      GROUP BY p.id
    `);
    db.pragma("user_version = 1");
  }
  if (version < 2) {
    const columns = db.pragma("table_info(tasks)");
    const hasColumn = (name) => columns.some((c) => c.name === name);
    if (!hasColumn("depends_on")) {
      db.exec("ALTER TABLE tasks ADD COLUMN depends_on TEXT");
    }
    db.pragma("user_version = 2");
  }
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

// src/core/engine/error-kb.ts
import * as fs from "fs";
import * as path from "path";

// node_modules/nanoid/index.js
import { webcrypto as crypto } from "crypto";

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.js
var POOL_SIZE_MULTIPLIER = 128;
var pool;
var poolOffset;
function fillPool(bytes) {
  if (!pool || pool.length < bytes) {
    pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER);
    crypto.getRandomValues(pool);
    poolOffset = 0;
  } else if (poolOffset + bytes > pool.length) {
    crypto.getRandomValues(pool);
    poolOffset = 0;
  }
  poolOffset += bytes;
}
function nanoid(size = 21) {
  fillPool(size |= 0);
  let id = "";
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63];
  }
  return id;
}

// src/core/engine/error-kb.ts
var VALID_SEVERITIES = /* @__PURE__ */ new Set(["critical", "high", "medium", "low"]);
var VALID_STATUSES = /* @__PURE__ */ new Set(["open", "resolved", "recurring", "wontfix"]);
var VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
function parseFrontmatter(raw) {
  const defaultMeta = {
    title: "",
    severity: "medium",
    tags: [],
    status: "open",
    occurrences: 0,
    first_seen: "",
    last_seen: ""
  };
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: defaultMeta, body: raw };
  }
  const yamlBlock = match[1];
  const body = match[2];
  const meta = { ...defaultMeta };
  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key === "title") {
      meta.title = value;
    } else if (key === "severity") {
      if (VALID_SEVERITIES.has(value)) meta.severity = value;
    } else if (key === "status") {
      if (VALID_STATUSES.has(value)) meta.status = value;
    } else if (key === "occurrences") {
      meta.occurrences = parseInt(value, 10) || 0;
    } else if (key === "first_seen") {
      meta.first_seen = value;
    } else if (key === "last_seen") {
      meta.last_seen = value;
    } else if (key === "tags") {
      const bracketMatch = value.match(/^\[(.*)\]$/);
      if (bracketMatch) {
        meta.tags = bracketMatch[1].split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      } else if (value === "" || value === "[]") {
        meta.tags = [];
      }
    }
  }
  return { meta, body };
}
function serializeFrontmatter(meta) {
  const tagsStr = meta.tags.length > 0 ? `[${meta.tags.join(", ")}]` : "[]";
  const lines = [
    "---",
    `title: ${meta.title}`,
    `severity: ${meta.severity}`,
    `tags: ${tagsStr}`,
    `status: ${meta.status}`,
    `occurrences: ${meta.occurrences}`,
    `first_seen: ${meta.first_seen}`,
    `last_seen: ${meta.last_seen}`,
    "---"
  ];
  return lines.join("\n");
}
var ErrorKBEngine = class {
  kbRoot;
  errorsDir;
  constructor(projectRoot) {
    this.kbRoot = path.join(projectRoot, ".claude", "error-kb");
    this.errorsDir = path.join(this.kbRoot, "errors");
    fs.mkdirSync(this.errorsDir, { recursive: true });
  }
  resolveFilePath(id) {
    if (!VALID_ID_PATTERN.test(id)) return null;
    return path.join(this.errorsDir, `${id}.md`);
  }
  add(newEntry) {
    const id = nanoid(12);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const meta = {
      title: newEntry.title,
      severity: newEntry.severity,
      tags: newEntry.tags,
      status: "open",
      occurrences: 1,
      first_seen: now,
      last_seen: now
    };
    let body = "\n";
    if (newEntry.cause) {
      body += `## Cause

${newEntry.cause}

`;
    }
    if (newEntry.solution) {
      body += `## Solution

${newEntry.solution}

`;
    }
    const content = serializeFrontmatter(meta) + "\n" + body;
    const filePath = path.join(this.errorsDir, `${id}.md`);
    fs.writeFileSync(filePath, content, "utf-8");
    this.updateIndex();
    return this.toErrorEntry(id, meta, body);
  }
  show(id) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    return this.toErrorEntry(id, meta, body);
  }
  search(query, opts) {
    const files = this.listErrorFiles();
    const results = [];
    for (const file of files) {
      const id = path.basename(file, ".md");
      const entry = this.show(id);
      if (!entry) continue;
      if (opts?.tags && opts.tags.length > 0) {
        const hasMatchingTag = opts.tags.some((t) => entry.tags.includes(t));
        if (!hasMatchingTag) continue;
      }
      if (opts?.severity && entry.severity !== opts.severity) {
        continue;
      }
      if (query && query.length > 0) {
        const searchable = `${entry.title} ${entry.content}`.toLowerCase();
        if (!searchable.includes(query.toLowerCase())) {
          continue;
        }
      }
      results.push(entry);
    }
    return results;
  }
  delete(id) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    this.updateIndex();
    return true;
  }
  update(id, patch) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    if (patch.severity !== void 0) meta.severity = patch.severity;
    if (patch.status !== void 0) meta.status = patch.status;
    if (patch.occurrences !== void 0) meta.occurrences = patch.occurrences;
    if (patch.last_seen !== void 0) meta.last_seen = patch.last_seen;
    if (patch.tags !== void 0) meta.tags = patch.tags;
    const content = serializeFrontmatter(meta) + "\n" + body;
    fs.writeFileSync(filePath, content, "utf-8");
    this.updateIndex();
  }
  recordOccurrence(id, context2) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    meta.occurrences += 1;
    meta.last_seen = (/* @__PURE__ */ new Date()).toISOString();
    let updatedBody = body;
    const historyEntry = `- ${meta.last_seen}: ${context2}`;
    const historyIdx = updatedBody.lastIndexOf("## History");
    if (historyIdx !== -1) {
      const headerEnd = updatedBody.indexOf("\n", historyIdx);
      if (headerEnd !== -1) {
        updatedBody = updatedBody.slice(0, headerEnd + 1) + historyEntry + "\n" + updatedBody.slice(headerEnd + 1);
      }
    } else {
      updatedBody = updatedBody.trimEnd() + "\n\n## History\n" + historyEntry + "\n";
    }
    const content = serializeFrontmatter(meta) + "\n" + updatedBody;
    fs.writeFileSync(filePath, content, "utf-8");
    this.updateIndex();
  }
  getStats() {
    const files = this.listErrorFiles();
    const stats = {
      total: 0,
      by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
      by_status: { open: 0, resolved: 0, recurring: 0, wontfix: 0 },
      top_recurring: []
    };
    const entries = [];
    for (const file of files) {
      const id = path.basename(file, ".md");
      const entry = this.show(id);
      if (!entry) continue;
      stats.total++;
      stats.by_severity[entry.severity]++;
      stats.by_status[entry.status]++;
      entries.push(entry);
    }
    stats.top_recurring = entries.sort((a, b) => b.occurrences - a.occurrences).slice(0, 10).map((e) => ({ id: e.id, title: e.title, occurrences: e.occurrences }));
    return stats;
  }
  toErrorEntry(id, meta, body) {
    return {
      id,
      title: meta.title,
      severity: meta.severity,
      tags: meta.tags,
      status: meta.status,
      occurrences: meta.occurrences,
      first_seen: meta.first_seen,
      last_seen: meta.last_seen,
      content: body
    };
  }
  listErrorFiles() {
    if (!fs.existsSync(this.errorsDir)) return [];
    return fs.readdirSync(this.errorsDir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => path.join(this.errorsDir, f));
  }
  updateIndex() {
    const stats = this.getStats();
    const lines = [
      "# Error Knowledge Base Index",
      "",
      `Total: ${stats.total}`,
      "",
      "## By Severity",
      `- Critical: ${stats.by_severity.critical}`,
      `- High: ${stats.by_severity.high}`,
      `- Medium: ${stats.by_severity.medium}`,
      `- Low: ${stats.by_severity.low}`,
      "",
      "## By Status",
      `- Open: ${stats.by_status.open}`,
      `- Resolved: ${stats.by_status.resolved}`,
      `- Recurring: ${stats.by_status.recurring}`,
      `- Won't Fix: ${stats.by_status.wontfix}`,
      ""
    ];
    if (stats.top_recurring.length > 0) {
      lines.push("## Top Recurring");
      for (const entry of stats.top_recurring.slice(0, 10)) {
        lines.push(`- ${entry.title} (${entry.occurrences}x)`);
      }
      lines.push("");
    }
    const indexPath = path.join(this.kbRoot, "_index.md");
    fs.writeFileSync(indexPath, lines.join("\n"), "utf-8");
  }
};

// src/core/config.ts
function getConfig(db, key) {
  const row = db.prepare("SELECT value FROM vs_config WHERE key = ?").get(key);
  return row?.value ?? null;
}
function setConfig(db, key, value) {
  db.prepare("INSERT INTO vs_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
function deleteConfig(db, key) {
  db.prepare("DELETE FROM vs_config WHERE key = ?").run(key);
}
function listConfig(db) {
  return db.prepare("SELECT key, value FROM vs_config ORDER BY key").all();
}

// src/core/models/task.ts
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
    const dependsOn = opts?.dependsOn && opts.dependsOn.length > 0 ? JSON.stringify(opts.dependsOn) : null;
    if (opts?.dependsOn && opts.dependsOn.length > 0) {
      this.validateDependencies(planId, id, opts.dependsOn);
    }
    this.db.prepare(
      `INSERT INTO tasks (id, plan_id, parent_id, title, status, depth, sort_order, spec, acceptance, depends_on)
         VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?)`
    ).run(
      id,
      planId,
      opts?.parentId ?? null,
      title,
      depth,
      sortOrder,
      opts?.spec ?? null,
      opts?.acceptance ?? null,
      dependsOn
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
  buildTaskMap(tasks) {
    const map = /* @__PURE__ */ new Map();
    for (const t of tasks) {
      map.set(t.id, t);
    }
    return map;
  }
  parseDeps(task2) {
    if (!task2.depends_on) return [];
    return JSON.parse(task2.depends_on);
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
    if (fields.depends_on !== void 0) {
      if (fields.depends_on !== null) {
        const depIds = JSON.parse(fields.depends_on);
        if (depIds.length > 0) {
          const task2 = this.getById(id);
          if (task2) {
            this.validateDependencies(task2.plan_id, id, depIds);
          }
        }
      }
      setClauses.push("depends_on = ?");
      values.push(fields.depends_on);
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
  validateDependencies(planId, taskId, dependsOn) {
    if (!dependsOn || dependsOn.length === 0) {
      return;
    }
    for (const depId of dependsOn) {
      if (depId === taskId) {
        throw new Error(`Task cannot depend on itself: ${depId}`);
      }
      const depTask = this.getById(depId);
      if (!depTask) {
        throw new Error(`Dependency task not found: ${depId}`);
      }
      if (depTask.plan_id !== planId) {
        throw new Error(
          `Dependency task ${depId} belongs to different plan: ${depTask.plan_id}`
        );
      }
    }
    const visited = /* @__PURE__ */ new Set();
    const hasCycle = (currentId) => {
      if (currentId === taskId) {
        return true;
      }
      if (visited.has(currentId)) {
        return false;
      }
      visited.add(currentId);
      const current = this.getById(currentId);
      if (!current || !current.depends_on) {
        return false;
      }
      const deps = JSON.parse(current.depends_on);
      for (const dep of deps) {
        if (hasCycle(dep)) {
          return true;
        }
      }
      return false;
    };
    for (const depId of dependsOn) {
      visited.clear();
      if (hasCycle(depId)) {
        throw new Error("Circular dependency detected");
      }
    }
  }
  getWaves(planId) {
    const tasks = this.getByPlan(planId);
    if (tasks.length === 0) return [];
    const taskMap = this.buildTaskMap(tasks);
    const poisoned = this.findPoisonedTasks(tasks, taskMap);
    const includedTasks = tasks.filter(
      (t) => !poisoned.has(t.id) || t.status === "blocked" || t.status === "skipped"
    );
    const waveIndex = /* @__PURE__ */ new Map();
    const includedSet = new Set(includedTasks.map((t) => t.id));
    const computeWave = (id, visited) => {
      if (waveIndex.has(id)) return waveIndex.get(id);
      if (visited.has(id)) return 0;
      visited.add(id);
      const task2 = taskMap.get(id);
      const deps = this.parseDeps(task2).filter((d) => includedSet.has(d));
      if (deps.length === 0) {
        waveIndex.set(id, 0);
        return 0;
      }
      const wave = Math.max(...deps.map((d) => computeWave(d, visited))) + 1;
      waveIndex.set(id, wave);
      return wave;
    };
    for (const t of includedTasks) {
      computeWave(t.id, /* @__PURE__ */ new Set());
    }
    const waveMap = /* @__PURE__ */ new Map();
    for (const t of includedTasks) {
      const idx = waveIndex.get(t.id) ?? 0;
      if (!waveMap.has(idx)) waveMap.set(idx, []);
      waveMap.get(idx).push(t);
    }
    return Array.from(waveMap.keys()).sort((a, b) => a - b).map((idx) => ({
      index: idx,
      task_ids: waveMap.get(idx).sort((a, b) => a.sort_order - b.sort_order).map((t) => t.id)
    }));
  }
  getNextAvailable(planId) {
    const tasks = this.getByPlan(planId);
    if (tasks.length === 0) return null;
    const taskMap = this.buildTaskMap(tasks);
    const todoTasks = tasks.filter((t) => t.status === "todo").sort((a, b) => a.sort_order - b.sort_order);
    for (const task2 of todoTasks) {
      const deps = this.parseDeps(task2);
      if (deps.length === 0) return task2;
      const allDone = deps.every((id) => taskMap.get(id)?.status === "done");
      const anyPoisoned = deps.some((id) => {
        const s = taskMap.get(id)?.status;
        return s === "blocked" || s === "skipped";
      });
      if (allDone && !anyPoisoned) return task2;
    }
    return null;
  }
  findPoisonedTasks(tasks, taskMap) {
    const poisoned = /* @__PURE__ */ new Set();
    const check = (id, visited) => {
      if (poisoned.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      const task2 = taskMap.get(id);
      if (!task2) return false;
      if (task2.status === "blocked" || task2.status === "skipped") {
        poisoned.add(id);
        return true;
      }
      for (const dep of this.parseDeps(task2)) {
        if (check(dep, visited)) {
          poisoned.add(id);
          return true;
        }
      }
      return false;
    };
    for (const t of tasks) {
      if (t.depends_on) check(t.id, /* @__PURE__ */ new Set());
    }
    return poisoned;
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
var PlanModel = class {
  db;
  events;
  constructor(db, events) {
    this.db = db;
    this.events = events;
  }
  create(title, spec, summary) {
    const id = nanoid(12);
    const ctx = detectGitContext();
    const stmt = this.db.prepare(
      `INSERT INTO plans (id, title, status, spec, summary, branch, worktree_name) VALUES (?, ?, 'draft', ?, ?, ?, ?)`
    );
    stmt.run(id, title, spec ?? null, summary ?? null, ctx.branch, ctx.worktreeName);
    const plan2 = this.getById(id);
    this.events?.record("plan", plan2.id, "created", null, JSON.stringify({ title, status: "draft", branch: ctx.branch }));
    return plan2;
  }
  getById(id) {
    const stmt = this.db.prepare(`SELECT * FROM plans WHERE id = ?`);
    const row = stmt.get(id);
    return row ?? null;
  }
  list(filter) {
    const conditions = [];
    const params = [];
    if (filter?.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter?.branch) {
      conditions.push("branch = ?");
      params.push(filter.branch);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const stmt = this.db.prepare(`SELECT * FROM plans ${where} ORDER BY created_at DESC`);
    return stmt.all(...params);
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
function formatErrorSearchResults(entries) {
  if (entries.length === 0) return "No errors found.";
  const lines = [];
  const header = `${padRight("ID", 16)}${padRight("Severity", 12)}${padRight("Status", 12)}${padRight("Occ", 6)}Title`;
  lines.push(header);
  for (const entry of entries) {
    lines.push(
      `${padRight(entry.id, 16)}${padRight(entry.severity, 12)}${padRight(entry.status, 12)}${padRight(String(entry.occurrences), 6)}${entry.title}`
    );
  }
  return lines.join("\n");
}
function formatErrorDetail(entry) {
  const tagsStr = entry.tags.length > 0 ? entry.tags.join(", ") : "(none)";
  const lines = [
    `ID:          ${entry.id}`,
    `Title:       ${entry.title}`,
    `Severity:    ${entry.severity}`,
    `Tags:        ${tagsStr}`,
    `Status:      ${entry.status}`,
    `Occurrences: ${entry.occurrences}`,
    `First seen:  ${entry.first_seen}`,
    `Last seen:   ${entry.last_seen}`
  ];
  if (entry.content && entry.content.trim().length > 0) {
    lines.push("");
    lines.push(entry.content.trim());
  }
  return lines.join("\n");
}
function formatErrorKBStats(stats) {
  const lines = [];
  lines.push(`Total: ${stats.total}`);
  lines.push("");
  lines.push("By Severity:");
  lines.push(`  critical: ${stats.by_severity.critical}`);
  lines.push(`  high:     ${stats.by_severity.high}`);
  lines.push(`  medium:   ${stats.by_severity.medium}`);
  lines.push(`  low:      ${stats.by_severity.low}`);
  lines.push("");
  lines.push("By Status:");
  lines.push(`  open:      ${stats.by_status.open}`);
  lines.push(`  resolved:  ${stats.by_status.resolved}`);
  lines.push(`  recurring: ${stats.by_status.recurring}`);
  lines.push(`  wontfix:   ${stats.by_status.wontfix}`);
  if (stats.top_recurring.length > 0) {
    lines.push("");
    lines.push("Top Recurring:");
    for (const entry of stats.top_recurring) {
      lines.push(`  ${entry.title} (${entry.occurrences}x)`);
    }
  }
  return lines.join("\n");
}

// src/cli/index.ts
var require2 = createRequire(import.meta.url);
var pkg = require2("../../package.json");
var jsonMode = false;
function output(data, formatted) {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatted ?? JSON.stringify(data, null, 2));
  }
}
function outputError(message) {
  if (jsonMode) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error(message);
  }
  process.exit(1);
}
function initModels() {
  const db = getDb();
  initSchema(db);
  const events = new EventModel(db);
  const planModel = new PlanModel(db, events);
  const taskModel = new TaskModel(db, events);
  const contextModel = new ContextModel(db);
  const taskMetricsModel = new TaskMetricsModel(db);
  const lifecycle = new LifecycleEngine(db, planModel, taskModel, events);
  const dashboard = new DashboardEngine(db);
  const alerts = new AlertsEngine(db);
  const stats = new StatsEngine(db);
  const insights = new InsightsEngine(db);
  return { db, events, planModel, taskModel, contextModel, taskMetricsModel, lifecycle, dashboard, alerts, stats, insights };
}
var program = new Command();
program.name("vp").description("VibeSpec CLI").version(pkg.version).option("--json", "Output in JSON format").hook("preAction", () => {
  jsonMode = program.opts().json === true;
});
program.command("dashboard").description("Show all active plans overview").action(() => {
  const { dashboard, alerts } = initModels();
  const overview = dashboard.getOverview();
  const alertList = alerts.getAlerts();
  output({ overview, alerts: alertList }, formatDashboard(overview, alertList));
});
var plan = program.command("plan").description("Manage plans");
plan.command("list").option("--status <status>", "Filter by status (draft, active, approved, completed, archived)").option("--branch <branch>", "Filter by branch").description("List plans").action((opts) => {
  const { planModel } = initModels();
  const filter = {};
  if (opts.status) filter.status = opts.status;
  if (opts.branch) filter.branch = opts.branch;
  const plans = planModel.list(Object.keys(filter).length > 0 ? filter : void 0);
  output(plans, formatPlanList(plans));
});
plan.command("show").argument("<id>", "Plan ID").description("Show plan details with task tree and waves").action((id) => {
  const { planModel, taskModel } = initModels();
  const p = planModel.getById(id);
  if (!p) return outputError(`Plan not found: ${id}`);
  const tree = taskModel.getTree(id);
  const waves = taskModel.getWaves(id);
  output({ plan: p, tasks: tree, waves }, formatPlanTree(p, tree));
});
plan.command("create").requiredOption("--title <title>", "Plan title").option("--spec <spec>", "Plan specification").option("--summary <summary>", "Plan summary").description("Create a new plan and activate it").action((opts) => {
  const { planModel } = initModels();
  const created = planModel.create(opts.title, opts.spec, opts.summary);
  const activated = planModel.activate(created.id);
  output(activated, `Created plan: ${activated.id} "${activated.title}" (${activated.status})`);
});
plan.command("complete").argument("<id>", "Plan ID").description("Complete a plan").action((id) => {
  const { lifecycle } = initModels();
  try {
    const completed = lifecycle.completePlan(id);
    output(completed, `Plan completed: ${completed.id} "${completed.title}"`);
  } catch (e) {
    outputError(e instanceof Error ? e.message : String(e));
  }
});
plan.command("approve").argument("<id>", "Plan ID").description("Approve a plan (active \u2192 approved)").action((id) => {
  const { planModel } = initModels();
  try {
    const approved = planModel.approve(id);
    output(approved, `Plan approved: ${approved.id} "${approved.title}"`);
  } catch (e) {
    outputError(e instanceof Error ? e.message : String(e));
  }
});
plan.command("archive").argument("<id>", "Plan ID").description("Archive a plan").action((id) => {
  const { planModel } = initModels();
  const p = planModel.getById(id);
  if (!p) return outputError(`Plan not found: ${id}`);
  const archived = planModel.archive(id);
  output(archived, `Plan archived: ${archived.id} "${archived.title}"`);
});
plan.command("update").argument("<id>", "Plan ID").option("--title <title>", "New title").option("--spec <spec>", "New spec").option("--summary <summary>", "New summary").description("Update plan title, spec, or summary").action((id, opts) => {
  const { planModel } = initModels();
  const p = planModel.getById(id);
  if (!p) return outputError(`Plan not found: ${id}`);
  const updated = planModel.update(id, opts);
  output(updated, `Plan updated: ${updated.id} "${updated.title}"`);
});
plan.command("delete").argument("<id>", "Plan ID").description("Delete a draft plan and all its tasks").action((id) => {
  const { planModel } = initModels();
  try {
    planModel.delete(id);
    output({ deleted: true, plan_id: id }, `Plan deleted: ${id}`);
  } catch (e) {
    outputError(e instanceof Error ? e.message : String(e));
  }
});
var task = program.command("task").description("Manage tasks");
task.command("create").requiredOption("--plan <plan_id>", "Plan ID").requiredOption("--title <title>", "Task title").option("--parent <parent_id>", "Parent task ID for subtasks").option("--spec <spec>", "Task specification").option("--acceptance <acceptance>", "Acceptance criteria").option("--depends-on <ids>", "Comma-separated task IDs this task depends on").description("Create a new task").action((opts) => {
  const { taskModel } = initModels();
  try {
    const dependsOn = opts.dependsOn ? opts.dependsOn.split(",").map((s) => s.trim()) : void 0;
    const created = taskModel.create(opts.plan, opts.title, {
      parentId: opts.parent,
      spec: opts.spec,
      acceptance: opts.acceptance,
      dependsOn
    });
    output(created, `Created task: ${created.id} "${created.title}" (${created.status})`);
  } catch (e) {
    outputError(e instanceof Error ? e.message : String(e));
  }
});
task.command("update").argument("<id>", "Task ID").argument("<status>", "New status (todo, in_progress, done, blocked, skipped)").option("--impl-status <status>", "Implementation status (DONE, DONE_WITH_CONCERNS, BLOCKED)").option("--test-count <count>", "Number of tests written").option("--files-changed <count>", "Number of files changed").option("--has-concerns", "Whether there are concerns").description("Update task status with optional metrics").action((id, status, opts) => {
  const VALID = ["todo", "in_progress", "done", "blocked", "skipped"];
  if (!VALID.includes(status)) {
    return outputError(`Invalid status. Must be: ${VALID.join(", ")}`);
  }
  const { taskModel, taskMetricsModel, lifecycle } = initModels();
  const t = taskModel.getById(id);
  if (!t) return outputError(`Task not found: ${id}`);
  const updated = taskModel.updateStatus(id, status);
  const completionCheck = lifecycle.autoCheckCompletion(updated.plan_id);
  if (["done", "blocked", "skipped"].includes(status)) {
    try {
      const metrics = {};
      if (opts.implStatus) metrics.impl_status = opts.implStatus;
      if (opts.testCount) metrics.test_count = parseInt(opts.testCount, 10);
      if (opts.filesChanged) metrics.files_changed = parseInt(opts.filesChanged, 10);
      if (opts.hasConcerns) metrics.has_concerns = true;
      taskMetricsModel.record(id, updated.plan_id, status, Object.keys(metrics).length > 0 ? metrics : void 0);
    } catch {
    }
  }
  output(
    { task: updated, completion_check: completionCheck },
    `Task ${updated.id}: ${updated.title} \u2192 ${updated.status}`
  );
});
task.command("next").argument("<plan_id>", "Plan ID").description("Get the next pending task").action((planId) => {
  const { taskModel } = initModels();
  const next = taskModel.getNextAvailable(planId);
  if (!next) {
    output(
      { message: "No pending tasks", hint: "All tasks are done or blocked. Use vs plan complete to finish the plan." },
      "No pending tasks."
    );
    return;
  }
  output(next, [
    `Next: ${next.id} "${next.title}"`,
    next.spec ? `Spec: ${next.spec}` : "",
    next.acceptance ? `Acceptance: ${next.acceptance}` : ""
  ].filter(Boolean).join("\n"));
});
task.command("show").argument("<id>", "Task ID").description("Show task details").action((id) => {
  const { taskModel } = initModels();
  const t = taskModel.getById(id);
  if (!t) return outputError(`Task not found: ${id}`);
  output(t, [
    `ID:         ${t.id}`,
    `Title:      ${t.title}`,
    `Status:     ${t.status}`,
    `Plan:       ${t.plan_id}`,
    `Depth:      ${t.depth}`,
    t.spec ? `Spec:       ${t.spec}` : "",
    t.acceptance ? `Acceptance: ${t.acceptance}` : "",
    `Created:    ${t.created_at}`,
    t.completed_at ? `Completed:  ${t.completed_at}` : ""
  ].filter(Boolean).join("\n"));
});
task.command("block").argument("<id>", "Task ID").option("--reason <reason>", "Reason for blocking").description("Mark a task as blocked").action((id, opts) => {
  const { taskModel, events } = initModels();
  const t = taskModel.getById(id);
  if (!t) return outputError(`Task not found: ${id}`);
  const blocked = taskModel.updateStatus(id, "blocked");
  if (opts.reason) {
    events.record("task", id, "blocked_reason", null, JSON.stringify({ reason: opts.reason }));
  }
  output(
    { ...blocked, block_reason: opts.reason ?? null },
    `Task blocked: ${blocked.id} "${blocked.title}"${opts.reason ? ` (reason: ${opts.reason})` : ""}`
  );
});
task.command("edit").argument("<id>", "Task ID").option("--title <title>", "New title").option("--spec <spec>", "New spec").option("--acceptance <acceptance>", "New acceptance criteria").description("Edit task title, spec, or acceptance").action((id, opts) => {
  const { taskModel } = initModels();
  const t = taskModel.getById(id);
  if (!t) return outputError(`Task not found: ${id}`);
  const edited = taskModel.update(id, opts);
  output(edited, `Task edited: ${edited.id} "${edited.title}"`);
});
task.command("delete").argument("<id>", "Task ID").description("Delete a task and its subtasks").action((id) => {
  const { taskModel } = initModels();
  try {
    taskModel.delete(id);
    output({ deleted: true, task_id: id }, `Task deleted: ${id}`);
  } catch (e) {
    outputError(e instanceof Error ? e.message : String(e));
  }
});
var context = program.command("context").description("Manage session context");
context.command("resume").option("--session-id <id>", "Optional session ID to filter").description("Resume context from previous sessions").action((opts) => {
  const { contextModel, dashboard, alerts } = initModels();
  const contextLogs = opts.sessionId ? [contextModel.getBySession(opts.sessionId)].filter(Boolean) : contextModel.getLatest(3);
  const overview = dashboard.getOverview();
  const alertList = alerts.getAlerts();
  output({ context_logs: contextLogs, overview, alerts: alertList });
});
context.command("save").requiredOption("--summary <summary>", "Summary of context to save").option("--plan-id <id>", "Plan ID to link context to").option("--session-id <id>", "Session ID").description("Save a context log entry").action((opts) => {
  const { contextModel } = initModels();
  const log = contextModel.save(opts.summary, {
    planId: opts.planId,
    sessionId: opts.sessionId
  });
  output(log, `Context saved: ${log.id} "${log.summary.slice(0, 50)}..."`);
});
program.command("stats").argument("[plan_id]", "Optional plan ID").description("Show velocity and estimates").action((planId) => {
  const { stats } = initModels();
  const velocity = stats.getVelocity(planId);
  const estimate = planId ? stats.getEstimatedCompletion(planId) : void 0;
  const timeline = stats.getTimeline(planId);
  output(
    { velocity, ...estimate ? { estimated_completion: estimate } : {}, ...timeline.length > 0 ? { timeline } : {} },
    formatStats(velocity, estimate, timeline.length > 0 ? timeline : void 0)
  );
});
program.command("history").argument("<type>", "Entity type (plan, task)").argument("<id>", "Entity ID").description("Show change history").action((type, id) => {
  const { events } = initModels();
  const eventList = events.getByEntity(type, id);
  output(eventList, formatHistory(eventList));
});
program.command("insights").option("--scope <scope>", "Scope: blocked_patterns, duration_stats, success_rates, all (default: all)").description("Get learning insights from task history").action((opts) => {
  const { insights } = initModels();
  const validScopes = ["blocked_patterns", "duration_stats", "success_rates", "all"];
  const scope = opts.scope && validScopes.includes(opts.scope) ? opts.scope : "all";
  const result = {};
  if (scope === "all" || scope === "blocked_patterns") {
    result.blocked_patterns = insights.getBlockedPatterns();
  }
  if (scope === "all" || scope === "duration_stats") {
    result.duration_stats = insights.getDurationStats();
  }
  if (scope === "all" || scope === "success_rates") {
    result.success_rates = insights.getSuccessRates();
  }
  if (scope === "all") {
    result.recommendations = insights.getRecommendations();
    result.confidence = insights.getConfidenceLevel();
  }
  output(result);
});
var config = program.command("config").description("Manage configuration");
config.command("set").argument("<key>", "Config key").argument("<value>", "Config value").description("Set a configuration value").action((key, value) => {
  const db = getDb();
  initSchema(db);
  setConfig(db, key, value);
  output({ key, value }, `${key} = ${value}`);
});
config.command("get").argument("<key>", "Config key").description("Get a configuration value").action((key) => {
  const db = getDb();
  initSchema(db);
  const value = getConfig(db, key);
  if (value === null) return outputError(`Config not found: ${key}`);
  output({ key, value }, `${key} = ${value}`);
});
config.command("list").description("List all configuration values").action(() => {
  const db = getDb();
  initSchema(db);
  const items = listConfig(db);
  if (items.length === 0) {
    output(items, "No configuration values set.");
    return;
  }
  const formatted = items.map((i) => `${i.key} = ${i.value}`).join("\n");
  output(items, formatted);
});
config.command("delete").argument("<key>", "Config key").description("Delete a configuration value").action((key) => {
  const db = getDb();
  initSchema(db);
  deleteConfig(db, key);
  output({ deleted: true, key }, `Deleted: ${key}`);
});
var errorKb = program.command("error-kb").description("Manage error knowledge base");
function getErrorKBEngine() {
  const root = findProjectRoot(process.cwd());
  return new ErrorKBEngine(root);
}
errorKb.command("search").argument("<query>", "Search query").option("--tag <tag>", "Filter by tag").option("--severity <level>", "Filter by severity (critical, high, medium, low)").description("Search error knowledge base").action((query, opts) => {
  const engine = getErrorKBEngine();
  const searchOpts = {};
  if (opts.tag) searchOpts.tags = [opts.tag];
  if (opts.severity) searchOpts.severity = opts.severity;
  const results = engine.search(query, searchOpts);
  output(results, formatErrorSearchResults(results));
});
errorKb.command("add").requiredOption("--title <title>", "Error title").requiredOption("--cause <cause>", "Error cause").requiredOption("--solution <solution>", "Error solution").option("--tags <tags>", "Comma-separated tags").option("--severity <level>", "Severity level (critical, high, medium, low)", "medium").description("Add a new error entry").action((opts) => {
  const engine = getErrorKBEngine();
  const tags = opts.tags ? opts.tags.split(",").map((t) => t.trim()) : [];
  const entry = engine.add({
    title: opts.title,
    cause: opts.cause,
    solution: opts.solution,
    tags,
    severity: opts.severity
  });
  output(entry, `Created error: ${entry.id}
Title: ${entry.title}
File: .claude/error-kb/errors/${entry.id}.md`);
});
errorKb.command("show").argument("<id>", "Error ID").description("Show error entry details").action((id) => {
  const engine = getErrorKBEngine();
  const entry = engine.show(id);
  if (!entry) return outputError(`Error not found: ${id}`);
  output(entry, formatErrorDetail(entry));
});
errorKb.command("update").argument("<id>", "Error ID").option("--occurrence <context>", "Record a new occurrence with context").option("--status <status>", "Update status (open, resolved, recurring, wontfix)").option("--severity <level>", "Update severity (critical, high, medium, low)").description("Update an error entry or record occurrence").action((id, opts) => {
  const engine = getErrorKBEngine();
  const existing = engine.show(id);
  if (!existing) return outputError(`Error not found: ${id}`);
  if (opts.occurrence) {
    engine.recordOccurrence(id, opts.occurrence);
    const updated = engine.show(id);
    output(updated, `Recorded occurrence for ${id}: ${opts.occurrence}`);
  } else {
    const patch = {};
    if (opts.status) patch.status = opts.status;
    if (opts.severity) patch.severity = opts.severity;
    engine.update(id, patch);
    const updated = engine.show(id);
    output(updated, `Updated error: ${id}`);
  }
});
errorKb.command("stats").description("Show error knowledge base statistics").action(() => {
  const engine = getErrorKBEngine();
  const stats = engine.getStats();
  output(stats, formatErrorKBStats(stats));
});
errorKb.command("delete").argument("<id>", "Error ID").description("Delete an error entry").action((id) => {
  const engine = getErrorKBEngine();
  const deleted = engine.delete(id);
  if (!deleted) return outputError(`Error not found: ${id}`);
  output({ deleted: true, error_id: id }, `Error deleted: ${id}`);
});
program.parse();
//# sourceMappingURL=index.js.map