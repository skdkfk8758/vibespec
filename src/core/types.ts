export type PlanStatus = 'draft' | 'active' | 'approved' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'skipped';
export type AlertType = 'stale' | 'blocked' | 'completable' | 'forgotten';

export interface Plan {
  id: string;
  title: string;
  status: PlanStatus;
  summary: string | null;
  spec: string | null;
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
  created_at: string;
  completed_at: string | null;
}

export interface TaskTreeNode extends Task {
  children: TaskTreeNode[];
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
  created_at: string;
}
