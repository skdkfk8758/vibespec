import type Database from 'better-sqlite3';
import { hasColumn } from '../utils.js';

const PLAN_PROGRESS_VIEW_SQL = `
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

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL CHECK(status IN ('draft','active','approved','completed','archived')) DEFAULT 'draft',
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
      allowed_files TEXT,
      forbidden_patterns TEXT,
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
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  applyMigrations(db);
}

export function applyMigrations(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number;

  if (version < 1) {
    if (!hasColumn(db, 'plans', 'branch')) {
      db.exec('ALTER TABLE plans ADD COLUMN branch TEXT');
    }
    if (!hasColumn(db, 'plans', 'worktree_name')) {
      db.exec('ALTER TABLE plans ADD COLUMN worktree_name TEXT');
    }

    db.exec('DROP VIEW IF EXISTS plan_progress');
    db.exec(`CREATE VIEW plan_progress AS ${PLAN_PROGRESS_VIEW_SQL}`);

    db.pragma('user_version = 1');
  }

  if (version < 2) {
    if (!hasColumn(db, 'tasks', 'depends_on')) {
      db.exec('ALTER TABLE tasks ADD COLUMN depends_on TEXT');
    }

    db.pragma('user_version = 2');
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

    db.pragma('user_version = 3');
  }

  if (version < 4) {
    if (!hasColumn(db, 'tasks', 'allowed_files')) {
      db.exec('ALTER TABLE tasks ADD COLUMN allowed_files TEXT');
    }
    if (!hasColumn(db, 'tasks', 'forbidden_patterns')) {
      db.exec('ALTER TABLE tasks ADD COLUMN forbidden_patterns TEXT');
    }

    db.pragma('user_version = 4');
  }

  if (version < 5) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_metrics'").all();
    if (tables.length > 0) {
      if (!hasColumn(db, 'task_metrics', 'changed_files_detail')) {
        db.exec('ALTER TABLE task_metrics ADD COLUMN changed_files_detail TEXT');
      }
      if (!hasColumn(db, 'task_metrics', 'scope_violations')) {
        db.exec('ALTER TABLE task_metrics ADD COLUMN scope_violations TEXT');
      }
    }

    db.pragma('user_version = 5');
  }

  if (version < 6) {
    // Add 'approved' to plans.status CHECK constraint
    // SQLite cannot ALTER CHECK constraints, so recreate the table
    // Disable FK temporarily to avoid CASCADE deleting tasks
    db.pragma('foreign_keys = OFF');

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
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
      INSERT INTO plans_new SELECT * FROM plans;
      DROP TABLE plans;
      ALTER TABLE plans_new RENAME TO plans;
    `);

    db.pragma('foreign_keys = ON');

    // Recreate views
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

    db.pragma('user_version = 6');
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

    db.pragma('user_version = 7');
  }

  if (version < 8) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS qa_runs (
        id                TEXT PRIMARY KEY,
        plan_id           TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        trigger           TEXT NOT NULL CHECK(trigger IN ('manual', 'auto', 'milestone')),
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
        category          TEXT NOT NULL CHECK(category IN ('functional', 'integration', 'flow', 'regression', 'edge_case')),
        title             TEXT NOT NULL,
        description       TEXT NOT NULL,
        priority          TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
        related_tasks     TEXT,
        status            TEXT NOT NULL CHECK(status IN ('pending', 'running', 'pass', 'fail', 'skip', 'warn')) DEFAULT 'pending',
        agent             TEXT,
        evidence          TEXT,
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

    db.pragma('user_version = 8');
  }
}
