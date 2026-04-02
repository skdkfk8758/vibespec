import type Database from 'better-sqlite3';
import type { CodexIntegration, CodexIntegrationStatus, CodexVerificationResult } from '../types.js';
import { generateId } from '../utils.js';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS codex_integrations (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  codex_thread_id TEXT NOT NULL DEFAULT '',
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt >= 1 AND attempt <= 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','verifying','passed','failed','escalated')),
  touched_files TEXT NOT NULL DEFAULT '[]',
  verification_result TEXT CHECK(verification_result IN ('PASS','WARN','FAIL') OR verification_result IS NULL),
  error_kb_entry_id TEXT,
  escalation_summary TEXT,
  prompt_context TEXT NOT NULL DEFAULT '',
  fallback_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export function initCodexIntegrationSchema(db: Database.Database): void {
  db.exec(CREATE_TABLE_SQL);
}

export function createCodexIntegration(db: Database.Database, data: { finding_id: string; run_id: string; codex_thread_id?: string; prompt_context?: string }): CodexIntegration {
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO codex_integrations (id, finding_id, run_id, codex_thread_id, prompt_context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, data.finding_id, data.run_id, data.codex_thread_id ?? '', data.prompt_context ?? '', now, now);
  return getByFindingId(db, data.finding_id)!;
}

export function updateCodexIntegration(db: Database.Database, id: string, updates: Partial<{ status: CodexIntegrationStatus; attempt: number; codex_thread_id: string; touched_files: string; verification_result: CodexVerificationResult | null; error_kb_entry_id: string; escalation_summary: string; prompt_context: string; fallback_reason: string }>): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) { fields.push(`${key} = ?`); values.push(value); }
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE codex_integrations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getByFindingId(db: Database.Database, findingId: string): CodexIntegration | null {
  return (db.prepare('SELECT * FROM codex_integrations WHERE finding_id = ? ORDER BY created_at DESC LIMIT 1').get(findingId) as CodexIntegration) ?? null;
}

export function listByRunId(db: Database.Database, runId: string): CodexIntegration[] {
  return db.prepare('SELECT * FROM codex_integrations WHERE run_id = ? ORDER BY created_at').all(runId) as CodexIntegration[];
}
