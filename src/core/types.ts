export type PlanStatus = 'draft' | 'active' | 'completed' | 'archived';
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
