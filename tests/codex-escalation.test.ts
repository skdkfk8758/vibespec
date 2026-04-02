import { describe, it, expect, vi } from 'vitest';
import { buildEscalationSummary, recordSuccessToKB, createSelfImproveRule } from '../src/core/engine/codex-escalation.js';
import type { QAFinding } from '../src/core/types.js';

const base: QAFinding = { id: 'f1', run_id: 'r1', scenario_id: null, severity: 'high', category: 'bug', title: 'Bug', description: 'A bug', affected_files: 'src/foo.ts', related_task_id: null, fix_suggestion: 'Fix', status: 'open', fix_plan_id: null, created_at: '2026-01-01' };

describe('codex-escalation', () => {
  it('AC02: 전체 이력 포함', () => {
    const s = buildEscalationSummary([{ attempt: 1, diff: 'd1', failureReason: 'f1' }, { attempt: 2, diff: 'd2', failureReason: 'f2' }, { attempt: 3, diff: 'd3', failureReason: 'f3' }]);
    expect(s).toContain('Attempt 1'); expect(s).toContain('Attempt 3'); expect(s).toContain('Total attempts: 3');
  });
  it('AC03: KB 기록', async () => { const kb = { add: vi.fn().mockResolvedValue({ id: 'kb-1' }) }; expect(await recordSuccessToKB(base, 'diff', { errorKB: kb })).toBe('kb-1'); });
  it('AC04: 부분 성공 기록', async () => { const kb = { add: vi.fn().mockResolvedValue({ id: 'kb-2' }) }; expect(await recordSuccessToKB(base, 'd', { errorKB: kb })).toBe('kb-2'); });
  it('AC05: KB 실패 시 null', async () => { const s = vi.spyOn(console, 'warn').mockImplementation(()=>{}); const kb = { add: vi.fn().mockRejectedValue(new Error('down')) }; expect(await recordSuccessToKB(base, 'd', { errorKB: kb })).toBeNull(); s.mockRestore(); });
  it('AC05: KB 미제공', async () => { expect(await recordSuccessToKB(base, 'd', {})).toBeNull(); });
  it('AC06: self-improve 룰', async () => { const si = { createPendingRule: vi.fn().mockResolvedValue(undefined) }; await createSelfImproveRule(base, 'd', { selfImprove: si }); expect(si.createPendingRule).toHaveBeenCalled(); });
  it('AC06: selfImprove 미제공', async () => { await expect(createSelfImproveRule(base, 'd', {})).resolves.toBeUndefined(); });
});
