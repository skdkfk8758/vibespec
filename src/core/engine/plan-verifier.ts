/**
 * PlanVerifier — AC 파싱 + 검증 타입 정의 + verify() 오케스트레이션
 */
import type Database from 'better-sqlite3';
import { TaskModel } from '../models/task.js';

export interface ACItem {
  acId: string; // "AC01", "AC02", ... 또는 자유형식은 "AC-FREE-1"
  text: string; // AC 설명 텍스트
}

export interface ACMatch {
  acId: string;
  text: string;
  matchedFiles: string[];
  matchedTests: string[];
  confidence: 'high' | 'medium' | 'low' | 'unmatched';
}

export interface TaskVerification {
  taskId: string;
  acItems: ACMatch[];
}

export interface VerificationResult {
  planId: string;
  taskResults: TaskVerification[];
  overallScore: number;
  unmatchedACs: string[];
  warnings: string[];
}

// "AC01: ...", "AC02: ..." 패턴 매칭
const AC_PATTERN = /^(AC\d+):\s*(.+)$/;

export class PlanVerifier {
  private db?: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db;
  }

  /**
   * AC와 코드 변경 파일을 매칭하여 ACMatch를 반환한다.
   * confidence 레벨:
   *   high   — testFiles 경로 중 하나에 AC 번호(acId)가 포함됨
   *   medium — changedFiles 경로 중 하나의 파일명이 AC 텍스트에 포함됨
   *   low    — AC 텍스트 토큰이 changedFiles 경로와 하나라도 겹침
   *   unmatched — 위 모두 해당 없음
   */
  matchACToChanges(ac: ACItem, changedFiles: string[], testFiles: string[]): ACMatch {
    // high: 테스트 파일이 changedFile과 같은 모듈을 커버하거나, 파일 경로에 AC 번호가 포함됨
    const changedModuleNames = changedFiles.map(cf => {
      const fileName = cf.split('/').pop() ?? cf;
      return fileName.replace(/\.[^.]+$/, '').toLowerCase(); // 확장자 제거
    });

    const matchedTests = testFiles.filter(tf => {
      // AC 번호가 파일 경로에 직접 포함
      if (tf.includes(ac.acId)) return true;
      // 테스트 파일이 changedFile 모듈을 커버 (예: plan-verifier.test.ts → plan-verifier)
      const tfFileName = tf.split('/').pop() ?? tf;
      const tfModuleName = tfFileName.replace(/\.test\.[^.]+$/, '').replace(/\.spec\.[^.]+$/, '').toLowerCase();
      return changedModuleNames.includes(tfModuleName);
    });

    if (matchedTests.length > 0) {
      return {
        acId: ac.acId,
        text: ac.text,
        matchedFiles: changedFiles,
        matchedTests,
        confidence: 'high',
      };
    }

    // medium: AC 텍스트에 changedFile의 파일명(확장자 제외 포함)이 존재
    const acTextLower = ac.text.toLowerCase();
    const matchedFiles = changedFiles.filter(cf => {
      const fileName = cf.split('/').pop() ?? cf;
      // 파일명 전체 (예: plan-verifier.ts) 또는 확장자 제외 (plan-verifier) 매칭
      const withoutExt = fileName.replace(/\.[^.]+$/, '');
      return acTextLower.includes(fileName.toLowerCase()) || acTextLower.includes(withoutExt.toLowerCase());
    });

    if (matchedFiles.length > 0) {
      return {
        acId: ac.acId,
        text: ac.text,
        matchedFiles,
        matchedTests: [],
        confidence: 'medium',
      };
    }

    // low: AC 텍스트 토큰과 changedFiles 경로 토큰이 겹침
    const acTokens = ac.text.toLowerCase().split(/[\s\-_./\\]+/).filter(t => t.length > 2);
    const lowMatchedFiles = changedFiles.filter(cf => {
      const cfTokens = cf.toLowerCase().split(/[\s\-_./\\]+/);
      return acTokens.some(t => cfTokens.includes(t));
    });

    if (lowMatchedFiles.length > 0) {
      return {
        acId: ac.acId,
        text: ac.text,
        matchedFiles: lowMatchedFiles,
        matchedTests: [],
        confidence: 'low',
      };
    }

    // unmatched
    return {
      acId: ac.acId,
      text: ac.text,
      matchedFiles: [],
      matchedTests: [],
      confidence: 'unmatched',
    };
  }

  /**
   * 플랜의 모든 done 태스크를 검증하고 VerificationResult를 반환한다.
   * - acceptance가 null인 태스크는 스킵
   * - 모든 태스크 skipped → overallScore = -1 (N/A)
   * - MUST 관련 AC 미매칭 시 warnings에 경고 추가
   */
  async verify(planId: string): Promise<VerificationResult> {
    if (!this.db) {
      throw new Error('PlanVerifier requires a Database instance for verify()');
    }

    const taskModel = new TaskModel(this.db);
    const doneTasks = taskModel.getByPlan(planId, { status: 'done' });

    // acceptance가 null인 태스크 필터링
    const tasksWithAC = doneTasks.filter(t => t.acceptance !== null && t.acceptance !== undefined);

    const taskResults: TaskVerification[] = [];
    const unmatchedACs: string[] = [];
    const warnings: string[] = [];

    // prepare 1회로 N+1 방지
    const handoffStmt = this.db.prepare(
      'SELECT changed_files FROM agent_handoffs WHERE task_id = ? ORDER BY attempt DESC LIMIT 1',
    );

    for (const task of tasksWithAC) {
      const acItems = this.parseACs(task.acceptance);

      // changed_files 조회
      const handoffRow = handoffStmt.get(task.id) as { changed_files: string | null } | undefined;

      let changedFiles: string[] = [];
      if (handoffRow?.changed_files) {
        try {
          changedFiles = JSON.parse(handoffRow.changed_files);
        } catch {
          // malformed JSON — 빈 배열로 처리
        }
      }

      // 테스트 파일만 추출
      const testFiles = changedFiles.filter(
        f => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'),
      );

      const acMatches: ACMatch[] = acItems.map(ac =>
        this.matchACToChanges(ac, changedFiles, testFiles),
      );

      // unmatchedACs 수집 및 MUST 경고
      for (const match of acMatches) {
        if (match.confidence === 'unmatched') {
          unmatchedACs.push(`${task.id}:${match.acId}`);
          // MUST 키워드 포함 AC 미매칭 시 경고
          if (/MUST|반드시|필수/i.test(match.text)) {
            warnings.push(
              `[MUST] ${match.acId} (task: ${task.id}): "${match.text}" — 미매칭`,
            );
          }
        }
      }

      taskResults.push({ taskId: task.id, acItems: acMatches });
    }

    // overallScore 계산
    let overallScore: number;
    if (taskResults.length === 0) {
      overallScore = -1; // 모든 태스크 skipped (N/A)
    } else {
      const allMatches = taskResults.flatMap(tr => tr.acItems);
      const total = allMatches.length;
      if (total === 0) {
        overallScore = -1;
      } else {
        const matched = allMatches.filter(m => m.confidence !== 'unmatched').length;
        overallScore = Math.round((matched / total) * 100);
      }
    }

    return {
      planId,
      taskResults,
      overallScore,
      unmatchedACs,
      warnings,
    };
  }

  /**
   * acceptance criteria 문자열을 ACItem 배열로 파싱한다.
   * - "AC01: 설명" 형식 → 각각 ACItem으로 추출
   * - AC 번호 없는 자유형식 → 전체를 단일 ACItem { acId: "AC-FREE-1" }으로 반환
   * - 빈 문자열 / null / undefined → 빈 배열 반환
   */
  parseACs(acceptance: string | null | undefined): ACItem[] {
    if (acceptance === null || acceptance === undefined) {
      return [];
    }

    const trimmed = acceptance.trim();
    if (trimmed.length === 0) {
      return [];
    }

    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // AC 번호 패턴이 있는지 확인
    const acLines = lines.filter(l => AC_PATTERN.test(l));

    if (acLines.length > 0) {
      // AC 번호 패턴 파싱
      const items: ACItem[] = [];
      for (const line of lines) {
        const match = line.match(AC_PATTERN);
        if (match) {
          items.push({ acId: match[1], text: match[2].trim() });
        }
      }
      return items;
    }

    // 자유형식 — 전체를 단일 ACItem으로
    return [{ acId: 'AC-FREE-1', text: trimmed }];
  }
}
