---
name: vs-resume
description: Use when resuming a previous session. 마지막 작업 내용을 불러오고 현재 상태를 조회한 뒤 다음 할 일을 제안합니다.
invocation: user
---

# Session Resume

새 세션을 시작할 때 이전 작업 컨텍스트를 복원합니다.

## Steps

1. **컨텍스트 복원**
   - Bash 도구로 `vs --json context resume` 명령을 실행하세요 (특정 세션을 복원하려면 `--session-id <id>` 옵션 추가)
   - 이 명령은 `context_logs`, `overview`, `alerts`를 한 번에 반환합니다. 추가 CLI 호출 없이 이 데이터를 Step 2~4에서 활용하세요

2. **Stash 복원 확인**
   - `git stash list`에서 `vibespec-session` 패턴의 stash를 검색하세요
   - 현재 브랜치를 `git rev-parse --abbrev-ref HEAD`로 확인하세요
   - 매칭되는 stash가 있으면:
     - stash 메시지 형식을 판별하여 파싱하세요:
       - **새 형식** (6필드): `vibespec-session:{branch}:{worktree_path}:{plan_id}:{task_id}:{timestamp}`
       - **기존 형식** (4필드): `vibespec-session:{plan_id}:{task_id}:{timestamp}` → branch를 "unknown"으로 표시
     - 새 형식에서 `worktree_path`가 있으면 해당 워크트리가 아직 존재하는지 확인하세요 (`test -d <worktree_path>`). 삭제된 워크트리의 stash는 별도 표시하세요
     - 아래 테이블 형태로 사용자에게 표시하세요:
       ```
       현재 브랜치: main
       이전 세션에서 보존된 변경사항:
       | # | Stash | Branch | Plan | Task | 저장 시각 | 일치 |
       |---|-------|--------|------|------|----------|------|
       | 1 | stash@{0} | main | K7NK... | gyGr... | 20260318-091500 | ✓ |
       | 2 | stash@{3} | unknown | A1B2... | none | 20260318-085000 | ? |
       ```
       - 일치 컬럼: ✓ (현재 브랜치와 동일), ✗ (다른 브랜치), ? (unknown/기존 형식)
     - **현재 브랜치와 일치하는 stash만 기본 복원 대상으로 표시하세요**
     - `AskUserQuestion`으로 복원 여부를 확인하세요:
       - question: "이전 세션의 변경사항이 있습니다. 어떻게 처리할까요?"
       - header: "Stash 복원"
       - multiSelect: false
       - 선택지:
         - label: "복원", description: "변경사항을 현재 브랜치에 적용합니다"
         - label: "건너뛰기", description: "stash를 유지한 채 다음 단계로 진행합니다"
         - label: "삭제", description: "해당 stash를 제거합니다"
     - **복원** → `git stash apply stash@{N}` 실행 (pop이 아닌 apply로 안전하게)
       - 성공하면 `git stash drop stash@{N}`으로 정리
       - 충돌 시 아래 단계를 따르세요:
         1. `git diff --name-only --diff-filter=U`로 충돌 파일 목록을 확인하세요
         2. 각 충돌 파일을 열어 `<<<<<<<`, `=======`, `>>>>>>>` 마커를 찾아 수동으로 해결하세요
         3. 해결된 파일을 `git add <파일>`으로 스테이징하세요
         4. 모든 충돌이 해결되면 `git stash drop stash@{N}`으로 사용한 stash를 정리하세요
         5. 충돌 해결이 어려우면 `git checkout --conflict=merge -- <파일>`로 충돌 상태를 재생성하거나, `git restore --staged --worktree -- <파일>`로 stash 적용 전 상태로 되돌릴 수 있습니다
     - **브랜치 불일치 경고**: 사용자가 ✗ 표시된 stash를 복원하려 하면 경고하세요:
       "이 stash는 '{branch}' 브랜치에서 생성되었습니다. 현재 브랜치({current})에 적용하면 다른 브랜치의 코드가 섞일 수 있습니다. 계속하시겠습니까?"
     - 여러 개면 최신 것부터 표시하고, 사용자가 개별 선택
   - 매칭되는 stash가 없으면 조용히 다음 단계로 진행하세요

3. **이전 세션 요약 및 현재 상태**

   Step 1에서 받은 데이터를 활용하여 한 번에 표시하세요:

   **이전 세션 요약** (`context_logs` 기반):
   - 최근 컨텍스트 로그를 기반으로 이전에 무엇을 했는지 요약하세요
   - 미완료 작업이나 차단된 항목을 강조하세요

   **현재 상태** (`overview`, `alerts` 기반):
   - 활성 플랜 진행률을 보여주세요
   - 주의가 필요한 알림을 표시하세요
   - 아래 추가 신호도 감지하여 알림에 포함하세요:
     - **타임아웃 경고**: 마지막 컨텍스트 저장으로부터 3일 이상 경과한 세션이 있으면 "장기 미활동 세션" 경고를 표시하세요. 해당 세션의 태스크가 여전히 in_progress 상태인지 확인하고, 계속할지 정리할지 사용자에게 물어보세요.
     - **의존성 변경 감지**: `git diff HEAD~1 --name-only`에서 lock 파일(`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) 변경이 감지되면 "의존성이 변경되었습니다. `npm ci` 등으로 의존성을 동기화하세요." 경고를 표시하세요.

4. **다음 할 일 제안**

   `AskUserQuestion`으로 현재 상황에 맞는 액션을 제안하세요:
   - question: "다음으로 무엇을 하시겠습니까?"
   - header: "세션 재개"
   - multiSelect: false
   - 선택지는 현재 상황에 맞게 구성하세요:

   | 우선순위 | 상황 | 제안 액션 |
   |---------|------|----------|
   | 1 | completable 플랜 있음 | "플랜 완료 처리" — 모든 태스크가 done인 플랜을 완료합니다 |
   | 2 | blocked 태스크 있음 | "차단 태스크 해소" — blocked 태스크를 확인하고 해결합니다 |
   | 3 | stale 태스크 있음 | "정체 태스크 리뷰" — 오래 진행 중인 태스크를 점검합니다 |
   | 4 | forgotten 플랜 있음 | "방치된 플랜 정리" — 아카이브하거나 작업을 재개합니다 |
   | 5 | in_progress 태스크 있음 | "진행 중 태스크 이어서 작업" — 현재 작업 중인 태스크를 계속합니다 |
   | 6 | 활성 플랜 없음 | "새 플랜 생성" — `/vs-plan`으로 새 작업을 시작합니다 |
   | 7 | 그 외 | "다음 태스크 시작" — `/vs-next`로 다음 태스크를 가져옵니다 |

   해당하는 상황이 여러 개면 우선순위가 높은 것부터 선택지로 제시하세요.

5. **세션 시작 기록**
   - 활성 플랜이 있으면 `--plan-id`를 포함하여 기록하세요:
     ```
     vs --json context save --summary "새 세션 시작" --plan-id <active_plan_id>
     ```
   - 활성 플랜이 없으면:
     ```
     vs --json context save --summary "새 세션 시작"
     ```
   - stash 복원을 수행했다면 summary에 복원 내역도 포함하세요

## 다음 단계

- in_progress 태스크 있을 시 → 이어서 작업 진행
- → `/vs-next`로 다음 태스크 시작
- → `/vs-pick`으로 특정 태스크 선택하여 시작
- → `/vs-exec`로 전체 태스크 일괄 실행
- → `/vs-worktree`로 격리된 환경에서 작업 시작
- → `/vs-dashboard`로 전체 현황 파악
- stale 알림 시 → `/vs-review`로 스펙 점검
