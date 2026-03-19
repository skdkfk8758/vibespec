---
name: vs-pick
description: Use when selecting a specific task from the plan to start working on.
invocation: user
---

# Pick Task

플랜의 태스크 목록을 인터랙티브하게 보여주고, 사용자가 선택한 태스크로 작업을 시작합니다.

## Steps

1. **워크트리 환경 확인**
   - `git rev-parse --git-dir`로 현재 워크트리 내부인지 확인하세요
   - 워크트리 밖이면 (경로에 `/worktrees/`가 없으면):
     → "메인 브랜치에서 직접 작업하게 됩니다. `/vs-worktree`로 격리 환경을 먼저 세팅하시겠습니까?"라고 안내하세요
     → 사용자가 원하면 `/vs-worktree`로 이동, 아니면 그대로 진행하세요

2. **활성 플랜 확인**
   - `vp_plan_list`를 호출하여 status가 active 또는 approved인 플랜을 필터링하세요
   - 플랜이 여러 개면 `AskUserQuestion`으로 어느 플랜에서 작업할지 물어보세요
   - 활성 플랜이 없으면 `/vs-plan`으로 새 플랜을 만들도록 안내하세요

3. **태스크 목록 조회 및 표시**
   - `vp_plan_get`으로 선택된 플랜의 전체 태스크 트리를 가져오세요
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

4. **태스크 선택**
   - `AskUserQuestion`을 사용하여 사용자에게 작업할 태스크를 선택하게 하세요
   - 선택지는 todo와 in_progress 상태의 태스크만 포함하세요 (done, skipped 제외)
   - blocked 태스크는 선택지에 포함하되, 차단 사유를 description에 표시하세요
   - 각 옵션의 label은 `{태스크제목}`, description은 `[{상태}] {spec 요약 또는 acceptance criteria 첫 줄}`로 구성하세요
   - 선택 가능한 태스크가 없으면 플랜 완료를 제안하거나 새 태스크 추가를 안내하세요

5. **선택된 태스크 상세 표시**
   - `vp_task_get`으로 선택된 태스크의 상세 정보를 가져오세요
   - 태스크 제목, spec, acceptance criteria를 보여주세요
   - 서브태스크가 있으면 함께 표시하세요

   **체크포인트**: "선택한 태스크: {title}. 시작 / 다른 태스크 선택 / 취소 중 선택해주세요."

6. **구현**
   - `vp_task_update`로 status를 in_progress로 변경하세요
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
     → `verification` 스킬과 `codex-review` 스킬을 **병렬로** 실행하세요
       - 전달 컨텍스트: 현재 태스크 정보(title, spec, acceptance), tdd-implementer 리포트(있는 경우)
       - 각 스킬이 독립적으로 PASS/WARN/FAIL/SKIP 판정과 리포트를 반환합니다
     → **종합 판정 규칙:**
       - codex-review가 SKIP이면 → verification 결과만으로 판정
       - 둘 다 PASS → **PASS**
       - 하나라도 WARN (나머지 PASS 또는 SKIP) → **WARN**
       - 하나라도 FAIL → **FAIL**
     → **종합 리포트**를 다음 형식으로 출력하세요:
       ```
       ## 종합 검증 리포트

       ### 최종 판정: [PASS | WARN | FAIL]

       ### Verification (기술 검증)
       [verification 리포트 요약 — verdict, 테스트/빌드/lint 결과, acceptance 충족률]

       ### Codex Review (코드 리뷰)
       [codex-review 리포트 요약 — verdict, 주요 발견사항]
       (SKIP인 경우: "Codex 리뷰를 건너뛰었습니다: {사유}")
       ```
     → PASS: `vp_task_update`로 status를 done으로 변경하세요
     → WARN: 리포트를 보여주고 사용자 판단에 따라 done 처리 (metrics에 `has_concerns: true` 기록)
     → FAIL: 리포트를 보여주고 수정 후 재검증 또는 강제 완료를 사용자에게 선택받으세요
   - `vp_context_save`로 완료 내용을 저장하세요


## 다음 단계

- → `/vs-next`로 순차 진행 복귀
- → `/vs-commit`으로 변경사항 커밋
- → `/vs-dashboard`로 전체 현황 확인
