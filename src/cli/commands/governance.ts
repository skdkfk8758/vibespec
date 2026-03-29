import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { getConfig, setConfig, deleteConfig } from '../../core/config.js';
import { output, outputError, initDb } from '../shared.js';
import type { Models } from '../shared.js';

/** Register/unregister PreToolUse hooks in .claude/settings.local.json */
function manageHook(action: 'add' | 'remove', hookId: string, toolName: string, scriptPath: string) {
  const settingsDir = join(process.cwd(), '.claude');
  const settingsPath = join(settingsDir, 'settings.local.json');
  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch { settings = {}; }
  }
  if (!settings.hooks) settings.hooks = {};
  const hooks = settings.hooks as Record<string, unknown[]>;
  if (!hooks.PreToolUse) hooks.PreToolUse = [];
  const preToolUse = hooks.PreToolUse as Array<Record<string, unknown>>;

  if (action === 'add') {
    // Remove existing hook with same id before adding
    hooks.PreToolUse = preToolUse.filter((h) => h.id !== hookId);
    (hooks.PreToolUse as Array<Record<string, unknown>>).push({
      id: hookId,
      type: 'command',
      matcher: toolName,
      command: scriptPath,
    });
    // Ensure script is executable
    if (existsSync(scriptPath)) {
      try { chmodSync(scriptPath, 0o755); } catch { /* ignore */ }
    }
  } else {
    hooks.PreToolUse = preToolUse.filter((h) => h.id !== hookId);
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

export function registerGovernanceCommands(program: Command, _getModels: () => Models): void {
  // ── careful ──
  const careful = program.command('careful').description('Manage careful mode (destructive command guard)');

  careful
    .command('on')
    .description('Enable careful mode')
    .action(() => {
      const db = initDb();
      setConfig(db, 'careful.enabled', 'true');
      const scriptPath = join(process.cwd(), 'bin', 'check-careful.sh');
      manageHook('add', 'vs-careful', 'Bash', scriptPath);
      output({ careful: true }, '⚠️ careful 모드 활성화됨 — 파괴적 명령이 차단됩니다.');
    });

  careful
    .command('off')
    .description('Disable careful mode')
    .action(() => {
      const db = initDb();
      setConfig(db, 'careful.enabled', 'false');
      manageHook('remove', 'vs-careful', 'Bash', '');
      output({ careful: false }, 'careful 모드 비활성화됨.');
    });

  careful
    .command('status')
    .description('Show careful mode status')
    .action(() => {
      const db = initDb();
      const enabled = getConfig(db, 'careful.enabled') === 'true';
      output({ careful: enabled }, enabled ? '⚠️ careful 모드: 활성화' : 'careful 모드: 비활성화');
    });

  // ── freeze ──
  const freeze = program.command('freeze').description('Manage freeze boundary (edit scope restriction)');

  freeze
    .command('set')
    .argument('<path>', 'Directory path to restrict edits to')
    .description('Set freeze boundary')
    .action((inputPath: string) => {
      const db = initDb();
      const absPath = resolve(inputPath);
      setConfig(db, 'freeze.path', absPath);
      const scriptPath = join(process.cwd(), 'bin', 'check-freeze.sh');
      manageHook('add', 'vs-freeze-edit', 'Edit', scriptPath);
      manageHook('add', 'vs-freeze-write', 'Write', scriptPath);
      output({ freeze: absPath }, `🔒 freeze 활성화됨 — 편집 범위: ${absPath}`);
    });

  freeze
    .command('off')
    .description('Remove freeze boundary')
    .action(() => {
      const db = initDb();
      deleteConfig(db, 'freeze.path');
      manageHook('remove', 'vs-freeze-edit', 'Edit', '');
      manageHook('remove', 'vs-freeze-write', 'Write', '');
      output({ freeze: null }, 'freeze 비활성화됨 — 편집 범위 제한 해제.');
    });

  freeze
    .command('status')
    .description('Show freeze boundary status')
    .action(() => {
      const db = initDb();
      const freezePath = getConfig(db, 'freeze.path');
      output(
        { freeze: freezePath },
        freezePath ? `🔒 freeze: ${freezePath}` : 'freeze: 비활성화'
      );
    });

  // ── guard ──
  const guard = program.command('guard').description('Enable/disable careful + freeze combined');

  guard
    .command('on')
    .argument('<path>', 'Directory path to restrict edits to')
    .description('Enable careful mode and set freeze boundary')
    .action((inputPath: string) => {
      const db = initDb();
      const absPath = resolve(inputPath);
      setConfig(db, 'careful.enabled', 'true');
      setConfig(db, 'freeze.path', absPath);
      const carefulScript = join(process.cwd(), 'bin', 'check-careful.sh');
      const freezeScript = join(process.cwd(), 'bin', 'check-freeze.sh');
      manageHook('add', 'vs-careful', 'Bash', carefulScript);
      manageHook('add', 'vs-freeze-edit', 'Edit', freezeScript);
      manageHook('add', 'vs-freeze-write', 'Write', freezeScript);
      output(
        { careful: true, freeze: absPath },
        `🛡️ guard 활성화됨 — careful + freeze: ${absPath}`
      );
    });

  guard
    .command('off')
    .description('Disable both careful mode and freeze boundary')
    .action(() => {
      const db = initDb();
      setConfig(db, 'careful.enabled', 'false');
      deleteConfig(db, 'freeze.path');
      manageHook('remove', 'vs-careful', 'Bash', '');
      manageHook('remove', 'vs-freeze-edit', 'Edit', '');
      manageHook('remove', 'vs-freeze-write', 'Write', '');
      output({ careful: false, freeze: null }, 'guard 비활성화됨 — careful + freeze 모두 해제.');
    });

  guard
    .command('status')
    .description('Show guard status')
    .action(() => {
      const db = initDb();
      const carefulEnabled = getConfig(db, 'careful.enabled') === 'true';
      const freezePath = getConfig(db, 'freeze.path');
      output(
        { careful: carefulEnabled, freeze: freezePath },
        `🛡️ guard: careful=${carefulEnabled ? '활성화' : '비활성화'}, freeze=${freezePath ?? '비활성화'}`
      );
    });
}
