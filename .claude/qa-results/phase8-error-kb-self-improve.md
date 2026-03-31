# Phase 8: Error KB & Self-Improve QA Report

**Date**: 2026-03-29
**Runner**: Claude Opus 4.6

---

## PART A: CLI Execution Results

| ID | Command | Result | Evidence |
|----|---------|--------|----------|
| S8.1 | `error-kb add` | PASS (adjusted) | Created ID `6CuB7SleG2HC`. **NOTE**: Scenario used `--error` flag but CLI requires `--cause`. Corrected to `--cause` and succeeded. |
| S8.2 | `error-kb search "TypeScript"` | PASS | Returned table with 1 match: `6CuB7SleG2HC medium open 1 TypeScript 타입 에러` |
| S8.3 | `error-kb show <id>` | PASS | All fields displayed: title, severity(medium), tags(type-error,ts2345), status(open), occurrences(1), first_seen, last_seen, Cause section, Solution section |
| S8.4 | `error-kb stats` | PASS | Total: 3, By Severity (critical:0, high:1, medium:2, low:0), By Status, Top Recurring list shown |
| S8.5 | `error-kb update <id> --solution` | FAIL (design gap) | `--solution` flag does not exist. CLI only supports `--occurrence`, `--status`, `--severity`. Updated with `--status resolved --severity high` instead - that worked. |
| S8.6 | `error-kb delete <id>` | PASS | `Error deleted: 6CuB7SleG2HC`. Verified with `show` returning "Error not found". |

### S8.5 Finding Detail

The scenario specifies `--solution "Updated: strict 타입 가드 패턴 사용"` but the `update` subcommand does not support `--solution` or `--cause` modification. This is a **feature gap** - once an entry is created, its cause/solution text in the markdown body cannot be updated via CLI. The `update` command only handles metadata fields (status, severity) and occurrence recording.

---

## PART B: Critical Analysis

### 1. Error KB Engine (`src/core/engine/error-kb.ts`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| **Search Algorithm** | Simple `String.includes()` on `title + content` (line 188). No fuzzy matching, no FTS5, no relevance scoring. | MEDIUM |
| **Ranking/Scoring** | None. Results returned in filesystem order (readdir). No scoring, no sorting by relevance/recency/severity. | MEDIUM |
| **Pattern Matching** | No auto-suggest or pattern detection in engine. Delegated entirely to the SKILL.md instructions ("occurrences >= 3 = pattern"). | LOW |
| **Performance** | Benchmark test exists (`error-kb-bench.test.ts`) testing 100 entries < 500ms. File-based storage (markdown frontmatter) means O(N) full scan on every search. Will degrade at ~1000+ entries. | MEDIUM |
| **Storage** | File-based markdown with YAML frontmatter in `.claude/error-kb/errors/`. No database. Index file (`_index.json`) is regenerated on every write. | INFO |
| **Update Gap** | `update()` method supports `severity`, `status`, `occurrences`, `last_seen`, `tags`, and body section replacement via UpdatePatch - but CLI does not expose `--solution`/`--cause` flags. | HIGH |

### 2. Self-Improve Engine (`src/core/engine/self-improve.ts`)

| Aspect | Finding | Severity |
|--------|---------|----------|
| **Fix Commit Detection** | Delegated to `self-improve-trigger.sh` hook. Detects `fix|hotfix|debug` conventional commit prefixes via regex. | OK |
| **Error Pattern Extraction** | Not automated in engine. The SKILL.md instructs the LLM agent to analyze diffs manually. Engine only provides CRUD for rules. | INFO |
| **Rule Promotion Logic** | Not in engine code. Threshold of `occurrences >= 3` is defined only in `SKILL.md` (Phase 4). Engine has no `promote()` method. | MEDIUM |
| **Occurrence/Prevented Tracking** | `incrementPrevented(id)` and `updateOccurrences(id, count)` exist. Simple counter updates via SQL. | OK |
| **Capacity Check** | `MAX_ACTIVE_RULES = 30` constant exists. `isAtCapacity()` method likely checks count. | OK |
| **Pending Pipeline** | File-based: pending JSONs in `.claude/self-improve/pending/`, moved to `processed/` after handling. `getPendingCount()` and `movePendingToProcessed()` exist. | OK |

### 3. Self-Improve Rules Schema (`src/core/db/schema.ts`, v7 migration)

```sql
CREATE TABLE self_improve_rules (
  id                TEXT PRIMARY KEY,
  error_kb_id       TEXT,           -- FK to error-kb (loose, no constraint)
  title             TEXT NOT NULL,
  category          TEXT NOT NULL,
  rule_path         TEXT NOT NULL,
  occurrences       INTEGER DEFAULT 0,
  prevented         INTEGER DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at        TEXT DEFAULT (datetime('now')),
  last_triggered_at TEXT
);
-- 3 indexes: status, category, error_kb_id
```

**Finding**: `error_kb_id` has no FOREIGN KEY constraint (error-kb is file-based, not in SQLite), so referential integrity is not enforced. Acceptable given the hybrid storage design.

### 4. Hook Scripts

| Hook | Purpose | Quality |
|------|---------|---------|
| `error-kb-suggest.sh` | PostToolUse: detects test failures, TS errors, build failures, runtime errors from Bash output. Suggests `vs error-kb search`. | GOOD. Covers 4 error categories. Uses `set -euo pipefail` + `trap 'exit 0' ERR` (fail-open). |
| `self-improve-trigger.sh` | PostToolUse: detects `fix/hotfix/debug` commit messages, extracts diff, creates pending JSON. | GOOD. Extracts commit hash, message, diff summary, diff content, task ID. |
| `self-improve-status.sh` | SessionStart: reports pending count and rule cap status. | GOOD. Silent when nothing to report (AC03). |

### 5. Test Coverage

| File | Test Count | Coverage Areas |
|------|-----------|----------------|
| `error-kb.test.ts` | ~15+ tests | constructor, add (with/without cause/solution), show (found/not-found), search (keyword, tags, severity, combined, empty), delete, update (severity/status/tags/occurrence), getStats (by_severity, by_status, top_recurring), path traversal prevention |
| `error-kb-bench.test.ts` | 4 tests | 100-entry search perf < 500ms (plain, tag filter, severity filter, combined) |
| `self-improve.test.ts` | ~15+ tests | AC01 (migration/table), AC02 (createRule DB+file), AC03 (archiveRule file move+DB), AC04 (listRules filtering), AC05 (getRuleStats), AC06 (directory auto-creation), AC07 (pending/processed file ops), timestamp tracking |
| `error-kb-cli.test.ts` | ~5+ tests | Formatter unit tests for search results, detail view, stats display |
| `error-kb-e2e.test.ts` | exists | E2E CLI integration tests |

### 6. Skills

| Skill | Quality | Notes |
|-------|---------|-------|
| `error-kb/SKILL.md` | GOOD | Clear 4-step workflow: search -> analyze -> record/update -> pattern detect. Severity guidelines. Integration points with vs-next, systematic-debugging. |
| `self-improve/SKILL.md` | GOOD | 5-phase pipeline: pending collection -> root cause analysis -> error-kb recording -> rule promotion (>= 3 occurrences) -> cleanup. 7 category taxonomy. Rule template with frontmatter. |
| `self-improve-review/SKILL.md` | GOOD | Effectiveness formula (`prevented / (prevented + occurrences)`), 30-day inactivity threshold, consolidation of similar rules, 30-rule cap enforcement. |

---

## Summary of Critical Findings

| # | Finding | Severity | Recommendation |
|---|---------|----------|----------------|
| 1 | **S8.1 scenario uses `--error` but CLI requires `--cause`** | LOW | Fix scenario doc to use `--cause` |
| 2 | **S8.5: `update` CLI lacks `--solution`/`--cause` flags** | HIGH | Add `--solution` and `--cause` options to `error-kb update` subcommand. Engine `update()` already supports body section replacement. |
| 3 | **Search is naive `String.includes()`** — no fuzzy, no scoring, no ranking | MEDIUM | Acceptable for < 100 entries. Consider FTS5 or at minimum TF-IDF scoring if KB grows beyond 500 entries. |
| 4 | **Rule promotion logic only in SKILL.md** — engine has no `promote()` | MEDIUM | This is by design (LLM-driven), but risks inconsistency if skill instructions change. Consider adding `shouldPromote(errorKbId): boolean` to engine. |
| 5 | **No deduplication in search** — identical queries return flat list | LOW | Acceptable for now. |
| 6 | **error_kb_id in self_improve_rules has no referential integrity** | LOW | Acceptable given hybrid file/DB storage. |
