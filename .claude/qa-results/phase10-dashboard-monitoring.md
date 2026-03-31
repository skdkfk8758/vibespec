# Phase 10: Dashboard & Monitoring — QA Report

## PART A: CLI Execution Results

| ID | Scenario | Result | Evidence |
|----|----------|--------|----------|
| S10.1 | `dashboard` | PASS | Shows 5 plans with progress bars, backlog summary (18 open/22 total), 6 alerts (completable x3, backlog_critical x3) |
| S10.2 | `stats` | PASS | Velocity: 23.4 tasks/day (164 in 7d), timeline bar chart 03/16~03/29 |
| S10.3 | `history` | FAIL | `error: missing required argument 'type'` — command requires `<type> <id>` args, not a general event history. With args (`history plan <id>`) works correctly showing timestamped events. Scenario spec is misleading. |
| S10.4 | `insights` | PASS | Returns JSON with blocked_patterns (empty), duration_stats (avg 541.3min, median 540.89min, n=163), success_rates (overall 97%, per-plan breakdown) |
| S10.5 | `dashboard --json` / `stats --json` | PASS | Both produce valid JSON (verified via `json.load()`) |

## PART B: Critical Code Analysis

### Alert Thresholds

| Threshold | Value | Configurable? | Assessment |
|-----------|-------|---------------|------------|
| Stale task | 3 days | YES — `getStaleTasks(thresholdDays=3)` param | Reasonable default, caller can override |
| Forgotten plan | 7 days | YES — `getForgottenPlans(thresholdDays=7)` param | Reasonable |
| QA risk high | risk_score >= 0.5 | NO — hardcoded in SQL `WHERE risk_score >= 0.5` | Should be configurable |
| QA stale | >7 days | NO — hardcoded `HAVING days_since > 7` | Should be configurable |
| Backlog stale | >7 days | NO — hardcoded in SQL | Should be configurable |
| Blocked % recommendation | >=30% | NO — hardcoded in insights | Should be configurable |
| Duration recommendation | >60 min | NO — hardcoded in insights | Should be configurable |
| Concerns recommendation | >=50% | NO — hardcoded in insights | Should be configurable |

### Stale Detection
- **Task stale**: `in_progress` tasks where `JULIANDAY('now') - JULIANDAY(MAX(event.created_at)) > 3`
- **Plan forgotten**: active plans where last event (plan or child task) > 7 days ago
- Assessment: Reasonable thresholds. Uses events table as activity signal — correct approach.

### Velocity Calculation
- Formula: `total_completed / days` (default 7 days)
- **Edge case — zero velocity**: Handled correctly — returns `estimated_days: null, estimated_date: null`
- **Edge case — no data**: Returns `daily: 0, total_completed: 0` — correct
- **Concern**: Velocity divides by fixed window (7), not by actual active days. A project active only 3 of 7 days shows deflated velocity. This is a design choice, not a bug.

### SQL Performance
- `getForgottenPlans()` uses `e.entity_id IN (SELECT id FROM tasks WHERE plan_id = p.id)` — correlated subquery in JOIN. Could be slow with large datasets. Recommend denormalization or CTE.
- `qa_runs` high-risk query uses correlated subquery: `created_at = (SELECT MAX(...))`. Acceptable for small datasets, may degrade.
- `JSON_EXTRACT` on `new_value` in events table for velocity — no index possible on JSON fields. Could degrade with 10K+ events.
- Overall: Acceptable for current scale (~200 tasks). Would need indexing strategy at 1K+ tasks.

## Critical Findings

| # | Severity | Finding |
|---|----------|---------|
| CF-1 | MEDIUM | S10.3 `history` requires `<type> <id>` but scenario expects bare `history` to show "recent events". Either the CLI needs a no-arg mode or the scenario spec is wrong. |
| CF-2 | LOW | 5 of 8 alert/insight thresholds are hardcoded in SQL strings. Should be extracted to configurable constants or constructor params for consistency with `getStaleTasks`/`getForgottenPlans`. |
| CF-3 | LOW | `getForgottenPlans` uses correlated subquery in OR-joined events; potential O(n*m) scan on large datasets. |
| CF-4 | INFO | Velocity uses calendar-day denominator (7), not active-day count. May confuse users on weekends/gaps. |
| CF-5 | INFO | `insights` outputs raw JSON even without `--json` flag (S10.4). Other commands show formatted text by default. Inconsistency. |
