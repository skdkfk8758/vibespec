import type Database from 'better-sqlite3';

export function initSchema(db: Database.Database): void {
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
