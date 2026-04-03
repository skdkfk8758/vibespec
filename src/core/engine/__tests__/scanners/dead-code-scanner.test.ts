import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DeadCodeScanner } from '../../scanners/dead-code-scanner.js';

describe('DeadCodeScanner', () => {
  let tmpDir: string;
  let scanner: DeadCodeScanner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-code-scanner-test-'));
    scanner = new DeadCodeScanner();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper: write a file to tmpDir
  function writeFile(relativePath: string, content: string): string {
    const fullPath = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    return fullPath;
  }

  describe('AC01: ts-morph로 미사용 export/함수/변수를 탐지해야 한다 (regex fallback)', () => {
    it('AC01: unused exported function is detected as dead code', async () => {
      // File A exports `unusedFn`, but no other file imports it
      const fileA = writeFile('src/a.ts', `
export function unusedFn() {
  return 42;
}
export function usedFn() {
  return 1;
}
`);
      // File B imports usedFn from A
      const fileB = writeFile('src/b.ts', `
import { usedFn } from './a.js';
const result = usedFn();
`);

      const findings = await scanner.scan([fileA, fileB]);
      const deadCodeFindings = findings.filter(f => f.category === 'DEAD_CODE');
      expect(deadCodeFindings.length).toBeGreaterThan(0);

      const descriptions = deadCodeFindings.map(f => f.description);
      // unusedFn should be flagged
      expect(descriptions.some(d => d.includes('unusedFn'))).toBe(true);
      // usedFn should NOT be flagged
      expect(descriptions.some(d => d.includes('usedFn') && !d.includes('unusedFn'))).toBe(false);
    });

    it('AC01: unused exported variable is detected as dead code', async () => {
      const fileA = writeFile('src/constants.ts', `
export const UNUSED_CONST = 'hello';
export const USED_CONST = 'world';
`);
      const fileB = writeFile('src/consumer.ts', `
import { USED_CONST } from './constants.js';
console.log(USED_CONST);
`);

      const findings = await scanner.scan([fileA, fileB]);
      const descriptions = findings.filter(f => f.category === 'DEAD_CODE').map(f => f.description);
      expect(descriptions.some(d => d.includes('UNUSED_CONST'))).toBe(true);
    });

    it('AC01: GCFinding fields are correctly populated', async () => {
      const fileA = writeFile('src/mod.ts', `
export function deadFn() {}
`);
      const findings = await scanner.scan([fileA]);
      if (findings.length > 0) {
        const f = findings[0];
        expect(f.id).toBeTruthy();
        expect(f.scan_id).toBe('');
        expect(f.category).toBe('DEAD_CODE');
        expect(f.rule_source).toBe('BUILTIN');
        expect(f.file_path).toBe(fileA);
        expect(typeof f.line_start).toBe('number');
        expect(typeof f.line_end).toBe('number');
        expect(f.status).toBe('detected');
      }
    });
  });

  describe('AC02: 테스트 파일은 데드코드 판정에서 제외되어야 한다', () => {
    it('AC02: test/ directory files are not flagged as dead code', async () => {
      const prodFile = writeFile('src/module.ts', `
export function someFunction() {}
`);
      const testFile = writeFile('test/module.test.ts', `
import { someFunction } from '../src/module.js';
someFunction();
`);

      const findings = await scanner.scan([prodFile, testFile]);
      const deadCodeFindings = findings.filter(f => f.category === 'DEAD_CODE');
      // someFunction is referenced in test file => should not be dead code
      expect(deadCodeFindings.some(f => f.description.includes('someFunction'))).toBe(false);
    });

    it('AC02: __tests__ directory files are excluded from dead code judgment', async () => {
      const prodFile = writeFile('src/utils.ts', `
export function helperUtil() {}
`);
      const testFile = writeFile('src/__tests__/utils.test.ts', `
import { helperUtil } from '../utils.js';
helperUtil();
`);

      const findings = await scanner.scan([prodFile, testFile]);
      const dead = findings.filter(f => f.category === 'DEAD_CODE' && f.description.includes('helperUtil'));
      expect(dead.length).toBe(0);
    });

    it('AC02: *.test.ts files are treated as test files', async () => {
      const prodFile = writeFile('src/helper.ts', `
export function helperFn() {}
`);
      const specFile = writeFile('src/helper.spec.ts', `
import { helperFn } from './helper.js';
helperFn();
`);

      const findings = await scanner.scan([prodFile, specFile]);
      const dead = findings.filter(f => f.category === 'DEAD_CODE' && f.description.includes('helperFn'));
      expect(dead.length).toBe(0);
    });
  });

  describe('AC03: 동적 import 사용 파일은 RISKY로 분류되어야 한다', () => {
    it('AC03: file with require(variable) is classified as RISKY', async () => {
      const dynamicFile = writeFile('src/dynamic.ts', `
export function loadPlugin(name: string) {
  return require(name);
}
`);

      const findings = await scanner.scan([dynamicFile]);
      const riskyFindings = findings.filter(f =>
        f.file_path === dynamicFile && f.safety_level === 'RISKY'
      );
      expect(riskyFindings.length).toBeGreaterThan(0);
    });

    it('AC03: file with eval() is classified as RISKY', async () => {
      const evalFile = writeFile('src/evaluator.ts', `
export function runCode(code: string) {
  return eval(code);
}
`);

      const findings = await scanner.scan([evalFile]);
      const riskyFindings = findings.filter(f =>
        f.file_path === evalFile && f.safety_level === 'RISKY'
      );
      expect(riskyFindings.length).toBeGreaterThan(0);
    });

    it('AC03: file with dynamic import() expression is classified as RISKY', async () => {
      const dynamicImportFile = writeFile('src/loader.ts', `
export async function loadModule(moduleName: string) {
  return import(moduleName);
}
`);

      const findings = await scanner.scan([dynamicImportFile]);
      const riskyFindings = findings.filter(f =>
        f.file_path === dynamicImportFile && f.safety_level === 'RISKY'
      );
      expect(riskyFindings.length).toBeGreaterThan(0);
    });
  });

  describe('AC04: 순환 참조 감지 시 RISKY로 상향 분류되어야 한다', () => {
    it('AC04: circular reference between two files upgrades safety_level to RISKY', async () => {
      const fileA = writeFile('src/circA.ts', `
import { fnB } from './circB.js';
export function fnA() { return fnB(); }
`);
      const fileB = writeFile('src/circB.ts', `
import { fnA } from './circA.js';
export function fnB() { return fnA(); }
`);

      const findings = await scanner.scan([fileA, fileB]);
      // At least one finding should be RISKY due to circular reference
      const riskyFindings = findings.filter(f => f.safety_level === 'RISKY');
      expect(riskyFindings.length).toBeGreaterThan(0);
    });
  });

  describe('AC05: 10000줄 초과 파일도 청크 분할로 처리 가능해야 한다', () => {
    it('AC05: file with more than 10000 lines is processed without error', async () => {
      // Generate a large file with many exported functions
      const lines: string[] = [];
      for (let i = 0; i < 10100; i++) {
        lines.push(`export function fn_${i}() { return ${i}; }`);
      }
      const largeFile = writeFile('src/large.ts', lines.join('\n'));

      // Should not throw; may return findings
      await expect(scanner.scan([largeFile])).resolves.toBeDefined();
    });

    it('AC05: chunk-split large file still detects dead code in it', async () => {
      const lines: string[] = [];
      for (let i = 0; i < 10050; i++) {
        lines.push(`export function fn_${i}() { return ${i}; }`);
      }
      const largeFile = writeFile('src/large2.ts', lines.join('\n'));

      const findings = await scanner.scan([largeFile]);
      // All exports are unused (no other files), so dead code should be detected
      const deadCodeFindings = findings.filter(f => f.category === 'DEAD_CODE');
      expect(deadCodeFindings.length).toBeGreaterThan(0);
    });
  });

  describe('Scanner interface compliance', () => {
    it('scanner has correct name property', () => {
      expect(scanner.name).toBe('DeadCodeScanner');
    });

    it('scan returns empty array for empty file list', async () => {
      const findings = await scanner.scan([]);
      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBe(0);
    });

    it('scan returns empty array for file with no exports', async () => {
      const fileA = writeFile('src/no-exports.ts', `
const x = 1;
console.log(x);
`);
      const findings = await scanner.scan([fileA]);
      const deadCodeFindings = findings.filter(f => f.category === 'DEAD_CODE');
      expect(deadCodeFindings.length).toBe(0);
    });
  });
});
