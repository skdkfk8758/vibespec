import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PolicyScanner } from '../../scanners/policy-scanner.js';

describe('PolicyScanner', () => {
  let tmpDir: string;
  let scanner: PolicyScanner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-scanner-test-'));
    scanner = new PolicyScanner(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AC02: POLICY.md 미존재 시 경고 + 빈 배열 반환', () => {
    it('AC02: POLICY.md 파일이 없으면 경고를 출력하고 빈 배열을 반환해야 한다', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const findings = await scanner.scan([]);
      expect(findings).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
      const warnArgs = warnSpy.mock.calls[0].join(' ');
      expect(warnArgs).toMatch(/POLICY\.md/i);
      warnSpy.mockRestore();
    });
  });

  describe('AC01: POLICY.md에서 금지 패턴 규칙 추출 및 위반 탐지', () => {
    it('AC01: 금지 패턴이 포함된 코드 블록에서 규칙을 추출하여 위반을 탐지해야 한다', async () => {
      const policyContent = [
        '# Project Policy',
        '',
        '## 금지 패턴',
        '',
        '- **금지**: `moment.js` 사용 금지',
        '',
        '```',
        'import moment',
        '```',
      ].join('\n');
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'docs/POLICY.md'), policyContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'bad.ts');
      fs.writeFileSync(targetFile, "import moment from 'moment';\n", 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].file_path).toBe(targetFile);
    });

    it('AC01: "금지" 키워드가 포함된 불릿 항목에서 패턴을 추출하여 위반을 탐지해야 한다', async () => {
      const policyContent = [
        '# Policy',
        '',
        '## Dependencies',
        '',
        '- **금지 의존성**: moment.js (→ dayjs), lodash 전체 import (→ 개별 함수)',
        '- 금지: express 사용',
      ].join('\n');
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'docs/POLICY.md'), policyContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'dep.ts');
      fs.writeFileSync(targetFile, "import express from 'express';\n", 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings.length).toBeGreaterThan(0);
    });

    it('AC01: 위반이 없는 파일은 findings를 반환하지 않아야 한다', async () => {
      const policyContent = [
        '# Policy',
        '',
        '- **금지**: `moment.js` 사용 금지',
      ].join('\n');
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'docs/POLICY.md'), policyContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'clean.ts');
      fs.writeFileSync(targetFile, "import dayjs from 'dayjs';\n", 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings).toEqual([]);
    });
  });

  describe('AC03: 자연어만 포함된 정책 항목 스킵', () => {
    it('AC03: 기계적 패턴을 추출할 수 없는 자연어 정책은 스킵되어야 한다', async () => {
      const policyContent = [
        '# Policy',
        '',
        '## Security',
        '',
        '- 민감한 데이터는 항상 암호화하여 저장해야 한다.',
        '- 사용자 입력 데이터는 반드시 검증 후 처리한다.',
        '- 보안 취약점 발견 시 즉시 보고한다.',
      ].join('\n');
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'docs/POLICY.md'), policyContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'any.ts');
      fs.writeFileSync(targetFile, 'const x = 1;\n', 'utf-8');

      // Should not throw and should return empty (no machine-verifiable rules extracted)
      const findings = await scanner.scan([targetFile]);
      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBe(0);
    });
  });

  describe('AC04: 탐지 결과 category=POLICY_VIOLATION', () => {
    it('AC04: 탐지된 findings의 category가 POLICY_VIOLATION이어야 한다', async () => {
      const policyContent = [
        '# Policy',
        '',
        '- **금지**: `badlib` 사용 금지',
      ].join('\n');
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'docs/POLICY.md'), policyContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'violation.ts');
      fs.writeFileSync(targetFile, "import badlib from 'badlib';\n", 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].category).toBe('POLICY_VIOLATION');
    });

    it('AC04: 탐지된 findings의 rule_source가 POLICY이어야 한다', async () => {
      const policyContent = [
        '# Policy',
        '',
        '- **금지**: `badlib` 사용 금지',
      ].join('\n');
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'docs/POLICY.md'), policyContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'violation2.ts');
      fs.writeFileSync(targetFile, "import badlib from 'badlib';\n", 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].rule_source).toBe('POLICY');
    });
  });
});
