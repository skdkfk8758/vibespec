import type { PlanProgress, Alert, Plan, TaskTreeNode, TaskStatus, Event, ErrorEntry, ErrorKBStats, SkillStats, BacklogItem, SelfImproveRule, EscalationCandidate } from '../core/types.js';
import type { BacklogStats } from '../core/models/backlog.js';
import type { ImportResult } from './importers.js';
import type { DashboardOverview } from '../core/engine/dashboard.js';
import type { VelocityResult, EstimatedCompletionResult, TimelineEntry } from '../core/engine/stats.js';


const FILLED = '█';
const EMPTY = '░';

export function formatProgressBar(pct: number, width: number = 20): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return `${FILLED.repeat(filled)}${EMPTY.repeat(empty)} ${Math.round(clamped)}%`;
}

export function formatDashboard(overview: DashboardOverview, alerts: Alert[]): string {
  const lines: string[] = [];

  if (overview.plans.length === 0) {
    lines.push('No active plans.');
  } else {
    const boxWidth = 55;
    const inner = boxWidth - 2; // inside the │ ... │

    lines.push(`┌─ Active Plans ${'─'.repeat(inner - 14)}┐`);
    lines.push(`│${' '.repeat(inner)}│`);

    overview.plans.forEach((plan, index) => {
      const num = numCircle(index + 1);
      const bar = formatProgressBar(plan.progress_pct, 12);
      const titleLine = `  ${num} ${plan.title}`;
      const gap = inner - titleLine.length - bar.length - 2;
      const paddedTitle = `${titleLine}${' '.repeat(Math.max(1, gap))}${bar}  `;
      lines.push(`│${padRight(paddedTitle, inner)}│`);

      const todoCount = plan.total_tasks - plan.done_tasks - plan.active_tasks - plan.blocked_tasks;
      const countsLine = `    done ${plan.done_tasks} · active ${plan.active_tasks} · blocked ${plan.blocked_tasks} · todo ${todoCount}`;
      lines.push(`│${padRight(countsLine, inner)}│`);

      lines.push(`│${' '.repeat(inner)}│`);
    });

    lines.push(`└${'─'.repeat(inner)}┘`);
  }

  // Backlog section
  if (overview.backlog && overview.backlog.open > 0) {
    lines.push('');
    const bp = overview.backlog.by_priority;
    const priParts: string[] = [];
    if (bp.critical > 0) priParts.push(`critical: ${bp.critical}`);
    if (bp.high > 0) priParts.push(`high: ${bp.high}`);
    if (bp.medium > 0) priParts.push(`medium: ${bp.medium}`);
    if (bp.low > 0) priParts.push(`low: ${bp.low}`);
    lines.push(`Backlog: ${overview.backlog.open} open / ${overview.backlog.total} total  (${priParts.join(' · ')})`);
  }

  if (alerts.length > 0) {
    lines.push('⚠ Alerts:');
    for (const alert of alerts) {
      lines.push(`  - [${alert.type}] ${alert.message}`);
    }
  }

  return lines.join('\n');
}

function numCircle(n: number): string {
  const circles = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  return circles[n - 1] ?? `(${n})`;
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len);
  return str + ' '.repeat(len - str.length);
}

export function formatStats(
  velocity: VelocityResult,
  estimate?: EstimatedCompletionResult,
  timeline?: TimelineEntry[],
): string {
  const lines: string[] = [];

  lines.push(
    `Velocity: ${velocity.daily.toFixed(1)} tasks/day (${velocity.total_completed} completed in last 7 days)`,
  );

  if (estimate) {
    lines.push(`Remaining: ${estimate.remaining_tasks} tasks`);
    if (estimate.estimated_days !== null && estimate.estimated_date !== null) {
      lines.push(`Estimated: ~${estimate.estimated_days} days (${estimate.estimated_date})`);
    } else {
      lines.push('Estimated: unknown (no velocity)');
    }
  }

  if (timeline && timeline.length > 0) {
    lines.push('');
    lines.push('Timeline:');
    const maxTasks = Math.max(...timeline.map((e) => e.tasks_completed));
    const maxBarWidth = 10;
    for (const entry of timeline) {
      const datePart = entry.date.slice(5).replace('-', '/');
      const barWidth =
        maxTasks > 0 ? Math.max(1, Math.round((entry.tasks_completed / maxTasks) * maxBarWidth)) : 1;
      const bar = FILLED.repeat(barWidth);
      const label = entry.tasks_completed === 1 ? '1 task' : `${entry.tasks_completed} tasks`;
      lines.push(`  ${datePart}  ${bar}  ${label}`);
    }
  }

  return lines.join('\n');
}

export function formatHistory(events: Event[]): string {
  if (events.length === 0) {
    return 'No history found.';
  }

  const lines: string[] = ['History:'];

  for (const event of events) {
    const dt = event.created_at.replace('T', ' ').slice(0, 16);
    const oldPart = event.old_value ?? '';
    const newPart = event.new_value ?? '';
    let detail = '';
    if (oldPart && newPart) {
      detail = ` ${oldPart} → ${newPart}`;
    } else if (newPart) {
      detail = ` → ${newPart}`;
    } else if (oldPart) {
      detail = ` ${oldPart}`;
    }
    lines.push(
      `  ${dt}  ${event.entity_type}    ${event.event_type}  ${detail}`.trimEnd(),
    );
  }

  return lines.join('\n');
}

const STATUS_ICONS: Record<TaskStatus, string> = {
  done: '[x]',
  in_progress: '[>]',
  blocked: '[!]',
  todo: '[ ]',
  skipped: '[-]',
};

export function formatPlanTree(plan: Plan, tasks: TaskTreeNode[]): string {
  const lines: string[] = [];
  const totalTasks = countTasks(tasks);
  const doneTasks = countTasksByStatus(tasks, ['done', 'skipped']);
  const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  lines.push(`${plan.title} (${plan.status})${' '.repeat(5)}${pct}%`);

  for (let i = 0; i < tasks.length; i++) {
    const isLast = i === tasks.length - 1;
    renderNode(tasks[i], '', isLast, lines);
  }

  return lines.join('\n');
}

function renderNode(
  node: TaskTreeNode,
  prefix: string,
  isLast: boolean,
  lines: string[],
): void {
  const connector = isLast ? '└─' : '├─';
  const icon = STATUS_ICONS[node.status];
  lines.push(`${prefix}${connector} ${icon} ${node.title}${' '.repeat(4)}${node.status}`);

  const childPrefix = prefix + (isLast ? '   ' : '│  ');
  for (let i = 0; i < node.children.length; i++) {
    const childIsLast = i === node.children.length - 1;
    renderNode(node.children[i], childPrefix, childIsLast, lines);
  }
}

function countTasks(nodes: TaskTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countTasks(node.children);
  }
  return count;
}

function countTasksByStatus(nodes: TaskTreeNode[], statuses: TaskStatus[]): number {
  let count = 0;
  for (const node of nodes) {
    if (statuses.includes(node.status)) count++;
    count += countTasksByStatus(node.children, statuses);
  }
  return count;
}

export function formatPlanList(plans: Plan[]): string {
  if (plans.length === 0) return 'No plans found.';

  const lines: string[] = [];
  const header = `${padRight('ID', 14)}${padRight('Title', 26)}${padRight('Status', 12)}Created`;
  lines.push(header);

  for (const plan of plans) {
    const created = plan.created_at?.split('T')[0] ?? 'unknown';
    lines.push(
      `${padRight(plan.id, 14)}${padRight(plan.title, 26)}${padRight(plan.status, 12)}${created}`,
    );
  }

  return lines.join('\n');
}

// ── Error KB formatters ─────────────────────────────────────────────────

export function formatErrorSearchResults(entries: ErrorEntry[]): string {
  if (entries.length === 0) return 'No errors found.';

  const lines: string[] = [];
  const header = `${padRight('ID', 16)}${padRight('Severity', 12)}${padRight('Status', 12)}${padRight('Occ', 6)}Title`;
  lines.push(header);

  for (const entry of entries) {
    lines.push(
      `${padRight(entry.id, 16)}${padRight(entry.severity, 12)}${padRight(entry.status, 12)}${padRight(String(entry.occurrences), 6)}${entry.title}`,
    );
  }

  return lines.join('\n');
}

export function formatErrorDetail(entry: ErrorEntry): string {
  const tagsStr = entry.tags.length > 0 ? entry.tags.join(', ') : '(none)';
  const lines: string[] = [
    `ID:          ${entry.id}`,
    `Title:       ${entry.title}`,
    `Severity:    ${entry.severity}`,
    `Tags:        ${tagsStr}`,
    `Status:      ${entry.status}`,
    `Occurrences: ${entry.occurrences}`,
    `First seen:  ${entry.first_seen}`,
    `Last seen:   ${entry.last_seen}`,
  ];

  if (entry.content && entry.content.trim().length > 0) {
    lines.push('');
    lines.push(entry.content.trim());
  }

  return lines.join('\n');
}

export function formatErrorKBStats(stats: ErrorKBStats): string {
  const lines: string[] = [];

  lines.push(`Total: ${stats.total}`);
  lines.push('');
  lines.push('By Severity:');
  lines.push(`  critical: ${stats.by_severity.critical}`);
  lines.push(`  high:     ${stats.by_severity.high}`);
  lines.push(`  medium:   ${stats.by_severity.medium}`);
  lines.push(`  low:      ${stats.by_severity.low}`);
  lines.push('');
  lines.push('By Status:');
  lines.push(`  open:      ${stats.by_status.open}`);
  lines.push(`  resolved:  ${stats.by_status.resolved}`);
  lines.push(`  recurring: ${stats.by_status.recurring}`);
  lines.push(`  wontfix:   ${stats.by_status.wontfix}`);

  if (stats.top_recurring.length > 0) {
    lines.push('');
    lines.push('Top Recurring:');
    for (const entry of stats.top_recurring) {
      lines.push(`  ${entry.title} (${entry.occurrences}x)`);
    }
  }

  return lines.join('\n');
}

export function formatSkillUsage(skillStats: SkillStats[]): string {
  if (skillStats.length === 0) return '';

  const lines: string[] = [];
  lines.push('Recent Skill Usage:');
  for (let i = 0; i < skillStats.length; i++) {
    const s = skillStats[i];
    const label = s.count === 1 ? '1 time' : `${s.count} times`;
    lines.push(`  ${numCircle(i + 1)} ${s.skill_name} (${label})`);
  }

  return lines.join('\n');
}

// ── Backlog formatters ──────────────────────────────────────────────────

const PRIORITY_ICONS: Record<string, string> = {
  critical: '!!!!',
  high: '!!! ',
  medium: '!!  ',
  low: '!   ',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'open',
  planned: 'planned',
  done: 'done',
  dropped: 'dropped',
};

export function formatBacklogList(items: BacklogItem[]): string {
  if (items.length === 0) return 'No backlog items found.';

  const lines: string[] = [];
  const header = `${padRight('ID', 14)}${padRight('Pri', 6)}${padRight('Category', 12)}${padRight('Status', 10)}Title`;
  lines.push(header);

  for (const item of items) {
    const pri = PRIORITY_ICONS[item.priority] ?? '    ';
    const cat = padRight(item.category ?? '-', 12);
    const status = padRight(STATUS_LABELS[item.status] ?? item.status, 10);
    lines.push(`${padRight(item.id, 14)}${padRight(pri, 6)}${cat}${status}${item.title}`);
  }

  return lines.join('\n');
}

export function formatBacklogDetail(item: BacklogItem): string {
  const tags = item.tags ? JSON.parse(item.tags).join(', ') : '(none)';
  const lines: string[] = [
    `ID:          ${item.id}`,
    `Title:       ${item.title}`,
    `Priority:    ${item.priority}`,
    `Category:    ${item.category ?? '-'}`,
    `Tags:        ${tags}`,
    `Complexity:  ${item.complexity_hint ?? '-'}`,
    `Source:      ${item.source ?? '-'}`,
    `Status:      ${item.status}`,
    `Plan:        ${item.plan_id ?? '-'}`,
    `Created:     ${item.created_at}`,
    `Updated:     ${item.updated_at}`,
  ];

  if (item.description) {
    lines.push('');
    lines.push(item.description);
  }

  return lines.join('\n');
}

export function formatBacklogStats(stats: BacklogStats): string {
  const lines: string[] = [];

  lines.push(`Total: ${stats.total}`);
  lines.push('');
  lines.push('By Priority:');
  lines.push(`  critical: ${stats.by_priority.critical}`);
  lines.push(`  high:     ${stats.by_priority.high}`);
  lines.push(`  medium:   ${stats.by_priority.medium}`);
  lines.push(`  low:      ${stats.by_priority.low}`);
  lines.push('');
  lines.push('By Status:');
  lines.push(`  open:     ${stats.by_status.open}`);
  lines.push(`  planned:  ${stats.by_status.planned}`);
  lines.push(`  done:     ${stats.by_status.done}`);
  lines.push(`  dropped:  ${stats.by_status.dropped}`);

  if (Object.keys(stats.by_category).length > 0) {
    lines.push('');
    lines.push('By Category:');
    for (const [cat, count] of Object.entries(stats.by_category)) {
      lines.push(`  ${padRight(cat + ':', 16)}${count}`);
    }
  }

  return lines.join('\n');
}

export function formatBacklogBoard(items: BacklogItem[]): string {
  if (items.length === 0) return 'No backlog items found.';

  const groups: Record<string, BacklogItem[]> = {};
  for (const item of items) {
    const cat = item.category ?? 'uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }

  const lines: string[] = [];
  const categories = Object.keys(groups).sort();
  const colWidth = 30;

  lines.push(categories.map(c => padRight(`[${c}]`, colWidth)).join('  '));
  lines.push(categories.map(() => '-'.repeat(colWidth)).join('  '));

  const maxRows = Math.max(...categories.map(c => groups[c].length));

  for (let row = 0; row < maxRows; row++) {
    const cols: string[] = [];
    for (const cat of categories) {
      const item = groups[cat][row];
      if (item) {
        const pri = PRIORITY_ICONS[item.priority] ?? '    ';
        const label = `${pri.trim()} ${item.title}`;
        cols.push(padRight(label.length > colWidth ? label.slice(0, colWidth - 1) + '>' : label, colWidth));
      } else {
        cols.push(' '.repeat(colWidth));
      }
    }
    lines.push(cols.join('  '));
  }

  return lines.join('\n');
}

export function formatImportPreview(result: ImportResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      lines.push(`Error: ${err}`);
    }
    if (result.items.length === 0) return lines.join('\n');
    lines.push('');
  }

  lines.push(`Import preview (${result.source_prefix}): ${result.items.length} items`);
  lines.push('');

  if (result.items.length === 0) {
    lines.push('No items to import.');
    return lines.join('\n');
  }

  const header = `${padRight('#', 4)}${padRight('Priority', 10)}${padRight('Category', 12)}Title`;
  lines.push(header);

  for (let i = 0; i < result.items.length; i++) {
    const item = result.items[i];
    const pri = padRight(item.priority ?? 'medium', 10);
    const cat = padRight(item.category ?? '-', 12);
    lines.push(`${padRight(String(i + 1), 4)}${pri}${cat}${item.title}`);
  }

  return lines.join('\n');
}

// ── Self-improve rule formatters ────────────────────────────────────────

export function formatRuleList(rules: SelfImproveRule[]): string {
  if (rules.length === 0) return 'No rules found.';

  const lines = rules.map(r =>
    `[${r.status}] [${r.enforcement}] ${r.id} | ${r.category} | ${r.title} (prevented: ${r.prevented})`
  );
  return lines.join('\n');
}

export function formatRuleDetail(rule: SelfImproveRule): string {
  const lines: string[] = [
    `ID:          ${rule.id}`,
    `Title:       ${rule.title}`,
    `Category:    ${rule.category}`,
    `Status:      ${rule.status}`,
    `Enforcement: ${rule.enforcement}`,
    `Escalated:   ${rule.escalated_at ?? '-'}`,
    `Occurrences: ${rule.occurrences}`,
    `Prevented:   ${rule.prevented}`,
    `Rule path:   ${rule.rule_path}`,
    `Created:     ${rule.created_at}`,
    `Last triggered: ${rule.last_triggered_at ?? '-'}`,
  ];
  return lines.join('\n');
}

export function formatEscalationStatus(candidates: EscalationCandidate[]): string {
  if (candidates.length === 0) return 'No escalation candidates found.';

  const lines: string[] = ['HARD 승격 예정 규칙:', ''];
  for (const c of candidates) {
    lines.push(`  ${c.id} | ${c.title} (occurrences: ${c.occurrences}, ${c.days_since_creation}일 경과)`);
  }
  return lines.join('\n');
}
