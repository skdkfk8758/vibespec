#!/usr/bin/env node

// src/cli/index.ts
import { Command } from "commander";
import { createRequire as createRequire2 } from "module";

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
    overview.plans.forEach((plan, index) => {
      const num = numCircle(index + 1);
      const bar = formatProgressBar(plan.progress_pct, 12);
      const titleLine = `  ${num} ${plan.title}`;
      const gap = inner - titleLine.length - bar.length - 2;
      const paddedTitle = `${titleLine}${" ".repeat(Math.max(1, gap))}${bar}  `;
      lines.push(`\u2502${padRight(paddedTitle, inner)}\u2502`);
      const todoCount = plan.total_tasks - plan.done_tasks - plan.active_tasks - plan.blocked_tasks;
      const countsLine = `    done ${plan.done_tasks} \xB7 active ${plan.active_tasks} \xB7 blocked ${plan.blocked_tasks} \xB7 todo ${todoCount}`;
      lines.push(`\u2502${padRight(countsLine, inner)}\u2502`);
      lines.push(`\u2502${" ".repeat(inner)}\u2502`);
    });
    lines.push(`\u2514${"\u2500".repeat(inner)}\u2518`);
  }
  if (overview.backlog && overview.backlog.open > 0) {
    lines.push("");
    const bp = overview.backlog.by_priority;
    const priParts = [];
    if (bp.critical > 0) priParts.push(`critical: ${bp.critical}`);
    if (bp.high > 0) priParts.push(`high: ${bp.high}`);
    if (bp.medium > 0) priParts.push(`medium: ${bp.medium}`);
    if (bp.low > 0) priParts.push(`low: ${bp.low}`);
    lines.push(`Backlog: ${overview.backlog.open} open / ${overview.backlog.total} total  (${priParts.join(" \xB7 ")})`);
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
function formatPlanTree(plan, tasks) {
  const lines = [];
  const totalTasks = countTasks(tasks);
  const doneTasks = countTasksByStatus(tasks, ["done", "skipped"]);
  const pct = totalTasks === 0 ? 0 : Math.round(doneTasks / totalTasks * 100);
  lines.push(`${plan.title} (${plan.status})${" ".repeat(5)}${pct}%`);
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
  for (const plan of plans) {
    const created = plan.created_at?.split("T")[0] ?? "unknown";
    lines.push(
      `${padRight(plan.id, 14)}${padRight(plan.title, 26)}${padRight(plan.status, 12)}${created}`
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
function formatSkillUsage(skillStats) {
  if (skillStats.length === 0) return "";
  const lines = [];
  lines.push("Recent Skill Usage:");
  for (let i = 0; i < skillStats.length; i++) {
    const s = skillStats[i];
    const label = s.count === 1 ? "1 time" : `${s.count} times`;
    lines.push(`  ${numCircle(i + 1)} ${s.skill_name} (${label})`);
  }
  return lines.join("\n");
}
var PRIORITY_ICONS = {
  critical: "!!!!",
  high: "!!! ",
  medium: "!!  ",
  low: "!   "
};
var STATUS_LABELS = {
  open: "open",
  planned: "planned",
  done: "done",
  dropped: "dropped"
};
function formatBacklogList(items) {
  if (items.length === 0) return "No backlog items found.";
  const lines = [];
  const header = `${padRight("ID", 14)}${padRight("Pri", 6)}${padRight("Category", 12)}${padRight("Status", 10)}Title`;
  lines.push(header);
  for (const item of items) {
    const pri = PRIORITY_ICONS[item.priority] ?? "    ";
    const cat = padRight(item.category ?? "-", 12);
    const status = padRight(STATUS_LABELS[item.status] ?? item.status, 10);
    lines.push(`${padRight(item.id, 14)}${padRight(pri, 6)}${cat}${status}${item.title}`);
  }
  return lines.join("\n");
}
function formatBacklogDetail(item) {
  const tags = item.tags ? JSON.parse(item.tags).join(", ") : "(none)";
  const lines = [
    `ID:          ${item.id}`,
    `Title:       ${item.title}`,
    `Priority:    ${item.priority}`,
    `Category:    ${item.category ?? "-"}`,
    `Tags:        ${tags}`,
    `Complexity:  ${item.complexity_hint ?? "-"}`,
    `Source:      ${item.source ?? "-"}`,
    `Status:      ${item.status}`,
    `Plan:        ${item.plan_id ?? "-"}`,
    `Created:     ${item.created_at}`,
    `Updated:     ${item.updated_at}`
  ];
  if (item.description) {
    lines.push("");
    lines.push(item.description);
  }
  return lines.join("\n");
}
function formatBacklogStats(stats) {
  const lines = [];
  lines.push(`Total: ${stats.total}`);
  lines.push("");
  lines.push("By Priority:");
  lines.push(`  critical: ${stats.by_priority.critical}`);
  lines.push(`  high:     ${stats.by_priority.high}`);
  lines.push(`  medium:   ${stats.by_priority.medium}`);
  lines.push(`  low:      ${stats.by_priority.low}`);
  lines.push("");
  lines.push("By Status:");
  lines.push(`  open:     ${stats.by_status.open}`);
  lines.push(`  planned:  ${stats.by_status.planned}`);
  lines.push(`  done:     ${stats.by_status.done}`);
  lines.push(`  dropped:  ${stats.by_status.dropped}`);
  if (Object.keys(stats.by_category).length > 0) {
    lines.push("");
    lines.push("By Category:");
    for (const [cat, count] of Object.entries(stats.by_category)) {
      lines.push(`  ${padRight(cat + ":", 16)}${count}`);
    }
  }
  return lines.join("\n");
}
function formatBacklogBoard(items) {
  if (items.length === 0) return "No backlog items found.";
  const groups = {};
  for (const item of items) {
    const cat = item.category ?? "uncategorized";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  const lines = [];
  const categories = Object.keys(groups).sort();
  const colWidth = 30;
  lines.push(categories.map((c) => padRight(`[${c}]`, colWidth)).join("  "));
  lines.push(categories.map(() => "-".repeat(colWidth)).join("  "));
  const maxRows = Math.max(...categories.map((c) => groups[c].length));
  for (let row = 0; row < maxRows; row++) {
    const cols = [];
    for (const cat of categories) {
      const item = groups[cat][row];
      if (item) {
        const pri = PRIORITY_ICONS[item.priority] ?? "    ";
        const label = `${pri.trim()} ${item.title}`;
        cols.push(padRight(label.length > colWidth ? label.slice(0, colWidth - 1) + ">" : label, colWidth));
      } else {
        cols.push(" ".repeat(colWidth));
      }
    }
    lines.push(cols.join("  "));
  }
  return lines.join("\n");
}
function formatImportPreview(result) {
  const lines = [];
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      lines.push(`Error: ${err}`);
    }
    if (result.items.length === 0) return lines.join("\n");
    lines.push("");
  }
  lines.push(`Import preview (${result.source_prefix}): ${result.items.length} items`);
  lines.push("");
  if (result.items.length === 0) {
    lines.push("No items to import.");
    return lines.join("\n");
  }
  const header = `${padRight("#", 4)}${padRight("Priority", 10)}${padRight("Category", 12)}Title`;
  lines.push(header);
  for (let i = 0; i < result.items.length; i++) {
    const item = result.items[i];
    const pri = padRight(item.priority ?? "medium", 10);
    const cat = padRight(item.category ?? "-", 12);
    lines.push(`${padRight(String(i + 1), 4)}${pri}${cat}${item.title}`);
  }
  return lines.join("\n");
}
function formatRuleList(rules) {
  if (rules.length === 0) return "No rules found.";
  const lines = rules.map(
    (r) => `[${r.status}] [${r.enforcement}] ${r.id} | ${r.category} | ${r.title} (prevented: ${r.prevented})`
  );
  return lines.join("\n");
}
function formatRuleDetail(rule) {
  const lines = [
    `ID:          ${rule.id}`,
    `Title:       ${rule.title}`,
    `Category:    ${rule.category}`,
    `Status:      ${rule.status}`,
    `Enforcement: ${rule.enforcement}`,
    `Escalated:   ${rule.escalated_at ?? "-"}`,
    `Occurrences: ${rule.occurrences}`,
    `Prevented:   ${rule.prevented}`,
    `Rule path:   ${rule.rule_path}`,
    `Created:     ${rule.created_at}`,
    `Last triggered: ${rule.last_triggered_at ?? "-"}`
  ];
  return lines.join("\n");
}
function formatEscalationStatus(candidates) {
  if (candidates.length === 0) return "No escalation candidates found.";
  const lines = ["HARD \uC2B9\uACA9 \uC608\uC815 \uADDC\uCE59:", ""];
  for (const c of candidates) {
    lines.push(`  ${c.id} | ${c.title} (occurrences: ${c.occurrences}, ${c.days_since_creation}\uC77C \uACBD\uACFC)`);
  }
  return lines.join("\n");
}

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
    const raw = execSync("git rev-parse --abbrev-ref HEAD --git-dir", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const lines = raw.split("\n");
    const branch = lines[0];
    const gitDir = lines[1] ?? "";
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
  } catch (e) {
    console.error("[connection] Git root detection failed:", e instanceof Error ? e.message : e);
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
  const path4 = dbPath ?? resolveDbPath();
  _db = new Database(path4);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}
function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
var _closing = false;
function handleShutdown() {
  if (_closing) return;
  _closing = true;
  closeDb();
  process.exit(0);
}
process.on("SIGTERM", handleShutdown);
process.on("SIGINT", handleShutdown);

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

// src/core/utils.ts
var InvalidTransitionError = class extends Error {
  constructor(current, target) {
    super(`Invalid transition: ${current} \u2192 ${target}`);
    this.name = "InvalidTransitionError";
  }
};
function validateTransition(allowed, current, target, opts) {
  if (current === target) return;
  if (opts?.force) return;
  const validTargets = allowed[current];
  if (!validTargets || !validTargets.includes(target)) {
    throw new InvalidTransitionError(current, target);
  }
}
function generateId() {
  return nanoid(12);
}
function hasColumn(db, table, column) {
  const columns = db.pragma(`table_info(${table})`);
  return columns.some((c) => c.name === column);
}
function withTransaction(db, fn) {
  const tx = db.transaction(fn);
  return tx();
}
function buildUpdateQuery(table, id, fields) {
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== void 0) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) return null;
  values.push(id);
  return {
    sql: `UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`,
    params: values
  };
}

// src/core/engine/embeddings.ts
import { createRequire } from "module";
var require2 = createRequire(import.meta.url);
var pipelineInstance = null;
function loadVec(db) {
  try {
    const sqliteVec = require2("sqlite-vec");
    sqliteVec.load(db);
    return true;
  } catch {
    return false;
  }
}
async function initModel() {
  if (pipelineInstance) return;
  const { pipeline } = await import("@xenova/transformers");
  pipelineInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
}
async function generateEmbedding(text) {
  if (!pipelineInstance) {
    await initModel();
  }
  const output2 = await pipelineInstance(text, { pooling: "mean", normalize: true });
  return new Float32Array(output2.data.slice(0, 384));
}
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// src/core/db/schema.ts
var PLAN_PROGRESS_VIEW_SQL = `
  SELECT
    p.id, p.title, p.status, p.branch, p.worktree_name,
    COUNT(t.id) AS total_tasks,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS active_tasks,
    SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_tasks,
    ROUND(SUM(CASE WHEN t.status = 'done' THEN 1.0 ELSE 0 END) / MAX(COUNT(t.id), 1) * 100) AS progress_pct
  FROM plans p LEFT JOIN tasks t ON t.plan_id = p.id
  WHERE p.status IN ('active', 'draft')
  GROUP BY p.id
`;
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL CHECK(status IN ('draft','active','approved','completed','archived')) DEFAULT 'draft',
      summary     TEXT,
      spec        TEXT,
      branch      TEXT,
      worktree_name TEXT,
      qa_overrides TEXT,
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
      allowed_files TEXT,
      forbidden_patterns TEXT,
      shadow_result TEXT CHECK(shadow_result IN ('clean', 'warning', 'alert')),
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

    CREATE VIEW IF NOT EXISTS plan_progress AS ${PLAN_PROGRESS_VIEW_SQL};

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
      changed_files_detail TEXT,
      scope_violations TEXT,
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

    CREATE TABLE IF NOT EXISTS skill_usage (
      id          TEXT PRIMARY KEY,
      skill_name  TEXT NOT NULL,
      plan_id     TEXT REFERENCES plans(id),
      session_id  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_skill_usage_name ON skill_usage(skill_name);
    CREATE INDEX IF NOT EXISTS idx_skill_usage_created ON skill_usage(created_at);

    CREATE TABLE IF NOT EXISTS vs_config (
      "key"   TEXT PRIMARY KEY,
      "value" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backlog_items (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      description      TEXT,
      priority         TEXT NOT NULL CHECK(priority IN ('critical','high','medium','low')) DEFAULT 'medium',
      category         TEXT CHECK(category IN ('feature','bugfix','refactor','chore','idea')),
      tags             TEXT,
      complexity_hint  TEXT CHECK(complexity_hint IN ('simple','moderate','complex')),
      source           TEXT,
      status           TEXT NOT NULL CHECK(status IN ('open','planned','done','dropped')) DEFAULT 'open',
      plan_id          TEXT REFERENCES plans(id) ON DELETE SET NULL,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_backlog_status ON backlog_items(status);
    CREATE INDEX IF NOT EXISTS idx_backlog_priority ON backlog_items(priority);
    CREATE INDEX IF NOT EXISTS idx_backlog_plan ON backlog_items(plan_id);

    CREATE TABLE IF NOT EXISTS agent_handoffs (
      id            TEXT PRIMARY KEY,
      task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      plan_id       TEXT REFERENCES plans(id) ON DELETE CASCADE,
      agent_type    TEXT NOT NULL,
      attempt       INTEGER NOT NULL DEFAULT 1,
      input_hash    TEXT,
      verdict       TEXT,
      summary       TEXT,
      report_path   TEXT,
      changed_files TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_agent_handoffs_task ON agent_handoffs(task_id);
    CREATE INDEX IF NOT EXISTS idx_agent_handoffs_plan ON agent_handoffs(plan_id);

    CREATE TABLE IF NOT EXISTS wave_gates (
      id              TEXT PRIMARY KEY,
      plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      wave_number     INTEGER NOT NULL,
      task_ids        TEXT NOT NULL,
      verdict         TEXT NOT NULL CHECK(verdict IN ('GREEN', 'YELLOW', 'RED')),
      summary         TEXT,
      findings_count  INTEGER DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_wave_gates_plan ON wave_gates(plan_id);

    CREATE TABLE IF NOT EXISTS plan_revisions (
      id              TEXT PRIMARY KEY,
      plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      trigger_type    TEXT NOT NULL CHECK(trigger_type IN (
        'assumption_violation', 'scope_explosion',
        'design_flaw', 'complexity_exceeded', 'dependency_shift'
      )),
      trigger_source  TEXT,
      description     TEXT NOT NULL,
      changes         TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'proposed'
        CHECK(status IN ('proposed', 'approved', 'rejected')),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan ON plan_revisions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_plan_revisions_status ON plan_revisions(status);
  `);
  applyMigrations(db);
}
function applyMigrations(db) {
  const version = db.pragma("user_version", { simple: true });
  if (version < 1) {
    if (!hasColumn(db, "plans", "branch")) {
      db.exec("ALTER TABLE plans ADD COLUMN branch TEXT");
    }
    if (!hasColumn(db, "plans", "worktree_name")) {
      db.exec("ALTER TABLE plans ADD COLUMN worktree_name TEXT");
    }
    db.exec("DROP VIEW IF EXISTS plan_progress");
    db.exec(`CREATE VIEW plan_progress AS ${PLAN_PROGRESS_VIEW_SQL}`);
    db.pragma("user_version = 1");
  }
  if (version < 2) {
    if (!hasColumn(db, "tasks", "depends_on")) {
      db.exec("ALTER TABLE tasks ADD COLUMN depends_on TEXT");
    }
    db.pragma("user_version = 2");
  }
  if (version < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS skill_usage (
        id          TEXT PRIMARY KEY,
        skill_name  TEXT NOT NULL,
        plan_id     TEXT REFERENCES plans(id),
        session_id  TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_skill_usage_name ON skill_usage(skill_name);
      CREATE INDEX IF NOT EXISTS idx_skill_usage_created ON skill_usage(created_at);
    `);
    db.pragma("user_version = 3");
  }
  if (version < 4) {
    if (!hasColumn(db, "tasks", "allowed_files")) {
      db.exec("ALTER TABLE tasks ADD COLUMN allowed_files TEXT");
    }
    if (!hasColumn(db, "tasks", "forbidden_patterns")) {
      db.exec("ALTER TABLE tasks ADD COLUMN forbidden_patterns TEXT");
    }
    db.pragma("user_version = 4");
  }
  if (version < 5) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_metrics'").all();
    if (tables.length > 0) {
      if (!hasColumn(db, "task_metrics", "changed_files_detail")) {
        db.exec("ALTER TABLE task_metrics ADD COLUMN changed_files_detail TEXT");
      }
      if (!hasColumn(db, "task_metrics", "scope_violations")) {
        db.exec("ALTER TABLE task_metrics ADD COLUMN scope_violations TEXT");
      }
    }
    db.pragma("user_version = 5");
  }
  if (version < 6) {
    db.pragma("foreign_keys = OFF");
    db.exec(`DROP VIEW IF EXISTS plan_progress`);
    db.exec(`DROP VIEW IF EXISTS plan_metrics`);
    db.exec(`
      CREATE TABLE plans_new (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        status      TEXT NOT NULL CHECK(status IN ('draft','active','approved','completed','archived')) DEFAULT 'draft',
        summary     TEXT,
        spec        TEXT,
        branch      TEXT,
        worktree_name TEXT,
        qa_overrides TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
      INSERT INTO plans_new (id, title, status, summary, spec, branch, worktree_name, created_at, completed_at)
        SELECT id, title, status, summary, spec, branch, worktree_name, created_at, completed_at FROM plans;
      DROP TABLE plans;
      ALTER TABLE plans_new RENAME TO plans;
    `);
    db.pragma("foreign_keys = ON");
    db.exec(`CREATE VIEW plan_progress AS ${PLAN_PROGRESS_VIEW_SQL}`);
    db.exec(`
      CREATE VIEW plan_metrics AS
      SELECT
        p.id, p.title, p.status,
        COUNT(tm.id) AS recorded_tasks,
        ROUND(AVG(tm.duration_min), 2) AS avg_duration_min,
        SUM(CASE WHEN tm.final_status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count,
        SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done_count,
        SUM(CASE WHEN tm.has_concerns = 1 THEN 1 ELSE 0 END) AS concern_count,
        ROUND(SUM(CASE WHEN tm.final_status = 'done' THEN 1.0 ELSE 0 END) / MAX(COUNT(tm.id), 1) * 100) AS success_rate
      FROM plans p JOIN task_metrics tm ON tm.plan_id = p.id
      WHERE p.status IN ('completed', 'archived')
      GROUP BY p.id
    `);
    db.pragma("user_version = 6");
  }
  if (version < 7) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS self_improve_rules (
        id                TEXT PRIMARY KEY,
        error_kb_id       TEXT,
        title             TEXT NOT NULL,
        category          TEXT NOT NULL,
        rule_path         TEXT NOT NULL,
        occurrences       INTEGER DEFAULT 0,
        prevented         INTEGER DEFAULT 0,
        status            TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
        created_at        TEXT DEFAULT (datetime('now')),
        last_triggered_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_self_improve_rules_status ON self_improve_rules(status);
      CREATE INDEX IF NOT EXISTS idx_self_improve_rules_category ON self_improve_rules(category);
      CREATE INDEX IF NOT EXISTS idx_self_improve_rules_kb_id ON self_improve_rules(error_kb_id);
    `);
    db.pragma("user_version = 7");
  }
  if (version < 8) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS qa_runs (
        id                TEXT PRIMARY KEY,
        plan_id           TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        "trigger"         TEXT NOT NULL CHECK("trigger" IN ('manual', 'auto', 'milestone', 'post_merge')),
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
        summary           TEXT,
        total_scenarios   INTEGER DEFAULT 0,
        passed_scenarios  INTEGER DEFAULT 0,
        failed_scenarios  INTEGER DEFAULT 0,
        risk_score        REAL DEFAULT 0,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at      DATETIME
      );

      CREATE TABLE IF NOT EXISTS qa_scenarios (
        id                TEXT PRIMARY KEY,
        run_id            TEXT NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
        category          TEXT NOT NULL CHECK(category IN ('functional', 'integration', 'flow', 'regression', 'edge_case', 'acceptance', 'security')),
        title             TEXT NOT NULL,
        description       TEXT NOT NULL,
        priority          TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
        related_tasks     TEXT,
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'pass', 'fail', 'skip', 'warn')) DEFAULT 'pending',
        agent             TEXT,
        evidence          TEXT,
        source            TEXT NOT NULL DEFAULT 'final' CHECK(source IN ('seed', 'shadow', 'wave', 'final', 'manual')),
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS qa_findings (
        id                TEXT PRIMARY KEY,
        run_id            TEXT NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
        scenario_id       TEXT REFERENCES qa_scenarios(id) ON DELETE SET NULL,
        severity          TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
        category          TEXT NOT NULL CHECK(category IN ('bug', 'regression', 'missing_feature', 'inconsistency', 'performance', 'security', 'ux_issue', 'spec_gap')),
        title             TEXT NOT NULL,
        description       TEXT NOT NULL,
        affected_files    TEXT,
        related_task_id   TEXT REFERENCES tasks(id),
        fix_suggestion    TEXT,
        status            TEXT NOT NULL CHECK(status IN ('open', 'planned', 'fixed', 'wontfix', 'duplicate')) DEFAULT 'open',
        fix_plan_id       TEXT REFERENCES plans(id),
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE VIEW IF NOT EXISTS qa_run_summary AS
      SELECT
        qr.id,
        qr.plan_id,
        qr.status,
        qr.risk_score,
        qr.created_at,
        COUNT(DISTINCT qs.id) AS total_scenarios,
        SUM(CASE WHEN qs.status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN qs.status = 'fail' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN qs.status = 'warn' THEN 1 ELSE 0 END) AS warned,
        COUNT(DISTINCT qf.id) AS total_findings,
        SUM(CASE WHEN qf.severity = 'critical' THEN 1 ELSE 0 END) AS critical_findings,
        SUM(CASE WHEN qf.severity = 'high' THEN 1 ELSE 0 END) AS high_findings
      FROM qa_runs qr
      LEFT JOIN qa_scenarios qs ON qs.run_id = qr.id
      LEFT JOIN qa_findings qf ON qf.run_id = qr.id
      GROUP BY qr.id;

      CREATE INDEX IF NOT EXISTS idx_qa_runs_plan ON qa_runs(plan_id);
      CREATE INDEX IF NOT EXISTS idx_qa_scenarios_run ON qa_scenarios(run_id);
      CREATE INDEX IF NOT EXISTS idx_qa_scenarios_status ON qa_scenarios(status);
      CREATE INDEX IF NOT EXISTS idx_qa_findings_run ON qa_findings(run_id);
      CREATE INDEX IF NOT EXISTS idx_qa_findings_severity ON qa_findings(severity);
      CREATE INDEX IF NOT EXISTS idx_qa_findings_status ON qa_findings(status);
    `);
    db.pragma("user_version = 8");
  }
  if (version < 9) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS backlog_items (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        description      TEXT,
        priority         TEXT NOT NULL CHECK(priority IN ('critical','high','medium','low')) DEFAULT 'medium',
        category         TEXT CHECK(category IN ('feature','bugfix','refactor','chore','idea')),
        tags             TEXT,
        complexity_hint  TEXT CHECK(complexity_hint IN ('simple','moderate','complex')),
        source           TEXT,
        status           TEXT NOT NULL CHECK(status IN ('open','planned','done','dropped')) DEFAULT 'open',
        plan_id          TEXT REFERENCES plans(id) ON DELETE SET NULL,
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_backlog_status ON backlog_items(status);
      CREATE INDEX IF NOT EXISTS idx_backlog_priority ON backlog_items(priority);
      CREATE INDEX IF NOT EXISTS idx_backlog_plan ON backlog_items(plan_id);
    `);
    db.pragma("user_version = 9");
  }
  if (version < 10) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS merge_reports (
        id              TEXT PRIMARY KEY,
        plan_id         TEXT REFERENCES plans(id),
        commit_hash     TEXT NOT NULL,
        source_branch   TEXT NOT NULL,
        target_branch   TEXT NOT NULL,
        changes_summary TEXT NOT NULL,
        review_checklist TEXT NOT NULL,
        conflict_log    TEXT,
        ai_judgments    TEXT,
        verification    TEXT NOT NULL,
        task_ids        TEXT,
        report_path     TEXT NOT NULL,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_merge_reports_plan ON merge_reports(plan_id);
      CREATE INDEX IF NOT EXISTS idx_merge_reports_commit ON merge_reports(commit_hash);
    `);
    db.pragma("user_version = 10");
  }
  if (version < 11) {
    if (!hasColumn(db, "self_improve_rules", "enforcement")) {
      db.exec("ALTER TABLE self_improve_rules ADD COLUMN enforcement TEXT DEFAULT 'SOFT' CHECK(enforcement IN ('SOFT', 'HARD'))");
    }
    if (!hasColumn(db, "self_improve_rules", "escalated_at")) {
      db.exec("ALTER TABLE self_improve_rules ADD COLUMN escalated_at TEXT");
    }
    db.pragma("user_version = 11");
  }
  if (version < 12) {
    const vecLoaded = loadVec(db);
    if (vecLoaded) {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_errors USING vec0(embedding float[384]);
        CREATE TABLE IF NOT EXISTS error_embeddings (
          error_id TEXT PRIMARY KEY,
          vec_rowid INTEGER NOT NULL,
          model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_error_embeddings_vec ON error_embeddings(vec_rowid);
      `);
    }
    db.pragma("user_version = 12");
  }
  if (version < 13) {
    db.pragma("foreign_keys = OFF");
    db.exec("DROP VIEW IF EXISTS qa_run_summary");
    db.exec("DROP VIEW IF EXISTS plan_progress");
    db.exec("DROP VIEW IF EXISTS plan_metrics");
    db.exec(`
      CREATE TABLE qa_scenarios_new (
        id                TEXT PRIMARY KEY,
        run_id            TEXT NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
        category          TEXT NOT NULL CHECK(category IN ('functional', 'integration', 'flow', 'regression', 'edge_case', 'acceptance', 'security')),
        title             TEXT NOT NULL,
        description       TEXT NOT NULL,
        priority          TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
        related_tasks     TEXT,
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'pass', 'fail', 'skip', 'warn')) DEFAULT 'pending',
        agent             TEXT,
        evidence          TEXT,
        source            TEXT NOT NULL DEFAULT 'final' CHECK(source IN ('seed', 'shadow', 'wave', 'final', 'manual')),
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO qa_scenarios_new (id, run_id, category, title, description, priority, related_tasks, status, agent, evidence, created_at)
        SELECT id, run_id, category, title, description, priority, related_tasks, status, agent, evidence, created_at FROM qa_scenarios;
      DROP TABLE qa_scenarios;
      ALTER TABLE qa_scenarios_new RENAME TO qa_scenarios;
    `);
    db.exec(`
      CREATE TABLE qa_runs_new (
        id                TEXT PRIMARY KEY,
        plan_id           TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        "trigger"         TEXT NOT NULL CHECK("trigger" IN ('manual', 'auto', 'milestone', 'post_merge')),
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
        summary           TEXT,
        total_scenarios   INTEGER DEFAULT 0,
        passed_scenarios  INTEGER DEFAULT 0,
        failed_scenarios  INTEGER DEFAULT 0,
        risk_score        REAL DEFAULT 0,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at      DATETIME
      );
      INSERT INTO qa_runs_new SELECT * FROM qa_runs;
      DROP TABLE qa_runs;
      ALTER TABLE qa_runs_new RENAME TO qa_runs;
    `);
    db.pragma("foreign_keys = ON");
    db.exec(`
      CREATE VIEW IF NOT EXISTS qa_run_summary AS
      SELECT
        qr.id,
        qr.plan_id,
        qr.status,
        qr.risk_score,
        qr.created_at,
        COUNT(DISTINCT qs.id) AS total_scenarios,
        SUM(CASE WHEN qs.status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN qs.status = 'fail' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN qs.status = 'warn' THEN 1 ELSE 0 END) AS warned,
        COUNT(DISTINCT qf.id) AS total_findings,
        SUM(CASE WHEN qf.severity = 'critical' THEN 1 ELSE 0 END) AS critical_findings,
        SUM(CASE WHEN qf.severity = 'high' THEN 1 ELSE 0 END) AS high_findings
      FROM qa_runs qr
      LEFT JOIN qa_scenarios qs ON qs.run_id = qr.id
      LEFT JOIN qa_findings qf ON qf.run_id = qr.id
      GROUP BY qr.id
    `);
    db.exec(`CREATE VIEW IF NOT EXISTS plan_progress AS ${PLAN_PROGRESS_VIEW_SQL}`);
    const hasTM = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_metrics'").get();
    if (hasTM) {
      db.exec(`
        CREATE VIEW IF NOT EXISTS plan_metrics AS
        SELECT
          p.id, p.title, p.status,
          COUNT(tm.id) AS recorded_tasks,
          ROUND(AVG(tm.duration_min), 2) AS avg_duration_min,
          SUM(CASE WHEN tm.final_status = 'blocked' THEN 1 ELSE 0 END) AS blocked_count,
          SUM(CASE WHEN tm.final_status = 'done' THEN 1 ELSE 0 END) AS done_count,
          SUM(CASE WHEN tm.has_concerns = 1 THEN 1 ELSE 0 END) AS concern_count,
          ROUND(SUM(CASE WHEN tm.final_status = 'done' THEN 1.0 ELSE 0 END) / MAX(COUNT(tm.id), 1) * 100) AS success_rate
        FROM plans p JOIN task_metrics tm ON tm.plan_id = p.id
        WHERE p.status IN ('completed', 'archived')
        GROUP BY p.id
      `);
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_qa_runs_plan ON qa_runs(plan_id);
      CREATE INDEX IF NOT EXISTS idx_qa_scenarios_run ON qa_scenarios(run_id);
      CREATE INDEX IF NOT EXISTS idx_qa_scenarios_status ON qa_scenarios(status);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_handoffs (
        id            TEXT PRIMARY KEY,
        task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        plan_id       TEXT REFERENCES plans(id) ON DELETE CASCADE,
        agent_type    TEXT NOT NULL,
        attempt       INTEGER NOT NULL DEFAULT 1,
        input_hash    TEXT,
        verdict       TEXT,
        summary       TEXT,
        report_path   TEXT,
        changed_files TEXT,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_agent_handoffs_task ON agent_handoffs(task_id);
      CREATE INDEX IF NOT EXISTS idx_agent_handoffs_plan ON agent_handoffs(plan_id);

      CREATE TABLE IF NOT EXISTS wave_gates (
        id              TEXT PRIMARY KEY,
        plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        wave_number     INTEGER NOT NULL,
        task_ids        TEXT NOT NULL,
        verdict         TEXT NOT NULL CHECK(verdict IN ('GREEN', 'YELLOW', 'RED')),
        summary         TEXT,
        findings_count  INTEGER DEFAULT 0,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_wave_gates_plan ON wave_gates(plan_id);

      CREATE TABLE IF NOT EXISTS plan_revisions (
        id              TEXT PRIMARY KEY,
        plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        trigger_type    TEXT NOT NULL CHECK(trigger_type IN (
          'assumption_violation', 'scope_explosion',
          'design_flaw', 'complexity_exceeded', 'dependency_shift'
        )),
        trigger_source  TEXT,
        description     TEXT NOT NULL,
        changes         TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'proposed'
          CHECK(status IN ('proposed', 'approved', 'rejected')),
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan ON plan_revisions(plan_id);
      CREATE INDEX IF NOT EXISTS idx_plan_revisions_status ON plan_revisions(status);
    `);
    if (!hasColumn(db, "plans", "qa_overrides")) {
      db.exec("ALTER TABLE plans ADD COLUMN qa_overrides TEXT");
    }
    if (!hasColumn(db, "tasks", "shadow_result")) {
      db.exec("ALTER TABLE tasks ADD COLUMN shadow_result TEXT CHECK(shadow_result IN ('clean', 'warning', 'alert'))");
    }
    db.pragma("user_version = 13");
  }
}

// src/core/engine/dashboard.ts
var DashboardEngine = class {
  db;
  skillUsageModel;
  constructor(db, skillUsageModel) {
    this.db = db;
    this.skillUsageModel = skillUsageModel;
  }
  getSkillUsageSummary(days = 7) {
    if (!this.skillUsageModel) return [];
    return this.skillUsageModel.getStats(days).slice(0, 5);
  }
  getOverview() {
    const plans = this.db.prepare("SELECT * FROM plan_progress").all();
    const active_count = plans.filter((p) => p.status === "active").length;
    const total_tasks = plans.reduce((sum, p) => sum + p.total_tasks, 0);
    const done_tasks = plans.reduce((sum, p) => sum + p.done_tasks, 0);
    const backlog = this.getBacklogSummary();
    return { plans, active_count, total_tasks, done_tasks, backlog };
  }
  getBacklogSummary() {
    try {
      const rows = this.db.prepare(
        `SELECT priority, COUNT(*) AS count
           FROM backlog_items
           WHERE status = 'open'
           GROUP BY priority`
      ).all();
      const by_priority = { critical: 0, high: 0, medium: 0, low: 0 };
      let open = 0;
      for (const row of rows) {
        if (row.priority in by_priority) {
          by_priority[row.priority] = row.count;
        }
        open += row.count;
      }
      const totalRow = this.db.prepare("SELECT COUNT(*) AS total FROM backlog_items").get();
      return { total: totalRow.total, open, by_priority };
    } catch (e) {
      console.error("[dashboard] backlog query failed:", e instanceof Error ? e.message : e);
      return { total: 0, open: 0, by_priority: { critical: 0, high: 0, medium: 0, low: 0 } };
    }
  }
  getPlanSummary(planId) {
    const row = this.db.prepare("SELECT * FROM plan_progress WHERE id = ?").get(planId);
    return row ?? null;
  }
  getQASummary(planId) {
    try {
      const row = this.db.prepare(
        `SELECT * FROM qa_run_summary
           WHERE plan_id = ?
           ORDER BY created_at DESC LIMIT 1`
      ).get(planId);
      return row ?? null;
    } catch (e) {
      console.error("[dashboard] QA run query failed:", e instanceof Error ? e.message : e);
      return null;
    }
  }
  getOpenFindings(planId) {
    try {
      const rows = this.db.prepare(
        `SELECT qf.severity, COUNT(*) AS count
           FROM qa_findings qf
           JOIN qa_runs qr ON qr.id = qf.run_id
           WHERE qr.plan_id = ? AND qf.status = 'open'
           GROUP BY qf.severity`
      ).all(planId);
      const result = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const row of rows) {
        if (row.severity in result) {
          result[row.severity] = row.count;
        }
      }
      return result;
    } catch (e) {
      console.error("[dashboard] alert counts query failed:", e instanceof Error ? e.message : e);
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }
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
    const progress = this.getAllPlanProgress();
    for (const task of this.getStaleTasks()) {
      alerts.push({
        type: "stale",
        entity_type: "task",
        entity_id: task.id,
        message: `Task "${task.title}" has been in progress for ${task.days_stale} days with no activity`
      });
    }
    for (const plan of progress.filter((p) => p.blocked_tasks > 0)) {
      alerts.push({
        type: "blocked",
        entity_type: "plan",
        entity_id: plan.id,
        message: `Plan "${plan.title}" has ${plan.blocked_tasks} blocked task(s)`
      });
    }
    for (const plan of progress.filter((p) => p.progress_pct === 100 && p.status === "active")) {
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
    alerts.push(...this.getQAAlerts(progress));
    alerts.push(...this.getBacklogAlerts());
    return alerts;
  }
  getQAAlerts(progress) {
    const qaAlerts = [];
    if (progress.length === 0) return qaAlerts;
    try {
      const planMap = new Map(progress.map((p) => [p.id, p]));
      const highRiskRuns = this.db.prepare(
        `SELECT plan_id, risk_score FROM qa_runs
         WHERE status = 'completed' AND risk_score >= 0.5
         AND created_at = (SELECT MAX(created_at) FROM qa_runs qr2 WHERE qr2.plan_id = qa_runs.plan_id AND qr2.status = 'completed')
         GROUP BY plan_id`
      ).all();
      for (const row of highRiskRuns) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: "qa_risk_high",
            entity_type: "plan",
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"\uC758 QA \uB9AC\uC2A4\uD06C\uAC00 \uB192\uC2B5\uB2C8\uB2E4 (risk: ${row.risk_score.toFixed(2)})`
          });
        }
      }
      const openFindings = this.db.prepare(
        `SELECT qr.plan_id, COUNT(*) AS count FROM qa_findings qf
         JOIN qa_runs qr ON qr.id = qf.run_id
         WHERE qf.status = 'open' AND qf.severity IN ('critical', 'high')
         GROUP BY qr.plan_id`
      ).all();
      for (const row of openFindings) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: "qa_findings_open",
            entity_type: "plan",
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"\uC5D0 \uBBF8\uD574\uACB0 critical/high QA \uC774\uC288\uAC00 ${row.count}\uAC74 \uC788\uC2B5\uB2C8\uB2E4`
          });
        }
      }
      const staleRuns = this.db.prepare(
        `SELECT plan_id, CAST(JULIANDAY('now') - JULIANDAY(MAX(created_at)) AS INTEGER) AS days_since
         FROM qa_runs WHERE status = 'completed'
         GROUP BY plan_id
         HAVING days_since > 7`
      ).all();
      for (const row of staleRuns) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: "qa_stale",
            entity_type: "plan",
            entity_id: row.plan_id,
            message: `Plan "${plan.title}"\uC758 \uB9C8\uC9C0\uB9C9 QA\uAC00 ${row.days_since}\uC77C \uC804\uC785\uB2C8\uB2E4`
          });
        }
      }
      const blockedFixPlans = this.db.prepare(
        `SELECT DISTINCT qr.plan_id, COUNT(t.id) AS blocked_count
         FROM qa_findings qf
         JOIN qa_runs qr ON qr.id = qf.run_id
         JOIN tasks t ON t.plan_id = qf.fix_plan_id AND t.status = 'blocked'
         WHERE qf.fix_plan_id IS NOT NULL
         GROUP BY qr.plan_id`
      ).all();
      for (const row of blockedFixPlans) {
        const plan = planMap.get(row.plan_id);
        if (plan) {
          qaAlerts.push({
            type: "qa_fix_blocked",
            entity_type: "plan",
            entity_id: row.plan_id,
            message: `QA \uC218\uC815 \uD50C\uB79C\uC5D0 \uCC28\uB2E8\uB41C \uD0DC\uC2A4\uD06C\uAC00 ${row.blocked_count}\uAC74 \uC788\uC2B5\uB2C8\uB2E4`
          });
        }
      }
    } catch {
    }
    return qaAlerts;
  }
  getAllPlanProgress() {
    return this.db.prepare("SELECT * FROM plan_progress").all();
  }
  getStaleTasks(thresholdDays = 3) {
    return this.db.prepare(
      `SELECT t.*, CAST(JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) AS INTEGER) AS days_stale
         FROM tasks t
         JOIN events e ON e.entity_id = t.id
         WHERE t.status = 'in_progress'
         GROUP BY t.id
         HAVING JULIANDAY('now') - JULIANDAY(MAX(e.created_at)) > ?`
    ).all(thresholdDays);
  }
  getBlockedPlans() {
    return this.db.prepare("SELECT * FROM plan_progress WHERE blocked_tasks > 0").all();
  }
  getCompletablePlans() {
    return this.db.prepare(
      "SELECT * FROM plan_progress WHERE progress_pct = 100 AND status = 'active'"
    ).all();
  }
  getBacklogAlerts() {
    const alerts = [];
    try {
      const staleItems = this.db.prepare(
        `SELECT id, title, CAST(JULIANDAY('now') - JULIANDAY(created_at) AS INTEGER) AS days_old
         FROM backlog_items
         WHERE status = 'open'
         AND JULIANDAY('now') - JULIANDAY(created_at) > 7`
      ).all();
      for (const item of staleItems) {
        alerts.push({
          type: "backlog_stale",
          entity_type: "backlog",
          entity_id: item.id,
          message: `\uBC31\uB85C\uADF8 "${item.title}"\uC774 ${item.days_old}\uC77C\uAC04 \uBBF8\uCC98\uB9AC \uC0C1\uD0DC\uC785\uB2C8\uB2E4`
        });
      }
      const criticalItems = this.db.prepare(
        `SELECT id, title FROM backlog_items
         WHERE status = 'open' AND priority = 'critical'`
      ).all();
      for (const item of criticalItems) {
        alerts.push({
          type: "backlog_critical",
          entity_type: "backlog",
          entity_id: item.id,
          message: `\uBC31\uB85C\uADF8 "${item.title}"\uC774 critical \uC6B0\uC120\uC21C\uC704\uB85C \uBBF8\uCC98\uB9AC \uC0C1\uD0DC\uC785\uB2C8\uB2E4`
        });
      }
    } catch {
    }
    return alerts;
  }
  getForgottenPlans(thresholdDays = 7) {
    return this.db.prepare(
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

// src/core/models/task.ts
var TASK_TRANSITIONS = {
  todo: ["in_progress", "blocked", "skipped"],
  in_progress: ["done", "blocked", "todo"],
  blocked: ["todo", "in_progress", "skipped"],
  done: [],
  skipped: []
};
var ACTION_VERBS_KO = /(?:반환|표시|생성|포함|존재|동작|출력|실행|저장|삭제|변경|확인|처리|전달|호출|설정|검증|수행|발생|제공|응답|보여|보고|판정|매핑|이동)(?:한다|된다|하다|된다|합니다|됩니다|해야)/;
var ACTION_VERBS_EN = /\b(?:return|display|create|contain|exist|output|run|save|delete|change|verify|should|must|shall|throw|fail|pass|handle|accept|reject|render|show|send|receive|include|produce|emit|dispatch|call|update|remove|add|store|load|fetch|respond|report|generate|trigger|prevent|allow|deny|block|skip)s?\b/i;
var GIVEN_WHEN_THEN = /\b(?:given|when|then)\b/i;
function validateAcceptance(acceptance) {
  if (acceptance === null || acceptance === void 0) {
    return { valid: true, warnings: [] };
  }
  const trimmed = acceptance.trim();
  if (trimmed.length === 0) {
    return { valid: false, warnings: ["AC\uAC00 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4. acceptance criteria\uB97C \uC791\uC131\uD574\uC8FC\uC138\uC694."] };
  }
  const lines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const items = [];
  let currentItem = "";
  for (const line of lines) {
    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      if (currentItem) items.push(currentItem);
      currentItem = line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "");
    } else if (items.length === 0 && !currentItem) {
      currentItem = line;
    } else {
      currentItem += " " + line;
    }
  }
  if (currentItem) items.push(currentItem);
  if (items.length === 0) {
    items.push(trimmed);
  }
  const warnings = [];
  if (items.length === 1) {
    warnings.push("AC \uD56D\uBAA9\uC774 1\uAC1C\uBFD0\uC785\uB2C8\uB2E4. \uB2E4\uC591\uD55C \uC2DC\uB098\uB9AC\uC624\uB97C \uCEE4\uBC84\uD558\uB294 \uC5EC\uB7EC \uD56D\uBAA9\uC744 \uC791\uC131\uD558\uC138\uC694.");
  }
  const unverifiable = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const hasKoVerb = ACTION_VERBS_KO.test(item);
    const hasEnVerb = ACTION_VERBS_EN.test(item);
    const hasGWT = GIVEN_WHEN_THEN.test(item);
    if (!hasKoVerb && !hasEnVerb && !hasGWT) {
      unverifiable.push(i + 1);
    }
  }
  if (unverifiable.length > 0) {
    const itemNums = unverifiable.join(", ");
    warnings.push(
      `AC #${itemNums}\uBC88 \uD56D\uBAA9\uC5D0 \uAC80\uC99D \uAC00\uB2A5\uD55C \uB3D9\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. "~\uD55C\uB2E4/~\uB41C\uB2E4" \uB610\uB294 "should/must" \uD615\uD0DC\uB85C \uAE30\uB300 \uB3D9\uC791\uC744 \uBA85\uC2DC\uD558\uC138\uC694.`
    );
  }
  return {
    valid: warnings.length === 0,
    warnings
  };
}
var TaskModel = class {
  constructor(db, events) {
    this.db = db;
    this.events = events;
  }
  events;
  create(planId, title, opts) {
    const { warnings } = validateAcceptance(opts?.acceptance);
    const id = generateId();
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
    const allowedFiles = opts?.allowedFiles && opts.allowedFiles.length > 0 ? JSON.stringify(opts.allowedFiles) : null;
    const forbiddenPatterns = opts?.forbiddenPatterns && opts.forbiddenPatterns.length > 0 ? JSON.stringify(opts.forbiddenPatterns) : null;
    if (opts?.dependsOn && opts.dependsOn.length > 0) {
      this.validateDependencies(planId, id, opts.dependsOn);
    }
    this.db.prepare(
      `INSERT INTO tasks (id, plan_id, parent_id, title, status, depth, sort_order, spec, acceptance, depends_on, allowed_files, forbidden_patterns)
         VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      planId,
      opts?.parentId ?? null,
      title,
      depth,
      sortOrder,
      opts?.spec ?? null,
      opts?.acceptance ?? null,
      dependsOn,
      allowedFiles,
      forbiddenPatterns
    );
    const task = this.getById(id);
    this.events?.record("task", task.id, "created", null, JSON.stringify({ title, status: "todo" }));
    return Object.assign(task, { warnings });
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
  parseDeps(task) {
    if (!task.depends_on) return [];
    return JSON.parse(task.depends_on);
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
    const { warnings } = fields.acceptance !== void 0 ? validateAcceptance(fields.acceptance) : { warnings: [] };
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
          const task = this.getById(id);
          if (task) {
            this.validateDependencies(task.plan_id, id, depIds);
          }
        }
      }
      setClauses.push("depends_on = ?");
      values.push(fields.depends_on);
    }
    if (fields.allowed_files !== void 0) {
      setClauses.push("allowed_files = ?");
      values.push(fields.allowed_files);
    }
    if (fields.forbidden_patterns !== void 0) {
      setClauses.push("forbidden_patterns = ?");
      values.push(fields.forbidden_patterns);
    }
    if (setClauses.length === 0) {
      return Object.assign(this.getById(id), { warnings });
    }
    values.push(id);
    return withTransaction(this.db, () => {
      this.db.prepare(`UPDATE tasks SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
      const oldTask = this.getById(id);
      this.events?.record("task", id, "updated", null, JSON.stringify(fields));
      return Object.assign(oldTask, { warnings });
    });
  }
  updateStatus(id, status, opts) {
    const oldTask = this.getById(id);
    if (!oldTask) throw new Error(`Task not found: ${id}`);
    if (oldTask.status === status) return oldTask;
    validateTransition(TASK_TRANSITIONS, oldTask.status, status, opts);
    const oldStatus = oldTask.status;
    const completedAt = status === "done" ? (/* @__PURE__ */ new Date()).toISOString() : null;
    return withTransaction(this.db, () => {
      this.db.prepare("UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?").run(status, completedAt, id);
      this.events?.record("task", id, "status_changed", JSON.stringify({ status: oldStatus }), JSON.stringify({ status }));
      return this.getById(id);
    });
  }
  delete(id) {
    const task = this.getById(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    withTransaction(this.db, () => {
      this.db.prepare("DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE parent_id = ?)").run(id);
      this.db.prepare("DELETE FROM tasks WHERE parent_id = ?").run(id);
      this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(id);
      this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      this.events?.record("task", id, "deleted", JSON.stringify({ title: task.title }), null);
    });
  }
  validateDependencies(planId, taskId, dependsOn) {
    if (!dependsOn || dependsOn.length === 0) {
      return;
    }
    const allTasks = this.getByPlan(planId);
    const taskMap = this.buildTaskMap(allTasks);
    for (const depId of dependsOn) {
      if (depId === taskId) {
        throw new Error(`Task cannot depend on itself: ${depId}`);
      }
      const depTask = taskMap.get(depId);
      if (!depTask) {
        const crossPlanTask = this.getById(depId);
        if (crossPlanTask && crossPlanTask.plan_id !== planId) {
          throw new Error(
            `Dependency task ${depId} belongs to different plan: ${crossPlanTask.plan_id}`
          );
        }
        throw new Error(`Dependency task not found: ${depId}`);
      }
    }
    const visited = /* @__PURE__ */ new Set();
    const hasCycle = (currentId) => {
      if (currentId === taskId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      const current = taskMap.get(currentId);
      if (!current) return false;
      const deps = this.parseDeps(current);
      return deps.some((dep) => hasCycle(dep));
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
      const task = taskMap.get(id);
      const deps = this.parseDeps(task).filter((d) => includedSet.has(d));
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
    for (const task of todoTasks) {
      const deps = this.parseDeps(task);
      if (deps.length === 0) return task;
      const allDone = deps.every((id) => taskMap.get(id)?.status === "done");
      const anyPoisoned = deps.some((id) => {
        const s = taskMap.get(id)?.status;
        return s === "blocked" || s === "skipped";
      });
      if (allDone && !anyPoisoned) return task;
    }
    return null;
  }
  findPoisonedTasks(tasks, taskMap) {
    const poisoned = /* @__PURE__ */ new Set();
    const check = (id, visited) => {
      if (poisoned.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      const task = taskMap.get(id);
      if (!task) return false;
      if (task.status === "blocked" || task.status === "skipped") {
        poisoned.add(id);
        return true;
      }
      for (const dep of this.parseDeps(task)) {
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
  record(optsOrEntityType, entityId, eventType, oldValue, newValue, sessionId) {
    let opts;
    if (typeof optsOrEntityType === "object") {
      opts = optsOrEntityType;
    } else {
      opts = {
        entityType: optsOrEntityType,
        entityId,
        eventType,
        oldValue,
        newValue,
        sessionId
      };
    }
    const stmt = this.db.prepare(
      `INSERT INTO events (entity_type, entity_id, event_type, old_value, new_value, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      opts.entityType,
      opts.entityId,
      opts.eventType,
      opts.oldValue ?? null,
      opts.newValue ?? null,
      opts.sessionId ?? null
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
var PLAN_TRANSITIONS = {
  draft: ["active"],
  active: ["approved", "completed", "archived"],
  approved: ["completed", "archived"],
  completed: ["archived"],
  archived: []
};
var PlanModel = class {
  db;
  events;
  handoffs;
  constructor(db, events, handoffs) {
    this.db = db;
    this.events = events;
    this.handoffs = handoffs;
  }
  create(title, spec, summary) {
    const id = generateId();
    const ctx = detectGitContext();
    this.db.prepare(
      `INSERT INTO plans (id, title, status, spec, summary, branch, worktree_name) VALUES (?, ?, 'draft', ?, ?, ?, ?)`
    ).run(id, title, spec ?? null, summary ?? null, ctx.branch, ctx.worktreeName);
    const plan = this.requireById(id);
    this.events?.record("plan", plan.id, "created", null, JSON.stringify({ title, status: "draft", branch: ctx.branch }));
    return plan;
  }
  getById(id) {
    const row = this.db.prepare(`SELECT * FROM plans WHERE id = ?`).get(id);
    return row ?? null;
  }
  requireById(id) {
    const plan = this.getById(id);
    if (!plan) throw new Error(`Plan not found: ${id}`);
    return plan;
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
    return this.db.prepare(`SELECT * FROM plans ${where} ORDER BY created_at DESC`).all(...params);
  }
  update(id, fields) {
    const plan = this.requireById(id);
    const query = buildUpdateQuery("plans", id, fields);
    if (!query) return plan;
    const oldFields = {};
    const newFields = {};
    for (const key of Object.keys(fields)) {
      if (fields[key] !== void 0) {
        oldFields[key] = plan[key];
        newFields[key] = fields[key];
      }
    }
    this.db.prepare(query.sql).run(...query.params);
    this.events?.record("plan", id, "updated", JSON.stringify(oldFields), JSON.stringify(newFields));
    return this.requireById(id);
  }
  transitionStatus(id, newStatus, eventType, guard, extra, opts) {
    const plan = this.requireById(id);
    if (plan.status === newStatus) return plan;
    validateTransition(PLAN_TRANSITIONS, plan.status, newStatus, opts);
    if (guard) guard(plan);
    const oldStatus = plan.status;
    withTransaction(this.db, () => {
      const sql = extra ? `UPDATE plans SET status = ?, ${extra} WHERE id = ?` : `UPDATE plans SET status = ? WHERE id = ?`;
      this.db.prepare(sql).run(newStatus, id);
      this.events?.record(
        "plan",
        id,
        eventType,
        JSON.stringify({ status: oldStatus }),
        JSON.stringify({ status: newStatus })
      );
    });
    if ((newStatus === "completed" || newStatus === "archived") && this.handoffs) {
      try {
        this.handoffs.cleanByPlan(id);
      } catch {
      }
    }
    return this.requireById(id);
  }
  activate(id, opts) {
    return this.transitionStatus(id, "active", "activated", void 0, void 0, opts);
  }
  complete(id, opts) {
    return this.transitionStatus(id, "completed", "completed", void 0, "completed_at = CURRENT_TIMESTAMP", opts);
  }
  approve(id, opts) {
    return this.transitionStatus(id, "approved", "approved", void 0, void 0, opts);
  }
  archive(id, opts) {
    return this.transitionStatus(id, "archived", "archived", void 0, void 0, opts);
  }
  delete(id) {
    const plan = this.requireById(id);
    if (plan.status !== "draft") {
      throw new Error(`Only draft plans can be deleted. Current status: ${plan.status}`);
    }
    withTransaction(this.db, () => {
      this.db.prepare("DELETE FROM events WHERE entity_id IN (SELECT id FROM tasks WHERE plan_id = ?)").run(id);
      this.db.prepare("DELETE FROM events WHERE entity_id = ?").run(id);
      this.db.prepare("DELETE FROM tasks WHERE plan_id = ?").run(id);
      this.db.prepare("DELETE FROM plans WHERE id = ?").run(id);
    });
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
  getById(id) {
    return this.db.prepare("SELECT * FROM context_log WHERE id = ?").get(id) ?? null;
  }
  search(tag, limit = 100) {
    return this.db.prepare(
      `SELECT * FROM context_log WHERE summary LIKE ? ORDER BY created_at DESC, id DESC LIMIT ?`
    ).all(`%${tag}%`, limit);
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
         (task_id, plan_id, duration_min, final_status, block_reason, impl_status, test_count, files_changed, has_concerns, changed_files_detail, scope_violations)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      taskId,
      planId,
      durationMin,
      finalStatus,
      blockReason,
      metrics?.impl_status ?? null,
      metrics?.test_count ?? null,
      metrics?.files_changed ?? null,
      metrics?.has_concerns ? 1 : 0,
      metrics?.changed_files_detail ?? null,
      metrics?.scope_violations ?? null
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

// src/core/models/skill-usage.ts
var SkillUsageModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  record(skillName, opts) {
    const id = generateId();
    const planId = opts?.planId ?? null;
    const sessionId = opts?.sessionId ?? null;
    const createdAt = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
    this.db.prepare(
      `INSERT INTO skill_usage (id, skill_name, plan_id, session_id, created_at)
         VALUES (?, ?, ?, ?, ?)`
    ).run(id, skillName, planId, sessionId, createdAt);
    return { id, skill_name: skillName, plan_id: planId, session_id: sessionId, created_at: createdAt };
  }
  getStats(days) {
    const base = `SELECT skill_name, COUNT(*) as count, MAX(created_at) as last_used FROM skill_usage`;
    const suffix = `GROUP BY skill_name ORDER BY count DESC`;
    if (days !== void 0) {
      return this.db.prepare(`${base} WHERE created_at >= datetime('now', '-' || ? || ' days') ${suffix}`).all(days);
    }
    return this.db.prepare(`${base} ${suffix}`).all();
  }
  getRecentUsage(limit) {
    return this.db.prepare(
      `SELECT * FROM skill_usage
         ORDER BY created_at DESC
         LIMIT ?`
    ).all(limit ?? 20);
  }
};

// src/core/models/qa-run.ts
var QARunModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(planId, trigger) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_runs (id, plan_id, "trigger") VALUES (?, ?, ?)`
    ).run(id, planId, trigger);
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare(`SELECT * FROM qa_runs WHERE id = ?`).get(id);
    return row ?? null;
  }
  list(planId) {
    if (planId) {
      return this.db.prepare(
        `SELECT * FROM qa_runs WHERE plan_id = ? ORDER BY created_at DESC`
      ).all(planId);
    }
    return this.db.prepare(
      `SELECT * FROM qa_runs ORDER BY created_at DESC`
    ).all();
  }
  updateStatus(id, status, summary) {
    this.db.prepare(
      `UPDATE qa_runs SET status = ?, summary = ?,
       completed_at = CASE WHEN ? IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = ?`
    ).run(status, summary ?? null, status, id);
    return this.get(id);
  }
  updateScores(id, total, passed, failed, riskScore) {
    this.db.prepare(
      `UPDATE qa_runs SET total_scenarios = ?, passed_scenarios = ?, failed_scenarios = ?, risk_score = ? WHERE id = ?`
    ).run(total, passed, failed, riskScore, id);
  }
  getLatestByPlan(planId) {
    const row = this.db.prepare(
      `SELECT * FROM qa_runs WHERE plan_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(planId);
    return row ?? null;
  }
  getSummary(id) {
    const row = this.db.prepare(
      `SELECT * FROM qa_run_summary WHERE id = ?`
    ).get(id);
    return row ?? null;
  }
};

// src/core/models/qa-scenario.ts
var QAScenarioModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(runId, data) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_scenarios (id, run_id, category, title, description, priority, related_tasks, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, runId, data.category, data.title, data.description, data.priority, data.related_tasks ?? null, data.source ?? "final");
    return this.get(id);
  }
  bulkCreate(runId, scenarios) {
    const insert = this.db.prepare(
      `INSERT INTO qa_scenarios (id, run_id, category, title, description, priority, related_tasks, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const ids = [];
    const tx = this.db.transaction(() => {
      for (const s of scenarios) {
        const id = generateId();
        insert.run(id, runId, s.category, s.title, s.description, s.priority, s.related_tasks ?? null, s.source ?? "final");
        ids.push(id);
      }
    });
    tx();
    return ids.map((id) => this.get(id));
  }
  get(id) {
    const row = this.db.prepare(`SELECT * FROM qa_scenarios WHERE id = ?`).get(id);
    return row ?? null;
  }
  listByRun(runId, filters) {
    const conditions = ["run_id = ?"];
    const params = [runId];
    if (filters?.category) {
      conditions.push("category = ?");
      params.push(filters.category);
    }
    if (filters?.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.agent) {
      conditions.push("agent = ?");
      params.push(filters.agent);
    }
    if (filters?.source) {
      conditions.push("source = ?");
      params.push(filters.source);
    }
    const where = conditions.join(" AND ");
    return this.db.prepare(
      `SELECT * FROM qa_scenarios WHERE ${where} ORDER BY created_at ASC`
    ).all(...params);
  }
  updateStatus(id, status, evidence) {
    if (evidence !== void 0) {
      this.db.prepare(
        `UPDATE qa_scenarios SET status = ?, evidence = ? WHERE id = ?`
      ).run(status, evidence, id);
    } else {
      this.db.prepare(
        `UPDATE qa_scenarios SET status = ? WHERE id = ?`
      ).run(status, id);
    }
  }
  listByPlanSource(planId, source) {
    return this.db.prepare(
      `SELECT s.* FROM qa_scenarios s
       INNER JOIN qa_runs r ON s.run_id = r.id
       WHERE r.plan_id = ? AND s.source = ?
       ORDER BY s.created_at ASC`
    ).all(planId, source);
  }
  getStatsByRun(runId) {
    return this.db.prepare(
      `SELECT
        category,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) AS failed
      FROM qa_scenarios
      WHERE run_id = ?
      GROUP BY category`
    ).all(runId);
  }
};

// src/core/models/qa-finding.ts
var QAFindingModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(runId, data) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO qa_findings (id, run_id, scenario_id, severity, category, title, description, affected_files, related_task_id, fix_suggestion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      runId,
      data.scenario_id ?? null,
      data.severity,
      data.category,
      data.title,
      data.description,
      data.affected_files ?? null,
      data.related_task_id ?? null,
      data.fix_suggestion ?? null
    );
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare(`SELECT * FROM qa_findings WHERE id = ?`).get(id);
    return row ?? null;
  }
  list(filters) {
    const conditions = [];
    const params = [];
    if (filters?.runId) {
      conditions.push("run_id = ?");
      params.push(filters.runId);
    }
    if (filters?.severity) {
      conditions.push("severity = ?");
      params.push(filters.severity);
    }
    if (filters?.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.category) {
      conditions.push("category = ?");
      params.push(filters.category);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.prepare(
      `SELECT * FROM qa_findings ${where} ORDER BY created_at DESC`
    ).all(...params);
  }
  updateStatus(id, status, fixPlanId) {
    this.db.prepare(
      `UPDATE qa_findings SET status = ?,
       fix_plan_id = CASE WHEN ? IS NOT NULL THEN ? ELSE fix_plan_id END
       WHERE id = ?`
    ).run(status, fixPlanId ?? null, fixPlanId ?? null, id);
  }
  getOpenByPlan(planId) {
    return this.db.prepare(
      `SELECT qf.* FROM qa_findings qf
       JOIN qa_runs qr ON qr.id = qf.run_id
       WHERE qr.plan_id = ? AND qf.status = 'open'
       ORDER BY qf.created_at DESC`
    ).all(planId);
  }
  getStatsByRun(runId) {
    return this.db.prepare(
      `SELECT severity, COUNT(*) AS count
       FROM qa_findings
       WHERE run_id = ?
       GROUP BY severity`
    ).all(runId);
  }
};

// src/core/models/backlog.ts
var BacklogModel = class {
  db;
  events;
  constructor(db, events) {
    this.db = db;
    this.events = events;
  }
  create(item) {
    const id = generateId();
    const tags = item.tags ? JSON.stringify(item.tags) : null;
    this.db.prepare(`
      INSERT INTO backlog_items (id, title, description, priority, category, tags, complexity_hint, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.title,
      item.description ?? null,
      item.priority ?? "medium",
      item.category ?? null,
      tags,
      item.complexity_hint ?? null,
      item.source ?? null
    );
    const created = this.requireById(id);
    this.events?.record("backlog", id, "created", null, JSON.stringify({ title: item.title }));
    return created;
  }
  getById(id) {
    const row = this.db.prepare("SELECT * FROM backlog_items WHERE id = ?").get(id);
    return row ?? null;
  }
  requireById(id) {
    const item = this.getById(id);
    if (!item) throw new Error(`Backlog item not found: ${id}`);
    return item;
  }
  findByTitle(title, status) {
    const statusFilter = status ? "AND status = ?" : "";
    const params = status ? [title, status] : [title];
    const row = this.db.prepare(
      `SELECT * FROM backlog_items WHERE title = ? ${statusFilter}`
    ).get(...params);
    return row ?? null;
  }
  list(filter) {
    const conditions = [];
    const params = [];
    if (filter?.status) {
      conditions.push("b.status = ?");
      params.push(filter.status);
    }
    if (filter?.priority) {
      conditions.push("b.priority = ?");
      params.push(filter.priority);
    }
    if (filter?.category) {
      conditions.push("b.category = ?");
      params.push(filter.category);
    }
    let sql;
    if (filter?.tag) {
      conditions.push("EXISTS (SELECT 1 FROM json_each(b.tags) WHERE json_each.value = ?)");
      params.push(filter.tag);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const priorityOrder = "CASE b.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END";
    sql = `SELECT b.* FROM backlog_items b ${where} ORDER BY ${priorityOrder}, b.created_at DESC`;
    return this.db.prepare(sql).all(...params);
  }
  update(id, fields) {
    const item = this.requireById(id);
    const dbFields = { ...fields, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    const query = buildUpdateQuery("backlog_items", id, dbFields);
    if (!query) return item;
    const oldFields = {};
    const newFields = {};
    for (const key of Object.keys(fields)) {
      if (fields[key] !== void 0) {
        oldFields[key] = item[key];
        newFields[key] = fields[key];
      }
    }
    this.db.prepare(query.sql).run(...query.params);
    if (fields.status && fields.status !== item.status) {
      this.events?.record("backlog", id, "status_changed", JSON.stringify({ status: item.status }), JSON.stringify({ status: fields.status }));
    } else {
      this.events?.record("backlog", id, "updated", JSON.stringify(oldFields), JSON.stringify(newFields));
    }
    return this.requireById(id);
  }
  promote(id, planId) {
    const item = this.requireById(id);
    if (item.status !== "open") {
      throw new Error(`Only open backlog items can be promoted. Current status: ${item.status}`);
    }
    this.db.prepare(
      "UPDATE backlog_items SET status = ?, plan_id = ?, updated_at = ? WHERE id = ?"
    ).run("planned", planId, (/* @__PURE__ */ new Date()).toISOString(), id);
    this.events?.record(
      "backlog",
      id,
      "status_changed",
      JSON.stringify({ status: "open" }),
      JSON.stringify({ status: "planned", plan_id: planId })
    );
    return this.requireById(id);
  }
  delete(id) {
    this.requireById(id);
    this.db.prepare("DELETE FROM events WHERE entity_type = ? AND entity_id = ?").run("backlog", id);
    this.db.prepare("DELETE FROM backlog_items WHERE id = ?").run(id);
  }
  getStats() {
    const items = this.db.prepare("SELECT priority, category, status FROM backlog_items").all();
    const stats = {
      total: items.length,
      by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
      by_category: {},
      by_status: { open: 0, planned: 0, done: 0, dropped: 0 }
    };
    for (const item of items) {
      stats.by_priority[item.priority]++;
      stats.by_status[item.status]++;
      const cat = item.category ?? "uncategorized";
      stats.by_category[cat] = (stats.by_category[cat] ?? 0) + 1;
    }
    return stats;
  }
};

// src/core/models/merge-report.ts
function rowToReport(row) {
  return {
    id: row.id,
    plan_id: row.plan_id,
    commit_hash: row.commit_hash,
    source_branch: row.source_branch,
    target_branch: row.target_branch,
    changes_summary: JSON.parse(row.changes_summary),
    review_checklist: JSON.parse(row.review_checklist),
    conflict_log: row.conflict_log ? JSON.parse(row.conflict_log) : null,
    ai_judgments: row.ai_judgments ? JSON.parse(row.ai_judgments) : null,
    verification: JSON.parse(row.verification),
    task_ids: row.task_ids ? JSON.parse(row.task_ids) : null,
    report_path: row.report_path,
    created_at: row.created_at
  };
}
var MergeReportModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(data) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO merge_reports (id, plan_id, commit_hash, source_branch, target_branch,
        changes_summary, review_checklist, conflict_log, ai_judgments, verification, task_ids, report_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.plan_id ?? null,
      data.commit_hash,
      data.source_branch,
      data.target_branch,
      JSON.stringify(data.changes_summary),
      JSON.stringify(data.review_checklist),
      data.conflict_log ? JSON.stringify(data.conflict_log) : null,
      data.ai_judgments ? JSON.stringify(data.ai_judgments) : null,
      JSON.stringify(data.verification),
      data.task_ids ? JSON.stringify(data.task_ids) : null,
      data.report_path
    );
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare(
      `SELECT * FROM merge_reports WHERE id = ?`
    ).get(id);
    return row ? rowToReport(row) : null;
  }
  getByCommit(hash) {
    const row = this.db.prepare(
      `SELECT * FROM merge_reports WHERE commit_hash = ? ORDER BY created_at DESC LIMIT 1`
    ).get(hash);
    return row ? rowToReport(row) : null;
  }
  getByPlan(planId) {
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports WHERE plan_id = ? ORDER BY created_at DESC`
    ).all(planId);
    return rows.map(rowToReport);
  }
  getLatest(limit = 5) {
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports ORDER BY created_at DESC LIMIT ?`
    ).all(limit);
    return rows.map(rowToReport);
  }
  list(opts) {
    if (opts?.planId) {
      const rows2 = this.db.prepare(
        `SELECT * FROM merge_reports WHERE plan_id = ? ORDER BY created_at DESC LIMIT ?`
      ).all(opts.planId, opts.limit ?? 100);
      return rows2.map(rowToReport);
    }
    const rows = this.db.prepare(
      `SELECT * FROM merge_reports ORDER BY created_at DESC LIMIT ?`
    ).all(opts?.limit ?? 100);
    return rows.map(rowToReport);
  }
};

// src/core/models/agent-handoff.ts
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, writeFileSync, rmSync } from "fs";
import { join } from "path";
var DEFAULT_HANDOFF_DIR = join(process.cwd(), ".claude", "handoff");
var AgentHandoffModel = class {
  db;
  baseDir;
  constructor(db, baseDir) {
    this.db = db;
    this.baseDir = baseDir ?? DEFAULT_HANDOFF_DIR;
  }
  create(taskId, planId, agentType, attempt, verdict, summary, reportPath, changedFiles, inputHash) {
    const existing = this.db.prepare(
      `SELECT id FROM agent_handoffs WHERE task_id = ? AND agent_type = ? AND attempt = ?`
    ).get(taskId, agentType, attempt);
    if (existing) {
      throw new Error(`Duplicate handoff: task=${taskId}, agent=${agentType}, attempt=${attempt}`);
    }
    const id = generateId();
    this.db.prepare(
      `INSERT INTO agent_handoffs (id, task_id, plan_id, agent_type, attempt, verdict, summary, report_path, changed_files, input_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, taskId, planId, agentType, attempt, verdict, summary, reportPath ?? null, changedFiles ?? null, inputHash ?? null);
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare(`SELECT * FROM agent_handoffs WHERE id = ?`).get(id);
    return row ?? null;
  }
  getByTask(taskId, agentType, attempt) {
    const conditions = ["task_id = ?"];
    const params = [taskId];
    if (agentType) {
      conditions.push("agent_type = ?");
      params.push(agentType);
    }
    if (attempt !== void 0) {
      conditions.push("attempt = ?");
      params.push(attempt);
    }
    return this.db.prepare(
      `SELECT * FROM agent_handoffs WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`
    ).all(...params);
  }
  list(planId, taskId) {
    const conditions = [];
    const params = [];
    if (planId) {
      conditions.push("plan_id = ?");
      params.push(planId);
    }
    if (taskId) {
      conditions.push("task_id = ?");
      params.push(taskId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.prepare(
      `SELECT * FROM agent_handoffs ${where} ORDER BY created_at DESC`
    ).all(...params);
  }
  cleanByPlan(planId) {
    const handoffs = this.list(planId);
    const taskIds = new Set(handoffs.map((h) => h.task_id).filter(Boolean));
    this.db.prepare(`DELETE FROM agent_handoffs WHERE plan_id = ?`).run(planId);
    for (const tid of taskIds) {
      const taskDir = join(this.baseDir, tid);
      if (existsSync2(taskDir)) {
        rmSync(taskDir, { recursive: true, force: true });
      }
    }
  }
  writeHandoffReport(taskId, agentType, attempt, data) {
    const taskDir = join(this.baseDir, taskId);
    if (!existsSync2(taskDir)) {
      mkdirSync(taskDir, { recursive: true });
    }
    const filePath = join(taskDir, `${agentType}_${attempt}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return filePath;
  }
  readHandoffReport(taskId, agentType, attempt) {
    const filePath = join(this.baseDir, taskId, `${agentType}_${attempt}.json`);
    if (!existsSync2(filePath)) {
      return null;
    }
    return JSON.parse(readFileSync2(filePath, "utf-8"));
  }
  cleanHandoffFiles(planId) {
    const handoffs = this.list(planId);
    const taskIds = new Set(handoffs.map((h) => h.task_id).filter(Boolean));
    for (const tid of taskIds) {
      const taskDir = join(this.baseDir, tid);
      if (existsSync2(taskDir)) {
        rmSync(taskDir, { recursive: true, force: true });
      }
    }
  }
};

// src/core/models/wave-gate.ts
var WaveGateModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(planId, waveNumber, taskIds, verdict, summary, findingsCount) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO wave_gates (id, plan_id, wave_number, task_ids, verdict, summary, findings_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, planId, waveNumber, JSON.stringify(taskIds), verdict, summary ?? null, findingsCount ?? 0);
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare("SELECT * FROM wave_gates WHERE id = ?").get(id);
    return row ?? null;
  }
  listByPlan(planId) {
    return this.db.prepare(
      "SELECT * FROM wave_gates WHERE plan_id = ? ORDER BY wave_number ASC"
    ).all(planId);
  }
};

// src/core/models/plan-revision.ts
var PlanRevisionModel = class {
  db;
  constructor(db) {
    this.db = db;
  }
  create(planId, triggerType, triggerSource, description, changes) {
    const id = generateId();
    this.db.prepare(
      `INSERT INTO plan_revisions (id, plan_id, trigger_type, trigger_source, description, changes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, planId, triggerType, triggerSource, description, changes);
    return this.get(id);
  }
  get(id) {
    const row = this.db.prepare("SELECT * FROM plan_revisions WHERE id = ?").get(id);
    return row ?? null;
  }
  listByPlan(planId) {
    return this.db.prepare(
      "SELECT * FROM plan_revisions WHERE plan_id = ? ORDER BY created_at DESC"
    ).all(planId);
  }
  updateStatus(id, status) {
    this.db.prepare(
      "UPDATE plan_revisions SET status = ? WHERE id = ?"
    ).run(status, id);
    return this.get(id);
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

// src/cli/shared.ts
var jsonMode = false;
function setJsonMode(mode) {
  jsonMode = mode;
}
function getJsonMode() {
  return jsonMode;
}
var verboseMode = false;
function setVerboseMode(mode) {
  verboseMode = mode;
}
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
function withErrorHandler(fn) {
  try {
    fn();
  } catch (e) {
    if (verboseMode && e instanceof Error && e.stack) {
      console.error(e.stack);
    }
    outputError(e instanceof Error ? e.message : String(e));
  }
}
function initModels() {
  const db = getDb();
  initSchema(db);
  const events = new EventModel(db);
  const agentHandoffModel = new AgentHandoffModel(db);
  const planModel = new PlanModel(db, events, agentHandoffModel);
  const taskModel = new TaskModel(db, events);
  const contextModel = new ContextModel(db);
  const taskMetricsModel = new TaskMetricsModel(db);
  const skillUsageModel = new SkillUsageModel(db);
  const lifecycle = new LifecycleEngine(db, planModel, taskModel, events);
  const dashboard = new DashboardEngine(db, skillUsageModel);
  const alerts = new AlertsEngine(db);
  const stats = new StatsEngine(db);
  const insights = new InsightsEngine(db);
  const qaRunModel = new QARunModel(db);
  const qaScenarioModel = new QAScenarioModel(db);
  const qaFindingModel = new QAFindingModel(db);
  const backlogModel = new BacklogModel(db, events);
  const mergeReportModel = new MergeReportModel(db);
  const waveGateModel = new WaveGateModel(db);
  const planRevisionModel = new PlanRevisionModel(db);
  return { db, events, planModel, taskModel, contextModel, taskMetricsModel, skillUsageModel, lifecycle, dashboard, alerts, stats, insights, qaRunModel, qaScenarioModel, qaFindingModel, backlogModel, mergeReportModel, agentHandoffModel, waveGateModel, planRevisionModel };
}
function initDb() {
  const db = getDb();
  initSchema(db);
  return db;
}

// src/cli/commands/governance.ts
import { resolve as resolve2, join as join2 } from "path";
import { existsSync as existsSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync2, chmodSync } from "fs";

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

// src/cli/commands/governance.ts
function manageHook(action, hookId, toolName, scriptPath) {
  const settingsDir = join2(process.cwd(), ".claude");
  const settingsPath = join2(settingsDir, "settings.local.json");
  let settings = {};
  if (existsSync3(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync3(settingsPath, "utf8"));
    } catch {
      settings = {};
    }
  }
  if (!settings.hooks) settings.hooks = {};
  const hooks = settings.hooks;
  if (!hooks.PreToolUse) hooks.PreToolUse = [];
  const preToolUse = hooks.PreToolUse;
  if (action === "add") {
    hooks.PreToolUse = preToolUse.filter((h) => h.id !== hookId);
    hooks.PreToolUse.push({
      id: hookId,
      type: "command",
      matcher: toolName,
      command: scriptPath
    });
    if (existsSync3(scriptPath)) {
      try {
        chmodSync(scriptPath, 493);
      } catch {
      }
    }
  } else {
    hooks.PreToolUse = preToolUse.filter((h) => h.id !== hookId);
  }
  writeFileSync2(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
function registerGovernanceCommands(program2, _getModels) {
  const careful = program2.command("careful").description("Manage careful mode (destructive command guard)");
  careful.command("on").description("Enable careful mode").action(() => {
    const db = initDb();
    setConfig(db, "careful.enabled", "true");
    const scriptPath = join2(process.cwd(), "bin", "check-careful.sh");
    manageHook("add", "vs-careful", "Bash", scriptPath);
    output({ careful: true }, "\u26A0\uFE0F careful \uBAA8\uB4DC \uD65C\uC131\uD654\uB428 \u2014 \uD30C\uAD34\uC801 \uBA85\uB839\uC774 \uCC28\uB2E8\uB429\uB2C8\uB2E4.");
  });
  careful.command("off").description("Disable careful mode").action(() => {
    const db = initDb();
    setConfig(db, "careful.enabled", "false");
    manageHook("remove", "vs-careful", "Bash", "");
    output({ careful: false }, "careful \uBAA8\uB4DC \uBE44\uD65C\uC131\uD654\uB428.");
  });
  careful.command("status").description("Show careful mode status").action(() => {
    const db = initDb();
    const enabled = getConfig(db, "careful.enabled") === "true";
    output({ careful: enabled }, enabled ? "\u26A0\uFE0F careful \uBAA8\uB4DC: \uD65C\uC131\uD654" : "careful \uBAA8\uB4DC: \uBE44\uD65C\uC131\uD654");
  });
  const freeze = program2.command("freeze").description("Manage freeze boundary (edit scope restriction)");
  freeze.command("set").argument("<path>", "Directory path to restrict edits to").description("Set freeze boundary").action((inputPath) => {
    const db = initDb();
    const absPath = resolve2(inputPath);
    setConfig(db, "freeze.path", absPath);
    const scriptPath = join2(process.cwd(), "bin", "check-freeze.sh");
    manageHook("add", "vs-freeze-edit", "Edit", scriptPath);
    manageHook("add", "vs-freeze-write", "Write", scriptPath);
    output({ freeze: absPath }, `\u{1F512} freeze \uD65C\uC131\uD654\uB428 \u2014 \uD3B8\uC9D1 \uBC94\uC704: ${absPath}`);
  });
  freeze.command("off").description("Remove freeze boundary").action(() => {
    const db = initDb();
    deleteConfig(db, "freeze.path");
    manageHook("remove", "vs-freeze-edit", "Edit", "");
    manageHook("remove", "vs-freeze-write", "Write", "");
    output({ freeze: null }, "freeze \uBE44\uD65C\uC131\uD654\uB428 \u2014 \uD3B8\uC9D1 \uBC94\uC704 \uC81C\uD55C \uD574\uC81C.");
  });
  freeze.command("status").description("Show freeze boundary status").action(() => {
    const db = initDb();
    const freezePath = getConfig(db, "freeze.path");
    output(
      { freeze: freezePath },
      freezePath ? `\u{1F512} freeze: ${freezePath}` : "freeze: \uBE44\uD65C\uC131\uD654"
    );
  });
  const guard = program2.command("guard").description("Enable/disable careful + freeze combined");
  guard.command("on").argument("<path>", "Directory path to restrict edits to").description("Enable careful mode and set freeze boundary").action((inputPath) => {
    const db = initDb();
    const absPath = resolve2(inputPath);
    setConfig(db, "careful.enabled", "true");
    setConfig(db, "freeze.path", absPath);
    const carefulScript = join2(process.cwd(), "bin", "check-careful.sh");
    const freezeScript = join2(process.cwd(), "bin", "check-freeze.sh");
    manageHook("add", "vs-careful", "Bash", carefulScript);
    manageHook("add", "vs-freeze-edit", "Edit", freezeScript);
    manageHook("add", "vs-freeze-write", "Write", freezeScript);
    output(
      { careful: true, freeze: absPath },
      `\u{1F6E1}\uFE0F guard \uD65C\uC131\uD654\uB428 \u2014 careful + freeze: ${absPath}`
    );
  });
  guard.command("off").description("Disable both careful mode and freeze boundary").action(() => {
    const db = initDb();
    setConfig(db, "careful.enabled", "false");
    deleteConfig(db, "freeze.path");
    manageHook("remove", "vs-careful", "Bash", "");
    manageHook("remove", "vs-freeze-edit", "Edit", "");
    manageHook("remove", "vs-freeze-write", "Write", "");
    output({ careful: false, freeze: null }, "guard \uBE44\uD65C\uC131\uD654\uB428 \u2014 careful + freeze \uBAA8\uB450 \uD574\uC81C.");
  });
  guard.command("status").description("Show guard status").action(() => {
    const db = initDb();
    const carefulEnabled = getConfig(db, "careful.enabled") === "true";
    const freezePath = getConfig(db, "freeze.path");
    output(
      { careful: carefulEnabled, freeze: freezePath },
      `\u{1F6E1}\uFE0F guard: careful=${carefulEnabled ? "\uD65C\uC131\uD654" : "\uBE44\uD65C\uC131\uD654"}, freeze=${freezePath ?? "\uBE44\uD65C\uC131\uD654"}`
    );
  });
  const handoff = program2.command("handoff").description("Manage agent handoff records and files");
  handoff.command("write").argument("<task_id>", "Task ID").requiredOption("--agent <type>", "Agent type").requiredOption("--attempt <n>", "Attempt number", parseInt).requiredOption("--verdict <v>", "Verdict").requiredOption("--summary <text>", "Summary text").option("--report-path <path>", "Report file path").description("Create a handoff record and JSON report file").action((taskId, opts) => {
    withErrorHandler(() => {
      const models = _getModels();
      const handoffModel = new AgentHandoffModel(models.db);
      const task = models.taskModel.getById(taskId);
      if (!task) return outputError(`Task not found: ${taskId}`);
      const planId = task.plan_id;
      const record = handoffModel.create(
        taskId,
        planId,
        opts.agent,
        opts.attempt,
        opts.verdict,
        opts.summary,
        opts.reportPath
      );
      const reportData = {
        id: record.id,
        task_id: taskId,
        plan_id: planId,
        agent_type: opts.agent,
        attempt: opts.attempt,
        verdict: opts.verdict,
        summary: opts.summary,
        created_at: record.created_at
      };
      const filePath = handoffModel.writeHandoffReport(taskId, opts.agent, opts.attempt, reportData);
      output(
        { ...record, report_file: filePath },
        `Handoff created: ${record.id} (file: ${filePath})`
      );
    });
  });
  handoff.command("read").argument("<task_id>", "Task ID").option("--agent <type>", "Agent type").option("--attempt <n>", "Attempt number", parseInt).description("Read handoff records and report files").action((taskId, opts) => {
    withErrorHandler(() => {
      const models = _getModels();
      const handoffModel = new AgentHandoffModel(models.db);
      const records = handoffModel.getByTask(taskId, opts.agent, opts.attempt);
      if (records.length === 0) return outputError(`No handoff records found for task: ${taskId}`);
      const results = records.map((rec) => {
        let reportContent = null;
        if (rec.agent_type && rec.attempt) {
          reportContent = handoffModel.readHandoffReport(taskId, rec.agent_type, rec.attempt);
        }
        return { ...rec, report_content: reportContent };
      });
      output(results, results.map(
        (r) => `[${r.agent_type}#${r.attempt}] ${r.verdict} \u2014 ${r.summary}`
      ).join("\n"));
    });
  });
  handoff.command("clean").argument("<plan_id>", "Plan ID").description("Delete all handoff records and files for a plan").action((planId) => {
    withErrorHandler(() => {
      const models = _getModels();
      const handoffModel = new AgentHandoffModel(models.db);
      const before = handoffModel.list(planId).length;
      handoffModel.cleanByPlan(planId);
      output(
        { plan_id: planId, deleted: before },
        `Cleaned ${before} handoff record(s) for plan: ${planId}`
      );
    });
  });
  const planCmd = program2.command("plan").description("Plan management commands");
  const revision = planCmd.command("revision").description("Manage plan revisions");
  revision.command("create").argument("<plan_id>", "Plan ID").requiredOption("--trigger-type <type>", "Trigger type (assumption_violation|scope_explosion|design_flaw|complexity_exceeded|dependency_shift)").requiredOption("--description <text>", "Revision description").requiredOption("--changes <json>", "Changes as JSON string").option("--trigger-source <id>", "Source ID that triggered the revision").description("Create a plan revision").action((planId, opts) => {
    withErrorHandler(() => {
      const models = _getModels();
      const rev = models.planRevisionModel.create(
        planId,
        opts.triggerType,
        opts.triggerSource ?? null,
        opts.description,
        opts.changes
      );
      output(rev, `Revision created: ${rev.id} (${rev.trigger_type}) \u2014 ${rev.status}`);
    });
  });
  revision.command("list").argument("<plan_id>", "Plan ID").description("List revisions for a plan").action((planId) => {
    withErrorHandler(() => {
      const models = _getModels();
      const revisions = models.planRevisionModel.listByPlan(planId);
      if (revisions.length === 0) {
        output([], `No revisions found for plan: ${planId}`);
        return;
      }
      output(
        revisions,
        revisions.map((r) => `[${r.id}] ${r.trigger_type} \u2014 ${r.status}: ${r.description}`).join("\n")
      );
    });
  });
  revision.command("update").argument("<id>", "Revision ID").requiredOption("--status <status>", "New status (approved|rejected)").description("Update revision status").action((id, opts) => {
    withErrorHandler(() => {
      const models = _getModels();
      const rev = models.planRevisionModel.updateStatus(id, opts.status);
      output(rev, `Revision ${rev.id} updated to: ${rev.status}`);
    });
  });
}

// src/cli/importers.ts
import { execFileSync } from "child_process";
import { readFileSync as readFileSync4, existsSync as existsSync4 } from "fs";
var REPO_FORMAT_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
function validateRepoFormat(repo) {
  const trimmed = repo.trim();
  if (!trimmed) {
    throw new Error('repo \uD30C\uB77C\uBBF8\uD130\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. "owner/repo" \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD558\uC138\uC694.');
  }
  if (!REPO_FORMAT_RE.test(trimmed)) {
    throw new Error(
      `\uC798\uBABB\uB41C repo \uD615\uC2DD\uC785\uB2C8\uB2E4: "${repo}". "owner/repo" \uD615\uC2DD(\uC608: octocat/Hello-World)\uB9CC \uD5C8\uC6A9\uB429\uB2C8\uB2E4.`
    );
  }
}
function importFromGithub(repo, options) {
  const errors = [];
  try {
    validateRepoFormat(repo);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { items: [], source_prefix: `github:${repo}`, errors };
  }
  const state = options?.state ?? "open";
  const args = [
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    state,
    "--json",
    "number,title,body,labels",
    "--limit",
    "50"
  ];
  if (options?.label) {
    args.push("--label", options.label);
  }
  let jsonStr;
  try {
    jsonStr = execFileSync("gh", args, { encoding: "utf-8", timeout: 3e4 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("command not found") || msg.includes("not found") || msg.includes("ENOENT")) {
      errors.push("gh CLI\uAC00 \uC124\uCE58\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. https://cli.github.com \uC5D0\uC11C \uC124\uCE58\uD558\uC138\uC694.");
    } else {
      errors.push(`GitHub API \uC624\uB958: ${msg.slice(0, 200)}`);
    }
    return { items: [], source_prefix: `github:${repo}`, errors };
  }
  let issues;
  try {
    issues = JSON.parse(jsonStr);
  } catch {
    errors.push("GitHub API \uC751\uB2F5\uC744 \uD30C\uC2F1\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return { items: [], source_prefix: `github:${repo}`, errors };
  }
  const items = issues.map((issue) => {
    const labelNames = issue.labels.map((l) => l.name);
    return {
      title: issue.title,
      description: issue.body?.slice(0, 500) ?? void 0,
      priority: inferPriorityFromLabels(labelNames),
      category: inferCategoryFromLabels(labelNames),
      tags: labelNames.length > 0 ? labelNames : void 0,
      source: `github:${repo}#${issue.number}`
    };
  });
  return { items, source_prefix: `github:${repo}`, errors };
}
function inferPriorityFromLabels(labels) {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.some((l) => l.includes("critical") || l.includes("urgent") || l.includes("p0"))) return "critical";
  if (lower.some((l) => l.includes("high") || l.includes("important") || l.includes("p1"))) return "high";
  if (lower.some((l) => l.includes("low") || l.includes("minor") || l.includes("p3"))) return "low";
  return "medium";
}
function inferCategoryFromLabels(labels) {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.some((l) => l.includes("bug") || l.includes("fix"))) return "bugfix";
  if (lower.some((l) => l.includes("feature") || l.includes("enhancement"))) return "feature";
  if (lower.some((l) => l.includes("refactor"))) return "refactor";
  if (lower.some((l) => l.includes("chore") || l.includes("maintenance"))) return "chore";
  return void 0;
}
function importFromFile(filepath) {
  const errors = [];
  if (!existsSync4(filepath)) {
    errors.push(`\uD30C\uC77C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${filepath}`);
    return { items: [], source_prefix: `file:${filepath}`, errors };
  }
  let content;
  try {
    content = readFileSync4(filepath, "utf-8");
  } catch (e) {
    errors.push(`\uD30C\uC77C \uC77D\uAE30 \uC2E4\uD328: ${e instanceof Error ? e.message : String(e)}`);
    return { items: [], source_prefix: `file:${filepath}`, errors };
  }
  const lines = content.split("\n");
  const items = [];
  for (const line of lines) {
    const match = line.match(/^[\s]*-\s+\[\s\]\s+(.+)$/);
    if (match) {
      items.push({
        title: match[1].trim(),
        source: `file:${filepath}`
      });
    }
  }
  if (items.length === 0 && lines.length > 0) {
    errors.push("\uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uD56D\uBAA9(- [ ])\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }
  return { items, source_prefix: `file:${filepath}`, errors };
}
function importFromSlack(channel, _options) {
  return {
    items: [],
    source_prefix: `slack:${channel}`,
    errors: ["Slack import\uB294 \uC2A4\uD0AC \uBAA8\uB4DC(/vs-backlog)\uC5D0\uC11C MCP \uB3C4\uAD6C\uB97C \uD1B5\uD574 \uC2E4\uD589\uD558\uC138\uC694. CLI\uC5D0\uC11C\uB294 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."]
  };
}

// src/core/types.ts
var VALID_PLAN_STATUSES = ["draft", "active", "approved", "completed", "archived"];
var VALID_QA_RUN_TERMINAL_STATUSES = ["completed", "failed"];
var VALID_BACKLOG_PRIORITIES = ["critical", "high", "medium", "low"];
var VALID_BACKLOG_CATEGORIES = ["feature", "bugfix", "refactor", "chore", "idea"];
var VALID_BACKLOG_COMPLEXITIES = ["simple", "moderate", "complex"];
var VALID_BACKLOG_STATUSES = ["open", "planned", "done", "dropped"];

// src/cli/commands/backlog.ts
function registerBacklogCommands(program2, getModels) {
  const backlog = program2.command("backlog").description("Manage backlog items");
  backlog.command("add").description("Add a backlog item").requiredOption("--title <title>", "Item title").option("--description <desc>", "Item description").option("--priority <priority>", "Priority: critical|high|medium|low", "medium").option("--category <category>", "Category: feature|bugfix|refactor|chore|idea").option("--tags <tags>", "Comma-separated tags").option("--complexity <complexity>", "Complexity hint: simple|moderate|complex").option("--source <source>", "Source of the item").action((opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    if (opts.priority && !VALID_BACKLOG_PRIORITIES.includes(opts.priority)) {
      outputError(`Invalid priority: ${opts.priority}. Must be one of: ${VALID_BACKLOG_PRIORITIES.join(", ")}`);
    }
    if (opts.category && !VALID_BACKLOG_CATEGORIES.includes(opts.category)) {
      outputError(`Invalid category: ${opts.category}. Must be one of: ${VALID_BACKLOG_CATEGORIES.join(", ")}`);
    }
    if (opts.complexity && !VALID_BACKLOG_COMPLEXITIES.includes(opts.complexity)) {
      outputError(`Invalid complexity: ${opts.complexity}. Must be one of: ${VALID_BACKLOG_COMPLEXITIES.join(", ")}`);
    }
    const tags = opts.tags ? opts.tags.split(",").map((t) => t.trim()) : void 0;
    const item = backlogModel.create({
      title: opts.title,
      description: opts.description,
      priority: opts.priority,
      category: opts.category,
      tags,
      complexity_hint: opts.complexity,
      source: opts.source
    });
    output(item, `Created backlog item: ${item.id} \u2014 ${item.title}`);
  }));
  backlog.command("list").description("List backlog items").option("--status <status>", "Filter by status").option("--priority <priority>", "Filter by priority").option("--category <category>", "Filter by category").option("--tag <tag>", "Filter by tag").action((opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const items = backlogModel.list({
      status: opts.status,
      priority: opts.priority,
      category: opts.category,
      tag: opts.tag
    });
    output(items, formatBacklogList(items));
  }));
  backlog.command("show").description("Show backlog item details").argument("<id>", "Backlog item ID").action((id) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const item = backlogModel.getById(id);
    if (!item) outputError(`Backlog item not found: ${id}`);
    output(item, formatBacklogDetail(item));
  }));
  backlog.command("update").description("Update a backlog item").argument("<id>", "Backlog item ID").option("--title <title>", "New title").option("--description <desc>", "New description").option("--priority <priority>", "New priority").option("--category <category>", "New category").option("--tags <tags>", "New comma-separated tags").option("--complexity <complexity>", "New complexity hint").option("--source <source>", "New source").option("--status <status>", "New status").action((id, opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const fields = {};
    if (opts.title) fields.title = opts.title;
    if (opts.description) fields.description = opts.description;
    if (opts.priority) {
      if (!VALID_BACKLOG_PRIORITIES.includes(opts.priority)) {
        outputError(`Invalid priority: ${opts.priority}`);
      }
      fields.priority = opts.priority;
    }
    if (opts.category) {
      if (!VALID_BACKLOG_CATEGORIES.includes(opts.category)) {
        outputError(`Invalid category: ${opts.category}`);
      }
      fields.category = opts.category;
    }
    if (opts.tags) fields.tags = JSON.stringify(opts.tags.split(",").map((t) => t.trim()));
    if (opts.complexity) {
      if (!VALID_BACKLOG_COMPLEXITIES.includes(opts.complexity)) {
        outputError(`Invalid complexity: ${opts.complexity}`);
      }
      fields.complexity_hint = opts.complexity;
    }
    if (opts.source) fields.source = opts.source;
    if (opts.status) {
      if (!VALID_BACKLOG_STATUSES.includes(opts.status)) {
        outputError(`Invalid status: ${opts.status}`);
      }
      fields.status = opts.status;
    }
    const item = backlogModel.update(id, fields);
    output(item, formatBacklogDetail(item));
  }));
  backlog.command("delete").description("Delete a backlog item").argument("<id>", "Backlog item ID").action((id) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    backlogModel.delete(id);
    output({ deleted: id }, `Deleted backlog item: ${id}`);
  }));
  backlog.command("promote").description("Promote a backlog item to a plan").argument("<id>", "Backlog item ID").requiredOption("--plan <planId>", "Plan ID to link").action((id, opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const item = backlogModel.promote(id, opts.plan);
    output(item, `Promoted backlog item ${item.id} \u2192 plan ${opts.plan}`);
  }));
  backlog.command("stats").description("Show backlog statistics").action(() => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const statsData = backlogModel.getStats();
    output(statsData, formatBacklogStats(statsData));
  }));
  backlog.command("board").description("Show backlog in kanban board view").option("--category <category>", "Filter by category").option("--status <status>", "Filter by status", "open").action((opts) => withErrorHandler(() => {
    const { backlogModel } = getModels();
    const items = backlogModel.list({
      status: opts.status,
      category: opts.category
    });
    output(items, formatBacklogBoard(items));
  }));
  const importCmd = backlog.command("import").description("Import backlog items from external sources");
  importCmd.command("github").description("Import from GitHub Issues").requiredOption("--repo <repo>", "Repository (owner/repo)").option("--label <label>", "Filter by label").option("--state <state>", "Issue state", "open").option("--dry-run", "Preview without importing").action((opts) => withErrorHandler(() => {
    const result = importFromGithub(opts.repo, { label: opts.label, state: opts.state });
    if (opts.dryRun || result.items.length === 0) {
      output(result, formatImportPreview(result));
      return;
    }
    const { backlogModel } = getModels();
    let imported = 0;
    let skipped = 0;
    const warnings = [];
    for (const item of result.items) {
      const existing = backlogModel.findByTitle(item.title, "open");
      if (existing) {
        warnings.push(`Duplicate: "${item.title}" (existing: ${existing.id})`);
        skipped++;
        continue;
      }
      backlogModel.create(item);
      imported++;
    }
    const summary = [`Imported ${imported} items from ${result.source_prefix}`];
    if (skipped > 0) summary.push(`Skipped ${skipped} duplicates`);
    if (warnings.length > 0) summary.push(...warnings.map((w) => `  \u26A0 ${w}`));
    output({ imported, skipped, warnings }, summary.join("\n"));
  }));
  importCmd.command("file").description("Import from a markdown/text file").requiredOption("--path <filepath>", "File path").option("--dry-run", "Preview without importing").action((opts) => withErrorHandler(() => {
    const result = importFromFile(opts.path);
    if (opts.dryRun || result.items.length === 0) {
      output(result, formatImportPreview(result));
      return;
    }
    const { backlogModel } = getModels();
    let imported = 0;
    let skipped = 0;
    const warnings = [];
    for (const item of result.items) {
      const existing = backlogModel.findByTitle(item.title, "open");
      if (existing) {
        warnings.push(`Duplicate: "${item.title}" (existing: ${existing.id})`);
        skipped++;
        continue;
      }
      backlogModel.create(item);
      imported++;
    }
    const summary = [`Imported ${imported} items from ${result.source_prefix}`];
    if (skipped > 0) summary.push(`Skipped ${skipped} duplicates`);
    if (warnings.length > 0) summary.push(...warnings.map((w) => `  \u26A0 ${w}`));
    output({ imported, skipped, warnings }, summary.join("\n"));
  }));
  importCmd.command("slack").description("Import from Slack channel (requires MCP)").requiredOption("--channel <channel>", "Slack channel ID").option("--since <days>", "Days to look back", "7").option("--dry-run", "Preview without importing").action((opts) => withErrorHandler(() => {
    const result = importFromSlack(opts.channel, { since: opts.since });
    output(result, formatImportPreview(result));
  }));
}

// src/cli/commands/planning.ts
function registerPlanningCommands(program2, getModels) {
  const plan = program2.command("plan").description("Manage plans");
  plan.command("list").option("--status <status>", "Filter by status (draft, active, approved, completed, archived)").option("--branch <branch>", "Filter by branch").description("List plans").action((opts) => {
    const { planModel } = getModels();
    const filter = {};
    if (opts.status) {
      if (!VALID_PLAN_STATUSES.includes(opts.status)) {
        return outputError(`Invalid status. Must be: ${VALID_PLAN_STATUSES.join(", ")}`);
      }
      filter.status = opts.status;
    }
    if (opts.branch) filter.branch = opts.branch;
    const plans = planModel.list(Object.keys(filter).length > 0 ? filter : void 0);
    output(plans, formatPlanList(plans));
  });
  plan.command("show").argument("<id>", "Plan ID").description("Show plan details with task tree and waves").action((id) => {
    const { planModel, taskModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const tree = taskModel.getTree(id);
    const waves = taskModel.getWaves(id);
    output({ plan: p, tasks: tree, waves }, formatPlanTree(p, tree));
  });
  plan.command("create").requiredOption("--title <title>", "Plan title").option("--spec <spec>", "Plan specification").option("--summary <summary>", "Plan summary").description("Create a new plan and activate it").action((opts) => {
    const { planModel } = getModels();
    const created = planModel.create(opts.title, opts.spec, opts.summary);
    const activated = planModel.activate(created.id);
    output(activated, `Created plan: ${activated.id} "${activated.title}" (${activated.status})`);
  });
  plan.command("edit").argument("<id>", "Plan ID").option("--title <title>", "New title").option("--spec <spec>", "Replace spec").option("--append-spec <text>", "Append text to existing spec").option("--summary <summary>", "New summary").description("Edit plan title, spec, or summary").action((id, opts) => {
    const { planModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const updates = {};
    if (opts.title) updates.title = opts.title;
    if (opts.spec) updates.spec = opts.spec;
    if (opts.appendSpec) updates.spec = (p.spec ?? "") + "\n\n" + opts.appendSpec;
    if (opts.summary) updates.summary = opts.summary;
    if (Object.keys(updates).length === 0) return outputError("No changes specified");
    const updated = planModel.update(id, updates);
    output(updated, `Plan updated: ${updated.id} "${updated.title}"`);
  });
  plan.command("complete").argument("<id>", "Plan ID").description("Complete a plan").action((id) => {
    withErrorHandler(() => {
      const { lifecycle } = getModels();
      const completed = lifecycle.completePlan(id);
      output(completed, `Plan completed: ${completed.id} "${completed.title}"`);
    });
  });
  plan.command("approve").argument("<id>", "Plan ID").description("Approve a plan (active \u2192 approved)").action((id) => {
    withErrorHandler(() => {
      const { planModel } = getModels();
      const approved = planModel.approve(id);
      output(approved, `Plan approved: ${approved.id} "${approved.title}"`);
    });
  });
  plan.command("archive").argument("<id>", "Plan ID").description("Archive a plan").action((id) => {
    const { planModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const archived = planModel.archive(id);
    output(archived, `Plan archived: ${archived.id} "${archived.title}"`);
  });
  plan.command("update").argument("<id>", "Plan ID").option("--title <title>", "New title").option("--spec <spec>", "New spec").option("--summary <summary>", "New summary").description("Update plan title, spec, or summary").action((id, opts) => {
    const { planModel } = getModels();
    const p = planModel.getById(id);
    if (!p) return outputError(`Plan not found: ${id}`);
    const updated = planModel.update(id, opts);
    output(updated, `Plan updated: ${updated.id} "${updated.title}"`);
  });
  plan.command("delete").argument("<id>", "Plan ID").description("Delete a draft plan and all its tasks").action((id) => {
    withErrorHandler(() => {
      const { planModel } = getModels();
      planModel.delete(id);
      output({ deleted: true, plan_id: id }, `Plan deleted: ${id}`);
    });
  });
  const task = program2.command("task").description("Manage tasks");
  task.command("create").requiredOption("--plan <plan_id>", "Plan ID").requiredOption("--title <title>", "Task title").option("--parent <parent_id>", "Parent task ID for subtasks").option("--spec <spec>", "Task specification").option("--acceptance <acceptance>", "Acceptance criteria").option("--depends-on <ids>", "Comma-separated task IDs this task depends on").option("--allowed-files <files>", "Comma-separated list of allowed files").option("--forbidden-patterns <patterns>", "Comma-separated list of forbidden patterns").option("--force", "Skip acceptance criteria validation warnings").description("Create a new task").action((opts) => {
    withErrorHandler(() => {
      const { taskModel } = getModels();
      const dependsOn = opts.dependsOn ? opts.dependsOn.split(",").map((s) => s.trim()) : void 0;
      const allowedFiles = opts.allowedFiles ? opts.allowedFiles.split(",").map((s) => s.trim()) : void 0;
      const forbiddenPatterns = opts.forbiddenPatterns ? opts.forbiddenPatterns.split(",").map((s) => s.trim()) : void 0;
      const created = taskModel.create(opts.plan, opts.title, {
        parentId: opts.parent,
        spec: opts.spec,
        acceptance: opts.acceptance,
        dependsOn,
        allowedFiles,
        forbiddenPatterns
      });
      const { warnings, ...taskData } = created;
      if (warnings.length > 0 && !opts.force) {
        for (const w of warnings) {
          console.error(`\u26A0 AC Warning: ${w}`);
        }
      }
      if (getJsonMode()) {
        output({ ...taskData, warnings }, `Created task: ${created.id} "${created.title}" (${created.status})`);
      } else {
        output(taskData, `Created task: ${created.id} "${created.title}" (${created.status})`);
      }
    });
  });
  task.command("update").argument("<id>", "Task ID").argument("<status>", "New status (todo, in_progress, done, blocked, skipped)").option("--impl-status <status>", "Implementation status (DONE, DONE_WITH_CONCERNS, BLOCKED)").option("--test-count <count>", "Number of tests written").option("--files-changed <count>", "Number of files changed").option("--has-concerns", "Whether there are concerns").option("--changed-files-detail <json>", "JSON string of changed files detail").option("--scope-violations <json>", "JSON string of scope violations").description("Update task status with optional metrics").action((id, status, opts) => {
    const VALID = ["todo", "in_progress", "done", "blocked", "skipped"];
    if (!VALID.includes(status)) {
      return outputError(`Invalid status. Must be: ${VALID.join(", ")}`);
    }
    const { taskModel, taskMetricsModel, lifecycle } = getModels();
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
        if (opts.changedFilesDetail) metrics.changed_files_detail = opts.changedFilesDetail;
        if (opts.scopeViolations) metrics.scope_violations = opts.scopeViolations;
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
    const { taskModel } = getModels();
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
    const { taskModel } = getModels();
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
      t.allowed_files ? `Allowed:    ${t.allowed_files}` : "",
      t.forbidden_patterns ? `Forbidden:  ${t.forbidden_patterns}` : "",
      `Created:    ${t.created_at}`,
      t.completed_at ? `Completed:  ${t.completed_at}` : ""
    ].filter(Boolean).join("\n"));
  });
  task.command("block").argument("<id>", "Task ID").option("--reason <reason>", "Reason for blocking").description("Mark a task as blocked").action((id, opts) => {
    const { taskModel, events } = getModels();
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
  task.command("edit").argument("<id>", "Task ID").option("--title <title>", "New title").option("--spec <spec>", "New spec").option("--acceptance <acceptance>", "New acceptance criteria").option("--allowed-files <files>", "Comma-separated list of allowed files").option("--forbidden-patterns <patterns>", "Comma-separated list of forbidden patterns").description("Edit task title, spec, acceptance, or scope").action((id, opts) => {
    const { taskModel } = getModels();
    const t = taskModel.getById(id);
    if (!t) return outputError(`Task not found: ${id}`);
    const fields = {};
    if (opts.title !== void 0) fields.title = opts.title;
    if (opts.spec !== void 0) fields.spec = opts.spec;
    if (opts.acceptance !== void 0) fields.acceptance = opts.acceptance;
    if (opts.allowedFiles !== void 0) {
      fields.allowed_files = JSON.stringify(opts.allowedFiles.split(",").map((s) => s.trim()));
    }
    if (opts.forbiddenPatterns !== void 0) {
      fields.forbidden_patterns = JSON.stringify(opts.forbiddenPatterns.split(",").map((s) => s.trim()));
    }
    const edited = taskModel.update(id, fields);
    output(edited, `Task edited: ${edited.id} "${edited.title}"`);
  });
  task.command("delete").argument("<id>", "Task ID").description("Delete a task and its subtasks").action((id) => {
    const { taskModel } = getModels();
    withErrorHandler(() => {
      taskModel.delete(id);
      output({ deleted: true, task_id: id }, `Task deleted: ${id}`);
    });
  });
}

// src/cli/commands/auxiliary.ts
function registerAuxiliaryCommands(program2, getModels) {
  const context = program2.command("context").description("Manage session context");
  context.command("resume").option("--session-id <id>", "Optional session ID to filter").description("Resume context from previous sessions").action((opts) => {
    const { contextModel, dashboard, alerts } = getModels();
    const contextLogs = opts.sessionId ? [contextModel.getBySession(opts.sessionId)].filter(Boolean) : contextModel.getLatest(3);
    const overview = dashboard.getOverview();
    const alertList = alerts.getAlerts();
    output({ context_logs: contextLogs, overview, alerts: alertList });
  });
  context.command("save").requiredOption("--summary <summary>", "Summary of context to save").option("--plan-id <id>", "Plan ID to link context to").option("--session-id <id>", "Session ID").description("Save a context log entry").action((opts) => {
    const { contextModel } = getModels();
    const log = contextModel.save(opts.summary, {
      planId: opts.planId,
      sessionId: opts.sessionId
    });
    output(log, `Context saved: ${log.id} "${log.summary.slice(0, 50)}..."`);
  });
  context.command("search").argument("<query>", "Search query (tag or keyword)").option("--limit <n>", "Max results", "10").description("Search context log entries by tag or keyword").action((query, opts) => {
    const { contextModel } = getModels();
    const results = contextModel.search(query);
    const limited = results.slice(0, parseInt(opts.limit, 10));
    if (limited.length === 0) {
      output([], `No context logs matching "${query}".`);
      return;
    }
    const formatted = limited.map(
      (l, i) => `${i + 1}. [#${l.id}] ${l.summary.slice(0, 100)} (${l.created_at})`
    ).join("\n");
    output(limited, `## Context Search: "${query}"

${formatted}`);
  });
  const config = program2.command("config").description("Manage configuration");
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
  program2.command("stats").argument("[plan_id]", "Optional plan ID").description("Show velocity and estimates").action((planId) => {
    const { stats } = getModels();
    const velocity = stats.getVelocity(planId);
    const estimate = planId ? stats.getEstimatedCompletion(planId) : void 0;
    const timeline = stats.getTimeline(planId);
    output(
      { velocity, ...estimate ? { estimated_completion: estimate } : {}, ...timeline.length > 0 ? { timeline } : {} },
      formatStats(velocity, estimate, timeline.length > 0 ? timeline : void 0)
    );
  });
  program2.command("history").argument("<type>", "Entity type (plan, task)").argument("<id>", "Entity ID").description("Show change history").action((type, id) => {
    const validTypes = ["plan", "task"];
    if (!validTypes.includes(type)) {
      return outputError(`Invalid entity type. Must be: ${validTypes.join(", ")}`);
    }
    const { events } = getModels();
    const eventList = events.getByEntity(type, id);
    output(eventList, formatHistory(eventList));
  });
  program2.command("insights").option("--scope <scope>", "Scope: blocked_patterns, duration_stats, success_rates, all (default: all)").description("Get learning insights from task history").action((opts) => {
    const { insights } = getModels();
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
  program2.command("skill-log").argument("<name>", "Skill name to record").option("--plan-id <id>", "Plan ID to associate").option("--session-id <id>", "Session ID to associate").description("Record a skill usage").action((name, opts) => {
    const { skillUsageModel } = getModels();
    const record = skillUsageModel.record(name, {
      planId: opts.planId,
      sessionId: opts.sessionId
    });
    output(record, `Recorded skill: ${record.skill_name} (${record.id})`);
  });
  program2.command("skill-stats").option("--days <days>", "Filter by recent N days").description("Show skill usage statistics").action((opts) => {
    const { skillUsageModel } = getModels();
    const days = opts.days ? parseInt(opts.days, 10) : void 0;
    const skillStats = skillUsageModel.getStats(days);
    if (skillStats.length === 0) {
      output(skillStats, "No skill usage data.");
      return;
    }
    output(skillStats, formatSkillUsage(skillStats));
  });
  const mergeReport = program2.command("merge-report").description("Manage merge reports");
  mergeReport.command("show").argument("<id>", "Report ID or commit hash").description("Show a merge report").action((id) => withErrorHandler(() => {
    const { mergeReportModel } = getModels();
    const report = mergeReportModel.get(id) ?? mergeReportModel.getByCommit(id);
    if (!report) return outputError(`Merge report not found: ${id}`);
    output(report, formatMergeReportSummary(report));
  }));
  mergeReport.command("list").option("--plan-id <plan_id>", "Filter by plan ID").option("--limit <n>", "Limit results", "20").description("List merge reports").action((opts) => withErrorHandler(() => {
    const { mergeReportModel } = getModels();
    const reports = mergeReportModel.list({ planId: opts.planId, limit: parseInt(opts.limit, 10) });
    output(reports, formatMergeReportList(reports));
  }));
  mergeReport.command("latest").description("Show the latest merge report").action(() => withErrorHandler(() => {
    const { mergeReportModel } = getModels();
    const reports = mergeReportModel.getLatest(1);
    if (reports.length === 0) {
      output(null, "\uB9AC\uD3EC\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. vs-merge\uB85C \uBA38\uC9C0\uB97C \uC644\uB8CC\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uC0DD\uC131\uB429\uB2C8\uB2E4.");
      return;
    }
    output(reports[0], formatMergeReportSummary(reports[0]));
  }));
  mergeReport.command("create").description("Create a merge report (used internally by vs-merge)").requiredOption("--commit <hash>", "Commit hash").requiredOption("--source <branch>", "Source branch").requiredOption("--target <branch>", "Target branch").requiredOption("--changes <json>", "Changes summary JSON").requiredOption("--checklist <json>", "Review checklist JSON").requiredOption("--verification <json>", "Verification result JSON").requiredOption("--report-path <path>", "Path to MD report file").option("--plan-id <id>", "Plan ID").option("--conflict-log <json>", "Conflict log JSON").option("--ai-judgments <json>", "AI judgments JSON").option("--task-ids <json>", "Task IDs JSON").action((opts) => withErrorHandler(() => {
    const { mergeReportModel } = getModels();
    const report = mergeReportModel.create({
      commit_hash: opts.commit,
      source_branch: opts.source,
      target_branch: opts.target,
      changes_summary: JSON.parse(opts.changes),
      review_checklist: JSON.parse(opts.checklist),
      verification: JSON.parse(opts.verification),
      report_path: opts.reportPath,
      plan_id: opts.planId,
      conflict_log: opts.conflictLog ? JSON.parse(opts.conflictLog) : void 0,
      ai_judgments: opts.aiJudgments ? JSON.parse(opts.aiJudgments) : void 0,
      task_ids: opts.taskIds ? JSON.parse(opts.taskIds) : void 0
    });
    output(report, `Created merge report: ${report.id}`);
  }));
}
function formatMergeReportSummary(r) {
  const lines = [];
  lines.push(`# Merge Report: ${r.source_branch} \u2192 ${r.target_branch}`);
  lines.push(`> ${r.created_at} | Commit: ${r.commit_hash.slice(0, 8)}`);
  if (r.plan_id) lines.push(`> Plan: ${r.plan_id}`);
  lines.push("");
  lines.push("## \uBCC0\uACBD \uC694\uC57D");
  for (const c of r.changes_summary) {
    lines.push(`- [${c.category}] ${c.file} \u2014 ${c.description}`);
  }
  lines.push("");
  lines.push("## Review Checklist");
  const levelIcon = { must: "\u{1F534}", should: "\u{1F7E1}", info: "\u{1F7E2}" };
  for (const item of r.review_checklist) {
    const loc = item.line ? `${item.file}:${item.line}` : item.file;
    lines.push(`- ${levelIcon[item.level]} ${loc} \u2014 ${item.description}`);
    lines.push(`  \u2514 ${item.reason}`);
  }
  lines.push("");
  if (r.conflict_log && r.conflict_log.length > 0) {
    lines.push("## \uCDA9\uB3CC \uD574\uACB0 \uAE30\uB85D");
    for (const c of r.conflict_log) {
      lines.push(`- ${c.file} (${c.hunks} hunks) \u2192 ${c.resolution}: ${c.choice_reason}`);
    }
    lines.push("");
  }
  if (r.ai_judgments && r.ai_judgments.length > 0) {
    lines.push("## AI \uD310\uB2E8 \uB85C\uADF8");
    for (const j of r.ai_judgments) {
      const loc = j.line ? `${j.file}:${j.line}` : j.file;
      lines.push(`- [${j.confidence}] ${loc} \u2014 ${j.description} (${j.type})`);
    }
    lines.push("");
  }
  const v = r.verification;
  lines.push("## \uAC80\uC99D \uACB0\uACFC");
  lines.push(`- Build: ${v.build}`);
  lines.push(`- Test: ${v.test.status}${v.test.passed != null ? ` (${v.test.passed} passed${v.test.failed ? `, ${v.test.failed} failed` : ""})` : ""}`);
  lines.push(`- Lint: ${v.lint}`);
  lines.push(`- Acceptance: ${v.acceptance}`);
  if (r.task_ids && r.task_ids.length > 0) {
    lines.push("");
    lines.push(`## \uAD00\uB828 \uD0DC\uC2A4\uD06C: ${r.task_ids.join(", ")}`);
  }
  return lines.join("\n");
}
function formatMergeReportList(reports) {
  if (reports.length === 0) return "\uB9AC\uD3EC\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
  const header = "| # | \uB0A0\uC9DC | \uBE0C\uB79C\uCE58 | \uCEE4\uBC0B | Checklist | \uCDA9\uB3CC |";
  const sep = "|---|------|--------|------|-----------|------|";
  const rows = reports.map((r, i) => {
    const date = r.created_at.split("T")[0] || r.created_at.split(" ")[0];
    const must = r.review_checklist.filter((c) => c.level === "must").length;
    const should = r.review_checklist.filter((c) => c.level === "should").length;
    const info = r.review_checklist.filter((c) => c.level === "info").length;
    const conflicts = r.conflict_log?.length ?? 0;
    return `| ${i + 1} | ${date} | ${r.source_branch} \u2192 ${r.target_branch} | ${r.commit_hash.slice(0, 8)} | \u{1F534}${must} \u{1F7E1}${should} \u{1F7E2}${info} | ${conflicts} |`;
  });
  return [header, sep, ...rows].join("\n");
}

// src/core/engine/error-kb.ts
import * as fs from "fs";
import * as path from "path";
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
  /** In-memory embedding cache: errorId -> Float32Array */
  embeddingCache = /* @__PURE__ */ new Map();
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
    const id = generateId();
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
  recordOccurrence(id, context) {
    const filePath = this.resolveFilePath(id);
    if (!filePath || !fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    meta.occurrences += 1;
    meta.last_seen = (/* @__PURE__ */ new Date()).toISOString();
    let updatedBody = body;
    const historyEntry = `- ${meta.last_seen}: ${context}`;
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
      const raw = fs.readFileSync(file, "utf-8");
      const { meta } = parseFrontmatter(raw);
      stats.total++;
      stats.by_severity[meta.severity]++;
      stats.by_status[meta.status]++;
      entries.push({ id, title: meta.title, occurrences: meta.occurrences });
    }
    stats.top_recurring = entries.sort((a, b) => b.occurrences - a.occurrences).slice(0, 10);
    return stats;
  }
  /**
   * Generate embedding text from an error entry's key fields.
   */
  entryToText(entry) {
    return `${entry.title} ${entry.content || ""}`.trim();
  }
  /**
   * Semantic search: generate embedding for query and compare against cached embeddings.
   * Returns results sorted by similarity (descending).
   */
  async searchSemantic(query, limit = 10) {
    if (this.embeddingCache.size === 0) return [];
    const queryEmbedding = await generateEmbedding(query);
    const results = [];
    for (const [id, embedding] of this.embeddingCache) {
      const entry = this.show(id);
      if (!entry) continue;
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      results.push({ entry, similarity });
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }
  /**
   * Hybrid search: run text search + semantic search in parallel,
   * merge results using Reciprocal Rank Fusion (RRF).
   */
  async searchHybrid(query, opts) {
    const [textResults, semanticResults] = await Promise.all([
      Promise.resolve(this.search(query, opts)),
      this.searchSemantic(query)
    ]);
    const k = 60;
    const scoreMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < textResults.length; i++) {
      const entry = textResults[i];
      const rrfScore = 1 / (k + i + 1);
      scoreMap.set(entry.id, { entry, score: rrfScore });
    }
    for (let i = 0; i < semanticResults.length; i++) {
      const { entry } = semanticResults[i];
      const rrfScore = 1 / (k + i + 1);
      const existing = scoreMap.get(entry.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(entry.id, { entry, score: rrfScore });
      }
    }
    const merged = Array.from(scoreMap.values());
    merged.sort((a, b) => b.score - a.score);
    return merged.map(({ entry, score }) => ({ entry, similarity: score }));
  }
  /**
   * Initialize embeddings for all existing error entries.
   * Skips entries that already have embeddings in cache.
   */
  async initEmbeddings() {
    const files = this.listErrorFiles();
    let indexed = 0;
    let skipped = 0;
    for (const file of files) {
      const id = path.basename(file, ".md");
      if (this.embeddingCache.has(id)) {
        skipped++;
        continue;
      }
      const entry = this.show(id);
      if (!entry) continue;
      const text = this.entryToText(entry);
      const embedding = await generateEmbedding(text);
      this.embeddingCache.set(id, embedding);
      indexed++;
    }
    return { indexed, skipped };
  }
  /**
   * Find potential duplicate entries based on embedding similarity.
   * Returns entries with similarity >= 0.85.
   */
  async findDuplicates(newEntry) {
    if (this.embeddingCache.size === 0) return [];
    const text = `${newEntry.title} ${newEntry.cause || ""} ${newEntry.solution || ""}`.trim();
    const queryEmbedding = await generateEmbedding(text);
    const results = [];
    for (const [id, embedding] of this.embeddingCache) {
      const entry = this.show(id);
      if (!entry) continue;
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      if (similarity >= 0.85) {
        results.push({ entry, similarity });
      }
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results;
  }
  /**
   * Add a new error entry with duplicate detection.
   * Returns the entry plus an optional duplicate warning.
   */
  async addWithDuplicateCheck(newEntry) {
    const duplicates = await this.findDuplicates(newEntry);
    const entry = this.add(newEntry);
    const text = this.entryToText(entry);
    const embedding = await generateEmbedding(text);
    this.embeddingCache.set(entry.id, embedding);
    const result = { entry };
    if (duplicates.length > 0) {
      const titles = duplicates.map((d) => `"${d.entry.title}" (similarity: ${d.similarity.toFixed(2)})`).join(", ");
      result.duplicateWarning = `Similar entries found: ${titles}`;
    }
    return result;
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
    return fs.readdirSync(this.errorsDir).filter((f) => f.endsWith(".md") && f !== "_index.md").map((f) => path.join(this.errorsDir, f));
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

// src/core/engine/self-improve.ts
import * as fs2 from "fs";
import * as path2 from "path";
var RULES_DIR = ".claude/rules";
var ARCHIVE_DIR = ".claude/rules/archive";
var PENDING_DIR = ".claude/self-improve/pending";
var PROCESSED_DIR = ".claude/self-improve/processed";
var CONFIG_LAST_RUN = "self_improve_last_run";
var MAX_ACTIVE_RULES = 30;
var SelfImproveEngine = class {
  db;
  projectRoot;
  rulesDir;
  archiveDir;
  pendingDir;
  processedDir;
  constructor(db, projectRoot) {
    this.db = db;
    this.projectRoot = projectRoot;
    this.rulesDir = path2.join(projectRoot, RULES_DIR);
    this.archiveDir = path2.join(projectRoot, ARCHIVE_DIR);
    this.pendingDir = path2.join(projectRoot, PENDING_DIR);
    this.processedDir = path2.join(projectRoot, PROCESSED_DIR);
    this.ensureDirectories();
  }
  ensureDirectories() {
    fs2.mkdirSync(this.rulesDir, { recursive: true });
    fs2.mkdirSync(this.archiveDir, { recursive: true });
    fs2.mkdirSync(this.pendingDir, { recursive: true });
    fs2.mkdirSync(this.processedDir, { recursive: true });
  }
  createRule(newRule) {
    const id = generateId();
    const slug = newRule.title.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    const filename = `${newRule.category.toLowerCase()}-${slug}.md`;
    const rulePath = path2.join(RULES_DIR, filename);
    const fullPath = path2.join(this.projectRoot, rulePath);
    const enforcement = newRule.enforcement ?? "SOFT";
    fs2.writeFileSync(fullPath, newRule.ruleContent, "utf-8");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(`
      INSERT INTO self_improve_rules (id, error_kb_id, title, category, rule_path, occurrences, prevented, status, enforcement, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)
    `).run(id, newRule.error_kb_id ?? null, newRule.title, newRule.category, rulePath, enforcement, now);
    return {
      id,
      error_kb_id: newRule.error_kb_id ?? null,
      title: newRule.title,
      category: newRule.category,
      rule_path: rulePath,
      occurrences: 0,
      prevented: 0,
      status: "active",
      enforcement,
      escalated_at: null,
      created_at: now,
      last_triggered_at: null
    };
  }
  listRules(status) {
    if (status) {
      return this.db.prepare(
        "SELECT * FROM self_improve_rules WHERE status = ? ORDER BY created_at DESC"
      ).all(status);
    }
    return this.db.prepare(
      "SELECT * FROM self_improve_rules ORDER BY status ASC, created_at DESC"
    ).all();
  }
  getRule(id) {
    return this.db.prepare(
      "SELECT * FROM self_improve_rules WHERE id = ?"
    ).get(id) ?? null;
  }
  archiveRule(id) {
    const rule = this.getRule(id);
    if (!rule || rule.status === "archived") return false;
    const srcPath = path2.join(this.projectRoot, rule.rule_path);
    const destPath = path2.join(this.archiveDir, path2.basename(rule.rule_path));
    if (fs2.existsSync(srcPath)) {
      fs2.renameSync(srcPath, destPath);
    }
    const newRulePath = path2.join(ARCHIVE_DIR, path2.basename(rule.rule_path));
    this.db.prepare(
      "UPDATE self_improve_rules SET status = ?, rule_path = ? WHERE id = ?"
    ).run("archived", newRulePath, id);
    return true;
  }
  incrementPrevented(id) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "UPDATE self_improve_rules SET prevented = prevented + 1, last_triggered_at = ? WHERE id = ?"
    ).run(now, id);
  }
  updateOccurrences(id, occurrences) {
    this.db.prepare(
      "UPDATE self_improve_rules SET occurrences = ? WHERE id = ?"
    ).run(occurrences, id);
  }
  getPendingCount() {
    if (!fs2.existsSync(this.pendingDir)) return 0;
    return fs2.readdirSync(this.pendingDir).filter((f) => f.endsWith(".json")).length;
  }
  listPending() {
    if (!fs2.existsSync(this.pendingDir)) return [];
    return fs2.readdirSync(this.pendingDir).filter((f) => f.endsWith(".json")).map((f) => path2.join(this.pendingDir, f)).sort();
  }
  movePendingToProcessed(pendingPath) {
    const filename = path2.basename(pendingPath);
    const destPath = path2.join(this.processedDir, filename);
    if (fs2.existsSync(pendingPath)) {
      fs2.renameSync(pendingPath, destPath);
    }
  }
  getLastRunTimestamp() {
    return getConfig(this.db, CONFIG_LAST_RUN);
  }
  setLastRunTimestamp() {
    setConfig(this.db, CONFIG_LAST_RUN, (/* @__PURE__ */ new Date()).toISOString());
  }
  getRuleStats() {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived,
        COALESCE(SUM(prevented), 0) AS total_prevented
      FROM self_improve_rules
    `).get();
    return {
      active: row?.active ?? 0,
      archived: row?.archived ?? 0,
      total_prevented: row?.total_prevented ?? 0
    };
  }
  getEffectiveness(id) {
    const rule = this.getRule(id);
    if (!rule) return 0;
    const total = rule.prevented + rule.occurrences;
    if (total === 0) return 0;
    return rule.prevented / total;
  }
  isAtCapacity() {
    const stats = this.getRuleStats();
    return stats.active >= MAX_ACTIVE_RULES;
  }
  getMaxActiveRules() {
    return MAX_ACTIVE_RULES;
  }
  escalateRule(id) {
    const rule = this.getRule(id);
    if (!rule || rule.enforcement === "HARD") return false;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "UPDATE self_improve_rules SET enforcement = ?, escalated_at = ? WHERE id = ?"
    ).run("HARD", now, id);
    const fullPath = path2.join(this.projectRoot, rule.rule_path);
    if (fs2.existsSync(fullPath)) {
      let content = fs2.readFileSync(fullPath, "utf-8");
      content = content.replace(/Enforcement:\s*SOFT/g, "Enforcement: HARD");
      fs2.writeFileSync(fullPath, content, "utf-8");
    }
    return true;
  }
  checkEscalation() {
    const rows = this.db.prepare(`
      SELECT id, title, rule_path, created_at, occurrences, prevented,
        CAST((julianday('now') - julianday(created_at)) AS INTEGER) AS days_since_creation
      FROM self_improve_rules
      WHERE status = 'active'
        AND enforcement = 'SOFT'
        AND occurrences >= 3
        AND prevented = 0
        AND CAST((julianday('now') - julianday(created_at)) AS INTEGER) >= 30
      ORDER BY occurrences DESC
    `).all();
    return rows;
  }
  autoArchiveStale(days = 60) {
    const rows = this.db.prepare(`
      SELECT id, rule_path FROM self_improve_rules
      WHERE status = 'active'
        AND occurrences = 0
        AND prevented = 0
        AND CAST((julianday('now') - julianday(created_at)) AS INTEGER) >= ?
    `).all(days);
    const archivedIds = [];
    for (const row of rows) {
      if (this.archiveRule(row.id)) {
        archivedIds.push(row.id);
      }
    }
    return archivedIds;
  }
  recordViolation(id) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "UPDATE self_improve_rules SET occurrences = occurrences + 1, last_triggered_at = ? WHERE id = ?"
    ).run(now, id);
  }
  recordPrevention(id) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      "UPDATE self_improve_rules SET prevented = prevented + 1, last_triggered_at = ? WHERE id = ?"
    ).run(now, id);
  }
  getRulesDir() {
    return this.rulesDir;
  }
  getPendingDir() {
    return this.pendingDir;
  }
  getProcessedDir() {
    return this.processedDir;
  }
};

// src/core/engine/qa-findings-analyzer.ts
import * as fs3 from "fs";
import * as path3 from "path";
var PENDING_DIR2 = ".claude/self-improve/pending";
function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return a.slice(0, i);
}
function isSimilarDescription(a, b) {
  if (a.includes(b) || b.includes(a)) return true;
  const prefix = commonPrefix(a, b).trim();
  const minLen = Math.min(a.length, b.length);
  return minLen > 0 && prefix.length >= minLen * 0.5;
}
function analyzeRecurringFindings(db, projectRoot) {
  const pendingDir = path3.join(projectRoot, PENDING_DIR2);
  fs3.mkdirSync(pendingDir, { recursive: true });
  const findings = db.prepare(`
    SELECT qf.id, qf.run_id, qf.category, qf.description
    FROM qa_findings qf
    JOIN qa_runs qr ON qr.id = qf.run_id
    ORDER BY qf.category, qf.description
  `).all();
  const analyzed = findings.length;
  const groups = [];
  for (const finding of findings) {
    let matched = false;
    for (const group of groups) {
      if (group.category !== finding.category) continue;
      if (isSimilarDescription(finding.description, group.description_pattern)) {
        group.finding_ids.push(finding.id);
        group.run_ids.add(finding.run_id);
        const common = commonPrefix(finding.description, group.description_pattern).trim();
        if (common.length > 0) {
          group.description_pattern = common;
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.push({
        category: finding.category,
        description_pattern: finding.description,
        finding_ids: [finding.id],
        run_ids: /* @__PURE__ */ new Set([finding.run_id])
      });
    }
  }
  let pendingCreated = 0;
  for (const group of groups) {
    if (group.run_ids.size >= 3) {
      const pending = {
        type: "recurring_qa_finding",
        finding_ids: group.finding_ids,
        category: group.category,
        description_pattern: group.description_pattern,
        repeat_count: group.run_ids.size,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      const filename = `recurring-${group.category}-${Date.now()}-${pendingCreated}.json`;
      const filePath = path3.join(pendingDir, filename);
      fs3.writeFileSync(filePath, JSON.stringify(pending, null, 2), "utf-8");
      pendingCreated++;
    }
  }
  return { analyzed, pendingCreated };
}

// src/cli/commands/knowledge.ts
function getErrorKBEngine() {
  const root = findProjectRoot(process.cwd());
  return new ErrorKBEngine(root);
}
function getSelfImproveEngine() {
  const db = initDb();
  const root = findProjectRoot(process.cwd());
  return new SelfImproveEngine(db, root);
}
function registerKnowledgeCommands(program2, getModels) {
  const errorKb = program2.command("error-kb").description("Manage error knowledge base");
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
  const selfImprove = program2.command("self-improve").description("Self-improve rules management");
  selfImprove.command("status").description("Show self-improve status (pending, rules, last run)").action(() => {
    const engine = getSelfImproveEngine();
    const pending = engine.getPendingCount();
    const stats = engine.getRuleStats();
    const lastRun = engine.getLastRunTimestamp();
    const data = { pending, rules: stats, last_run: lastRun };
    if (getJsonMode()) {
      output(data);
    } else {
      const lines = [
        `Pending: ${pending}\uAC74`,
        `Rules: active ${stats.active}, archived ${stats.archived}, prevented ${stats.total_prevented}`,
        `Last run: ${lastRun ?? "never"}`
      ];
      if (stats.active > engine.getMaxActiveRules()) {
        lines.push(`\u26A0 \uD65C\uC131 \uADDC\uCE59\uC774 ${engine.getMaxActiveRules()}\uAC1C \uC0C1\uD55C\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4.`);
      }
      output(data, lines.join("\n"));
    }
  });
  const rules = selfImprove.command("rules").description("Manage self-improve rules");
  rules.command("list").option("--status <status>", "Filter by status (active, archived)").description("List self-improve rules").action((opts) => {
    const engine = getSelfImproveEngine();
    const status = opts.status;
    const ruleList = engine.listRules(status);
    if (ruleList.length === 0) {
      output(ruleList, "No rules found.");
      return;
    }
    if (getJsonMode()) {
      output(ruleList);
    } else {
      output(ruleList, formatRuleList(ruleList));
    }
  });
  rules.command("show").argument("<id>", "Rule ID").description("Show rule details").action((id) => {
    const engine = getSelfImproveEngine();
    const rule = engine.getRule(id);
    if (!rule) return outputError(`Rule not found: ${id}`);
    if (getJsonMode()) {
      output(rule);
    } else {
      output(rule, formatRuleDetail(rule));
    }
  });
  rules.command("update").argument("<id>", "Rule ID").option("--enforcement <level>", "Set enforcement level (SOFT or HARD)").description("Update a rule").action((id, opts) => {
    const engine = getSelfImproveEngine();
    if (opts.enforcement === "HARD") {
      const result = engine.escalateRule(id);
      if (!result) return outputError(`Rule not found or already HARD: ${id}`);
      const updated = engine.getRule(id);
      output(updated, `Rule ${id} escalated to HARD enforcement.`);
    } else if (opts.enforcement === "SOFT") {
      const rule = engine.getRule(id);
      if (!rule) return outputError(`Rule not found: ${id}`);
      output(rule, `Rule ${id} enforcement is SOFT.`);
    } else {
      outputError("--enforcement must be SOFT or HARD");
    }
  });
  rules.command("archive").argument("<id>", "Rule ID").description("Archive a rule").action((id) => {
    const engine = getSelfImproveEngine();
    const result = engine.archiveRule(id);
    if (!result) return outputError(`Rule not found or already archived: ${id}`);
    output({ archived: true, rule_id: id }, `Rule archived: ${id}`);
  });
  selfImprove.command("escalation-status").description("Show rules pending escalation to HARD").action(() => {
    const engine = getSelfImproveEngine();
    const candidates = engine.checkEscalation();
    if (getJsonMode()) {
      output(candidates);
    } else {
      output(candidates, formatEscalationStatus(candidates));
    }
  });
  selfImprove.command("escalate").option("--auto", "Automatically escalate all eligible rules to HARD").description("Escalate rules to HARD enforcement").action((opts) => {
    if (!opts.auto) {
      return outputError("Use --auto flag to escalate eligible rules.");
    }
    const engine = getSelfImproveEngine();
    const candidates = engine.checkEscalation();
    if (candidates.length === 0) {
      output({ escalated: [], count: 0 }, "No rules eligible for escalation.");
      return;
    }
    const escalated = [];
    for (const c of candidates) {
      if (engine.escalateRule(c.id)) {
        escalated.push(c.id);
      }
    }
    output(
      { escalated, count: escalated.length },
      `Escalated ${escalated.length} rule(s) to HARD: ${escalated.join(", ")}`
    );
  });
  selfImprove.command("archive-stale").option("--days <days>", "Number of days without trigger before archiving", "60").description("Archive stale rules that have not been triggered").action((opts) => {
    const engine = getSelfImproveEngine();
    const days = parseInt(opts.days, 10);
    const archived = engine.autoArchiveStale(days);
    output(
      { archived, count: archived.length },
      archived.length > 0 ? `Archived ${archived.length} stale rule(s): ${archived.join(", ")}` : "No stale rules to archive."
    );
  });
  selfImprove.command("analyze-qa").description("Analyze QA findings for recurring patterns and generate pending self-improve signals").action(() => {
    const db = initDb();
    const root = findProjectRoot(process.cwd());
    const result = analyzeRecurringFindings(db, root);
    output(
      result,
      `Analyzed ${result.analyzed} findings, created ${result.pendingCreated} pending signal(s).`
    );
  });
}

// src/cli/commands/quality.ts
import * as fs5 from "fs";

// src/core/engine/qa-config.ts
import { z } from "zod";
import * as YAML from "yaml";
import * as fs4 from "fs";
var CustomRuleSchema = z.object({
  id: z.string(),
  pattern: z.string().refine(
    (val) => {
      try {
        new RegExp(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid regular expression pattern" }
  ),
  severity: z.enum(["critical", "high", "medium", "low"]),
  message: z.string()
});
var IgnoreRuleSchema = z.object({
  rule_id: z.string(),
  paths: z.array(z.string()),
  reason: z.string(),
  expires: z.string().optional()
});
var SeverityAdjustmentSchema = z.object({
  rule_id: z.string(),
  new_severity: z.enum(["critical", "high", "medium", "low"]),
  condition: z.string()
});
var QaRulesSchema = z.object({
  profile: z.enum(["web-frontend", "api-server", "fullstack", "library", "cli-tool"]).optional(),
  risk_thresholds: z.object({
    green: z.number(),
    yellow: z.number(),
    orange: z.number()
  }).optional(),
  severity_weights: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number()
  }).optional(),
  modules: z.object({
    lint_check: z.boolean().optional(),
    type_check: z.boolean().optional(),
    test_coverage: z.boolean().optional(),
    dead_code: z.boolean().optional(),
    dependency_audit: z.boolean().optional(),
    complexity_analysis: z.boolean().optional(),
    shadow: z.boolean().optional(),
    wave_gate: z.boolean().optional(),
    adaptive_planner: z.boolean().optional()
  }).optional(),
  regression_bonus: z.number().optional(),
  custom_rules: z.array(CustomRuleSchema).optional(),
  ignore: z.array(IgnoreRuleSchema).optional(),
  severity_adjustments: z.array(SeverityAdjustmentSchema).optional()
});
var DEFAULT_QA_CONFIG = {
  risk_thresholds: { green: 0.2, yellow: 0.5, orange: 0.8 },
  severity_weights: { critical: 0.4, high: 0.3, medium: 0.2, low: 0.1 },
  modules: {
    lint_check: true,
    type_check: true,
    test_coverage: true,
    dead_code: true,
    dependency_audit: true,
    complexity_analysis: true,
    shadow: false,
    wave_gate: false,
    adaptive_planner: false
  },
  regression_bonus: 0.2
};
var PROFILE_PRESETS = {
  "web-frontend": {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: true,
      wave_gate: false,
      adaptive_planner: false
    },
    severity_weights: { critical: 0.4, high: 0.3, medium: 0.2, low: 0.1 }
  },
  "api-server": {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: false,
      wave_gate: true,
      adaptive_planner: false
    },
    severity_weights: { critical: 0.5, high: 0.3, medium: 0.15, low: 0.05 }
  },
  fullstack: {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: true,
      wave_gate: true,
      adaptive_planner: false
    }
  },
  library: {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: true,
      complexity_analysis: true,
      shadow: false,
      wave_gate: false,
      adaptive_planner: false
    },
    regression_bonus: 0.3
  },
  "cli-tool": {
    modules: {
      lint_check: true,
      type_check: true,
      test_coverage: true,
      dead_code: true,
      dependency_audit: false,
      complexity_analysis: true,
      shadow: false,
      wave_gate: false,
      adaptive_planner: false
    }
  }
};
function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overrideVal = override[key];
    if (overrideVal !== null && overrideVal !== void 0 && typeof overrideVal === "object" && !Array.isArray(overrideVal) && typeof baseVal === "object" && baseVal !== null && !Array.isArray(baseVal)) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== void 0) {
      result[key] = overrideVal;
    }
  }
  return result;
}
function loadYamlConfig(yamlPath) {
  try {
    if (!fs4.existsSync(yamlPath)) {
      return { ...DEFAULT_QA_CONFIG };
    }
    const content = fs4.readFileSync(yamlPath, "utf-8");
    const parsed = YAML.parse(content);
    if (parsed === null || parsed === void 0) {
      return { ...DEFAULT_QA_CONFIG };
    }
    const validated = QaRulesSchema.parse(parsed);
    return deepMerge(DEFAULT_QA_CONFIG, validated);
  } catch (err) {
    console.warn(
      `[VibeSpec] qa-rules.yaml \uD30C\uC2F1 \uC2E4\uD328, L0 \uAE30\uBCF8\uAC12\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4: ${err instanceof Error ? err.message : String(err)}`
    );
    return { ...DEFAULT_QA_CONFIG };
  }
}
function filterExpiredIgnoreRules(config) {
  if (!config.ignore) return config;
  const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const filtered = config.ignore.filter((rule) => {
    if (!rule.expires) return true;
    return rule.expires >= now;
  });
  return { ...config, ignore: filtered };
}
function resolveConfig(options = {}) {
  const { planId, db, yamlPath, rawConfig } = options;
  let config = { ...DEFAULT_QA_CONFIG };
  if (rawConfig) {
    config = { ...rawConfig };
    return filterExpiredIgnoreRules(config);
  }
  const effectiveYamlPath = yamlPath ?? ".claude/qa-rules.yaml";
  const yamlConfig = loadYamlConfig(effectiveYamlPath);
  const profileName = yamlConfig.profile;
  if (profileName && PROFILE_PRESETS[profileName]) {
    config = deepMerge(config, PROFILE_PRESETS[profileName]);
  }
  config = deepMerge(config, yamlConfig);
  if (planId && db) {
    try {
      const row = db.prepare("SELECT qa_overrides FROM plans WHERE id = ?").get(planId);
      if (row?.qa_overrides) {
        const overrides = JSON.parse(row.qa_overrides);
        config = deepMerge(config, overrides);
      }
    } catch {
    }
  }
  config = filterExpiredIgnoreRules(config);
  return config;
}
function validateConfig(config) {
  const errors = [];
  const warnings = [];
  const { green, yellow, orange } = config.risk_thresholds;
  if (green >= yellow) {
    errors.push(`risk_thresholds ordering error: green (${green}) must be less than yellow (${yellow})`);
  }
  if (yellow >= orange) {
    errors.push(`risk_thresholds ordering error: yellow (${yellow}) must be less than orange (${orange})`);
  }
  if (config.custom_rules) {
    for (const rule of config.custom_rules) {
      try {
        new RegExp(rule.pattern);
      } catch {
        errors.push(`Invalid regex pattern in custom_rule '${rule.id}': ${rule.pattern}`);
      }
    }
  }
  if (config.modules) {
    const allFalse = Object.values(config.modules).every((v) => v === false);
    if (allFalse) {
      warnings.push("All modules are disabled. No QA checks will be performed.");
    }
  }
  return { errors, warnings };
}
function detectProfile(packageJson) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const depNames = Object.keys(allDeps);
  const frontendIndicators = ["react", "react-dom", "vue", "svelte", "next", "nuxt", "angular", "@angular/core"];
  const backendIndicators = ["express", "fastify", "koa", "hapi", "@nestjs/core", "hono"];
  const cliIndicators = ["commander", "yargs", "inquirer", "oclif", "meow", "cac"];
  const hasFrontend = depNames.some((d) => frontendIndicators.includes(d));
  const hasBackend = depNames.some((d) => backendIndicators.includes(d));
  const hasCli = depNames.some((d) => cliIndicators.includes(d));
  if (hasFrontend && hasBackend) return "fullstack";
  if (hasFrontend) return "web-frontend";
  if (hasBackend) return "api-server";
  if (hasCli) return "cli-tool";
  return "library";
}

// src/cli/commands/quality.ts
import * as YAML2 from "yaml";
function getQAModels() {
  const m = initModels();
  return { qaRun: m.qaRunModel, qaScenario: m.qaScenarioModel, qaFinding: m.qaFindingModel, planModel: m.planModel };
}
function registerQualityCommands(program2, getModels) {
  const qa = program2.command("qa").description("Manage QA runs, scenarios, and findings");
  const qaRun = qa.command("run").description("Manage QA runs");
  qaRun.command("create").argument("[plan_id]", "Plan ID (optional for --mode security-only)").option("--trigger <type>", "Trigger type (manual, auto, milestone)", "manual").option("--mode <mode>", "Run mode (full, security-only)").description("Create a new QA run").action((planId, opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel } = getQAModels();
    if (opts.mode === "security-only") {
      const { planModel: planModel2 } = initModels();
      let sentinelPlan = planModel2.list({ status: "active" }).find((p) => p.title === "__security_audit__");
      if (!sentinelPlan) {
        sentinelPlan = planModel2.create("__security_audit__", "Auto-created sentinel plan for standalone security audits");
      }
      const run2 = qaRunModel.create(sentinelPlan.id, opts.trigger);
      output(run2, `Created security-only QA run: ${run2.id} (sentinel plan: ${sentinelPlan.id})`);
      return;
    }
    if (!planId) return outputError("Plan ID is required (use --mode security-only for standalone)");
    const { planModel } = initModels();
    const plan = planModel.getById(planId);
    if (!plan) return outputError(`Plan not found: ${planId}`);
    const run = qaRunModel.create(planId, opts.trigger);
    output(run, `Created QA run: ${run.id} (plan: ${planId}, trigger: ${opts.trigger})`);
  }));
  qaRun.command("list").option("--plan <plan_id>", "Filter by plan ID").description("List QA runs").action((opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel } = getQAModels();
    const runs = qaRunModel.list(opts.plan);
    if (runs.length === 0) {
      output(runs, "No QA runs found.");
      return;
    }
    output(runs, runs.map(
      (r) => `${r.id}  ${r.status.padEnd(10)}  risk:${r.risk_score.toFixed(2)}  ${r.passed_scenarios}/${r.total_scenarios} passed  ${r.created_at}`
    ).join("\n"));
  }));
  qaRun.command("show").argument("<run_id>", "QA Run ID").description("Show QA run details with scenarios and findings").action((runId) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaScenario, qaFinding } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    const summary = qaRunModel.getSummary(runId);
    const scenarios = qaScenario.listByRun(runId);
    const findings = qaFinding.list({ runId });
    output({ run, summary, scenarios, findings }, [
      `QA Run: ${run.id} (${run.status})`,
      `Plan: ${run.plan_id} | Trigger: ${run.trigger} | Risk: ${run.risk_score.toFixed(2)}`,
      `Scenarios: ${run.passed_scenarios}/${run.total_scenarios} passed, ${run.failed_scenarios} failed`,
      findings.length > 0 ? `Findings: ${findings.length} total` : "Findings: none",
      run.summary ? `Summary: ${run.summary}` : ""
    ].filter(Boolean).join("\n"));
  }));
  qaRun.command("complete").argument("<run_id>", "QA Run ID").option("--summary <text>", "Summary of the QA run results").option("--status <status>", "Final status (completed, failed)", "completed").description("Complete a QA run and set its final status").action((runId, opts) => withErrorHandler(() => {
    const statusInput = opts.status;
    if (!VALID_QA_RUN_TERMINAL_STATUSES.includes(statusInput)) {
      return outputError(`Invalid status: ${statusInput}. Must be one of: ${VALID_QA_RUN_TERMINAL_STATUSES.join(", ")}`);
    }
    const status = statusInput;
    const { qaRun: qaRunModel } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    if (VALID_QA_RUN_TERMINAL_STATUSES.includes(run.status)) {
      return outputError(`QA run ${runId} is already ${run.status}`);
    }
    const updated = qaRunModel.updateStatus(runId, status, opts.summary);
    output(updated, `QA run ${runId} marked as ${status}${opts.summary ? ` \u2014 ${opts.summary}` : ""}`);
  }));
  const qaScenarioCmd = qa.command("scenario").description("Manage QA scenarios");
  qaScenarioCmd.command("create").argument("<run_id>", "QA Run ID").requiredOption("--title <title>", "Scenario title").requiredOption("--description <desc>", "Scenario description").requiredOption("--category <cat>", "Category (functional, integration, flow, regression, edge_case)").option("--priority <p>", "Priority (critical, high, medium, low)", "medium").option("--related-tasks <ids>", "Comma-separated related task IDs").option("--agent <name>", "Assigned agent name").option("--source <source>", "Scenario source (seed, shadow, wave, final, manual)", "final").description("Create a QA scenario").action((runId, opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaScenario } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    if (run.status !== "pending" && run.status !== "running") {
      return outputError(`Cannot add scenarios to ${run.status} run`);
    }
    const scenario = qaScenario.create(runId, {
      category: opts.category,
      title: opts.title,
      description: opts.description,
      priority: opts.priority,
      related_tasks: opts.relatedTasks ? JSON.stringify(opts.relatedTasks.split(",").map((s) => s.trim())) : void 0,
      source: opts.source
    });
    output(scenario, `Created scenario: ${scenario.id} [${scenario.category}] ${scenario.title}`);
  }));
  qaScenarioCmd.command("update").argument("<id>", "Scenario ID").requiredOption("--status <status>", "Status (pending, running, pass, fail, skip, warn)").option("--evidence <text>", "Evidence text").description("Update scenario status").action((id, opts) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const existing = qaScenario.get(id);
    if (!existing) return outputError(`Scenario not found: ${id}`);
    qaScenario.updateStatus(id, opts.status, opts.evidence);
    const updated = qaScenario.get(id);
    output(updated, `Updated scenario ${id}: ${updated.status}`);
  }));
  qaScenarioCmd.command("list").argument("<run_id>", "QA Run ID").option("--category <cat>", "Filter by category").option("--status <status>", "Filter by status").option("--source <source>", "Filter by source (seed, shadow, wave, final, manual)").description("List scenarios for a QA run").action((runId, opts) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const scenarios = qaScenario.listByRun(runId, {
      category: opts.category,
      status: opts.status,
      source: opts.source
    });
    if (scenarios.length === 0) {
      output(scenarios, "No scenarios found.");
      return;
    }
    output(scenarios, scenarios.map(
      (s) => `${s.id}  [${s.category}]  ${s.status.padEnd(7)}  ${s.priority.padEnd(8)}  ${s.title}`
    ).join("\n"));
  }));
  const qaFindingCmd = qa.command("finding").description("Manage QA findings");
  qaFindingCmd.command("create").argument("<run_id>", "QA Run ID").requiredOption("--title <title>", "Finding title").requiredOption("--description <desc>", "Finding description").requiredOption("--severity <s>", "Severity (critical, high, medium, low)").requiredOption("--category <cat>", "Category (bug, regression, missing_feature, inconsistency, performance, security, ux_issue, spec_gap)").option("--scenario-id <id>", "Related scenario ID").option("--affected-files <files>", "Comma-separated affected files").option("--related-task-id <id>", "Related task ID").option("--fix-suggestion <text>", "Fix suggestion").description("Create a QA finding").action((runId, opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaFinding } = getQAModels();
    const run = qaRunModel.get(runId);
    if (!run) return outputError(`QA run not found: ${runId}`);
    const finding = qaFinding.create(runId, {
      scenario_id: opts.scenarioId,
      severity: opts.severity,
      category: opts.category,
      title: opts.title,
      description: opts.description,
      affected_files: opts.affectedFiles ? JSON.stringify(opts.affectedFiles.split(",").map((s) => s.trim())) : void 0,
      related_task_id: opts.relatedTaskId,
      fix_suggestion: opts.fixSuggestion
    });
    output(finding, `Created finding: ${finding.id} [${finding.severity}] ${finding.title}`);
  }));
  qaFindingCmd.command("update").argument("<id>", "Finding ID").requiredOption("--status <status>", "Status (open, planned, fixed, wontfix, duplicate)").option("--fix-plan-id <id>", "Fix plan ID").description("Update finding status").action((id, opts) => withErrorHandler(() => {
    const { qaFinding } = getQAModels();
    const existing = qaFinding.get(id);
    if (!existing) return outputError(`Finding not found: ${id}`);
    qaFinding.updateStatus(id, opts.status, opts.fixPlanId);
    const updated = qaFinding.get(id);
    output(updated, `Updated finding ${id}: ${updated.status}`);
  }));
  qaFindingCmd.command("list").option("--run <run_id>", "Filter by QA run ID").option("--severity <s>", "Filter by severity").option("--status <s>", "Filter by status").option("--category <cat>", "Filter by category").description("List QA findings").action((opts) => withErrorHandler(() => {
    const { qaFinding } = getQAModels();
    const findings = qaFinding.list({
      runId: opts.run,
      severity: opts.severity,
      status: opts.status,
      category: opts.category
    });
    if (findings.length === 0) {
      output(findings, "No findings found.");
      return;
    }
    output(findings, findings.map(
      (f) => `${f.id}  [${f.severity}]  ${f.status.padEnd(9)}  ${f.category.padEnd(16)}  ${f.title}`
    ).join("\n"));
  }));
  qa.command("stats").option("--plan <plan_id>", "Filter by plan ID").description("Show QA statistics").action((opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel, qaFinding } = getQAModels();
    const runs = qaRunModel.list(opts.plan);
    const completedRuns = runs.filter((r) => r.status === "completed");
    const avgRisk = completedRuns.length > 0 ? completedRuns.reduce((sum, r) => sum + r.risk_score, 0) / completedRuns.length : 0;
    const allFindings = opts.plan ? runs.flatMap((r) => qaFinding.list({ runId: r.id })) : qaFinding.list();
    const openFindings = allFindings.filter((f) => f.status === "open");
    const statsData = {
      total_runs: runs.length,
      completed_runs: completedRuns.length,
      avg_risk_score: Math.round(avgRisk * 100) / 100,
      total_findings: allFindings.length,
      open_findings: openFindings.length,
      findings_by_severity: {
        critical: openFindings.filter((f) => f.severity === "critical").length,
        high: openFindings.filter((f) => f.severity === "high").length,
        medium: openFindings.filter((f) => f.severity === "medium").length,
        low: openFindings.filter((f) => f.severity === "low").length
      }
    };
    output(statsData, [
      `QA Statistics${opts.plan ? ` (plan: ${opts.plan})` : ""}`,
      `Runs: ${statsData.total_runs} total, ${statsData.completed_runs} completed`,
      `Avg Risk Score: ${statsData.avg_risk_score}`,
      `Findings: ${statsData.total_findings} total, ${statsData.open_findings} open`,
      `  critical: ${statsData.findings_by_severity.critical}  high: ${statsData.findings_by_severity.high}  medium: ${statsData.findings_by_severity.medium}  low: ${statsData.findings_by_severity.low}`
    ].join("\n"));
  }));
  const qaSeed = qa.command("seed").description("Manage QA seed scenarios (pre-generated from spec)");
  qaSeed.command("create").argument("<plan_id>", "Plan ID").option("--trigger <type>", "Trigger type (manual, auto)", "manual").description("Create a QA run for seeding and display agent prompt").action((planId, opts) => withErrorHandler(() => {
    const { qaRun: qaRunModel, planModel } = getQAModels();
    const plan = planModel.getById(planId);
    if (!plan) return outputError(`Plan not found: ${planId}`);
    const run = qaRunModel.create(planId, opts.trigger);
    output(run, [
      `Created QA run for seeding: ${run.id} (plan: ${planId})`,
      "",
      "Dispatch qa-seeder agent with:",
      `  plan_id: ${planId}`,
      `  run_id: ${run.id}`,
      `  plan_spec: (from plan show)`,
      `  task_list: (from plan show --tasks)`
    ].join("\n"));
  }));
  qaSeed.command("list").argument("<plan_id>", "Plan ID").description("List seed scenarios for a plan (source=seed)").action((planId) => withErrorHandler(() => {
    const { qaScenario } = getQAModels();
    const scenarios = qaScenario.listByPlanSource(planId, "seed");
    if (scenarios.length === 0) {
      output(scenarios, "No seed scenarios found for this plan.");
      return;
    }
    output(scenarios, scenarios.map(
      (s) => `${s.id}  [${s.category}]  ${s.status.padEnd(7)}  ${s.priority.padEnd(8)}  ${s.title}`
    ).join("\n"));
  }));
  const qaConfig = qa.command("config").description("Manage QA configuration");
  qaConfig.command("resolve").argument("[plan_id]", "Plan ID for L2 overrides").description("Resolve and display merged QA configuration").action((planId) => withErrorHandler(() => {
    const resolveOpts = {};
    if (planId) {
      resolveOpts.planId = planId;
      resolveOpts.db = initDb();
    }
    const config = resolveConfig(resolveOpts);
    output(config, formatConfigHuman(config));
  }));
  qaConfig.command("validate").description("Validate .claude/qa-rules.yaml").action(() => withErrorHandler(() => {
    const yamlPath = ".claude/qa-rules.yaml";
    if (!fs5.existsSync(yamlPath)) {
      return outputError(`Configuration file not found: ${yamlPath}`);
    }
    const rawContent = fs5.readFileSync(yamlPath, "utf-8");
    const parsed = YAML2.parse(rawContent);
    const zodResult = QaRulesSchema.safeParse(parsed);
    const errors = [];
    const warnings = [];
    if (!zodResult.success) {
      for (const issue of zodResult.error.issues) {
        errors.push(`Schema error at ${issue.path.join(".")}: ${issue.message}`);
      }
    }
    if (zodResult.success) {
      const config = resolveConfig({ yamlPath });
      const validation = validateConfig(config);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }
    const result = { errors, warnings, valid: errors.length === 0 };
    output(result, [
      `Validation: ${result.valid ? "PASS" : "FAIL"}`,
      errors.length > 0 ? `Errors (${errors.length}):` : "",
      ...errors.map((e) => `  - ${e}`),
      warnings.length > 0 ? `Warnings (${warnings.length}):` : "",
      ...warnings.map((w) => `  - ${w}`)
    ].filter(Boolean).join("\n"));
  }));
  qaConfig.command("init").description("Auto-detect profile and create .claude/qa-rules.yaml").action(() => withErrorHandler(() => {
    const yamlPath = ".claude/qa-rules.yaml";
    if (fs5.existsSync(yamlPath)) {
      return outputError(`Configuration file already exists: ${yamlPath}`);
    }
    let profile = "library";
    try {
      const pkgContent = fs5.readFileSync("package.json", "utf-8");
      const pkgJson = JSON.parse(pkgContent);
      profile = detectProfile(pkgJson);
    } catch {
    }
    const preset = PROFILE_PRESETS[profile] ?? {};
    const config = {
      profile,
      ...DEFAULT_QA_CONFIG,
      ...preset
    };
    if (!fs5.existsSync(".claude")) {
      fs5.mkdirSync(".claude", { recursive: true });
    }
    const yamlContent = YAML2.stringify(config);
    fs5.writeFileSync(yamlPath, yamlContent, "utf-8");
    output(
      { profile, path: yamlPath },
      `Created ${yamlPath} with profile: ${profile}`
    );
  }));
  qaConfig.command("show").argument("[plan_id]", "Plan ID for L2 overrides").description("Show resolved QA configuration (alias for resolve)").action((planId) => withErrorHandler(() => {
    const resolveOpts = {};
    if (planId) {
      resolveOpts.planId = planId;
      resolveOpts.db = initDb();
    }
    const config = resolveConfig(resolveOpts);
    output(config, formatConfigHuman(config));
  }));
  const waveGate = program2.command("wave-gate").description("Manage wave gates for integration verification");
  waveGate.command("create").argument("<plan_id>", "Plan ID").requiredOption("--wave <number>", "Wave number").requiredOption("--verdict <verdict>", "Verdict (GREEN, YELLOW, RED)").requiredOption("--task-ids <ids>", "Comma-separated task IDs").option("--summary <text>", "Summary of wave gate results").option("--findings-count <n>", "Number of findings", "0").description("Create a wave gate record").action((planId, opts) => withErrorHandler(() => {
    const validVerdicts = ["GREEN", "YELLOW", "RED"];
    if (!validVerdicts.includes(opts.verdict)) {
      return outputError(`Invalid verdict: ${opts.verdict}. Must be one of: ${validVerdicts.join(", ")}`);
    }
    const m = initModels();
    const plan = m.planModel.getById(planId);
    if (!plan) return outputError(`Plan not found: ${planId}`);
    const waveNumber = parseInt(opts.wave, 10);
    if (isNaN(waveNumber) || waveNumber < 0) return outputError(`Invalid wave number: ${opts.wave}`);
    const taskIds = opts.taskIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (taskIds.length === 0) return outputError("At least one task ID is required");
    const findingsCount = parseInt(opts.findingsCount, 10) || 0;
    const gate = m.waveGateModel.create(planId, waveNumber, taskIds, opts.verdict, opts.summary, findingsCount);
    output(gate, `Created wave gate: ${gate.id} (wave ${waveNumber}, verdict: ${opts.verdict})`);
  }));
  waveGate.command("list").argument("<plan_id>", "Plan ID").description("List wave gates for a plan").action((planId) => withErrorHandler(() => {
    const m = initModels();
    const gates = m.waveGateModel.listByPlan(planId);
    if (gates.length === 0) {
      output(gates, "No wave gates found.");
      return;
    }
    output(gates, gates.map(
      (g) => `${g.id}  wave:${g.wave_number}  ${g.verdict.padEnd(6)}  findings:${g.findings_count}  ${g.created_at}`
    ).join("\n"));
  }));
}
function formatConfigHuman(config) {
  const lines = [];
  if (config.profile) {
    lines.push(`Profile: ${config.profile}`);
    lines.push("");
  }
  lines.push("Risk Thresholds:");
  lines.push(`  green:  ${config.risk_thresholds.green}`);
  lines.push(`  yellow: ${config.risk_thresholds.yellow}`);
  lines.push(`  orange: ${config.risk_thresholds.orange}`);
  lines.push("");
  lines.push("Severity Weights:");
  lines.push(`  critical: ${config.severity_weights.critical}`);
  lines.push(`  high:     ${config.severity_weights.high}`);
  lines.push(`  medium:   ${config.severity_weights.medium}`);
  lines.push(`  low:      ${config.severity_weights.low}`);
  lines.push("");
  lines.push("Modules:");
  for (const [key, val] of Object.entries(config.modules)) {
    lines.push(`  ${key}: ${val ? "enabled" : "disabled"}`);
  }
  lines.push("");
  lines.push(`Regression Bonus: ${config.regression_bonus}`);
  if (config.custom_rules && config.custom_rules.length > 0) {
    lines.push("");
    lines.push(`Custom Rules (${config.custom_rules.length}):`);
    for (const rule of config.custom_rules) {
      lines.push(`  [${rule.severity}] ${rule.id}: ${rule.message}`);
    }
  }
  if (config.ignore && config.ignore.length > 0) {
    lines.push("");
    lines.push(`Ignore Rules (${config.ignore.length}):`);
    for (const rule of config.ignore) {
      lines.push(`  ${rule.rule_id}: ${rule.reason} (${rule.paths.join(", ")})`);
    }
  }
  return lines.join("\n");
}

// src/cli/commands/generation.ts
function registerGenerationCommands(program2, getModels) {
  const ideate = program2.command("ideate").description("Manage ideation records");
  ideate.command("list").description("List ideation records from context log").action(() => {
    const { contextModel } = initModels();
    const ideations = contextModel.search("[ideation]");
    if (ideations.length === 0) {
      output([], "ideation \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. /vs-ideate\uB85C \uC544\uC774\uB514\uC5B4\uB97C \uC815\uB9AC\uD574\uBCF4\uC138\uC694.");
      return;
    }
    const formatted = ideations.map(
      (l, i) => `${i + 1}. [#${l.id}] ${l.summary.replace("[ideation] ", "")} (${l.created_at})`
    ).join("\n");
    output(ideations, `## Ideation \uC774\uB825

${formatted}`);
  });
  ideate.command("show").argument("<id>", "Context log ID").description("Show ideation detail").action((id) => {
    withErrorHandler(() => {
      const { contextModel } = initModels();
      const log = contextModel.getById(parseInt(id, 10));
      if (!log) return outputError(`Ideation not found: ${id}`);
      output(log, `## Ideation #${log.id}

**Created**: ${log.created_at}

${log.summary}`);
    });
  });
}

// src/cli/index.ts
var require3 = createRequire2(import.meta.url);
var pkg = require3("../../package.json");
var program = new Command();
program.name("vp").description("VibeSpec CLI").version(pkg.version).option("--json", "Output in JSON format").option("--verbose", "Show detailed error output").hook("preAction", () => {
  setJsonMode(program.opts().json === true);
  setVerboseMode(program.opts().verbose === true);
});
program.command("dashboard").description("Show all active plans overview").action(() => {
  const { dashboard, alerts } = initModels();
  const overview = dashboard.getOverview();
  const alertList = alerts.getAlerts();
  const skillUsage = dashboard.getSkillUsageSummary(7);
  const dashboardText = formatDashboard(overview, alertList);
  const skillText = formatSkillUsage(skillUsage);
  const combined = skillText ? `${dashboardText}

${skillText}` : dashboardText;
  output({ overview, alerts: alertList, skill_usage: skillUsage }, combined);
});
registerPlanningCommands(program, initModels);
registerAuxiliaryCommands(program, initModels);
registerGovernanceCommands(program, initModels);
registerKnowledgeCommands(program, initModels);
registerQualityCommands(program, initModels);
registerGenerationCommands(program, initModels);
registerBacklogCommands(program, initModels);
program.parse();
//# sourceMappingURL=index.js.map