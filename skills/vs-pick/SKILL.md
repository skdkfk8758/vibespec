---
name: vs-pick
description: Pick a specific task from the plan to start.
invocation: user
---

# Pick Task

플랜의 태스크 목록을 인터랙티브하게 보여주고, 사용자가 선택한 태스크로 작업을 시작합니다.

## When to Use

**사용하세요:**
- 특정 태스크를 직접 골라서 작업하고 싶을 때
- 블로커를 우회하여 의존성 없는 태스크를 먼저 진행할 때
- 순서와 무관하게 특정 기능을 우선 구현할 때

**사용하지 마세요:**
- 순차 진행이면 → `/vs-next`
- 전체 일괄 실행이면 → `/vs-exec`

## Steps

1. **워크트리 환경 확인**
   - `git rev-parse --git-dir`로 현재 워크트리 내부인지 확인하세요
   - 워크트리 밖이면 (경로에 `/worktrees/`가 없으면):
     → "메인 브랜치에서 직접 작업하게 됩니다. `/vs-worktree`로 격리 환경을 먼저 세팅하시겠습니까?"라고 안내하세요
     → 사용자가 원하면 `/vs-worktree`로 이동, 아니면 그대로 진행하세요

2. **활성 플랜 확인**
   - Bash 도구로 `vs plan list --json` 명령을 실행하세요. status가 active 또는 approved인 플랜을 필터링하세요
   - 플랜이 여러 개면 `AskUserQuestion`으로 어느 플랜에서 작업할지 물어보세요
   - 활성 플랜이 없으면 `/vs-plan`으로 새 플랜을 만들도록 안내하세요

3. **태스크 목록 조회 및 표시**
   - Bash 도구로 `vs plan show <plan_id> --json` 명령을 실행하세요. 선택된 플랜의 전체 태스크 트리를 가져오세요
   - 태스크를 상태별로 분류하여 테이블로 표시하세요:

   ```
   ## 📋 태스크 목록 — {플랜 제목}

   | # | ID | 태스크 | 상태 |
   |---|-----|--------|------|
   | 1 | T-xxx | 태스크 제목 | 🔲 todo |
   | 2 | T-yyy | 태스크 제목 | 🔄 in_progress |
   | 3 | T-zzz | 태스크 제목 | ✅ done |
   | 4 | T-aaa | 태스크 제목 | 🚫 blocked |
   ```

   - 서브태스크가 있으면 들여쓰기로 계층 구조를 표시하세요
   - 상태 이모지: todo=🔲, in_progress=🔄, done=✅, blocked=🚫, skipped=⏭️

   **의존성 상태 표시**: 각 태스크의 `depends_on` 필드를 분석하여 의존성 상태를 함께 표시하세요:
   - 의존성이 없거나 모든 의존 태스크가 done이면: `[ready]`
   - 미완료 의존 태스크가 있으면: `[blocked by {미완료 태스크 ID 목록}]`
   - 테이블에 "의존성" 열을 추가하세요:

   ```
   ## 📋 태스크 목록 — {플랜 제목}

   | # | ID | 태스크 | 상태 | 의존성 |
   |---|-----|--------|------|--------|
   | 1 | T-xxx | 태스크 제목 | 🔲 todo | [ready] |
   | 2 | T-yyy | 태스크 제목 | 🔲 todo | [blocked by T-xxx] |
   | 3 | T-zzz | 태스크 제목 | 🔲 todo | [blocked by T-xxx, T-yyy] |
   | 4 | T-aaa | 태스크 제목 | ✅ done | — |
   ```

4. **태스크 선택**
   - `AskUserQuestion`을 사용하여 사용자에게 작업할 태스크를 선택하게 하세요
   - 선택지는 todo와 in_progress 상태의 태스크만 포함하세요 (done, skipped 제외)
   - blocked 태스크는 선택지에 포함하되, 차단 사유를 description에 표시하세요
   - 각 옵션의 label은 `{태스크제목}`, description은 `[{상태}] {spec 요약 또는 acceptance criteria 첫 줄}`로 구성하세요
   - 선택 가능한 태스크가 없으면 플랜 완료를 제안하거나 새 태스크 추가를 안내하세요

   **의존성 미충족 태스크 선택 시 경고**: 사용자가 `depends_on`의 선행 태스크가 아직 done이 아닌 태스크를 선택한 경우:
   → `AskUserQuestion`으로 명시적 경고를 표시하세요:
     - question: "선택한 태스크 '{태스크 제목}'에 미충족 의존성이 있습니다:\n{미완료 의존 태스크 목록 (ID, 제목, 상태)}\n선행 태스크 없이 진행하면 구현이 불완전하거나 나중에 충돌이 발생할 수 있습니다."
     - header: "⚠️ 의존성 경고"
     - multiSelect: false
     - 선택지:
       - label: "그래도 진행", description: "의존성 미충족 상태로 구현을 시작합니다"
       - label: "선행 태스크 먼저", description: "미완료 의존 태스크를 먼저 선택합니다"
       - label: "다른 태스크 선택", description: "태스크 목록으로 돌아갑니다"
   → "선행 태스크 먼저" 선택 시 미완료 의존 태스크 중 하나를 자동 선택하여 Step 5로 진행하세요
   → "다른 태스크 선택" 선택 시 Step 4를 다시 실행하세요

5. **선택된 태스크 상세 표시**
   - Bash 도구로 `vs task show <task_id> --json` 명령을 실행하세요. 선택된 태스크의 상세 정보를 가져오세요
   - 태스크 제목, spec, acceptance criteria를 보여주세요
   - 서브태스크가 있으면 함께 표시하세요

5a. **Complex 태스크 워크트리 추천**
   - 선택된 태스크의 `complexity_hint` 필드를 확인하세요
   - 다음 조건을 **모두** 만족하면 워크트리를 추천하세요:
     1. `complexity_hint`가 `complex`임
     2. 현재 워크트리 밖에서 작업 중 (Step 1에서 확인한 결과 활용)
   - 조건 미충족 시 (complexity_hint가 null/simple/moderate이거나 이미 워크트리 안) 이 단계를 스킵하세요
   - 추천 시 `AskUserQuestion`으로 안내하세요:
     - question: "이 태스크는 complex 복잡도로, 여러 파일/모듈을 변경할 수 있습니다. 격리 환경을 강력히 권장합니다. 워크트리를 생성하시겠습니까?"
     - header: "Complex 태스크"
     - multiSelect: false
     - 선택지:
       - label: "워크트리 생성", description: "`/vs-worktree`로 격리 환경을 세팅합니다"
       - label: "그대로 진행", description: "현재 환경에서 작업합니다"
   - "워크트리 생성" 선택 시: `/vs-worktree`를 안내하세요
   - "그대로 진행" 선택 시: 체크포인트로 진행하세요
   - **Note**: 이 추천은 Step 1의 일반 워크트리 확인과 독립적입니다. Step 1에서 "그대로 진행"을 선택했더라도 complex 태스크면 재추천합니다.

   **체크포인트**: "선택한 태스크: {title}. 시작 / 다른 태스크 선택 / 취소 중 선택해주세요."

6. **구현**
   - Bash 도구로 `vs task update <id> in_progress --json` 명령을 실행하세요
   - 태스크의 TDD 적합성을 판단하세요:

   **TDD 적합** (함수, API, 서비스, 데이터 처리, 비즈니스 로직):
     → `tdd-implementer` 에이전트를 디스패치하세요
     → 전달 정보: 태스크(제목, spec, acceptance), 플랜 컨텍스트(제목, 스펙 요약)
     → 에이전트가 자율적으로 RED-GREEN-REFACTOR를 실행합니다
     → 에이전트 리포트를 사용자에게 그대로 표시하세요

   **TDD 부적합** (환경 설정, DB 마이그레이션, UI 스타일링, 문서, 의존성 업데이트):
     → 태스크 spec을 기반으로 직접 구현하세요
     → 완료 후 변경 사항을 사용자에게 요약 보고하세요

7. **완료 처리**
   구현이 끝나면 (에이전트 리포트 수신 또는 직접 구현 완료):
   - 에이전트 status가 BLOCKED인 경우:
     → 차단 사유를 사용자에게 보여주고 대응 방법을 논의하세요
     → 해결 후 에이전트를 재디스패치하거나 직접 구현하세요
   - 에이전트 status가 DONE 또는 DONE_WITH_CONCERNS인 경우, 또는 직접 구현 완료 시:
     → `verification` 스킬을 실행하세요
       - 전달 컨텍스트: 현재 태스크 정보(title, spec, acceptance), tdd-implementer 리포트(있는 경우)
     → **판정:** verification 결과를 그대로 사용합니다 (PASS / WARN / FAIL)
     → **검증 리포트**를 다음 형식으로 출력하세요:
       ```
       ## 검증 리포트

       ### 최종 판정: [PASS | WARN | FAIL]

       ### Verification (기술 검증)
       [verification 리포트 요약 — verdict, 테스트/빌드/lint 결과, acceptance 충족률]

       ### Scope Verification (범위 검증)
       [scope 리포트 요약 — verdict, 범위 내/외 파일 수, 위반 상세]
       (scope 미지정인 경우: "Scope 규칙 미지정 — SKIP")
       ```
     → PASS: Bash 도구로 `vs task update <id> done --json` 명령을 실행하세요
     → WARN: 리포트를 보여주고 사용자 판단에 따라 done 처리 (Bash 도구로 `vs task update <id> done --json --has-concerns` 명령을 실행하세요)
     → FAIL: 리포트를 보여주고 수정 후 재검증 또는 강제 완료를 사용자에게 선택받으세요


## 다음 단계

- → `/vs-next`로 순차 진행 복귀
- → `/vs-commit`으로 변경사항 커밋
- → `/vs-dashboard`로 전체 현황 확인
