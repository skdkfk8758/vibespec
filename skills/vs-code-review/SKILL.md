---
name: vs-code-review
description: "[QA] Review code changes and detect production bugs."
invocation: user
argument-hint: "[--base <branch>]"
---

# Code Review (코드 리뷰)

git diff 기반으로 변경된 코드에서 프로덕션 버그를 사전 탐지하고, 기계적 문제는 자동 수정합니다.

## When to Use

**사용하세요:**
- 구현 완료 후 커밋/PR 전에 코드 품질 검증이 필요할 때
- feature 브랜치에서 main으로 머지 전 최종 점검
- 대규모 리팩토링 후 의도치 않은 버그 유입 확인

**사용하지 마세요:**
- 태스크 완료 검증 → `verification` (AC 크로스체크 + 테스트/빌드/lint)
- 코드 품질/재사용/효율 리뷰 → `simplify-loop` (반복 리뷰)
- 보안 전문 감사 → `/vs-security` (OWASP Top 10)

**역할 분담:**
| 스킬 | 트리거 시점 | 입력 | 관점 |
|------|------------|------|------|
| **vs-code-review** | 커밋/PR 전, 사용자 수동 호출 | git diff | 프로덕션 버그, 완전성 |
| **verification** | 태스크 완료 시 자동 | AC + 테스트/빌드/lint | 요구사항 충족 |
| **simplify-loop** | 사용자 수동 호출 | 전체 변경 코드 | 재사용, 품질, 효율 |

## Steps

### Step 1: 변경 파일 수집

1. `$ARGUMENTS`에 `--base` 옵션이 있으면 해당 브랜치 기준, 없으면 `main` 기준으로 diff를 수집하세요
2. Bash 도구로 `git diff --name-only --diff-filter=ACMR <base>...HEAD` 실행
3. 바이너리 파일(이미지, 폰트 등)은 필터링하여 제외
4. 변경 파일이 없으면: "변경사항이 없습니다. 커밋되지 않은 변경이 있는지 `git status`를 확인하세요." 안내 후 종료
5. 변경 파일 목록과 총 변경 라인 수를 요약 표시

### Step 2: 버그 패턴 스캔

변경된 파일을 읽고 아래 **10개 버그 패턴 카테고리**를 스캔하세요.
각 패턴에 대해 Grep 패턴으로 후보를 수집한 뒤, 변경 파일의 컨텍스트를 읽어 실제 문제인지 판단합니다.

| # | 패턴 | Severity | 자동수정 | Grep 패턴 | 검증 포인트 |
|---|------|----------|---------|-----------|-------------|
| 1 | **Race Condition** | critical | 불가 | `async.*await.*\bPromise\.all\b`, `setTimeout.*state`, `\.then\(.*\.then\(` | 공유 상태 동시 접근, lock/mutex 없는 병렬 쓰기, 비동기 체인에서 상태 의존 |
| 2 | **Trust Boundary Violation** | critical | 불가 | `req\.(body\|query\|params)\b.*(?!.*validat)`, `JSON\.parse\(.*req\b`, `eval\(`, `new Function\(` | 사용자 입력을 검증 없이 사용, 클라이언트 데이터 직접 신뢰 |
| 3 | **Missing Index** | high | 불가 | `\.find\(\{`, `\.filter\(\{`, `WHERE.*(?!.*INDEX)`, `SELECT.*FROM.*WHERE` | 반복 쿼리에 인덱스 없음, N+1 쿼리 내부의 미인덱스 필드 |
| 4 | **Escaping Bug** | high | 불가 | `innerHTML\s*=`, `dangerouslySetInnerHTML`, `` `.*\$\{.*req\b` ``, `\.raw\(` | HTML/SQL/쉘 이스케이프 누락, 템플릿 리터럴에 미검증 입력 |
| 5 | **Broken Invariant** | high | 불가 | `\.length\s*[><=].*(?!.*throw)`, `if.*null.*(?!.*return\|throw)`, `switch.*(?!.*default)` | null 체크 후 처리 누락, switch-case default 미처리, 배열 길이 가정 |
| 6 | **Bad Retry Logic** | medium | 불가 | `retry.*catch`, `setTimeout.*retry`, `while.*attempt` | 지수 백오프 없는 재시도, 무한 재시도, 재시도 시 상태 미초기화 |
| 7 | **Forgotten Enum Handler** | medium | 불가 | `switch\s*\(.*type\|status\|kind\|state`, `if.*===.*\|\|.*===` | 새 enum 값 추가 후 switch/if에 미반영, exhaustive check 누락 |
| 8 | **Dead Code** | low | **가능** | `\/\/\s*TODO.*\d{4}`, `function\s+\w+.*\{[^}]*\}(?!.*\b\1\b)`, `import.*(?!.*used)` | 미사용 함수, 미사용 import, 1년 이상 된 TODO 코멘트 |
| 9 | **N+1 Query** | medium | **가능** | `for.*await.*find\b`, `\.map\(.*await.*query`, `forEach.*await.*fetch` | 루프 내 개별 쿼리, batch/bulk API 미사용 |
| 10 | **Stale Comment** | low | **가능** | `\/\/.*(?:이전\|기존\|원래\|old\|legacy\|deprecated\|removed\|deleted)` | 코드와 불일치하는 주석, 삭제된 로직을 설명하는 주석 |

**스캔 절차:**
1. 각 패턴의 Grep 패턴으로 변경 파일에서 후보 라인을 수집
2. 후보 라인의 전후 10줄 컨텍스트를 읽어 **실제 문제인지 판단** (false positive 제거)
3. false positive 판단 기준:
   - 테스트 파일 내부의 의도적 패턴 → 제외
   - 주석/문서 내 예시 코드 → 제외
   - 이미 적절한 처리가 존재하는 경우 → 제외
4. 확인된 문제를 severity별로 분류하여 Step 4의 리포트에 반영

### Step 3: 자동 수정

기계적으로 수정 가능한 문제(패턴 8, 9, 10)를 자동 수정합니다.

#### 자동 수정 대상 (애매하지 않은 기계적 문제만)

| 패턴 | 자동 수정 규칙 |
|------|---------------|
| **Dead Code** (#8) | 미사용 import 제거, 미사용 함수 제거, 1년+ TODO 삭제 |
| **N+1 Query** (#9) | 루프 내 개별 쿼리를 batch/bulk API로 변환 (패턴이 명확한 경우만) |
| **Stale Comment** (#10) | 코드와 불일치하는 주석 삭제 또는 갱신 |

#### 자동 수정 절차

1. 수정 전 `git stash push -m "code-review: pre-autofix backup"` 실행
2. 각 수정에 대해:
   - 변경 내용을 `[AUTO-FIXED] {파일}:{라인} {문제} → {수정 내용}` 형식으로 기록
   - Edit 도구로 최소한의 변경만 적용
3. 수정 후 테스트 실행: `npm test` (또는 프로젝트의 테스트 명령)
   - **테스트 통과**: `git stash drop` (백업 제거), 수정 확정
   - **테스트 실패**: `git checkout -- .` + `git stash pop` (원상 복구) + WARN 리포트에 "자동 수정이 테스트를 깨뜨려 롤백됨" 기록
4. 자동 수정 불가능한 패턴(#1~#7)은 절대 자동 수정하지 않음

#### Completeness Gap 탐지

Step 2 스캔 후, 변경된 코드에서 **미완성 구현**을 탐지하세요:

**탐지 기준** — 아래 중 하나라도 해당하면 Completeness Gap:
- `TODO`, `FIXME`, `HACK`, `XXX` 주석이 있으면서 30분 이내 완성 가능
- 에러 처리가 `console.log`/`console.error`만으로 되어 있는 catch 블록
- 빈 함수 바디 또는 `throw new Error('Not implemented')`
- 하드코딩된 값이 상수/설정으로 추출 가능한 경우
- 타입이 `any`로 선언된 곳이 구체적 타입 추론 가능한 경우

**판단 기준**: "이 문제를 완전히 해결하는 데 30분 이내 소요" → Gap으로 보고
**리포트 형식**: Step 4의 `### Completeness Gaps` 섹션에 목록으로 출력

### Step 4: 리포트 생성

스캔 결과를 severity별로 분류하여 리포트를 생성합니다.

```
## Code Review Report

**Base**: {base branch}
**변경 파일**: {N}개 ({+added} / {-removed} lines)

### Summary
- Critical: {N}건
- High: {N}건
- Medium: {N}건
- Low: {N}건
- Auto-Fixed: {N}건

### 판정: [PASS | WARN | FAIL]

### Findings

#### Critical
| # | 파일:라인 | 패턴 | 문제 | 자동수정 |
|---|----------|------|------|---------|
| 1 | ... | ... | ... | [AUTO-FIXED] / 사용자 판단 필요 |

#### High
...

#### Auto-Fixed
| # | 파일:라인 | 문제 | 수정 내용 |
|---|----------|------|----------|
| 1 | ... | ... | [AUTO-FIXED] ... |

### Completeness Gaps
- {30분 이내 완성 가능한 80% 구현 지적}
```

### Step 4a: Error KB 대조

리포트 생성 후, 발견된 패턴을 Error KB와 크로스체크하세요:

1. 발견된 각 패턴 카테고리에서 핵심 키워드 추출 (예: "race condition", "N+1", "trust boundary")
2. Bash 도구로 `vs --json error-kb search "<키워드>"` 실행
3. 매칭 결과가 있으면 리포트에 추가:
   ```
   ### Error KB 매칭
   - KB#{id}: "{title}" (발생 {occurrences}회) — 해결책: {resolution}
   ```
4. `occurrences >= 3`인 항목: "⚠️ 반복 패턴입니다. 구조적 개선을 검토하세요." 추가 경고

### Step 4b: PASS/WARN/FAIL 판정

리포트 Summary를 기반으로 판정하세요:

| 판정 | 기준 |
|------|------|
| **FAIL** | Critical 1건 이상 **또는** High 3건 이상 |
| **WARN** | High 1~2건 **또는** Medium 5건 이상 **또는** Completeness Gap 3건 이상 |
| **PASS** | 위 조건에 해당하지 않음 |

- 자동 수정된 항목(`[AUTO-FIXED]`)은 판정 카운트에서 제외
- 판정 결과를 리포트의 `### 판정` 섹션에 반영

### Step 5: 사용자 확인 및 후속 조치

1. 리포트를 사용자에게 표시
2. 애매한 문제(보안, 레이스, 설계 판단)는 `AskUserQuestion`으로 개별 판단 요청:
   - 각 애매한 문제에 대해: "이 문제를 어떻게 처리할까요?" + 선택지 (수정/무시/나중에)
**체크포인트**: `AskUserQuestion`으로 다음 단계를 물어보세요:
- question: "코드 리뷰가 완료되었습니다. 어떻게 진행할까요?"
- header: "리뷰 완료"
- multiSelect: false
- 선택지:
  - label: "커밋/PR 진행", description: "리뷰 결과에 만족합니다. 커밋합니다"
  - label: "지적 사항 수정", description: "발견된 문제를 수정한 후 재리뷰합니다"
  - label: "리포트만 저장", description: "결과를 기록하고 나중에 처리합니다"

## Rules

- git diff가 비어있으면 안내 후 즉시 종료
- 바이너리 파일은 스캔 대상에서 제외
- 자동 수정 후 반드시 테스트 실행 → 실패 시 즉시 롤백
- 애매한 문제(보안, 레이스, 설계 판단)는 절대 자동 수정하지 않고 사용자 판단 요청
- 100+ 파일 변경 시 변경량 상위 파일부터 우선 분석
- context_log 저장 시 반드시 `[code-review]` 태그 포함

## 다음 단계

- → `/vs-commit`으로 변경사항 커밋
- → `/vs-code-review`를 다시 실행하여 수정 후 재리뷰
- → `/vs-security`로 보안 전문 감사 추가 실행
