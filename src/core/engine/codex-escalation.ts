import type { QAFinding } from '../types.js';

export interface AttemptHistory { attempt: number; diff: string; failureReason: string; }
export interface ErrorKBClient { add(entry: { title: string; severity: string; tags: string[]; cause: string; solution: string }): Promise<{ id: string }>; }
export interface SelfImproveClient { createPendingRule(rule: { category: string; pattern: string; fix: string; source: string }): Promise<void>; }
export interface EscalationDependencies { errorKB?: ErrorKBClient; selfImprove?: SelfImproveClient; }

export function buildEscalationSummary(attempts: AttemptHistory[]): string {
  const lines = ['## Autofix Escalation Report', '', `Total attempts: ${attempts.length}`, ''];
  for (const a of attempts) { lines.push(`### Attempt ${a.attempt}`, `**Failure reason:** ${a.failureReason}`, `**Diff:** ${a.diff}`, ''); }
  return lines.join('\n');
}

export async function handleEscalation(_integrationId: string, attempts: AttemptHistory[], _deps: EscalationDependencies): Promise<string> {
  return buildEscalationSummary(attempts);
}

export async function recordSuccessToKB(finding: QAFinding, diff: string, deps: EscalationDependencies): Promise<string | null> {
  if (!deps.errorKB) return null;
  try {
    const result = await deps.errorKB.add({ title: `[Codex Autofix] ${finding.title}`, severity: finding.severity, tags: ['codex-autofix', finding.category], cause: finding.description, solution: `Codex auto-fixed:\n${diff}` });
    return result.id;
  } catch { console.warn('[codex-escalation] Failed to record to error-kb'); return null; }
}

export async function createSelfImproveRule(finding: QAFinding, diff: string, deps: EscalationDependencies): Promise<void> {
  if (!deps.selfImprove) return;
  try { await deps.selfImprove.createPendingRule({ category: finding.category, pattern: finding.description, fix: diff, source: 'codex-autofix' }); }
  catch { console.warn('[codex-escalation] Failed to create self-improve rule'); }
}
