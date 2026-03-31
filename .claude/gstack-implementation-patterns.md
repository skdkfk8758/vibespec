# gstack Implementation Patterns — Research Report
> Source: https://github.com/garrytan/gstack (cloned 2026-03-27)

## 1. Browser Automation (/browse, /qa)

### Playwright Wrapper
- **No wrapper library.** Direct Playwright `chromium` import (`playwright` package).
- Two launch modes:
  - **Headless (default):** `chromium.launch({ headless: true })` → `browser.newContext({ viewport: 1280x720 })` → new tab.
  - **Headed:** `chromium.launchPersistentContext(userDataDir, { headless: false })` — required for Chrome extension loading. Uses `~/.gstack/chromium-profile/` as persistent user data dir.
- Extensions loaded via `--load-extension` + `--disable-extensions-except` args. Playwright's bundled Chromium used (real Chrome silently blocks `--load-extension`).

### Headless Browser Lifecycle (Daemon Model)
- **Long-lived Bun.serve() HTTP server** acts as daemon between Claude Code and Chromium.
- First CLI call spawns the server (~3s). Every subsequent call is an HTTP POST to `localhost:PORT` (~100-200ms).
- State file at `.gstack/browse.json`: `{ pid, port, token (UUID v4), startedAt, binaryVersion }` (mode 0o600, atomic write via tmp+rename).
- **Auto-start:** CLI reads state file → if missing or health check fails → spawn new server.
- **Auto-shutdown:** 30-minute idle timeout.
- **Version auto-restart:** Binary embeds `git rev-parse HEAD`. If running server's `binaryVersion` differs, CLI kills old server and starts new one.
- **Port selection:** Random 10000-60000, retry up to 5x on collision (supports multiple workspaces).
- **Crash recovery:** No self-healing. Chromium crash → server exits immediately → CLI auto-restarts on next command.
- **Security:** Localhost-only binding + Bearer token auth on every request.

### The ~100ms/cmd Claim
- Based on the daemon model: after initial 3s cold start, each command is just an HTTP POST to localhost. The Bun compiled binary starts in ~1ms. Chromium is already running and persistent. Round-trip is HTTP overhead + Playwright command execution (~100-200ms including Chromium's work).

### Ref System (Element Addressing)
- `page.accessibility.snapshot()` → YAML-like ARIA tree → parsed, sequential refs assigned (`@e1, @e2...`).
- Each ref maps to a Playwright Locator built via `getByRole(role, { name }).nth(index)`.
- Stored as `Map<string, RefEntry>` on BrowserManager instance.
- **No DOM mutation** — external Locators avoid CSP, framework hydration, and Shadow DOM issues.
- Refs cleared on `framenavigated` event. Staleness detection via async `locator.count()` check (~5ms) before use.
- Cursor-interactive refs (`@c1, @c2`) via `-C` flag: finds `cursor:pointer`, `onclick`, custom `tabindex` elements not in ARIA tree.

### Screenshots in QA Workflow
- `/qa` has 6+3 phases: Initialize → Authenticate → Orient → Explore → Document → Wrap Up → Triage → Fix Loop → Final Report.
- **Two evidence tiers:**
  - Interactive bugs: screenshot before action → perform action → screenshot after → `snapshot -D` (unified diff against previous snapshot).
  - Static bugs: single annotated screenshot (`snapshot -i -a -o path.png` overlays red boxes at each `@ref`).
- Screenshots saved to `$REPORT_DIR/screenshots/issue-NNN-*.png`.
- QA report written using `qa/templates/qa-report-template.md` format.
- Health score rubric: Console (15%), Links (10%), plus per-category scoring (Visual, Functional, UX, Content, Performance, Accessibility).

---

## 2. Safety Skills (/careful, /freeze, /guard)

### Architecture: Claude Code PreToolUse Hooks
All three use **Claude Code's native hook system** — not custom wrappers. Defined in `SKILL.md` frontmatter:

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"       # or "Edit", "Write"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-careful.sh"
```

The hook runs **before** the tool executes. Returns JSON: `{}` to allow, `{"permissionDecision":"deny","message":"..."}` to block.

### /careful — Destructive Command Detection
- `check-careful.sh` is a **pattern-matching shell script** that reads the Bash command from stdin (JSON).
- Matches against regex patterns for: `rm -rf`, `DROP TABLE`, `TRUNCATE`, `git push --force/-f`, `git reset --hard`, `git checkout .`, `git restore .`, `kubectl delete`, `docker rm -f`, `docker system prune`.
- On match: returns `permissionDecision: "deny"` with explanation. User can override.
- Fires analytics event to `~/.gstack/analytics/skill-usage.jsonl`.

### /freeze — Directory-Scoped Edit Restriction
- **Allowlist model** (not deny pattern). Only edits **within** the frozen directory are permitted.
- Setup: user provides a directory path → resolved to absolute → saved to `$STATE_DIR/freeze-dir.txt` (with trailing slash).
- `check-freeze.sh` reads the tool's JSON from stdin, extracts `file_path`, and does a **prefix match**:
  ```bash
  case "$FILE_PATH" in
    "${FREEZE_DIR}"*) echo '{}' ;;           # Inside boundary → allow
    *) echo '{"permissionDecision":"deny"...}' ;;  # Outside → deny
  esac
  ```
- Hooks on both `Edit` and `Write` tool matchers.
- `/unfreeze` removes the boundary.

### /guard — Combined Mode
- Simply registers **both** hooks: `check-careful.sh` on `Bash`, `check-freeze.sh` on `Edit` and `Write`.
- No additional logic — pure composition of `/careful` + `/freeze`.
- References sibling skill directories via `${CLAUDE_SKILL_DIR}/../careful/bin/` and `${CLAUDE_SKILL_DIR}/../freeze/bin/`.

---

## 3. Deploy Skills — REMOVED
> 배포 스킬(deploy, canary, setup-deploy)은 v0.28.0에서 의도적으로 제거됨.
> 릴리즈 기능만 vs-release로 유지.

---

## 4. Review Skills (/office-hours, /plan-ceo-review, /autoplan)

### /plan-ceo-review — CEO/Founder-Mode Review
- **Four modes:** SCOPE EXPANSION (dream big), SELECTIVE EXPANSION (hold scope + cherry-pick), HOLD SCOPE (maximum rigor), SCOPE REDUCTION (strip to essentials).
- "10-star product" framework — challenges premises, expands scope when it creates better product.
- `benefits-from: [office-hours]` — can leverage office-hours context.

### Review Result Persistence
- Results persisted via `gstack-review-log` CLI:
  ```bash
  gstack-review-log '{"skill":"plan-eng-review","timestamp":"ISO","status":"clean|issues_open","unresolved":N,"critical_gaps":N,"commit":"SHORT_HASH"}'
  ```
- Stored in `~/.gstack/projects/$SLUG/` (per-project).
- Review Readiness Dashboard reads all review logs and displays:
  - Which reviews have run, their status, staleness (commit hash comparison).
  - **Verdict logic:** CLEARED if eng review is clean within 7 days; CEO/Design/Codex reviews shown but never block shipping.
  - Staleness: `git rev-list --count STORED_COMMIT..HEAD` to detect drift.

### /autoplan — Three-Phase Pipeline
- **Strict sequential execution: CEO → Design → Eng.**
- Each phase MUST complete fully before next begins (no parallelism).
- Phase-transition summaries emitted between each.
- Tracks results in a GSTACK REVIEW REPORT table embedded in the plan file:

| Review | Trigger | Status | Findings |
|--------|---------|--------|----------|
| CEO Review | `/plan-ceo-review` | — | — |
| Eng Review | `/plan-eng-review` | — | — |
| Design Review | `/plan-design-review` | — | — |

- After eng review, review chaining suggests next steps based on what's missing/stale.

### /office-hours
- Provides CEO-level product review context. Used as input by other plan reviews (`benefits-from: [office-hours]`).

---

## 5. Codex Integration (/codex)

### CLI Wrapper, Not API
- Wraps the **OpenAI Codex CLI** (`codex` command), not a direct API call.
- Three modes:
  1. **Review:** `codex review --base <base> -c 'model_reasoning_effort="xhigh"' --enable web_search_cached`
  2. **Challenge (Adversarial):** `codex exec "<adversarial-prompt>" -C "$(git rev-parse --show-toplevel)" -s read-only --json`
  3. **Consult:** Free-form `codex exec` with session continuity.

### Adversarial Challenge Mode
- Constructs a specific adversarial prompt: "Find ways this code will fail in production. Think like an attacker and a chaos engineer. Find edge cases, race conditions, security holes, resource leaks, failure modes, silent data corruption. Be adversarial. No compliments — just the problems."
- Optional focus area (e.g., `/codex challenge security`) narrows the prompt to that domain.
- Runs in **read-only sandbox** (`-s read-only`) — Codex can read code but not modify it.
- Output parsed as JSONL for reasoning traces and tool calls.
- 5-minute timeout on the Bash tool (`timeout: 300000`).

### Integration in /ship (Pre-Landing Review)
- Diff size triggers review depth:
  - **Large tier (200+ lines):** Runs 4 passes — Codex structured review, Claude structured review, Claude adversarial subagent, Codex adversarial challenge.
  - Pass/fail gate: `[P1]` markers in Codex output → `GATE: FAIL`.
  - If Codex CLI not installed, degrades gracefully to 2 of 4 passes (Claude only).

---

## Key Architectural Patterns for VibeSpec Adaptation

1. **Skills are Markdown, not code.** Every skill is a `SKILL.md` with YAML frontmatter (name, allowed-tools, hooks) + prose instructions. The LLM IS the runtime.
2. **Hooks use Claude Code's native PreToolUse system.** Shell scripts that read JSON from stdin and return `{}` or `{"permissionDecision":"deny"}`.
3. **Browser is a persistent daemon.** Long-lived HTTP server + Chromium process. State file for discovery. Auto-start, auto-shutdown, version auto-restart.
4. **Template system keeps docs in sync with code.** `SKILL.md.tmpl` + code metadata → generated `SKILL.md`. CI validates freshness.
5. **Review results persist to filesystem.** JSONL files in `~/.gstack/`, keyed by project slug. Dashboard reads these for staleness detection.
6. **Multi-model composition.** Claude as primary + Codex CLI as adversarial second opinion. Graceful degradation when Codex unavailable.
7. **Canary monitoring reuses the browse daemon.** No separate monitoring infrastructure — same screenshot/snapshot commands in a polling loop.
