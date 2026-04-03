import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { RefactorScanner } from '../../scanners/refactor-scanner.js';

describe('RefactorScanner', () => {
  let tmpDir: string;
  let scanner: RefactorScanner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refactor-scanner-test-'));
    scanner = new RefactorScanner();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFile(name: string, content: string): string {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  // ─── AC01: Cyclomatic Complexity ───────────────────────────────────────────

  describe('AC01: CC 10 이상 함수를 탐지하고 severity를 올바르게 분류해야 한다', () => {
    it('AC01: CC 10 미만 함수는 탐지하지 않아야 한다', async () => {
      // CC = 1 (base) + 3 (if/else if/else) = 4
      const code = `
function simpleFunc(x: number): string {
  if (x > 10) {
    return 'high';
  } else if (x > 5) {
    return 'mid';
  } else {
    return 'low';
  }
}
`;
      const file = writeFile('simple.ts', code);
      const findings = await scanner.scan([file]);
      const ccFindings = findings.filter(f => f.rule_id === 'high-complexity');
      expect(ccFindings).toHaveLength(0);
    });

    it('AC01: CC 10 이상 함수를 탐지해야 한다', async () => {
      // CC = 1 + 10 분기 = 11 → medium
      const code = `
function complexFunc(a: number, b: number, c: number): number {
  if (a > 0) {
    return 1;
  } else if (a < 0) {
    return 2;
  } else if (b > 0) {
    return 3;
  } else if (b < 0) {
    return 4;
  } else if (c > 0) {
    return 5;
  } else if (c < 0) {
    return 6;
  } else if (a === b) {
    return 7;
  } else if (b === c) {
    return 8;
  } else if (a === c) {
    return 9;
  } else {
    return 10;
  }
}
`;
      const file = writeFile('complex.ts', code);
      const findings = await scanner.scan([file]);
      const ccFindings = findings.filter(f => f.rule_id === 'high-complexity');
      expect(ccFindings.length).toBeGreaterThan(0);
    });

    it('AC01: CC 10~14 함수는 severity=medium이어야 한다', async () => {
      // CC = 1 + 10 = 11 → medium
      const code = `
function mediumComplexFunc(a: number, b: number, c: number, d: number): number {
  if (a > 0) { return 1; }
  else if (a < 0) { return 2; }
  else if (b > 0) { return 3; }
  else if (b < 0) { return 4; }
  else if (c > 0) { return 5; }
  else if (c < 0) { return 6; }
  else if (d > 0) { return 7; }
  else if (d < 0) { return 8; }
  else if (a === b) { return 9; }
  else { return 10; }
}
`;
      const file = writeFile('medium.ts', code);
      const findings = await scanner.scan([file]);
      const ccFindings = findings.filter(f => f.rule_id === 'high-complexity');
      expect(ccFindings.length).toBeGreaterThan(0);
      expect(ccFindings[0].severity).toBe('medium');
    });

    it('AC01: CC 15+ 함수는 severity=high이어야 한다', async () => {
      // CC = 1 + 15 = 16 → high
      const code = `
function veryComplexFunc(a: number, b: number, c: number, d: number, e: number): number {
  if (a > 0) { return 1; }
  else if (a < 0) { return 2; }
  else if (b > 0) { return 3; }
  else if (b < 0) { return 4; }
  else if (c > 0) { return 5; }
  else if (c < 0) { return 6; }
  else if (d > 0) { return 7; }
  else if (d < 0) { return 8; }
  else if (e > 0) { return 9; }
  else if (e < 0) { return 10; }
  else if (a === b) { return 11; }
  else if (b === c) { return 12; }
  else if (c === d) { return 13; }
  else if (d === e) { return 14; }
  else { return 15; }
}
`;
      const file = writeFile('high.ts', code);
      const findings = await scanner.scan([file]);
      const ccFindings = findings.filter(f => f.rule_id === 'high-complexity');
      expect(ccFindings.length).toBeGreaterThan(0);
      expect(ccFindings[0].severity).toBe('high');
    });

    it('AC01: findings의 category=REFACTOR_CANDIDATE, rule_source=BUILTIN이어야 한다', async () => {
      const code = `
function complexFunc2(a: number, b: number, c: number): number {
  if (a > 0) { return 1; }
  else if (a < 0) { return 2; }
  else if (b > 0) { return 3; }
  else if (b < 0) { return 4; }
  else if (c > 0) { return 5; }
  else if (c < 0) { return 6; }
  else if (a === b) { return 7; }
  else if (b === c) { return 8; }
  else if (a === c) { return 9; }
  else { return 10; }
}
`;
      const file = writeFile('cat.ts', code);
      const findings = await scanner.scan([file]);
      const ccFindings = findings.filter(f => f.rule_id === 'high-complexity');
      expect(ccFindings.length).toBeGreaterThan(0);
      expect(ccFindings[0].category).toBe('REFACTOR_CANDIDATE');
      expect(ccFindings[0].rule_source).toBe('BUILTIN');
    });

    it('AC01: arrow function도 CC 탐지 대상이어야 한다', async () => {
      const code = `
const arrowComplex = (a: number, b: number, c: number, d: number): number => {
  if (a > 0) { return 1; }
  else if (a < 0) { return 2; }
  else if (b > 0) { return 3; }
  else if (b < 0) { return 4; }
  else if (c > 0) { return 5; }
  else if (c < 0) { return 6; }
  else if (d > 0) { return 7; }
  else if (d < 0) { return 8; }
  else if (a === b) { return 9; }
  else { return 10; }
};
`;
      const file = writeFile('arrow.ts', code);
      const findings = await scanner.scan([file]);
      const ccFindings = findings.filter(f => f.rule_id === 'high-complexity');
      expect(ccFindings.length).toBeGreaterThan(0);
    });
  });

  // ─── AC02: Code Duplication ─────────────────────────────────────────────────

  describe('AC02: 연속 10줄 이상 동일 코드 블록을 중복으로 탐지해야 한다', () => {
    it('AC02: 10줄 미만 중복은 탐지하지 않아야 한다', async () => {
      const block = `  const x = 1;
  const y = 2;
  const z = 3;
  return x + y + z;`;
      const code = `
function a() {
${block}
}

function b() {
${block}
}
`;
      const file = writeFile('small-dup.ts', code);
      const findings = await scanner.scan([file]);
      const dupFindings = findings.filter(f => f.rule_id === 'code-duplication');
      expect(dupFindings).toHaveLength(0);
    });

    it('AC02: 파일 내 연속 10줄 이상 동일 코드를 탐지해야 한다', async () => {
      const block = Array.from({ length: 10 }, (_, i) => `  const line${i} = ${i};`).join('\n');
      const code = `
function funcA() {
${block}
}

function funcB() {
${block}
}
`;
      const file = writeFile('infile-dup.ts', code);
      const findings = await scanner.scan([file]);
      const dupFindings = findings.filter(f => f.rule_id === 'code-duplication');
      expect(dupFindings.length).toBeGreaterThan(0);
    });

    it('AC02: 공백 무시 후 동일 코드를 탐지해야 한다', async () => {
      const block1 = Array.from({ length: 10 }, (_, i) => `  const line${i} = ${i};`).join('\n');
      const block2 = Array.from({ length: 10 }, (_, i) => `   const line${i} = ${i};`).join('\n'); // extra spaces
      const code = `
function funcA() {
${block1}
}

function funcB() {
${block2}
}
`;
      const file = writeFile('whitespace-dup.ts', code);
      const findings = await scanner.scan([file]);
      const dupFindings = findings.filter(f => f.rule_id === 'code-duplication');
      expect(dupFindings.length).toBeGreaterThan(0);
    });

    it('AC02: 한 줄 주석(//) 무시 후 동일 코드를 탐지해야 한다', async () => {
      const block1 = Array.from({ length: 10 }, (_, i) => `  const line${i} = ${i};`).join('\n');
      const block2 = Array.from({ length: 10 }, (_, i) =>
        i === 0 ? `  // some comment\n  const line${i} = ${i};` : `  const line${i} = ${i};`
      ).join('\n');
      const code = `
function funcA() {
${block1}
}

function funcB() {
${block2}
}
`;
      const file = writeFile('comment-dup.ts', code);
      const findings = await scanner.scan([file]);
      const dupFindings = findings.filter(f => f.rule_id === 'code-duplication');
      expect(dupFindings.length).toBeGreaterThan(0);
    });

    it('AC02: category=REFACTOR_CANDIDATE, rule_source=BUILTIN이어야 한다', async () => {
      const block = Array.from({ length: 10 }, (_, i) => `  const x${i} = ${i * 2};`).join('\n');
      const code = `
function dupA() {
${block}
}

function dupB() {
${block}
}
`;
      const file = writeFile('dup-cat.ts', code);
      const findings = await scanner.scan([file]);
      const dupFindings = findings.filter(f => f.rule_id === 'code-duplication');
      expect(dupFindings.length).toBeGreaterThan(0);
      expect(dupFindings[0].category).toBe('REFACTOR_CANDIDATE');
      expect(dupFindings[0].rule_source).toBe('BUILTIN');
    });
  });

  // ─── AC03: Function Length ──────────────────────────────────────────────────

  describe('AC03: 함수 길이 100줄 초과를 탐지해야 한다', () => {
    it('AC03: 100줄 이하 함수는 탐지하지 않아야 한다', async () => {
      const lines = Array.from({ length: 98 }, (_, i) => `  const v${i} = ${i};`).join('\n');
      const code = `function shortFunc() {\n${lines}\n}\n`;
      const file = writeFile('short.ts', code);
      const findings = await scanner.scan([file]);
      const lenFindings = findings.filter(f => f.rule_id === 'long-function');
      expect(lenFindings).toHaveLength(0);
    });

    it('AC03: 100줄 초과 함수를 탐지해야 한다', async () => {
      const lines = Array.from({ length: 102 }, (_, i) => `  const v${i} = ${i};`).join('\n');
      const code = `function longFunc() {\n${lines}\n}\n`;
      const file = writeFile('long.ts', code);
      const findings = await scanner.scan([file]);
      const lenFindings = findings.filter(f => f.rule_id === 'long-function');
      expect(lenFindings.length).toBeGreaterThan(0);
    });

    it('AC03: category=REFACTOR_CANDIDATE, rule_source=BUILTIN이어야 한다', async () => {
      const lines = Array.from({ length: 102 }, (_, i) => `  const v${i} = ${i};`).join('\n');
      const code = `function longFunc2() {\n${lines}\n}\n`;
      const file = writeFile('long2.ts', code);
      const findings = await scanner.scan([file]);
      const lenFindings = findings.filter(f => f.rule_id === 'long-function');
      expect(lenFindings.length).toBeGreaterThan(0);
      expect(lenFindings[0].category).toBe('REFACTOR_CANDIDATE');
      expect(lenFindings[0].rule_source).toBe('BUILTIN');
    });
  });

  // ─── AC04: Nesting Depth ────────────────────────────────────────────────────

  describe('AC04: nesting depth 4 이상을 탐지해야 한다', () => {
    it('AC04: depth 3 이하는 탐지하지 않아야 한다', async () => {
      const code = `
function shallowFunc(a: boolean, b: boolean, c: boolean): void {
  if (a) {         // depth 1
    if (b) {       // depth 2
      if (c) {     // depth 3
        return;
      }
    }
  }
}
`;
      const file = writeFile('shallow.ts', code);
      const findings = await scanner.scan([file]);
      const nestFindings = findings.filter(f => f.rule_id === 'deep-nesting');
      expect(nestFindings).toHaveLength(0);
    });

    it('AC04: depth 4 이상을 탐지해야 한다', async () => {
      const code = `
function deepFunc(a: boolean, b: boolean, c: boolean, d: boolean): void {
  if (a) {           // depth 1
    if (b) {         // depth 2
      if (c) {       // depth 3
        if (d) {     // depth 4
          return;
        }
      }
    }
  }
}
`;
      const file = writeFile('deep.ts', code);
      const findings = await scanner.scan([file]);
      const nestFindings = findings.filter(f => f.rule_id === 'deep-nesting');
      expect(nestFindings.length).toBeGreaterThan(0);
    });

    it('AC04: category=REFACTOR_CANDIDATE, rule_source=BUILTIN이어야 한다', async () => {
      const code = `
function deepFunc2(a: boolean, b: boolean, c: boolean, d: boolean): void {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          return;
        }
      }
    }
  }
}
`;
      const file = writeFile('deep2.ts', code);
      const findings = await scanner.scan([file]);
      const nestFindings = findings.filter(f => f.rule_id === 'deep-nesting');
      expect(nestFindings.length).toBeGreaterThan(0);
      expect(nestFindings[0].category).toBe('REFACTOR_CANDIDATE');
      expect(nestFindings[0].rule_source).toBe('BUILTIN');
    });

    it('AC04: 존재하지 않는 파일은 스킵해야 한다', async () => {
      const findings = await scanner.scan(['/nonexistent/file.ts']);
      expect(findings).toEqual([]);
    });
  });

  // ─── General ────────────────────────────────────────────────────────────────

  describe('빈 파일 목록 처리', () => {
    it('빈 파일 목록 시 빈 배열을 반환해야 한다', async () => {
      const findings = await scanner.scan([]);
      expect(findings).toEqual([]);
    });
  });
});
