export type PlanStatus = 'draft' | 'active' | 'approved' | 'completed' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'skipped';
export type AlertType = 'stale' | 'blocked' | 'completable' | 'forgotten' | 'qa_risk_high' | 'qa_findings_open' | 'qa_stale' | 'qa_fix_blocked' | 'backlog_stale' | 'backlog_critical';
export type EntityType = 'plan' | 'task' | 'backlog';
export type EventType = 'created' | 'updated' | 'status_changed' | 'activated' | 'completed' | 'approved' | 'archived' | 'deleted' | 'blocked_reason';

export const VALID_PLAN_STATUSES: readonly PlanStatus[] = ['draft', 'active', 'approved', 'completed', 'archived'] as const;

export interface Plan {
  id: string;
  title: string;
  status: PlanStatus;
  summary: string | null;
  spec: string | null;
  branch: string | null;
  worktree_name: string | null;
  qa_overrides: string | null;
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
  shadow_result: 'clean' | 'warning' | 'alert' | null;
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
  entity_type: EntityType;
  entity_id: string;
  event_type: EventType;
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
  final_status: TaskStatus;
  block_reason: string | null;
  impl_status: string | null;
  test_count: number | null;
  files_changed: number | null;
  has_concerns: boolean;
  changed_files_detail: string | null;
  scope_violations: string | null;
  created_at: string;
}

export interface TaskMetricsInput {
  impl_status?: string;
  test_count?: number;
  files_changed?: number;
  has_concerns?: boolean;
  changed_files_detail?: string;
  scope_violations?: string;
}

export type TaskUpdateInput = Partial<Pick<Task, 'title' | 'spec' | 'acceptance' | 'sort_order' | 'depends_on' | 'allowed_files' | 'forbidden_patterns'>>;

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorStatus = 'open' | 'resolved' | 'recurring' | 'wontfix';

export interface ErrorUpdateInput {
  status?: ErrorStatus;
  severity?: ErrorSeverity;
  tags?: string[];
}

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

export interface VectorSearchResult {
  entry: ErrorEntry;
  similarity: number;
}

export interface AddResult {
  entry: ErrorEntry;
  duplicateWarning?: string;
}

export interface ErrorKBStats {
  total: number;
  by_severity: Record<ErrorSeverity, number>;
  by_status: Record<ErrorStatus, number>;
  top_recurring: Array<{ id: string; title: string; occurrences: number }>;
}

// Self-Improve types
export type RuleCategory =
  | 'LOGIC_ERROR'
  | 'TYPE_ERROR'
  | 'API_MISUSE'
  | 'MISSING_EDGE'
  | 'PATTERN_VIOLATION'
  | 'CONFIG_ERROR'
  | 'TEST_GAP';

export type RuleStatus = 'active' | 'archived';

export type RuleEnforcement = 'SOFT' | 'HARD';

export interface SelfImproveRule {
  id: string;
  error_kb_id: string | null;
  title: string;
  category: RuleCategory;
  rule_path: string;
  occurrences: number;
  prevented: number;
  status: RuleStatus;
  enforcement: RuleEnforcement;
  escalated_at: string | null;
  created_at: string;
  last_triggered_at: string | null;
}

export interface EscalationCandidate {
  id: string;
  title: string;
  rule_path: string;
  created_at: string;
  occurrences: number;
  prevented: number;
  days_since_creation: number;
}

export interface RuleStats {
  active: number;
  archived: number;
  total_prevented: number;
}

export interface NewRule {
  error_kb_id?: string;
  title: string;
  category: RuleCategory;
  ruleContent: string;
  enforcement?: RuleEnforcement;
}

// QA types
export type QARunTrigger = 'manual' | 'auto' | 'milestone' | 'post_merge';
export type QARunStatus = 'pending' | 'running' | 'completed' | 'failed';
export const VALID_QA_RUN_TERMINAL_STATUSES = ['completed', 'failed'] as const satisfies readonly QARunStatus[];
export type QAScenarioCategory = 'functional' | 'integration' | 'flow' | 'regression' | 'edge_case' | 'acceptance' | 'security';
export type QAScenarioSource = 'seed' | 'shadow' | 'wave' | 'final' | 'manual';
export type QAScenarioPriority = 'critical' | 'high' | 'medium' | 'low';
export type QAScenarioStatus = 'pending' | 'running' | 'pass' | 'fail' | 'skip' | 'warn';
export type QAFindingSeverity = 'critical' | 'high' | 'medium' | 'low';
export type QAFindingCategory =
  | 'bug'
  | 'regression'
  | 'missing_feature'
  | 'inconsistency'
  | 'performance'
  | 'security'
  | 'ux_issue'
  | 'spec_gap';
export type QAFindingStatus = 'open' | 'planned' | 'fixed' | 'wontfix' | 'duplicate';

export interface QARun {
  id: string;
  plan_id: string;
  trigger: QARunTrigger;
  status: QARunStatus;
  summary: string | null;
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  risk_score: number;
  created_at: string;
  completed_at: string | null;
}

export interface QAScenario {
  id: string;
  run_id: string;
  category: QAScenarioCategory;
  title: string;
  description: string;
  priority: QAScenarioPriority;
  related_tasks: string | null;
  status: QAScenarioStatus;
  agent: string | null;
  evidence: string | null;
  source: QAScenarioSource;
  created_at: string;
}

export interface QAFinding {
  id: string;
  run_id: string;
  scenario_id: string | null;
  severity: QAFindingSeverity;
  category: QAFindingCategory;
  title: string;
  description: string;
  affected_files: string | null;
  related_task_id: string | null;
  fix_suggestion: string | null;
  status: QAFindingStatus;
  fix_plan_id: string | null;
  created_at: string;
}

export interface QARunSummary {
  id: string;
  plan_id: string;
  status: QARunStatus;
  risk_score: number;
  created_at: string;
  total_scenarios: number;
  passed: number;
  failed: number;
  warned: number;
  total_findings: number;
  critical_findings: number;
  high_findings: number;
}

export interface NewQAScenario {
  category: QAScenarioCategory;
  title: string;
  description: string;
  priority: QAScenarioPriority;
  related_tasks?: string;
  source?: QAScenarioSource;
}

export interface NewQAFinding {
  scenario_id?: string;
  severity: QAFindingSeverity;
  category: QAFindingCategory;
  title: string;
  description: string;
  affected_files?: string;
  related_task_id?: string;
  fix_suggestion?: string;
}

// Backlog types
export type BacklogPriority = 'critical' | 'high' | 'medium' | 'low';
export type BacklogCategory = 'feature' | 'bugfix' | 'refactor' | 'chore' | 'idea';
export type BacklogComplexity = 'simple' | 'moderate' | 'complex';
export type BacklogStatus = 'open' | 'planned' | 'done' | 'dropped';

export const VALID_BACKLOG_PRIORITIES: readonly BacklogPriority[] = ['critical', 'high', 'medium', 'low'] as const;
export const VALID_BACKLOG_CATEGORIES: readonly BacklogCategory[] = ['feature', 'bugfix', 'refactor', 'chore', 'idea'] as const;
export const VALID_BACKLOG_COMPLEXITIES: readonly BacklogComplexity[] = ['simple', 'moderate', 'complex'] as const;
export const VALID_BACKLOG_STATUSES: readonly BacklogStatus[] = ['open', 'planned', 'done', 'dropped'] as const;

export interface BacklogItem {
  id: string;
  title: string;
  description: string | null;
  priority: BacklogPriority;
  category: BacklogCategory | null;
  tags: string | null;
  complexity_hint: BacklogComplexity | null;
  source: string | null;
  status: BacklogStatus;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewBacklogItem {
  title: string;
  description?: string;
  priority?: BacklogPriority;
  category?: BacklogCategory;
  tags?: string[];
  complexity_hint?: BacklogComplexity;
  source?: string;
}

// Merge Report types
export type ReviewChecklistLevel = 'must' | 'should' | 'info';
export type ConflictResolution = 'ours' | 'theirs' | 'ai_merge' | 'manual';
export type AIJudgmentType = 'inference' | 'guess' | 'pattern_based';
export type AIConfidence = 'high' | 'medium' | 'low';

export interface ChangeSummaryItem {
  file: string;
  category: 'feat' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore';
  description: string;
}

export interface ReviewChecklistItem {
  level: ReviewChecklistLevel;
  file: string;
  line?: string;
  description: string;
  reason: string;
}

export interface ConflictLogItem {
  file: string;
  hunks: number;
  resolution: ConflictResolution;
  choice_reason: string;
}

export interface AIJudgmentItem {
  file: string;
  line?: string;
  type: AIJudgmentType;
  description: string;
  confidence: AIConfidence;
}

export interface MergeVerificationResult {
  build: 'pass' | 'fail' | 'skip';
  test: { status: 'pass' | 'fail' | 'skip'; passed?: number; failed?: number };
  lint: 'pass' | 'fail' | 'skip' | 'warn';
  acceptance: 'pass' | 'fail' | 'skip' | 'warn';
}

export interface MergeReport {
  id: string;
  plan_id: string | null;
  commit_hash: string;
  source_branch: string;
  target_branch: string;
  changes_summary: ChangeSummaryItem[];
  review_checklist: ReviewChecklistItem[];
  conflict_log: ConflictLogItem[] | null;
  ai_judgments: AIJudgmentItem[] | null;
  verification: MergeVerificationResult;
  task_ids: string[] | null;
  report_path: string;
  created_at: string;
}

export interface NewMergeReport {
  plan_id?: string;
  commit_hash: string;
  source_branch: string;
  target_branch: string;
  changes_summary: ChangeSummaryItem[];
  review_checklist: ReviewChecklistItem[];
  conflict_log?: ConflictLogItem[];
  ai_judgments?: AIJudgmentItem[];
  verification: MergeVerificationResult;
  task_ids?: string[];
  report_path: string;
}

// Agent Handoff types
export type AgentType = 'tdd-implementer' | 'verifier' | 'debugger' | 'qa-shadow' | 'qa-seeder' | 'plan-advisor';
export type HandoffVerdict = 'PASS' | 'WARN' | 'FAIL' | 'FIX_APPLIED' | 'BLOCKED' | 'CLEAN' | 'WARNING' | 'ALERT' | 'DONE' | 'DONE_WITH_CONCERNS';

export interface AgentHandoff {
  id: string;
  task_id: string | null;
  plan_id: string | null;
  agent_type: string;
  attempt: number;
  input_hash: string | null;
  verdict: string | null;
  summary: string | null;
  report_path: string | null;
  changed_files: string | null;
  created_at: string;
}

// Wave Gate types
export type WaveGateVerdict = 'GREEN' | 'YELLOW' | 'RED';

export interface WaveGate {
  id: string;
  plan_id: string;
  wave_number: number;
  task_ids: string;
  verdict: WaveGateVerdict;
  summary: string | null;
  findings_count: number;
  created_at: string;
}

// Plan Revision types
export type RevisionTriggerType = 'assumption_violation' | 'scope_explosion' | 'design_flaw' | 'complexity_exceeded' | 'dependency_shift';
export type RevisionStatus = 'proposed' | 'approved' | 'rejected';

export interface PlanRevision {
  id: string;
  plan_id: string;
  trigger_type: RevisionTriggerType;
  trigger_source: string | null;
  description: string;
  changes: string;
  status: RevisionStatus;
  created_at: string;
}

