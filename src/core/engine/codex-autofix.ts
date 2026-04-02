import * as path from 'node:path';
import type Database from 'better-sqlite3';
import type { QAFinding } from '../types.js';
import { CodexDetector } from './codex-detect.js';
import { buildCodexPrompt } from './codex-prompt-builder.js';
import { createCodexIntegration, updateCodexIntegration } from './codex-integration-db.js';

export interface CodexExecutionResult { success: boolean; touchedFiles: string[]; rawOutput: string; timedOut?: boolean; }
export interface CodexExecutor { execute(prompt: string, options: { write: boolean; effort: string; timeout: number }): Promise<CodexExecutionResult>; }
export interface GitOperations { getDiffFileNames(): string[]; checkoutFile(filePath: string): void; }
export interface Verifier { verify(): Promise<{ verdict: 'PASS' | 'WARN' | 'FAIL'; details: string }>; }

export interface AutofixDependencies { db: Database.Database; executor: CodexExecutor; gitOps: GitOperations; projectRoot: string; allowedFiles?: string[]; }
export interface RetryDependencies extends AutofixDependencies { verifier: Verifier; maxRetries?: number; verificationTimeout?: number; }
export interface AutofixResult { success: boolean; timedOut?: boolean; retryConsumed: boolean; integrationId: string; status: string; touchedFiles?: string[]; }
export interface AutofixRetryResult { status: 'passed' | 'failed' | 'escalated'; totalAttempts: number; integrationId: string; attempts: Array<{ attempt: number; verdict: string; details: string }>; }

const TIMEOUT_MS = 600_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_VERIFICATION_TIMEOUT = 300_000;

export async function executeAutofix(finding: QAFinding, deps: AutofixDependencies): Promise<AutofixResult> {
  const { db, executor, gitOps, projectRoot, allowedFiles } = deps;
  const detector = new CodexDetector();
  const detectResult = detector.detect();
  if (!detectResult.available || !detectResult.authenticated) {
    console.warn('[codex-autofix] Codex unavailable, skipping autofix');
    return { success: false, retryConsumed: false, integrationId: '', status: 'unavailable' };
  }
  const promptResult = buildCodexPrompt(finding, projectRoot);
  if (promptResult.escalation) return { success: false, retryConsumed: false, integrationId: '', status: 'escalated' };

  const integration = createCodexIntegration(db, { finding_id: finding.id, run_id: finding.run_id, prompt_context: promptResult.prompt });
  updateCodexIntegration(db, integration.id, { status: 'running' });

  const execResult = await executor.execute(promptResult.prompt, { write: true, effort: 'high', timeout: TIMEOUT_MS });
  if (execResult.timedOut) {
    updateCodexIntegration(db, integration.id, { status: 'failed', escalation_summary: 'Timed out after 600s' });
    return { success: false, timedOut: true, retryConsumed: false, integrationId: integration.id, status: 'timeout' };
  }

  updateCodexIntegration(db, integration.id, { status: 'verifying' });

  const diffFiles = gitOps.getDiffFileNames();
  const effectiveAllowed = allowedFiles ?? (finding.affected_files ? finding.affected_files.split(',').map((f) => f.trim()) : []);
  const normalizedAllowed = effectiveAllowed.map((f) => path.normalize(f));
  const outOfScope = diffFiles.filter((f) => !normalizedAllowed.includes(path.normalize(f)));

  if (outOfScope.length > 0) {
    console.warn(`[codex-autofix] scope violation: ${outOfScope.length} file(s) outside allowed scope — rolling back`);
    try { for (const file of outOfScope) gitOps.checkoutFile(file); }
    catch (err) {
      updateCodexIntegration(db, integration.id, { status: 'escalated', escalation_summary: `Rollback failed: ${(err as Error).message}` });
      return { success: false, retryConsumed: false, integrationId: integration.id, status: 'escalated' };
    }
  }

  updateCodexIntegration(db, integration.id, { touched_files: JSON.stringify(execResult.touchedFiles) });
  return { success: true, retryConsumed: true, integrationId: integration.id, status: 'verifying', touchedFiles: execResult.touchedFiles };
}

function buildRetryPrompt(base: string, attempt: number, prevDiff: string, prevFailure: string): string {
  if (attempt === 2) return `${base}\n\n---\n## Previous Attempt Failed\n이전 시도 수정: ${prevDiff}\n실패 이유: ${prevFailure}\n다른 접근법을 시도하세요.`;
  if (attempt === 3) return `${base}\n\n---\n## 2 Previous Attempts Failed\n이전 시도 수정: ${prevDiff}\n실패 이유: ${prevFailure}\n근본 원인을 재분석하고 완전히 다른 접근법을 사용하세요.`;
  return base;
}

async function verifyWithTimeout(verifier: Verifier, timeoutMs: number) {
  return Promise.race([verifier.verify(), new Promise<{ verdict: 'FAIL' as const; details: string }>((r) => setTimeout(() => r({ verdict: 'FAIL', details: 'Verification timed out' }), timeoutMs))]);
}

export async function executeAutofixWithRetry(finding: QAFinding, deps: RetryDependencies): Promise<AutofixRetryResult> {
  const { db, executor, gitOps, projectRoot, allowedFiles, verifier, maxRetries = DEFAULT_MAX_RETRIES, verificationTimeout = DEFAULT_VERIFICATION_TIMEOUT } = deps;

  const promptResult = buildCodexPrompt(finding, projectRoot);
  if (promptResult.escalation) return { status: 'escalated', totalAttempts: 0, integrationId: '', attempts: [] };

  const detector = new CodexDetector();
  if (!detector.detect().available) return { status: 'failed', totalAttempts: 0, integrationId: '', attempts: [] };

  const attempts: Array<{ attempt: number; verdict: string; details: string }> = [];
  let integrationId = '';
  let previousDiff = '';
  let previousFailure = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const prompt = buildRetryPrompt(promptResult.prompt, attempt, previousDiff, previousFailure);
    const integration = createCodexIntegration(db, { finding_id: finding.id, run_id: finding.run_id, prompt_context: prompt });
    integrationId = integration.id;
    updateCodexIntegration(db, integrationId, { status: 'running', attempt });

    const execResult = await executor.execute(prompt, { write: true, effort: 'high', timeout: TIMEOUT_MS });
    if (execResult.timedOut) { attempts.push({ attempt, verdict: 'FAIL', details: 'timeout' }); return { status: 'failed', totalAttempts: attempt, integrationId, attempts }; }

    updateCodexIntegration(db, integrationId, { status: 'verifying', touched_files: JSON.stringify(execResult.touchedFiles) });

    const effectiveAllowed = allowedFiles ?? (finding.affected_files ? finding.affected_files.split(',').map((f) => f.trim()) : []);
    const normalizedAllowed = effectiveAllowed.map((f) => path.normalize(f));
    const outOfScope = gitOps.getDiffFileNames().filter((f) => !normalizedAllowed.includes(path.normalize(f)));
    if (outOfScope.length > 0) { try { for (const file of outOfScope) gitOps.checkoutFile(file); } catch { /* continue */ } }

    const verifyResult = await verifyWithTimeout(verifier, verificationTimeout);
    attempts.push({ attempt, verdict: verifyResult.verdict, details: verifyResult.details });

    if (verifyResult.verdict === 'PASS' || verifyResult.verdict === 'WARN') {
      updateCodexIntegration(db, integrationId, { status: 'passed', verification_result: verifyResult.verdict });
      return { status: 'passed', totalAttempts: attempt, integrationId, attempts };
    }

    updateCodexIntegration(db, integrationId, { status: 'failed', verification_result: 'FAIL' });
    previousDiff = JSON.stringify(execResult.touchedFiles ?? []);
    previousFailure = verifyResult.details;
  }

  updateCodexIntegration(db, integrationId, { status: 'escalated' });
  return { status: 'failed', totalAttempts: maxRetries, integrationId, attempts };
}
