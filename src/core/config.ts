import type Database from 'better-sqlite3';
import { validateConfigEntry } from './config-schema.js';

export function getConfig(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM vs_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(db: Database.Database, key: string, value: string): void {
  validateConfigEntry(key, value);
  db.prepare('INSERT INTO vs_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function deleteConfig(db: Database.Database, key: string): void {
  db.prepare('DELETE FROM vs_config WHERE key = ?').run(key);
}

export function listConfig(db: Database.Database): Array<{ key: string; value: string }> {
  return db.prepare('SELECT key, value FROM vs_config ORDER BY key').all() as Array<{ key: string; value: string }>;
}

