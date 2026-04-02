---
name: vs-next
description: [Core] Start the next pending task. (다음 태스크)
invocation: user
---

# Next Task

다음 태스크를 가져와서 작업을 시작합니다.

## When to Use

**사용하세요:**
- 활성 플랜에서 다음 태스크를 순차적으로 진행할 때
- 배치 모드로 남은 태스크를 자동 연속 실행할 때

**사용하지 마세요:**
- 특정 태스크를 직접 선택하려면 → `/vs-pick`
- 서브에이전트 없이 빠르게 일괄 실행하려면 → `/vs-exec`

## Steps

1. **Stash 복원 확인**
   - Bash 도구로 `git stash list 2>/dev/null | grep vibespec-session` 을 실행하여 vibespec stash를 검색하세요
   - 현재 브랜치를 `git rev-parse --abbrev-ref HEAD`로 확인하세요
   - 매칭되는 stash가 있으면:
     - stash 메시지에서 브랜치를 파싱하세요 (형식: `vibespec-session:{branch}:{worktree}:{plan}:{task}:{timestamp}`)
     - 현재 브랜치와 일치하는 stash만 복원 대상으로 표시하세요
     - `AskUserQuestion`으로 복원 여부를 확인하세요:
       - question: "이전 세션의 미커밋 변경사항이 stash에 보존되어 있습니다. 어떻게 처리할까요?"
       - header: "Stash 복원"
       - multiSelect: false
       - 선택지:
         - label: "복원", description: "변경사항을 현재 브랜치에 적용합니다"
         - label: "건너뛰기", description: "stash를 유지한 채 다음 단계로 진행합니다"
         - label: "삭제", description: "해당 stash를 제거합니다"
     - **복원** 선택 시: `git stash apply stash@{N}` 실행
       - 성공하면 `git stash drop stash@{N}`으로 정리
       - 충돌 시: `git diff --name-only --diff-filter=U`로 충돌 파일을 표시하고 수동 해결을 안내하세요
     - **삭제** 선택 시: `git stash drop stash@{N}` 실행
   - 매칭되는 stash가 없으면 조용히 다음 단계로 진행하세요

2. **워크트리 환경 확인**
   - `git worktree list`로 현재 워크트리 내부인지 확인하세요
   - 워크트리 밖이면 (메인 저장소에서 직접 작업 중):
     → `AskUserQuestion`으로 확인하세요:
     - question: "메인 브랜치에서 직접 작업하게 됩니다. 격리 환경을 먼저 세팅하시겠습니까?"
     - header: "워크트리 확인"
     - multiSelect: false
     - 선택지:
       - label: "워크트리 생성", description: "`/vs-worktree`로 격리 환경을 세팅합니다"
       - label: "그대로 진행", description: "메인 브랜치에서 직접 작업합니다"

3. **활성 플랜 확인**
   - Bash 도구로 `vs --json plan list` 명령을 실행하세요. 플랜 목록을 가져오고 status가 active 또는 approved인 플랜을 필터링하세요
   - 플랜이 여러 개면 사용자에게 어느 플랜에서 작업할지 물어보세요
   - 활성 플랜이 없으면 `/vs-plan`으로 새 플랜을 만들도록 안내하세요

4. **다음 태스크 조회**
   - Bash 도구로 `vs --json task next <plan_id>` 명령을 실행하여 다음 todo 태스크를 가져오세요
   - **순환 의존성 검증**: 반환된 태스크의 `depends_on` 필드를 따라가며 의존성 체인을 순회하세요
     - 이미 방문한 태스크 ID가 다시 나타나면 순환 의존성입니다
     - 순환이 감지되면:
       → `AskUserQuestion`으로 사용자에게 경고하세요: "순환 의존성이 감지되었습니다: {순환 체인 표시, 예: T1 → T3 → T5 → T1}. 해당 태스크들을 blocked 처리하시겠습니까?"
       → 사용자가 동의하면 순환에 포함된 태스크들을 blocked로 전환하고 (`vs --json task update <id> blocked`), 사유를 기록하세요
       → 순환에 포함되지 않은 다음 태스크를 조회하세요
   - 남은 태스크가 없으면:
     - 플랜 완료 가능 여부를 확인하고 완료를 제안하세요
     - 또는 새 태스크 추가를 제안하세요

3a. **Complex 태스크 워크트리 추천**
   - 조회된 태스크의 `complexity_hint` 필드를 확인하세요
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
   - "그대로 진행" 선택 시: Step 4로 진행하세요
   - **Note**: 이 추천은 Step 1의 일반 워크트리 확인과 독립적입니다. Step 1에서 "그대로 진행"을 선택했더라도 complex 태스크가 조회되면 재추천합니다.
   - **Note**: 배치 모드(Step 8)에서는 이 추천을 적용하지 않습니다 (배치 시작 전 워크트리 확인이 이미 완료되었으므로).

5. **태스크 상세 표시**
   - 태스크 제목, spec, acceptance criteria를 보여주세요
   - 서브태스크가 있으면 함께 표시하세요

6. **에러 KB 사전 조회**
   - 태스크 제목과 spec에서 핵심 키워드(모듈명, 기술명, 에러 유형 등)를 추출하세요
   - Bash 도구로 `vs --json error-kb search "<추출된 키워드>"` 명령을 실행하세요
   - 결과가 있으면:
     → 관련 에러 목록과 해결책을 표시하고 "이전에 유사한 에러가 있었습니다. 참고하여 구현하세요."로 안내하세요
     → occurrences >= 3인 에러가 있으면: "반복 패턴입니다. patterns/ 문서 생성을 고려하세요." 추가 안내하세요
   - 결과가 없으면: 조용히 다음 단계로 진행하세요

7. **스코프 규칙 우선순위**

   3단계 스코프 규칙이 존재하며, 우선순위는 다음과 같습니다:
   | 우선순위 | 메커니즘 | 동작 |
   |---------|---------|------|
   | 1 (최고) | **freeze** (PreToolUse 훅) | Edit/Write를 물리적으로 차단 (exit 2) |
   | 2 | **allowed_files / forbidden_patterns** (태스크 DB) | verifier가 WARN으로 보고 |
   | 3 (최저) | **Modification Plan** (에이전트 자율) | tdd-implementer가 자체 판단 |

   - freeze가 차단하면 allowed_files 여부와 무관하게 편집 불가
   - allowed_files 위반은 WARN이며 FAIL을 발생시키지 않음
   - 상세: verifier 에이전트 문서의 "스코프 규칙 우선순위" 섹션 참조

8. **크로스 플랜 파일 겹침 확인**
   - 현재 태스크에 `allowed_files`가 설정되어 있으면:
     1. `vs --json plan list --status active`로 다른 활성 플랜 조회
     2. 각 플랜의 태스크 중 `allowed_files`가 설정된 태스크와 현재 태스크의 `allowed_files`를 비교
     3. 겹치는 파일이 있으면 경고를 표시하세요:
        ```
        ⚠️ 크로스 플랜 겹침 감지:
        - 플랜 "{다른 플랜 제목}"의 태스크 "{태스크 제목}"도 {겹치는 파일}을 수정합니다.
        💡 Advisory: 다른 플랜의 해당 태스크가 먼저 완료된 후 이 태스크를 진행하면 머지 충돌을 줄일 수 있습니다.
        ```
     4. **경고만 표시하고 진행은 차단하지 않습니다** (advisory 수준)
   - `allowed_files`가 없으면 이 단계를 스킵하세요

9. **구현**
   - Bash 도구로 `vs --json task update <id> in_progress` 명령을 실행하여 status를 in_progress로 변경하세요

   **체크포인트**: `AskUserQuestion`으로 구현 방식을 선택받으세요:
   - question: "이 태스크를 어떻게 구현할까요?"
   - header: "구현 방식 선택"
   - multiSelect: false
   - 선택지:
     - label: "TDD 에이전트 디스패치", description: "tdd-implementer 에이전트가 RED-GREEN-REFACTOR로 자율 구현합니다 (함수, API, 서비스, 비즈니스 로직에 적합)"
     - label: "직접 구현", description: "현재 세션에서 직접 구현합니다 (환경 설정, DB 마이그레이션, UI 스타일링, 문서에 적합)"
     - label: "건너뛰기", description: "이 태스크를 skipped 처리하고 다음으로 넘어갑니다"

   **TDD 자동 판별 테이블** — 아래 기준으로 TDD/직접 구현을 판별하고, 선택지 제시 시 추천을 표시하세요:

   | 신호 | TDD 적합 | 직접 구현 |
   |------|---------|----------|
   | **allowed_files 확장자** | `.ts`, `.js` (비-config) | `.md`, `.yaml`, `.json`, `.css`, `.html` |
   | **spec 키워드** | "함수", "API", "서비스", "로직", "처리", "검증" | "설정", "마이그레이션", "문서", "스타일", "의존성", "삭제" |
   | **태스크 제목** | "구현", "추가", "생성", "통합" | "업데이트", "삭제", "정리", "설정", "제거" |

   **판별 규칙:**
   1. 3개 신호 중 **2개 이상 TDD 적합** → TDD 추천
   2. 3개 신호 중 **2개 이상 직접 구현** → 직접 구현 추천
   3. **혼합 (1:1:1 또는 판별 불가)** → 직접 구현 기본값
   4. 배치 모드(Step 8)에서는 이 테이블을 **자동 적용**하여 사용자 체크포인트 없이 판별

   **Handoff 디렉토리 사전 생성** (TDD/직접 구현 공통):
     → 구현 시작 전에 Bash 도구로 `mkdir -p .claude/handoff/{task_id}` 를 실행하세요
     → 이 디렉토리는 tdd-implementer의 ac_mapping.json, impl_report.json, verifier의 baseline_snapshot.json 등 에이전트 간 핸드오프 파일이 저장되는 경로입니다
     → 디렉토리가 이미 존재하면 무시됩니다 (`-p` 플래그)

   **Baseline 테스트 스냅샷 기록** (TDD/직접 구현 공통, handoff 디렉토리 생성 후):
     → 구현 시작 전에 현재 테스트 상태를 기록하세요
     → JSON 리포터 사용: `npx vitest run --reporter=json 2>/dev/null` 또는 `npx jest --json 2>/dev/null`
     → JSON 파싱이 불가하면 일반 실행 후 출력에서 실패 테스트 이름을 grep으로 추출 (fallback)
     → 테스트 러너가 없거나 실행 실패 시: baseline을 생성하지 않고 진행 (verifier가 fallback 처리)
     → 결과를 `.claude/handoff/{task_id}/baseline_snapshot.json`에 저장:
       ```json
       {
         "task_id": "{task_id}",
         "timestamp": "{ISO8601}",
         "test_runner": "vitest|jest|other",
         "reporter_format": "json|grep_fallback",
         "total": 0,
         "passed": 0,
         "failed": 0,
         "failed_tests": ["test name 1", "test name 2"],
         "exit_code": 0
       }
       ```

   **TDD 에이전트 디스패치:**
     → `tdd-implementer` 또는 `debugger` 에이전트를 디스패치하세요
     → 전달 정보: 태스크(제목, spec, acceptance), 플랜 컨텍스트(제목, 스펙 요약), **scope**(allowed_files, forbidden_patterns — 태스크에 설정되어 있으면)

     **Budget Pressure 힌트 주입** (tdd-implementer, debugger에만 적용 — vs-plan 등 비구현 에이전트 제외):
     디스패치 프롬프트의 **말미**에 아래 조건에 해당하는 힌트를 비침습적으로 주입하세요:
     - 조건 1 — **태스크 복잡도 L**: 태스크 title/spec에서 복잡도 힌트를 추론 (변경 파일 5개+, AC 5개+)
       → `[BUDGET HINT] 이 태스크는 규모가 큽니다. 핵심 기능에 집중하고, 부가적인 리팩터링은 피하세요.`
     - 조건 2 — **이전 재시도 이력**: `vs --json handoff list <task_id>` 결과에서 동일 에이전트의 attempt >= 2인 이력이 있으면
       → `[BUDGET HINT] 이전에 이 태스크에서 {N}회 시도가 있었습니다. 이전 실패 원인을 먼저 확인하고, 핵심 문제에 집중하세요.`
     - 조건 3 — **플랜 진행률 70%+**: `vs --json plan show <plan_id>`에서 progress_pct >= 70이면
       → `[BUDGET HINT] 플랜이 마무리 단계입니다 ({pct}%). 구현 품질과 테스트 커버리지에 집중하세요.`
     - 힌트 주입 실패 시 (DB 조회 에러 등): silent fail — 힌트 없이 에이전트를 디스패치하세요

     → 에이전트가 자율적으로 RED-GREEN-REFACTOR를 실행합니다
     → 에이전트 리포트를 사용자에게 그대로 표시하세요

   **직접 구현:**
     → 태스크 spec을 기반으로 직접 구현하세요
     → 완료 후 변경 사항을 사용자에게 요약 보고하세요

   **부분 실패 롤백 전략:**
   구현 중 실패(빌드 에러, 테스트 실패 등)가 발생하면:
   - `git stash push -m "vs-next: T{id} partial implementation"` 으로 현재까지의 변경사항을 보존하세요
   - Bash 도구로 `vs --json task update <id> blocked` 명령을 실행하여 태스크를 blocked로 전환하세요
   - 실패 사유를 기록하세요: `vs --json task update <id> blocked --note "실패 사유: {에러 메시지 요약}. 변경사항은 git stash에 보존됨 (stash 이름: vs-next: T{id} partial implementation)"`
   - 사용자에게 보고하세요: 실패 사유, stash 복원 방법 (`git stash pop` 또는 `git stash apply`), 다음 태스크 진행 여부
   - 롤백하지 않고 이어서 수정할 수도 있으므로 `AskUserQuestion`으로 선택받으세요:
     - "롤백 후 다음 태스크": stash 상태 유지, 다음 태스크 진행
     - "수정 시도": stash를 복원하고 수동 수정
     - "강제 완료": 현재 상태로 WARN 처리 후 진행

10. **완료 처리**
   구현이 끝나면 (에이전트 리포트 수신 또는 직접 구현 완료):
   - 에이전트 status가 BLOCKED인 경우:
     → 차단 사유를 사용자에게 보여주고 대응 방법을 논의하세요
     → 해결 후 에이전트를 재디스패치하거나 직접 구현하세요
   - 에이전트 status가 DONE 또는 DONE_WITH_CONCERNS인 경우, 또는 직접 구현 완료 시:
     → **QA config 1회 조회**: `vs --json qa config resolve <plan_id>`를 실행하고 결과를 `resolved_config` 변수에 캐싱하세요. 이후 shadow/design_review/adaptive_planner 조건 확인 시 이 캐싱된 값을 재사용합니다.
     → `verifier` 에이전트를 디스패치하세요 (전달 정보: 태스크, 플랜 컨텍스트, impl_report, scope)

     **완료 후처리 — QA Shadow / Design Review / Skeleton Guard / Adaptive Planner**:
     상세 절차: **completion-checks SKILL.md** 참조
     - 섹션 1 "QA Shadow 병렬 디스패치": verifier와 동시에 qa-shadow 디스패치 (조건: modules.shadow)
     - 섹션 2 "Design Review Light 병렬 디스패치": UI 파일 변경 시 design-review-light 디스패치 (조건: modules.design_review + DESIGN.md + UI 파일)
     - 섹션 3 "Skeleton Guard impl-check 병렬 디스패치": 골격 정합성 검증 (조건: modules.skeleton_guard + POLICY.md)
     - 섹션 4 "Adaptive Planner Watcher": 플랜 수준 이상 감지 — 6개 트리거 (조건: modules.adaptive_planner)

     → **판정:** verifier 결과를 그대로 사용합니다 (PASS / WARN / FAIL)
     → **검증 리포트**: completion-checks SKILL.md의 "검증 리포트 형식" 섹션 참조
     → done 처리 시 verifier 리포트에서 `changed_files_detail`과 `scope_violations` JSON을 추출하여 옵션으로 전달하세요
     → PASS: `vs --json task update <id> done`
     → WARN: 리포트를 보여주고 사용자 판단에 따라 `vs --json task update <id> done --has-concerns`
     → FAIL (단일 태스크 모드): 리포트를 보여주고 수정 후 재검증 또는 강제 완료를 사용자에게 선택받으세요
     → FAIL (배치 모드): `debugger` 에이전트를 자동 디스패치하세요 (Step 8의 자동 재시도 정책 참조)

   **백로그 매칭**: 상세 절차는 completion-checks SKILL.md의 "5. 백로그 매칭" 섹션 참조.
   변경 파일과 관련된 open 백로그 항목을 감지하여 "같이 처리" / "나중에" / "무시" 선택을 제시합니다.

   **마일스톤 QA 자동 트리거**: 태스크 done 처리 후 QA 실행을 자동 제안합니다.
   1. 캐싱된 `resolved_config`의 `modules.auto_trigger` 설정을 확인하세요 (Step 10 초반에 이미 조회됨)
   2. `auto_trigger.enabled`가 `false`이면 이 단계를 스킵하세요
   3. 플랜 진행률을 계산하세요: `done / (total - skipped) * 100`
   4. `auto_trigger.milestones` 배열의 각 값과 비교하여, 처음 도달한 마일스톤이 있는지 확인하세요
   5. 해당 플랜의 `qa_overrides`에서 `dismissed_milestones`를 확인하세요:
      - 이미 해당 마일스톤이 dismissed_milestones에 있으면 → 스킵
      - 이미 해당 마일스톤에서 QA Run(`vs --json qa run list --plan <plan_id>`)이 있으면 → 스킵
   6. 마일스톤에 도달했고 위 조건에 해당하지 않으면 `AskUserQuestion`으로 제안하세요:
      - question: "플랜 진행률이 {N}%에 도달했습니다. QA를 실행하시겠습니까?"
      - header: "QA 자동 트리거"
      - multiSelect: false
      - 선택지 (100% 마일스톤일 때):
        - label: "QA 실행 (강력 권장)", description: "incremental QA를 실행합니다 (shadow CLEAN 태스크는 스킵)"
        - label: "나중에", description: "이 마일스톤에서 QA를 건너뜁니다"
      - 선택지 (50% 등 중간 마일스톤일 때):
        - label: "QA 실행", description: "incremental QA를 실행합니다"
        - label: "나중에", description: "이 마일스톤에서 QA를 건너뜁니다"
   7. "QA 실행" 선택 시: `vs --json qa run create <plan_id> --trigger auto` 후 `/vs-qa` 안내
   8. "나중에" 선택 시: `vs --json plan update <plan_id> --qa-overrides '{"dismissed_milestones": [기존 + 현재 마일스톤]}'`으로 기록
   - **Note**: 배치 모드(Step 8)에서는 Wave 완료 시점에만 이 체크를 수행하세요 (매 태스크마다 X)
   - **Note**: shadow ALERT가 2회 이상 누적된 경우에도 targeted QA를 제안하세요

   **플랜 완료 감지**: 태스크 done 처리 후 `vs --json task next <plan_id>`를 실행하세요.
   - 남은 todo 태스크가 없으면 (모든 태스크가 done/skipped/blocked):
     → **Skeleton Evolve 자동 실행** (선택적):
       - 조건: 골격 문서 1개 이상 존재 AND `resolved_config.modules.skeleton_guard`가 `true`
       - 조건 충족 시:
         1. skeleton-evolve 에이전트를 디스패치 (model: haiku):
            ```
            당신은 skeleton-evolve 에이전트입니다.
            agents/skeleton-evolve.md의 Execution Process를 따라 실행하세요.

            plan_id: {plan_id}
            plan_spec: {플랜 스펙}
            task_results: {태스크 결과}
            changed_files: {git diff --name-only로 수집한 변경 파일}
            skeleton_docs: {골격 문서 내용}
            ```
         2. evolve 결과 처리:
            - Auto 변경: 자동 적용 + "골격 문서 자동 업데이트: {N}건" 표시
            - Suggest 변경: 사용자에게 AskUserQuestion으로 각 제안 승인/거부
            - Locked 변경: 사유 입력 요청
            - cross-reference 충돌: 해결 선택 요청
         3. 완료 후 아래 체크포인트 제시
       - 조건 미충족 시: 바로 체크포인트 제시
     → 다음 체크포인트에서 "플랜 검증" 선택지를 **우선 표시**하세요
   - 남은 태스크가 있으면 일반 체크포인트를 표시하세요

   **체크포인트**: `AskUserQuestion`으로 다음 선택지를 제시하세요:
   - question: "다음으로 무엇을 하시겠습니까?"
   - header: "다음 작업"
   - multiSelect: false
   - 선택지 (남은 태스크가 없을 때 — **플랜 완료 흐름**):
     - label: "플랜 검증 (권장)", description: "vs-qa → vs-plan-verify 순서로 플랜 전체를 검증합니다"
     - label: "커밋 정리", description: "현재까지의 변경사항을 먼저 커밋합니다"
     - label: "대시보드", description: "진행률을 확인합니다"
   - 선택지 (남은 태스크가 있을 때 — **일반 흐름**):
     - label: "다음 태스크", description: "다음 1개 태스크를 실행합니다"
     - label: "배치 실행", description: "남은 태스크를 자동으로 연속 실행합니다 (서브에이전트 기반 병렬 + 자동 재시도)"
     - label: "커밋 정리", description: "현재까지의 변경사항을 커밋합니다"
     - label: "대시보드", description: "진행률을 확인합니다"

   - "플랜 검증" → `/vs-qa` 실행 후 → `/vs-plan-verify` 실행
   - "다음 태스크" → Step 3부터 반복
   - "배치 실행" → Step 8로 진행
   - "커밋 정리" → `/vs-commit`
   - "대시보드" → `/vs-dashboard`

11. **배치 실행 모드**

   남은 todo 태스크를 서브에이전트 기반으로 자동 연속 실행합니다. 각 태스크는 fresh 서브에이전트에서 구현하여 컨텍스트 오염을 방지합니다.

   > **vs-exec과의 차이**: `/vs-exec`는 서브에이전트 없이 단일 세션에서 순차 실행합니다 (빠르지만 컨텍스트 오염, 셀프 리뷰). 이 배치 모드는 서브에이전트를 활용하여 컨텍스트 격리, 독립 코드 리뷰, 최대 3개 병렬 실행을 제공합니다. 복잡한 플랜이나 높은 품질이 필요할 때 사용하세요.

   #### Wave 수집 및 의존성 분석
   - Bash 도구로 `vs --json plan show <plan_id>` 명령을 실행하여 전체 태스크 트리와 **waves** 정보를 가져오세요
   - `waves` 배열이 Wave 단위로 병렬 실행 가능한 태스크 그룹을 제공합니다
   - todo 상태인 태스크만 필터링하세요

   #### Wave 기반 실행 전략
   - **Wave 단위로 실행**: Wave 0의 모든 태스크를 먼저 처리한 후 Wave 1로 진행
   - **같은 Wave 내 태스크**: 최대 3개까지 병렬 디스패치 (`run_in_background: true`)
   - **의존성 자동 관리**: `vs --json task next <plan_id>`가 `depends_on` 기반으로 실행 가능한 태스크만 반환하므로, Wave 정보와 함께 사용하면 최적 병렬화 달성
   - 각 태스크마다 Step 6(구현) + Step 7(완료 처리)를 동일하게 적용하세요
     - **TDD 자동 판별 테이블(Step 7)을 자동 적용**: 사용자 체크포인트 없이 테이블 기준으로 TDD/직접 구현을 자동 결정
     - verifier 에이전트 검증
     - 판정 (PASS/WARN/FAIL)
     - 배치 리포트의 태스크 결과에 `판별: TDD` 또는 `판별: 직접` 컬럼을 포함

   #### Wave Gate 검증 (선택적)
   Wave의 모든 태스크가 done 처리된 후:
   - 조건: `vs --json qa config resolve <plan_id>`의 `modules.wave_gate`가 `true`
   - 조건 미충족 시 이 단계를 건너뛰세요
   - Wave Gate 실행:
     1. 이 Wave에서 완료된 태스크들의 변경 파일을 수집
     2. 태스크 간 통합 시나리오를 경량 검증 (cross-task flow 확인)
     3. 판정:
        - GREEN: 통합 이슈 없음 → 다음 Wave 진행
        - YELLOW: 경미한 이슈 → 경고 표시 후 다음 Wave 진행
        - RED: 심각한 이슈 → 구현 일시정지 + AskUserQuestion:
          "Wave Gate RED: {요약}. 어떻게 처리할까요?"
          - "수정 후 재검증" / "무시하고 계속" / "배치 중단"
     4. `vs wave-gate create <plan_id> --wave <n> --verdict <v> --task-ids <ids>` 기록

   #### 자동 재시도 정책 (debugger 에이전트 연동)
   - **PASS**: 다음 태스크 진행
   - **WARN**: 기록 후 다음 태스크 진행 (`--has-concerns` 플래그 사용)
   - **FAIL**: `debugger` 에이전트를 자동 디스패치
     - 전달 정보: 태스크(title, spec, acceptance), 플랜 컨텍스트, verifier FAIL 리포트, impl_report
     - debugger 결과에 따른 처리:
       - **FIX_APPLIED**: `verifier` 에이전트로 재검증 → PASS면 done, FAIL이면 재시도. 수정 성공 시 `vs --json error-kb add`로 에러와 해결책을 KB에 자동 기록하세요
       - **NEEDS_MANUAL**: 사용자에게 에스컬레이션 → "수동 수정" / "건너뛰기" / "배치 중단"
       - **BLOCKED**: 태스크를 blocked로 변경
     - 최대 2회 재시도 (debugger 디스패치 → verifier 재검증 사이클)
     - 3번째 실패 시 → 해당 태스크를 blocked로 변경하고 사용자에게 에스컬레이션

   #### 실패 시 의존 태스크 스킵
   - 태스크가 blocked 상태가 되면, `depends_on`으로 이 태스크에 의존하는 모든 후속 태스크를 자동으로 skipped 처리하세요
   - 스킵 사유를 각 태스크의 metrics에 기록하세요: `skipped_reason: "dependency T{N} blocked"`

   #### 배치 진행 리포트
   3개 태스크마다 (또는 의존성 체인 단위로) 중간 리포트를 출력하세요:

   ```
   ## 배치 진행 ({완료}/{전체})

   | 태스크 | 결과 | 재시도 |
   |--------|------|--------|
   | T1: {제목} | PASS | 0 |
   | T2: {제목} | WARN | 0 |
   | T3: {제목} | 진행 중 | - |
   ```

   #### 배치 완료 리포트
   모든 태스크 처리 후 전체 테스트 스위트를 실행하고 종합 리포트를 출력하세요:

   ```
   ## 배치 실행 완료

   ### 태스크 결과
   | 태스크 | 결과 | 재시도 |
   |--------|------|--------|
   | T1: {제목} | PASS | 0 |
   | T2: {제목} | WARN | 1 |
   | T3: {제목} | BLOCKED | 2 |
   | T4: {제목} | SKIPPED (T3 의존) | - |

   ### 통계
   - 총 태스크: {N}개
   - PASS: {N} / WARN: {N} / BLOCKED: {N} / SKIPPED: {N}
   - 전체 테스트: {passed}/{total}

   ### 다음 단계
   - BLOCKED/SKIPPED 태스크가 있으면 → 수동 해결 후 `/vs-next`
   - 모두 완료되면 → `/vs-commit`으로 커밋 정리
   ```

## 다음 단계

- → `/vs-next`로 다음 태스크 진행 (단일 또는 배치)
- → `/vs-exec`로 서브에이전트 없이 단일 세션 일괄 실행
- → `/vs-commit`으로 변경사항 논리 단위 커밋
- → `/vs-dashboard`로 진행률 확인
- 블로커 발견 시 → `/vs-pick`으로 다른 태스크 선택
- → `/vs-worktree`로 격리된 환경에서 작업 시작
