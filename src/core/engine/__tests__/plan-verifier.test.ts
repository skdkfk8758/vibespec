import { describe, it, expect, beforeEach } from 'vitest';
import { PlanVerifier } from '../plan-verifier.js';
import type { ACItem, ACMatch, VerificationResult } from '../plan-verifier.js';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { PlanModel } from '../../models/plan.js';
import { TaskModel } from '../../models/task.js';
import type Database from 'better-sqlite3';

describe('PlanVerifier.parseACs', () => {
  const verifier = new PlanVerifier();

  it('AC01: "AC01: 설명\\nAC02: 설명" 형식에서 ACItem 배열을 추출한다', () => {
    // Arrange
    const input = 'AC01: 첫 번째 조건\nAC02: 두 번째 조건\nAC03: 세 번째 조건';

    // Act
    const result = verifier.parseACs(input);

    // Assert
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual<ACItem>({ acId: 'AC01', text: '첫 번째 조건' });
    expect(result[1]).toEqual<ACItem>({ acId: 'AC02', text: '두 번째 조건' });
    expect(result[2]).toEqual<ACItem>({ acId: 'AC03', text: '세 번째 조건' });
  });

  it('AC01: 숫자가 두 자리인 AC 번호도 올바르게 파싱한다', () => {
    // Arrange
    const input = 'AC10: 열 번째 조건\nAC11: 열한 번째 조건';

    // Act
    const result = verifier.parseACs(input);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].acId).toBe('AC10');
    expect(result[1].acId).toBe('AC11');
  });

  it('AC02: AC 번호 없는 자유형식도 단일 ACItem으로 반환한다', () => {
    // Arrange
    const input = '사용자가 로그인하면 대시보드가 표시되어야 한다';

    // Act
    const result = verifier.parseACs(input);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].acId).toBe('AC-FREE-1');
    expect(result[0].text).toBe('사용자가 로그인하면 대시보드가 표시되어야 한다');
  });

  it('AC02: 여러 줄의 자유형식도 단일 ACItem으로 반환한다', () => {
    // Arrange
    const input = '첫 줄 설명\n두 번째 줄 설명\n세 번째 줄 설명';

    // Act
    const result = verifier.parseACs(input);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].acId).toBe('AC-FREE-1');
  });

  it('AC03: 빈 문자열 입력 시 빈 배열을 반환한다', () => {
    // Arrange & Act
    const result = verifier.parseACs('');

    // Assert
    expect(result).toEqual([]);
  });

  it('AC03: null 입력 시 빈 배열을 반환한다', () => {
    // Arrange & Act
    const result = verifier.parseACs(null);

    // Assert
    expect(result).toEqual([]);
  });

  it('AC03: undefined 입력 시 빈 배열을 반환한다', () => {
    // Arrange & Act
    const result = verifier.parseACs(undefined);

    // Assert
    expect(result).toEqual([]);
  });

  it('AC03: 공백만 있는 문자열 입력 시 빈 배열을 반환한다', () => {
    // Arrange & Act
    const result = verifier.parseACs('   \n  \n  ');

    // Assert
    expect(result).toEqual([]);
  });
});

describe('PlanVerifier.matchACToChanges', () => {
  const verifier = new PlanVerifier();

  it('AC01: 테스트 파일 경로에 AC 번호가 포함되면 confidence=high로 매칭된다', () => {
    // Arrange
    const ac: ACItem = { acId: 'AC01', text: '테스트 파일에 AC01이 포함되면 high 매칭' };
    const changedFiles = ['src/core/engine/plan-verifier.ts'];
    const testFiles = ['src/core/engine/__tests__/plan-verifier.test.ts'];

    // Act
    const result: ACMatch = verifier.matchACToChanges(ac, changedFiles, testFiles);

    // Assert
    expect(result.acId).toBe('AC01');
    expect(result.confidence).toBe('high');
    expect(result.matchedTests).toContain('src/core/engine/__tests__/plan-verifier.test.ts');
  });

  it('AC01: AC 번호가 테스트 파일 경로에 없으면 high가 아니다', () => {
    // Arrange
    const ac: ACItem = { acId: 'AC99', text: '매칭 없는 AC' };
    const changedFiles: string[] = [];
    const testFiles = ['src/core/engine/__tests__/plan-verifier.test.ts'];

    // Act
    const result: ACMatch = verifier.matchACToChanges(ac, changedFiles, testFiles);

    // Assert
    expect(result.confidence).not.toBe('high');
  });

  it('AC02: changed_files와 AC 텍스트의 파일명이 일치하면 confidence=medium', () => {
    // Arrange
    const ac: ACItem = { acId: 'AC02', text: 'plan-verifier 파일 변경 시 medium 매칭' };
    const changedFiles = ['src/core/engine/plan-verifier.ts'];
    const testFiles: string[] = [];

    // Act
    const result: ACMatch = verifier.matchACToChanges(ac, changedFiles, testFiles);

    // Assert
    expect(result.acId).toBe('AC02');
    expect(result.confidence).toBe('medium');
    expect(result.matchedFiles).toContain('src/core/engine/plan-verifier.ts');
  });

  it('AC02: AC 텍스트에 changedFile의 파일명이 없으면 medium이 아니다', () => {
    // Arrange
    const ac: ACItem = { acId: 'AC02', text: '완전히 다른 모듈 설명' };
    const changedFiles = ['src/core/engine/plan-verifier.ts'];
    const testFiles: string[] = [];

    // Act
    const result: ACMatch = verifier.matchACToChanges(ac, changedFiles, testFiles);

    // Assert
    expect(result.confidence).not.toBe('medium');
  });

  it('AC03: 같은 파일이 여러 AC에 중복 매칭될 수 있다', () => {
    // Arrange
    const ac1: ACItem = { acId: 'AC01', text: 'plan-verifier 관련 첫 번째 조건' };
    const ac2: ACItem = { acId: 'AC02', text: 'plan-verifier 관련 두 번째 조건' };
    const changedFiles = ['src/core/engine/plan-verifier.ts'];
    const testFiles: string[] = [];

    // Act
    const result1: ACMatch = verifier.matchACToChanges(ac1, changedFiles, testFiles);
    const result2: ACMatch = verifier.matchACToChanges(ac2, changedFiles, testFiles);

    // Assert
    expect(result1.matchedFiles).toContain('src/core/engine/plan-verifier.ts');
    expect(result2.matchedFiles).toContain('src/core/engine/plan-verifier.ts');
  });

  it('AC04: 매칭 없는 AC는 confidence=unmatched로 반환된다', () => {
    // Arrange
    const ac: ACItem = { acId: 'AC04', text: '전혀 관련 없는 설명' };
    const changedFiles: string[] = [];
    const testFiles: string[] = [];

    // Act
    const result: ACMatch = verifier.matchACToChanges(ac, changedFiles, testFiles);

    // Assert
    expect(result.acId).toBe('AC04');
    expect(result.confidence).toBe('unmatched');
    expect(result.matchedFiles).toHaveLength(0);
    expect(result.matchedTests).toHaveLength(0);
  });

  it('AC04: changedFiles가 있어도 AC 텍스트와 전혀 매칭 안 되면 unmatched', () => {
    // Arrange
    const ac: ACItem = { acId: 'AC04', text: '완전히 다른 내용' };
    const changedFiles = ['src/completely/different/file.ts'];
    const testFiles: string[] = [];

    // Act
    const result: ACMatch = verifier.matchACToChanges(ac, changedFiles, testFiles);

    // Assert
    expect(result.confidence).toBe('unmatched');
  });
});

describe('PlanVerifier.verify', () => {
  let db: Database.Database;
  let planModel: PlanModel;
  let taskModel: TaskModel;
  let verifier: PlanVerifier;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    planModel = new PlanModel(db);
    taskModel = new TaskModel(db);
    verifier = new PlanVerifier(db);
  });

  it('AC01: verify가 VerificationResult를 반환하며 overallScore가 0-100 범위이다', async () => {
    // Arrange
    const plan = planModel.create('Test Plan');
    const task = taskModel.create(plan.id, 'Task 1', {
      acceptance: 'AC01: plan-verifier 관련 조건이 충족된다',
    });
    taskModel.updateStatus(task.id, 'in_progress');
    taskModel.updateStatus(task.id, 'done');
    // Insert agent_handoff with changed_files
    db.prepare(
      `INSERT INTO agent_handoffs (id, task_id, plan_id, agent_type, attempt, changed_files)
       VALUES ('h1', ?, ?, 'tdd-implementer', 1, ?)`,
    ).run(task.id, plan.id, JSON.stringify(['src/core/engine/plan-verifier.ts']));

    // Act
    const result: VerificationResult = await verifier.verify(plan.id);

    // Assert
    expect(result).toBeDefined();
    expect(result.planId).toBe(plan.id);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('AC02: MUST 관련 AC 미매칭 시 warnings에 경고가 포함된다', async () => {
    // Arrange
    const plan = planModel.create('MUST Plan');
    const task = taskModel.create(plan.id, 'Task MUST', {
      acceptance: 'AC01: 반드시 MUST 조건을 충족해야 한다',
    });
    taskModel.updateStatus(task.id, 'in_progress');
    taskModel.updateStatus(task.id, 'done');
    // No changed_files → AC will be unmatched

    // Act
    const result: VerificationResult = await verifier.verify(plan.id);

    // Assert
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('AC01'))).toBe(true);
  });

  it('AC03: acceptance가 null인 태스크는 결과에서 제외된다', async () => {
    // Arrange
    const plan = planModel.create('Null AC Plan');
    const taskWithAC = taskModel.create(plan.id, 'Task with AC', {
      acceptance: 'AC01: 정상 조건이 충족된다',
    });
    const taskNoAC = taskModel.create(plan.id, 'Task without AC');
    taskModel.updateStatus(taskWithAC.id, 'in_progress');
    taskModel.updateStatus(taskWithAC.id, 'done');
    taskModel.updateStatus(taskNoAC.id, 'in_progress');
    taskModel.updateStatus(taskNoAC.id, 'done');

    // Act
    const result: VerificationResult = await verifier.verify(plan.id);

    // Assert — taskNoAC should not appear in taskResults
    const resultTaskIds = result.taskResults.map(tr => tr.taskId);
    expect(resultTaskIds).not.toContain(taskNoAC.id);
  });

  it('AC04: 모든 태스크 skipped 시 score가 -1 (N/A 표시)로 반환된다', async () => {
    // Arrange
    const plan = planModel.create('All Skipped Plan');
    // No done tasks, only skipped ones (acceptance=null → skipped by verifier)
    const task1 = taskModel.create(plan.id, 'Task no AC 1');
    const task2 = taskModel.create(plan.id, 'Task no AC 2');
    taskModel.updateStatus(task1.id, 'in_progress');
    taskModel.updateStatus(task1.id, 'done');
    taskModel.updateStatus(task2.id, 'in_progress');
    taskModel.updateStatus(task2.id, 'done');
    // Both have no acceptance → all skipped

    // Act
    const result: VerificationResult = await verifier.verify(plan.id);

    // Assert
    expect(result.overallScore).toBe(-1);
  });
});
