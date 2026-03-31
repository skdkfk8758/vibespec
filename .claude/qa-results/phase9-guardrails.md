# Phase 9: Guardrails (Safety) Testing Report

## PART A: CLI Execution Results

| ID | Scenario | Result | Execution Evidence |
|----|----------|--------|--------------------|
| S9.1 | Careful 모드 활성화 | PASS | `careful on` -> "careful 모드 활성화됨 -- 파괴적 명령이 차단됩니다." / `status` -> "careful 모드: 활성화" |
| S9.2 | Careful 모드 상태 확인 | PASS | `careful status` -> "careful 모드: 활성화" (정확한 상태 표시) |
| S9.3 | Careful 모드 비활성화 | PASS | `careful off` -> "careful 모드 비활성화됨." / `status` -> "careful 모드: 비활성화" |
| S9.4 | Freeze 모드 활성화 | PASS (syntax note) | `freeze set src/components` -> "freeze 활성화됨 -- 편집 범위: .../src/components". 단, `--path` 옵션이 아닌 positional argument임 (`freeze set <path>`) |
| S9.5 | Freeze 상태 확인 & 비활성화 | PARTIAL | `freeze status` -> PASS. `freeze unset` -> FAIL ("unknown command 'unset'"). 올바른 명령은 `freeze off` |
| S9.6 | Guard 모드 (careful+freeze) | PARTIAL | `guard on src/` -> PASS ("guard 활성화됨 -- careful + freeze"). `guard status` -> PASS. `guard off` -> PASS. 단, `guard set --path` / `guard unset` 명령은 존재하지 않음 (올바른 명령: `guard on <path>` / `guard off`) |

### Syntax Discrepancy Summary
- **freeze**: subcommands are `set <path>`, `off`, `status` (NOT `--path` option, NOT `unset`)
- **guard**: subcommands are `on <path>`, `off`, `status` (NOT `set --path`, NOT `unset`)
- Test scenario 명세와 실제 CLI 인터페이스 간 불일치 있음. 실제 동작은 정상.

---

## PART B: Critical Analysis

### 1. Hook Scripts Analysis

#### careful-guard (bin/check-careful.sh)
**Blocked patterns** (10 patterns):
- `rm -rf`, `rm -fr`
- `DROP TABLE`, `DROP DATABASE`
- `TRUNCATE`
- `git push --force`, `git push -f`
- `git reset --hard`
- `git clean -f`
- `git checkout -- .`

**Detection method**: grep -qEi (case-insensitive regex) against the `command` field from TOOL_INPUT JSON.

#### freeze-boundary (bin/check-freeze.sh)
**Enforcement**: Extracts `file_path` (Edit/Write) or redirect target (Bash `>`, `>>`, `tee`). Converts to absolute path via `cd dirname && pwd`. Prefix-matches against freeze.path.

### 2. Config Storage
- Stored in **SQLite** (`vibespec.db`, table `vs_config`): keys `careful.enabled` and `freeze.path`
- Hooks read config via `node dist/cli/index.js config get <key>` (bin scripts) or `sqlite3` direct query (hooks/lib/read-config.sh)

### 3. CLI Implementation
- `manageHook()` in `src/cli/index.ts` reads/writes `.claude/settings.local.json`
- Adds `PreToolUse` hook entries with id, type, matcher (Bash/Edit/Write), and command path
- On removal, filters out by hookId. After cleanup, `PreToolUse` array is empty (verified).

### 4. Security Findings

| # | Finding | Severity | Detail |
|---|---------|----------|--------|
| SEC-1 | Careful-guard bypass via subshell/variable expansion | MEDIUM | `bash -c "rm -rf /"` or `CMD="rm"; $CMD -rf /` evades regex. Pattern only matches literal `rm\s+-rf`. |
| SEC-2 | Careful-guard bypass via line breaks | MEDIUM | Multi-line commands (e.g., `rm \\\n-rf /`) may not match single-line grep. |
| SEC-3 | Careful-guard bypass via aliases/functions | LOW | `alias destroy='rm -rf'` then `destroy /` is undetectable. Acceptable -- aliases unlikely in tool input. |
| SEC-4 | Freeze bypass via `cp`, `mv`, `sed -i` in Bash | MEDIUM | Freeze only checks redirect patterns (`>`, `>>`, `tee`) for Bash tool. `cp malicious.txt /outside/path` is NOT caught. |
| SEC-5 | Freeze bypass via Bash `mv` or `install` | MEDIUM | Same as SEC-4. Any file-modifying command that isn't redirect-based bypasses the check. |
| SEC-6 | No symlink resolution | MEDIUM | `cd` + `pwd` resolves symlinks on macOS, but if freeze.path itself contains a symlink that doesn't exist yet, fallback uses raw string. Symlink in target could escape boundary. |
| SEC-7 | Prefix matching false positive | LOW | If freeze=/app/src, then /app/srcExtra/file.txt would pass (prefix match without trailing `/`). |
| SEC-8 | No `--force-with-lease` exemption in bin script | LOW | Unlike hooks/careful-guard.sh, bin/check-careful.sh lacks `--force-with-lease` allowlist -- blocks legitimate safe force pushes. |
| SEC-9 | Node.js process per hook invocation | INFO | Each hook call spawns `node dist/cli/index.js config get` -- ~200ms overhead per tool use. hooks/lib/read-config.sh uses sqlite3 directly (~1ms) but bin/ scripts do not. |

### 5. guardrail-status.sh (SessionStart hook)
- Reads `careful.enabled` and `freeze.path` from DB via `vs_config_get()`
- Prints status line if either is active (e.g., "careful 모드 활성화 중 | freeze: /path")
- Has `trap 'exit 0' ERR` -- silently succeeds on any error (good resilience)
- Uses the fast sqlite3 path via read-config.sh (not node)

---

## Summary Verdict

**4/6 PASS, 2/6 PARTIAL** (partial due to test scenario syntax mismatch, not functional bugs)

All core guardrail functionality works correctly. The main security concern is that careful-guard can be bypassed with indirect command invocation (subshells, variable expansion), and freeze-boundary only guards Edit/Write file_path + Bash redirects but not arbitrary Bash file-write commands (cp, mv, sed -i). These are known limitations acknowledged in the code comments ("완벽하지 않으나 주요 패턴을 커버").
