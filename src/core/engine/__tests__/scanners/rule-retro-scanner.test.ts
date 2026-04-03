import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RuleRetroScanner } from '../../scanners/rule-retro-scanner.js';

describe('RuleRetroScanner', () => {
  let tmpDir: string;
  let rulesDir: string;
  let scanner: RuleRetroScanner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-retro-scanner-test-'));
    rulesDir = path.join(tmpDir, '.claude', 'rules');
    scanner = new RuleRetroScanner(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AC04: 규칙 파일이 없거나 .claude/rules/ 미존재 시 빈 배열 반환', () => {
    it('AC04: .claude/rules/ 디렉토리 미존재 시 빈 배열을 반환해야 한다', async () => {
      // rules dir not created
      const findings = await scanner.scan([]);
      expect(findings).toEqual([]);
    });

    it('AC04: .claude/rules/ 디렉토리가 있지만 규칙 파일 없을 시 빈 배열을 반환해야 한다', async () => {
      fs.mkdirSync(rulesDir, { recursive: true });
      const findings = await scanner.scan([]);
      expect(findings).toEqual([]);
    });
  });

  describe('AC01: 활성 규칙의 Applies When 패턴과 매칭되는 파일에서 위반 탐지', () => {
    it('AC01: glob 패턴에 매칭되는 파일에서 규칙 패턴을 찾아 위반을 탐지해야 한다', async () => {
      fs.mkdirSync(rulesDir, { recursive: true });

      // Create a rule file with Applies-When and a pattern
      const ruleContent = [
        '---',
        'Rule-ID: rule-test-001',
        'Applies-When: **/*.ts',
        'Status: active',
        '---',
        '# Test Rule',
        '',
        'NEVER DO: console.log(',
      ].join('\n');
      fs.writeFileSync(path.join(rulesDir, 'test-rule.md'), ruleContent, 'utf-8');

      // Create a target TypeScript file that violates the rule
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'foo.ts');
      fs.writeFileSync(targetFile, 'function bar() {\n  console.log("hello");\n}\n', 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].file_path).toBe(targetFile);
    });

    it('AC01: 규칙 패턴이 없는 파일은 위반을 탐지하지 않아야 한다', async () => {
      fs.mkdirSync(rulesDir, { recursive: true });

      const ruleContent = [
        '---',
        'Rule-ID: rule-test-002',
        'Applies-When: **/*.ts',
        'Status: active',
        '---',
        '# Test Rule',
        '',
        'NEVER DO: dangerousPattern(',
      ].join('\n');
      fs.writeFileSync(path.join(rulesDir, 'test-rule.md'), ruleContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'clean.ts');
      fs.writeFileSync(targetFile, 'function clean() {\n  return 42;\n}\n', 'utf-8');

      const findings = await scanner.scan([targetFile]);
      expect(findings).toEqual([]);
    });
  });

  describe('AC02: 탐지된 위반은 category=RULE_VIOLATION, rule_source=SELF_IMPROVE로 분류', () => {
    it('AC02: findings의 category가 RULE_VIOLATION이어야 한다', async () => {
      fs.mkdirSync(rulesDir, { recursive: true });

      const ruleContent = [
        '---',
        'Rule-ID: rule-cat-001',
        'Applies-When: **/*.ts',
        'Status: active',
        '---',
        '# Category Rule',
        '',
        'NEVER DO: badCall(',
      ].join('\n');
      fs.writeFileSync(path.join(rulesDir, 'cat-rule.md'), ruleContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'bad.ts');
      fs.writeFileSync(targetFile, 'badCall();\n', 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].category).toBe('RULE_VIOLATION');
    });

    it('AC02: findings의 rule_source가 SELF_IMPROVE이어야 한다', async () => {
      fs.mkdirSync(rulesDir, { recursive: true });

      const ruleContent = [
        '---',
        'Rule-ID: rule-src-001',
        'Applies-When: **/*.ts',
        'Status: active',
        '---',
        '# Source Rule',
        '',
        'NEVER DO: anotherBadCall(',
      ].join('\n');
      fs.writeFileSync(path.join(rulesDir, 'src-rule.md'), ruleContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'another.ts');
      fs.writeFileSync(targetFile, 'anotherBadCall();\n', 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].rule_source).toBe('SELF_IMPROVE');
    });

    it('AC02: findings의 rule_id가 규칙 파일의 Rule-ID여야 한다', async () => {
      fs.mkdirSync(rulesDir, { recursive: true });

      const ruleContent = [
        '---',
        'Rule-ID: my-special-rule-id',
        'Applies-When: **/*.ts',
        'Status: active',
        '---',
        '# ID Rule',
        '',
        'NEVER DO: specialPattern(',
      ].join('\n');
      fs.writeFileSync(path.join(rulesDir, 'id-rule.md'), ruleContent, 'utf-8');

      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const targetFile = path.join(srcDir, 'id-test.ts');
      fs.writeFileSync(targetFile, 'specialPattern();\n', 'utf-8');

      const findings = await scanner.scan([targetFile]);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].rule_id).toBe('my-special-rule-id');
    });
  });

  describe('AC03: 매칭 파일 500개 초과 시 경고 출력', () => {
    it('AC03: 매칭 파일이 500개를 초과하면 경고 로그가 출력되어야 한다', async () => {
      fs.mkdirSync(rulesDir, { recursive: true });

      const ruleContent = [
        '---',
        'Rule-ID: rule-warn-001',
        'Applies-When: **/*.ts',
        'Status: active',
        '---',
        '# Warn Rule',
        '',
        'NEVER DO: neverPattern(',
      ].join('\n');
      fs.writeFileSync(path.join(rulesDir, 'warn-rule.md'), ruleContent, 'utf-8');

      // Provide 501 matching files (they don't need to exist for the warning check)
      const fakeFiles = Array.from({ length: 501 }, (_, i) =>
        path.join(tmpDir, 'src', `file${i}.ts`)
      );

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await scanner.scan(fakeFiles);
      expect(warnSpy).toHaveBeenCalled();
      const warnArgs = warnSpy.mock.calls[0].join(' ');
      expect(warnArgs).toMatch(/500/);
      warnSpy.mockRestore();
    });
  });
});
