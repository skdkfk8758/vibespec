import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

let _db: Database.Database | null = null;

function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    dir = dirname(dir);
  }
  return startDir;
}

function resolveDbPath(): string {
  if (process.env.VIBESPEC_DB_PATH) {
    return process.env.VIBESPEC_DB_PATH;
  }
  const root = findProjectRoot(process.cwd());
  return resolve(root, 'vibespec.db');
}

export function getDb(dbPath?: string): Database.Database {
  if (_db) return _db;

  const path = dbPath ?? resolveDbPath();
  _db = new Database(path);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

export function createMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
