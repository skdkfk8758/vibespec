import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('node:fs', async () => { const a = await vi.importActual<typeof import('node:fs')>('node:fs'); return { ...a, existsSync: vi.fn(), accessSync: vi.fn(), constants: a.constants }; });
vi.mock('node:child_process', () => ({ execSync: vi.fn() }));
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { CodexDetector } from '../codex-detect.js';

describe('CodexDetector', () => {
  let d: CodexDetector;
  const mockExists = vi.mocked(fs.existsSync);
  const mockAccess = vi.mocked(fs.accessSync);
  const mockExec = vi.mocked(execSync);
  beforeEach(() => { d = new CodexDetector(); vi.clearAllMocks(); });

  it('AC01: 설치+인증 시 available/authenticated true', () => {
    mockExists.mockReturnValue(true); mockAccess.mockReturnValue(undefined); mockExec.mockReturnValue('authenticated\n' as any);
    const r = d.detect(); expect(r.available).toBe(true); expect(r.authenticated).toBe(true); expect(r.plugin_path).toBeDefined();
  });
  it('AC02: 미설치 시 available false', () => { mockExists.mockReturnValue(false); expect(d.detect().available).toBe(false); });
  it('AC02: 에러 없이 종료', () => { mockExists.mockReturnValue(false); expect(() => d.detect()).not.toThrow(); });
  it('AC03: 캐시 반환', () => { mockExists.mockReturnValue(false); d.detect(); const c = mockExists.mock.calls.length; d.detect(); expect(mockExists.mock.calls.length).toBe(c); });
  it('AC03: clearCache 후 재감지', () => { mockExists.mockReturnValue(false); d.detect(); const c = mockExists.mock.calls.length; d.clearCache(); d.detect(); expect(mockExists.mock.calls.length).toBeGreaterThan(c); });
  it('AC04: 예외 시 false', () => { mockExists.mockImplementation(() => { throw new Error('e'); }); expect(d.detect().available).toBe(false); });
  it('AC04: 예외 시 warn', () => { const s = vi.spyOn(console, 'warn').mockImplementation(() => {}); mockExists.mockImplementation(() => { throw new Error('e'); }); d.detect(); expect(s).toHaveBeenCalledWith(expect.stringContaining('[codex-detect]')); s.mockRestore(); });
});
