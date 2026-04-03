#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

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
function normalizeError(err) {
  return err instanceof Error ? err : new Error(String(err));
}

// src/core/models/base-repository.ts
var BaseRepository = class {
  db;
  tableName;
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
  }
  getById(id) {
    const row = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    return row ?? null;
  }
  requireById(id) {
    const entity = this.getById(id);
    if (!entity) throw new Error(`${this.tableName} not found: ${id}`);
    return entity;
  }
  list() {
    return this.db.prepare(`SELECT * FROM ${this.tableName}`).all();
  }
  delete(id) {
    this.requireById(id);
    this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }
  update(id, fields) {
    this.requireById(id);
    const query = buildUpdateQuery(this.tableName, id, fields);
    if (query) {
      this.db.prepare(query.sql).run(...query.params);
    }
    return this.requireById(id);
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
var TaskModel = class extends BaseRepository {
  events;
  constructor(db, events) {
    super(db, "tasks");
    this.events = events;
  }
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

// src/core/engine/plan-verifier.ts
var AC_PATTERN = /^(AC\d+):\s*(.+)$/;
var PlanVerifier = class {
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * AC와 코드 변경 파일을 매칭하여 ACMatch를 반환한다.
   * confidence 레벨:
   *   high   — testFiles 경로 중 하나에 AC 번호(acId)가 포함됨
   *   medium — changedFiles 경로 중 하나의 파일명이 AC 텍스트에 포함됨
   *   low    — AC 텍스트 토큰이 changedFiles 경로와 하나라도 겹침
   *   unmatched — 위 모두 해당 없음
   */
  matchACToChanges(ac, changedFiles, testFiles) {
    const changedModuleNames = changedFiles.map((cf) => {
      const fileName = cf.split("/").pop() ?? cf;
      return fileName.replace(/\.[^.]+$/, "").toLowerCase();
    });
    const matchedTests = testFiles.filter((tf) => {
      if (tf.includes(ac.acId)) return true;
      const tfFileName = tf.split("/").pop() ?? tf;
      const tfModuleName = tfFileName.replace(/\.test\.[^.]+$/, "").replace(/\.spec\.[^.]+$/, "").toLowerCase();
      return changedModuleNames.includes(tfModuleName);
    });
    if (matchedTests.length > 0) {
      return {
        acId: ac.acId,
        text: ac.text,
        matchedFiles: changedFiles,
        matchedTests,
        confidence: "high"
      };
    }
    const acTextLower = ac.text.toLowerCase();
    const matchedFiles = changedFiles.filter((cf) => {
      const fileName = cf.split("/").pop() ?? cf;
      const withoutExt = fileName.replace(/\.[^.]+$/, "");
      return acTextLower.includes(fileName.toLowerCase()) || acTextLower.includes(withoutExt.toLowerCase());
    });
    if (matchedFiles.length > 0) {
      return {
        acId: ac.acId,
        text: ac.text,
        matchedFiles,
        matchedTests: [],
        confidence: "medium"
      };
    }
    const acTokens = ac.text.toLowerCase().split(/[\s\-_./\\]+/).filter((t) => t.length > 2);
    const lowMatchedFiles = changedFiles.filter((cf) => {
      const cfTokens = cf.toLowerCase().split(/[\s\-_./\\]+/);
      return acTokens.some((t) => cfTokens.includes(t));
    });
    if (lowMatchedFiles.length > 0) {
      return {
        acId: ac.acId,
        text: ac.text,
        matchedFiles: lowMatchedFiles,
        matchedTests: [],
        confidence: "low"
      };
    }
    return {
      acId: ac.acId,
      text: ac.text,
      matchedFiles: [],
      matchedTests: [],
      confidence: "unmatched"
    };
  }
  /**
   * 플랜의 모든 done 태스크를 검증하고 VerificationResult를 반환한다.
   * - acceptance가 null인 태스크는 스킵
   * - 모든 태스크 skipped → overallScore = -1 (N/A)
   * - MUST 관련 AC 미매칭 시 warnings에 경고 추가
   */
  async verify(planId) {
    if (!this.db) {
      throw new Error("PlanVerifier requires a Database instance for verify()");
    }
    const taskModel = new TaskModel(this.db);
    const doneTasks = taskModel.getByPlan(planId, { status: "done" });
    const tasksWithAC = doneTasks.filter((t) => t.acceptance !== null && t.acceptance !== void 0);
    const taskResults = [];
    const unmatchedACs = [];
    const warnings = [];
    const handoffStmt = this.db.prepare(
      "SELECT changed_files FROM agent_handoffs WHERE task_id = ? ORDER BY attempt DESC LIMIT 1"
    );
    for (const task of tasksWithAC) {
      const acItems = this.parseACs(task.acceptance);
      const handoffRow = handoffStmt.get(task.id);
      let changedFiles = [];
      if (handoffRow?.changed_files) {
        try {
          changedFiles = JSON.parse(handoffRow.changed_files);
        } catch {
        }
      }
      const testFiles = changedFiles.filter(
        (f) => f.includes(".test.") || f.includes(".spec.") || f.includes("__tests__")
      );
      const acMatches = acItems.map(
        (ac) => this.matchACToChanges(ac, changedFiles, testFiles)
      );
      for (const match of acMatches) {
        if (match.confidence === "unmatched") {
          unmatchedACs.push(`${task.id}:${match.acId}`);
          if (/MUST|반드시|필수/i.test(match.text)) {
            warnings.push(
              `[MUST] ${match.acId} (task: ${task.id}): "${match.text}" \u2014 \uBBF8\uB9E4\uCE6D`
            );
          }
        }
      }
      taskResults.push({ taskId: task.id, acItems: acMatches });
    }
    let overallScore;
    if (taskResults.length === 0) {
      overallScore = -1;
    } else {
      const allMatches = taskResults.flatMap((tr) => tr.acItems);
      const total = allMatches.length;
      if (total === 0) {
        overallScore = -1;
      } else {
        const matched = allMatches.filter((m) => m.confidence !== "unmatched").length;
        overallScore = Math.round(matched / total * 100);
      }
    }
    return {
      planId,
      taskResults,
      overallScore,
      unmatchedACs,
      warnings
    };
  }
  /**
   * acceptance criteria 문자열을 ACItem 배열로 파싱한다.
   * - "AC01: 설명" 형식 → 각각 ACItem으로 추출
   * - AC 번호 없는 자유형식 → 전체를 단일 ACItem { acId: "AC-FREE-1" }으로 반환
   * - 빈 문자열 / null / undefined → 빈 배열 반환
   */
  parseACs(acceptance) {
    if (acceptance === null || acceptance === void 0) {
      return [];
    }
    const trimmed = acceptance.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const lines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const acLines = lines.filter((l) => AC_PATTERN.test(l));
    if (acLines.length > 0) {
      const items = [];
      for (const line of lines) {
        const match = line.match(AC_PATTERN);
        if (match) {
          items.push({ acId: match[1], text: match[2].trim() });
        }
      }
      return items;
    }
    return [{ acId: "AC-FREE-1", text: trimmed }];
  }
};

export {
  __commonJS,
  __toESM,
  validateTransition,
  generateId,
  hasColumn,
  withTransaction,
  buildUpdateQuery,
  normalizeError,
  BaseRepository,
  TaskModel,
  PlanVerifier
};
//# sourceMappingURL=chunk-VPBWN2NJ.js.map