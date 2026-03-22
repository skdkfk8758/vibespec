import type Database from 'better-sqlite3';

export interface ObsidianConfig {
  vault?: string;
  folder?: string;
  enabled?: boolean;
}

export function getConfig(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM vs_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT INTO vs_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function deleteConfig(db: Database.Database, key: string): void {
  db.prepare('DELETE FROM vs_config WHERE key = ?').run(key);
}

export function listConfig(db: Database.Database): Array<{ key: string; value: string }> {
  return db.prepare('SELECT key, value FROM vs_config ORDER BY key').all() as Array<{ key: string; value: string }>;
}

export function resolveVaultPath(db: Database.Database, cliOpt?: string): string | null {
  if (cliOpt) return cliOpt;
  if (process.env.VS_OBSIDIAN_VAULT) return process.env.VS_OBSIDIAN_VAULT;
  return getConfig(db, 'obsidian.vault');
}

export function resolveObsidianFolder(db: Database.Database, cliOpt?: string): string {
  if (cliOpt) return cliOpt;
  if (process.env.VS_OBSIDIAN_FOLDER) return process.env.VS_OBSIDIAN_FOLDER;
  return getConfig(db, 'obsidian.folder') ?? 'VibeSpec/Errors';
}
