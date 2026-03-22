---
name: vs-next
description: Use when fetching and starting the next pending task from the active plan.
invocation: user
---

# Next Task

다음 태스크를 가져와서 작업을 시작합니다.

## Steps

1. **워크트리 환경 확인**
   - `git rev-parse --git-dir`로 현재 워크트리 내부인지 확인하세요
   - 워크트리 밖이면 (경로에 `/worktrees/`가 없으면):
     → "메인 브랜치에서 직접 작업하게 됩니다. `/vs-worktree`로 격리 환경을 먼저 세팅하시겠습니까?"라고 안내하세요
     → 사용자가 원하면 `/vs-worktree`로 이동, 아니면 그대로 진행하세요

2. **활성 플랜 확인**
   - Bash 도구로 `vs plan list --json` 명령을 실행하세요. 플랜 목록을 가져오고 status가 active 또는 approved인 플랜을 필터링하세요
   - 플랜이 여러 개면 사용자에게 어느 플랜에서 작업할지 물어보세요
   - 활성 플랜이 없으면 `/vs-plan`으로 새 플랜을 만들도록 안내하세요

3. **다음 태스크 조회**
   - Bash 도구로 `vs task next <plan_id> --json` 명령을 실행하여 다음 todo 태스크를 가져오세요
   - 남은 태스크가 없으면:
     - 플랜 완료 가능 여부를 확인하고 완료를 제안하세요
     - 또는 새 태스크 추가를 제안하세요

4. **태스크 상세 표시**
   - 태스크 제목, spec, acceptance criteria를 보여주세요
   - 서브태스크가 있으면 함께 표시하세요

5. **에러 KB 사전 조회**
   - 태스크 제목과 spec에서 핵심 키워드(모듈명, 기술명, 에러 유형 등)를 추출하세요
   - Bash 도구로 `vs error-kb search "<추출된 키워드>" --json` 명령을 실행하세요
   - 결과가 있으면:
     → 관련 에러 목록과 해결책을 표시하고 "이전에 유사한 에러가 있었습니다. 참고하여 구현하세요."로 안내하세요
     → occurrences >= 3인 에러가 있으면: "반복 패턴입니다. patterns/ 문서 생성을 고려하세요." 추가 안내하세요
   - 결과가 없으면: 조용히 다음 단계로 진행하세요

6. **구현**
   - Bash 도구로 `vs task update <id> in_progress --json` 명령을 실행하여 status를 in_progress로 변경하세요

   **체크포인트**: "이 태스크를 시작합니다. TDD 에이전트 디스패치 / 직접 구현 / 건너뛰기 중 선택해주세요."
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
     → `verifier` 에이전트와 `codex-review` 스킬을 **병렬로** 실행하세요
       - `verifier` 에이전트 전달 정보: 태스크(title, spec, acceptance), 플랜 컨텍스트, impl_report(있는 경우)
       - `codex-review` 스킬 전달 정보: 현재 태스크 정보, tdd-implementer 리포트(있는 경우)
       - 각각 독립적으로 PASS/WARN/FAIL/SKIP 판정과 리포트를 반환합니다
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
     → PASS: Bash 도구로 `vs task update <id> done --json` 명령을 실행하여 status를 done으로 변경하세요
     → WARN: 리포트를 보여주고 사용자 판단에 따라 done 처리 (Bash 도구로 `vs task update <id> done --json --has-concerns` 명령을 실행하세요)
     → FAIL (단일 태스크 모드): 리포트를 보여주고 수정 후 재검증 또는 강제 완료를 사용자에게 선택받으세요
     → FAIL (배치 모드): `debugger` 에이전트를 자동 디스패치하세요 (Step 8의 자동 재시도 정책 참조)
   - Bash 도구로 `vs context save --json --summary "..."` 명령을 실행하여 완료 내용을 저장하세요
   **체크포인트**: `AskUserQuestion`으로 다음 선택지를 제시하세요:
   - header: "다음 작업"
   - 선택지:
     - label: "다음 태스크", description: "다음 1개 태스크를 실행합니다"
     - label: "배치 실행", description: "남은 태스크를 자동으로 연속 실행합니다 (의존성 기반 병렬 + 자동 재시도)"
     - label: "커밋 정리", description: "현재까지의 변경사항을 커밋합니다"
     - label: "대시보드", description: "진행률을 확인합니다"

   - "다음 태스크" → Step 3부터 반복
   - "배치 실행" → Step 8로 진행
   - "커밋 정리" → `/vs-commit`
   - "대시보드" → `/vs-dashboard`

8. **배치 실행 모드**

   남은 todo 태스크를 자동으로 연속 실행합니다. 각 태스크는 fresh 서브에이전트에서 구현하여 컨텍스트 오염을 방지합니다.

   #### Wave 수집 및 의존성 분석
   - Bash 도구로 `vs plan show <plan_id> --json` 명령을 실행하여 전체 태스크 트리와 **waves** 정보를 가져오세요
   - `waves` 배열이 Wave 단위로 병렬 실행 가능한 태스크 그룹을 제공합니다
   - todo 상태인 태스크만 필터링하세요

   #### Wave 기반 실행 전략
   - **Wave 단위로 실행**: Wave 0의 모든 태스크를 먼저 처리한 후 Wave 1로 진행
   - **같은 Wave 내 태스크**: 최대 3개까지 병렬 디스패치 (`run_in_background: true`)
   - **의존성 자동 관리**: `vs task next <plan_id> --json`가 `depends_on` 기반으로 실행 가능한 태스크만 반환하므로, Wave 정보와 함께 사용하면 최적 병렬화 달성
   - 각 태스크마다 Step 6(구현) + Step 7(완료 처리)를 동일하게 적용하세요
     - tdd-implementer 디스패치 또는 직접 구현 판단
     - verifier 에이전트 + codex-review 병렬 리뷰
     - 종합 판정 (PASS/WARN/FAIL)

   #### 자동 재시도 정책 (debugger 에이전트 연동)
   - **PASS**: 다음 태스크 진행
   - **WARN**: 기록 후 다음 태스크 진행 (`--has-concerns` 플래그 사용)
   - **FAIL**: `debugger` 에이전트를 자동 디스패치
     - 전달 정보: 태스크(title, spec, acceptance), 플랜 컨텍스트, verifier FAIL 리포트, impl_report
     - debugger 결과에 따른 처리:
       - **FIX_APPLIED**: `verifier` 에이전트로 재검증 → PASS면 done, FAIL이면 재시도. 수정 성공 시 `vs error-kb add`로 에러와 해결책을 KB에 자동 기록하세요
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
   | T1: {제목} | ✅ PASS | 0 |
   | T2: {제목} | ⚠️ WARN | 0 |
   | T3: {제목} | 🔄 진행 중 | - |
   ```

   #### 배치 완료 리포트
   모든 태스크 처리 후 전체 테스트 스위트를 실행하고 종합 리포트를 출력하세요:

   ```
   ## 배치 실행 완료

   ### 태스크 결과
   | 태스크 | 결과 | 재시도 |
   |--------|------|--------|
   | T1: {제목} | ✅ PASS | 0 |
   | T2: {제목} | ⚠️ WARN | 1 |
   | T3: {제목} | ❌ BLOCKED | 2 |
   | T4: {제목} | ⏭️ SKIPPED (T3 의존) | - |

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
- → `/vs-commit`으로 변경사항 논리 단위 커밋
- → `/vs-dashboard`로 진행률 확인
- 블로커 발견 시 → `/vs-pick`으로 다른 태스크 선택
