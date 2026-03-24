import Database from 'better-sqlite3';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';

let _db: Database.Database | null = null;

export interface GitContext {
  branch: string | null;
  worktreeName: string | null;
  isWorktree: boolean;
}

export function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    const gitPath = resolve(dir, '.git');
    if (existsSync(gitPath)) {
      const stat = statSync(gitPath);
      if (stat.isFile()) {
        const content = readFileSync(gitPath, 'utf-8').trim();
        const match = content.match(/^gitdir:\s*(.+)/);
        if (match) {
          const absGitDir = resolve(dir, match[1]);
          return absGitDir.replace(/[/\\]\.git[/\\]worktrees[/\\].*$/, '');
        }
      }
      return dir;
    }
    dir = dirname(dir);
  }
  return startDir;
}

export function detectGitContext(): GitContext {
  try {
    const raw = execSync('git rev-parse --abbrev-ref HEAD --git-dir', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const lines = raw.split('\n');
    const branch = lines[0];
    const gitDir = lines[1] ?? '';

    const isWorktree = gitDir.includes('/worktrees/');
    let worktreeName: string | null = null;
    if (isWorktree) {
      const match = gitDir.match(/\/worktrees\/([^/]+)$/);
      worktreeName = match ? match[1] : null;
    }

    return {
      branch: branch === 'HEAD' ? null : branch,
      worktreeName,
      isWorktree,
    };
  } catch {
    return { branch: null, worktreeName: null, isWorktree: false };
  }
}

function resolveDbPath(): string {
  if (process.env.VIBESPEC_DB_PATH) {
    return process.env.VIBESPEC_DB_PATH;
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.env.PROJECT_DIR;
  if (projectDir) {
    return resolve(findProjectRoot(projectDir), 'vibespec.db');
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
