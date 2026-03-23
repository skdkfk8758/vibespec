export type PlanStatus = 'draft' | 'active' | 'approved' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'skipped';
export type AlertType = 'stale' | 'blocked' | 'completable' | 'forgotten';

export interface Plan {
  id: string;
  title: string;
  status: PlanStatus;
  summary: string | null;
  spec: string | null;
  branch: string | null;
  worktree_name: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Task {
  id: string;
  plan_id: string;
  parent_id: string | null;
  title: string;
  status: TaskStatus;
  depth: number;
  sort_order: number;
  spec: string | null;
  acceptance: string | null;
  depends_on: string | null;
  allowed_files: string | null;
  forbidden_patterns: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TaskTreeNode extends Task {
  children: TaskTreeNode[];
}

export interface Wave {
  index: number;
  task_ids: string[];
}

export interface Event {
  id: number;
  entity_type: string;
  entity_id: string;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  session_id: string | null;
  created_at: string;
}

export interface ContextLog {
  id: number;
  plan_id: string | null;
  session_id: string | null;
  summary: string;
  last_task_id: string | null;
  created_at: string;
}

export interface PlanProgress {
  id: string;
  title: string;
  status: PlanStatus;
  branch: string | null;
  worktree_name: string | null;
  total_tasks: number;
  done_tasks: number;
  active_tasks: number;
  blocked_tasks: number;
  progress_pct: number;
}

export interface Alert {
  type: AlertType;
  entity_type: string;
  entity_id: string;
  message: string;
}

export interface BlockedPattern {
  reason: string;
  count: number;
  pct: number;
}

export interface DurationStats {
  avg_min: number;
  median_min: number;
  sample_count: number;
}

export interface SuccessRates {
  overall: number;
  by_plan: Array<{ title: string; rate: number; count: number }>;
}

export interface InsightsResult {
  blocked_patterns: BlockedPattern[];
  duration_stats: DurationStats;
  success_rates: SuccessRates;
  recommendations: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface TaskMetrics {
  id: number;
  task_id: string;
  plan_id: string;
  duration_min: number | null;
  final_status: string;
  block_reason: string | null;
  impl_status: string | null;
  test_count: number | null;
  files_changed: number | null;
  has_concerns: boolean;
  changed_files_detail: string | null;
  scope_violations: string | null;
  created_at: string;
}

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorStatus = 'open' | 'resolved' | 'recurring' | 'wontfix';

export interface ErrorEntry {
  id: string;
  title: string;
  severity: ErrorSeverity;
  tags: string[];
  status: ErrorStatus;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  content: string;
}

export interface SkillUsage {
  id: string;
  skill_name: string;
  plan_id: string | null;
  session_id: string | null;
  created_at: string;
}

export interface SkillStats {
  skill_name: string;
  count: number;
  last_used: string;
}

export interface NewErrorEntry {
  title: string;
  severity: ErrorSeverity;
  tags: string[];
  cause?: string;
  solution?: string;
}

export interface ErrorKBStats {
  total: number;
  by_severity: Record<ErrorSeverity, number>;
  by_status: Record<ErrorStatus, number>;
  top_recurring: Array<{ id: string; title: string; occurrences: number }>;
}

