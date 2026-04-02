import { describe, it, expect, vi } from 'vitest';
vi.mock('node:fs', async () => { const a = await vi.importActual<typeof import('node:fs')>('node:fs'); return { ...a, existsSync: vi.fn(), readFileSync: vi.fn() }; });
import * as fs from 'node:fs';
import { buildCodexPrompt } from '../src/core/engine/codex-prompt-builder.js';
import type { QAFinding } from '../src/core/types.js';

const mExists = vi.mocked(fs.existsSync);
const mRead = vi.mocked(fs.readFileSync);
const base: QAFinding = { id: 'f1', run_id: 'r1', scenario_id: null, severity: 'high', category: 'bug', title: 'Bug', description: 'A bug', affected_files: 'src/foo.ts,src/bar.ts', related_task_id: null, fix_suggestion: 'Fix it', status: 'open', fix_plan_id: null, created_at: '2026-01-01' };

describe('codex-prompt-builder', () => {
  it('AC01: 코드 스니펫 포함', () => { mExists.mockReturnValue(true); mRead.mockReturnValue('const x=1;'); const r = buildCodexPrompt(base, '/p'); expect(r.prompt).toContain('src/foo.ts'); expect(r.included_files).toContain('src/foo.ts'); });
  it('AC02: fix_suggestion 포함', () => { mExists.mockReturnValue(true); mRead.mockReturnValue('c'); expect(buildCodexPrompt(base, '/p').prompt).toContain('Fix it'); });
  it('AC03: .env 제외', () => { mExists.mockReturnValue(true); mRead.mockReturnValue('c'); const r = buildCodexPrompt({ ...base, affected_files: 'src/foo.ts,.env,secret.json' }, '/p'); expect(r.excluded_sensitive_files).toContain('.env'); expect(r.excluded_sensitive_files).toContain('secret.json'); });
  it('AC03: case-insensitive', () => { mExists.mockReturnValue(true); mRead.mockReturnValue('c'); const r = buildCodexPrompt({ ...base, affected_files: 'src/foo.ts,.ENV,.Key' }, '/p'); expect(r.excluded_sensitive_files).toContain('.ENV'); expect(r.excluded_sensitive_files).toContain('.Key'); });
  it('AC04: error-kb 결과', () => { mExists.mockReturnValue(true); mRead.mockReturnValue('c'); const kb = { search: vi.fn().mockReturnValue([{ title: 'Prev', solution: 'Do X' }]) }; expect(buildCodexPrompt(base, '/p', kb).prompt).toContain('Prev'); });
  it('AC04: error-kb 없음', () => { mExists.mockReturnValue(true); mRead.mockReturnValue('c'); expect(buildCodexPrompt(base, '/p').prompt).not.toContain('Previous Solutions'); });
  it('AC05: null affected_files', () => { expect(buildCodexPrompt({ ...base, affected_files: null }, '/p').escalation).toBeDefined(); });
  it('AC05: 파일 미존재', () => { mExists.mockReturnValue(false); expect(buildCodexPrompt(base, '/p').escalation).toBeDefined(); });
});
