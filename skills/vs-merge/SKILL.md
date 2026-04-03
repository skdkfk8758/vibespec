---
name: vs-merge
description: [Env] Squash-merge worktree branch into target.
invocation: deferred
argument-hint: "[target-branch]"
---

# Merge Worktree

워크트리 브랜치를 타겟 브랜치에 squash-merge하고, 변경사항을 깊이 분석하여 구조화된 커밋 메시지를 생성합니다.

## Current Context

- Git dir: `!git rev-parse --git-dir`
- Current branch: `!git branch --show-current`
- Recent commits: `!git log --oneline -20`
- Working tree status: `!git status --short`

## Steps

### Phase 1: Validation

1. **워크트리 확인**: `git rev-parse --git-dir`의 결과에 `/worktrees/`가 포함되어야 합니다. 포함되지 않으면 **즉시 중단**:
   > "이 스킬은 git worktree 내에서만 실행할 수 있습니다. `/worktree`로 워크트리를 먼저 생성하세요."

2. **현재 브랜치 식별**: `git branch --show-current`로 워크트리 브랜치명을 가져옵니다.

3. **타겟 브랜치 결정**:
   - `$ARGUMENTS`가 있으면 해당 값을 타겟으로 사용
   - 없으면 사용자에게 `AskUserQuestion`으로 타겟 브랜치를 물어봅니다:
     - header: "머지 타겟 브랜치 선택"
     - `git branch --list`로 로컬 브랜치 목록을 가져와 현재 워크트리 브랜치를 제외한 브랜치들을 선택지로 제시합니다
     - `main` 또는 `master`가 있으면 해당 브랜치를 기본값(첫 번째 선택지)으로 표시합니다
     - "직접 입력" 선택지도 포함하여 목록에 없는 리모트 브랜치도 지정할 수 있게 합니다

4. **원본 레포 경로 해석**: `git rev-parse --git-common-dir`로 메인 레포의 .git 경로를 찾고, 그 부모 디렉토리가 원본 레포 작업 디렉토리입니다.

5. **클린 확인**: `git status --porcelain`으로 미커밋 변경사항 체크. 있으면 **중단**하고 커밋 또는 stash를 먼저 하라고 안내합니다.

### Phase 1.5: Pre-merge QA 게이트

머지 전에 QA 실행 여부를 확인합니다.

1. 워크트리와 연결된 플랜을 확인하세요 (`vs --json plan list --status active`에서 `worktree_name`이 현재 워크트리와 일치하는 플랜)
2. 플랜이 있으면 `vs --json qa config resolve <plan_id>`로 `auto_trigger` 설정을 조회하세요
3. `auto_trigger.enabled`가 `false`이면 이 단계를 스킵하세요
4. `vs --json qa run list --plan <plan_id>`로 최근 completed QA Run을 확인하세요:
   - **QA Run이 없으면**: QA 제안
   - **QA Run이 있지만 risk_score ≥ 0.5이면**: 재실행 제안
   - **QA Run이 있고 risk_score < 0.5이면**: 스킵
5. QA 제안 시 `AskUserQuestion`으로 안내하세요:
   - question: "머지 전 QA를 실행하시겠습니까? {QA Run 없으면: 'QA가 한 번도 실행되지 않았습니다.' / risk_score 높으면: '최근 QA risk score가 {score}로 높습니다.'}"
   - header: "Pre-merge QA"
   - multiSelect: false
   - 선택지:
     - label: "QA 실행 (권장)", description: "머지 전 incremental QA를 실행합니다"
     - label: "머지 진행", description: "QA 없이 머지를 계속합니다"
6. "QA 실행" → `/vs-qa` 실행 후 머지 플로우로 복귀
7. "머지 진행" → Phase 2로 진행 (강제 차단하지 않음)

### Phase 2: Research

이 단계가 가장 중요합니다. 커밋 메시지 품질을 위해 변경사항을 깊이 이해해야 합니다.

1. **커밋 히스토리**: `git log --oneline <target>..HEAD`로 워크트리의 모든 커밋을 확인합니다.

2. **변경 파일 요약**: `git diff <target>...HEAD --stat`으로 변경 파일과 규모를 파악합니다.

3. **전체 diff**: `git diff <target>...HEAD`로 전체 diff를 읽습니다. 주의 깊게 분석하세요.

4. **핵심 파일 읽기**: 가장 큰 변경이 있는 파일, 새로 생성된 파일, 삭제된 파일은 Read 도구로 전체 컨텍스트를 파악합니다.

5. **변경 분류**: 모든 변경을 카테고리로 분류합니다:
   - Features (새 기능)
   - Fixes (버그 수정)
   - Refactors (동작 변경 없는 구조 개선)
   - Tests (테스트 추가/수정)
   - Docs (문서)
   - Config/Chore (빌드, CI, 도구, 의존성)

6. **지배적 타입 결정**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test` 중 전체 작업을 가장 잘 대표하는 타입을 결정합니다.

7. **머지 리포트 데이터 수집** (Phase 6에서 사용):

   이 단계에서 수집한 정보를 아래 구조로 메모리에 유지하세요. Phase 6 리포트 생성에서 사용합니다.

   a. **changes_summary**: 파일별 변경 카테고리와 설명을 수집하세요:
      ```json
      [{"file": "src/models/user.ts", "category": "feat", "description": "사용자 인증 필드 추가"}]
      ```

   b. **ai_judgments**: 구현 과정에서 AI가 추론/추측한 부분을 기록하세요:
      - `inference` (기존 패턴에서 추론한 코드) — confidence: high
      - `guess` (도메인 지식이 필요한 추측) — confidence: low
      - `pattern_based` (기계적 변환, import 경로 등) — confidence: high
      ```json
      [{"file": "src/api/auth.ts", "line": "45", "type": "guess", "description": "세션 만료 시간을 30분으로 설정 — 요구사항에 명시 없어 추측", "confidence": "low"}]
      ```

   c. **테스트 커버리지 갭**: 변경된 소스 파일 중 대응하는 테스트 파일이 없는 파일을 식별하세요. 파일명 패턴으로 매칭합니다:
      - `src/foo.ts` → `src/__tests__/foo.test.ts`, `tests/foo.test.ts`, `src/foo.test.ts`, `src/foo.spec.ts`

### Phase 3: Target Preparation

1. **원본 레포 경로**를 Phase 1 step 4에서 가져옵니다.

2. **타겟 브랜치 상태 확인**: `git -C <original-repo> log --oneline -10 <target>`으로 최근 커밋을 확인합니다.

3. **WIP 커밋 탐지**: 타겟 브랜치에 `wip:`, `WIP`, `auto-commit` 패턴의 커밋이 있으면 사용자에게 경고하고, 마지막 클린 커밋으로 reset할지 확인합니다.

4. **Fetch** (리모트 있는 경우): `git -C <original-repo> fetch origin <target> 2>/dev/null`으로 최신 상태를 가져옵니다. 리모트가 없어도 실패하지 않습니다.

5. **Divergence 감지**: 워크트리가 타겟의 최신 상태를 포함하는지 확인합니다:
   ```bash
   merge_base=$(git -C <original-repo> merge-base <target> <worktree-branch>)
   target_head=$(git -C <original-repo> rev-parse <target>)
   ```
   - `merge_base == target_head` → 안전, 계속 진행
   - `merge_base != target_head` → 타겟에 워크트리 생성 이후 새 커밋이 존재합니다. 사용자에게 경고:
     > "⚠️ 타겟 브랜치에 워크트리 분기 이후 새로운 커밋이 있습니다. 통합 충돌 가능성이 있으므로 워크트리에서 rebase 후 테스트를 먼저 실행하는 것을 권장합니다. 계속 진행하시겠습니까? (Phase 4.5에서 통합 검증이 실행됩니다)"
   - 사용자가 중단을 선택하면 머지를 진행하지 않습니다

6. **충돌 사전 분석 (Dry-Run)**

   머지를 실행하기 전에 예상 충돌을 미리 파악합니다:

   ```bash
   git -C <original-repo> merge-tree $(git -C <original-repo> merge-base <target> <worktree-branch>) <target> <worktree-branch>
   ```

   - 출력에서 `CONFLICT` 패턴을 파싱하여 충돌 파일과 영역 수를 집계하세요
   - `merge-tree` 명령이 실패하면 (구 Git 버전) **SKIP** 처리하고 기존 방식대로 진행하세요
   - 충돌 0개 → "충돌 없음 — 안전하게 머지 진행합니다" 메시지 출력 후 Phase 4로 직행

   **충돌이 있으면** 아래 **충돌 맵 개요**를 생성하여 표시하세요:

   ```
   ## 충돌 사전 분석

   예상 충돌: {N}개 파일, {M}개 영역

   | 파일 | 충돌 영역 | 관련 모듈 |
   |------|----------|-----------|
   | src/core/types.ts | 1 hunk | 타입 정의 |
   | src/core/models/plan.ts | 3 hunks | PlanModel |
   | src/cli/index.ts | 2 hunks | CLI 명령 |

   ### 의존관계 기반 추천 해결 순서
   1. src/core/types.ts (다른 파일이 import)
   2. src/core/models/plan.ts (types에 의존, cli가 import)
   3. src/cli/index.ts (plan에 의존)
   ```

   의존관계 분석 방법:
   - 충돌 파일들 간의 `import`/`require` 관계를 파싱하세요
   - import되는 쪽(하위 모듈)을 먼저 해결하도록 순서를 추천하세요
   - 순환 import가 있으면 경고하고 사용자에게 순서를 선택받으세요

   **체크포인트**: `AskUserQuestion`으로 진행 여부를 확인하세요:
   - question: "충돌 {N}개가 예상됩니다. 어떻게 진행할까요?"
   - header: "충돌 사전 분석"
   - 선택지:
     - label: "추천 순서로 머지 진행", description: "위 순서대로 충돌을 해결하며 머지합니다"
     - label: "워크트리에서 rebase 먼저", description: "머지를 중단하고 워크트리에서 rebase 후 재시도합니다"
     - label: "그대로 머지 진행", description: "순서 추천 없이 기존 방식대로 진행합니다"

### Phase 4: Squash Merge

1. **타겟 브랜치 체크아웃**:
   ```bash
   git -C <original-repo> checkout <target>
   ```

2. **Squash merge 실행**:
   ```bash
   git -C <original-repo> merge --squash <worktree-branch>
   ```

3. **충돌 처리**: 충돌이 발생하면 **사용자를 인터뷰하며 함께 해결**합니다:

   **절대 자동 해결을 시도하지 마세요.** 모든 충돌은 사용자의 명시적 선택을 받아야 합니다.

   a. **충돌 파일 목록 표시**:
      ```bash
      git -C <original-repo> diff --name-only --diff-filter=U
      ```
      충돌 파일 수와 목록을 보여줍니다.

   b. **충돌 규모에 따른 처리 방식 분기:**

      충돌 파일이 **5개 미만**이면 → 아래 **파일별 인터뷰**를 진행합니다.

      충돌 파일이 **5개 이상**이면 → `AskUserQuestion`으로 처리 방식을 선택받습니다:
      - header: "충돌 파일 {N}개 — 처리 방식 선택"
      - 선택지:
        - label: "카테고리별 일괄 처리", description: "소스/테스트/설정 파일을 그룹으로 나눠 한 번에 처리합니다"
        - label: "파일별 개별 처리", description: "각 파일을 하나씩 인터뷰하며 해결합니다"

      **카테고리별 일괄 처리** 선택 시:
      1. 충돌 파일을 카테고리로 분류합니다:
         - **소스**: `src/`, `lib/`, `app/` 등 메인 코드
         - **테스트**: `test/`, `tests/`, `__tests__/`, `*_test.*`, `*.spec.*`, `*.test.*`
         - **설정**: `*.config.*`, `*.json`, `*.yaml`, `*.yml`, `*.toml`, `.env*`, `Makefile`, `Dockerfile` 등
      2. 카테고리별로 파일 목록과 충돌 요약을 보여줍니다
      3. `AskUserQuestion`으로 카테고리 단위 선택을 받습니다:
         - header: "{카테고리}: {N}개 파일 충돌"
         - 선택지:
           - label: "모두 ours (타겟)", description: "이 카테고리의 모든 파일을 {타겟 브랜치} 쪽으로 해결합니다"
           - label: "모두 theirs (워크트리)", description: "이 카테고리의 모든 파일을 워크트리 쪽으로 해결합니다"
           - label: "개별 처리", description: "이 카테고리의 파일을 하나씩 인터뷰합니다"
      4. "개별 처리" 선택 시 해당 카테고리만 아래 파일별 인터뷰로 전환합니다

      **파일별 인터뷰** — 각 충돌 파일에 대해 순서대로:

      1. **충돌 파일 분석**:
         - 충돌 파일의 전체 내용을 `Read`로 읽어 모든 충돌 마커(`<<<<<<<`, `=======`, `>>>>>>>`)를 찾습니다
         - 충돌 영역(hunk) 수를 카운트합니다

      2. **파일 개요 표시**: 인터뷰 시작 전에 파일 컨텍스트를 보여줍니다:
         ```
         📄 {파일명} — 충돌 영역 {N}개
         ```
         - 해당 파일이 속한 모듈/컴포넌트 설명 (파일 경로와 imports 기반으로 추론)
         - 충돌 원인 커밋 조회:
           ```bash
           # ours 쪽 (타겟 브랜치에서 이 파일을 마지막으로 변경한 커밋)
           git -C <original-repo> log --oneline -1 <target> -- <file>
           # theirs 쪽 (워크트리 브랜치에서 이 파일을 마지막으로 변경한 커밋)
           git -C <original-repo> log --oneline -1 <worktree-branch> -- <file>
           ```
         - 표시 형식:
           ```
           ours 마지막 변경: <commit-hash> <message> (타겟: {target})
           theirs 마지막 변경: <commit-hash> <message> (워크트리: {branch})
           ```

      3. **충돌 영역(hunk) 단위 인터뷰** — 파일에 충돌 영역이 **1개**이면 파일 단위로 처리하고, **2개 이상**이면 각 영역을 개별적으로 인터뷰합니다:

         각 충돌 영역에 대해:

         a. **3-way diff 표시** — base(공통 조상), ours, theirs를 모두 보여줍니다:
            - base 내용 조회:
              ```bash
              git -C <original-repo> show :1:<file>
              ```
              (`:1:`은 merge base 버전, `:2:`는 ours, `:3:`은 theirs)
            - 표시 형식:
              ```
              ── 충돌 #{N} (line {start}-{end}) ──

              ◆ BASE (공통 조상):
              {base 내용 — 양쪽이 분기하기 전 원본}

              ◆ OURS (타겟: {target}):
              {ours 내용}

              ◆ THEIRS (워크트리: {branch}):
              {theirs 내용}
              ```

         b. **의미 요약** — 각 side가 무엇을 하려는 것인지 1문장으로 설명합니다:
            ```
            💡 분석:
            - ours: {타겟에서 이 영역을 어떻게 변경했는지 — 예: "함수 시그니처에 옵션 파라미터 추가"}
            - theirs: {워크트리에서 이 영역을 어떻게 변경했는지 — 예: "반환 타입을 Promise로 변경하고 async 추가"}
            - 충돌 원인: {양쪽이 왜 충돌하는지 — 예: "같은 함수 선언부를 양쪽에서 다르게 수정"}
            ```

         c. **AI 추천 병합 코드 생성**:
            - base, ours, theirs 코드를 모두 분석하세요
            - **양쪽의 의도를 모두 살린 통합 코드**를 생성하세요:
              - ours의 변경 의도 (예: 파라미터 추가)와 theirs의 변경 의도 (예: 반환 타입 변경)를 모두 반영
              - 단순 concatenation이 아니라, 구문적으로 올바르고 의미적으로 양쪽을 통합한 코드
            - 통합이 불가능한 경우 (양쪽이 동일 로직을 완전히 다르게 재작성) → AI 추천을 건너뛰고 "이 충돌은 AI 병합이 어렵습니다. 수동 선택을 권장합니다." 메시지 표시

         d. **`AskUserQuestion`으로 선택지 제시**:
            - header: "충돌 #{N}: {파일명} (line {start}-{end})"
            - 선택지:
              - label: "AI 추천 (병합)", description: "양쪽 의도를 통합한 코드를 적용합니다", preview: "{생성된 통합 코드}"
              - label: "ours (타겟)", description: "{ours 의미 요약} — {타겟 브랜치} 쪽 코드를 유지합니다"
              - label: "theirs (워크트리)", description: "{theirs 의미 요약} — 워크트리에서 작업한 코드를 유지합니다"
              - label: "수동 편집", description: "직접 내용을 지정합니다"
            - AI 추천 생성에 실패한 경우 "AI 추천 (병합)" 선택지를 제외하세요

         e. **선택에 따른 처리**:
            - **AI 추천**: `Edit`으로 충돌 마커 영역 전체를 생성된 통합 코드로 교체합니다
            - **ours/theirs** (파일에 충돌이 1개일 때): `git -C <original-repo> checkout --ours <file>` 또는 `--theirs <file>` 실행
            - **ours/theirs** (파일에 충돌이 2개 이상일 때): `Edit`으로 해당 충돌 영역의 마커를 제거하고 선택된 쪽 내용만 남깁니다
            - **수동 편집**: 사용자에게 원하는 내용을 물어보고 `Edit`으로 충돌 마커를 제거하며 반영

      4. **모든 hunk 해결 후 파일 구문 검증**:
         - `git -C <original-repo> add <file>`로 staging
         - **TypeScript 파일**인 경우 (`.ts`, `.tsx`):
           ```bash
           npx tsc --noEmit --pretty <file> 2>&1
           ```
           - 에러가 있으면:
             ```
             ⚠️ 구문 검증 실패: {file}
             {에러 메시지}
             ```
             → `AskUserQuestion`으로 대응 선택:
               - label: "해당 hunk 재수정", description: "에러가 발생한 영역을 다시 인터뷰합니다"
               - label: "무시하고 계속", description: "구문 에러를 무시하고 다음 파일로 진행합니다"
             → "재수정" 선택 시: `git -C <original-repo> checkout -m <file>`로 충돌 상태 복원 후 해당 파일의 Step 3부터 재시작
           - 에러가 없으면: "✅ 구문 검증 통과" 표시
         - **비 TypeScript 파일**: 구문 검증을 건너뛰세요

      5. **파일 해결 완료 확인**: 해결된 파일 내용을 간략히 보여주고 다음 파일로 진행합니다

   c. **모든 충돌 해소 확인**:
      ```bash
      git -C <original-repo> diff --name-only --diff-filter=U
      ```
      남은 충돌이 없으면 Phase 4.5로 진행합니다.

4. 충돌 없이 성공하면 Phase 4.5로 진행합니다.

5. **충돌 해결 기록 수집** (머지 리포트용):

   충돌이 있었다면, 각 충돌 파일의 해결 기록을 아래 구조로 메모리에 유지하세요:
   ```json
   [{"file": "src/api/auth.ts", "hunks": 3, "resolution": "ai_merge", "choice_reason": "양쪽 의도를 모두 반영 — ours의 파라미터 추가 + theirs의 async 변환", "discarded_intent": null}]
   ```
   - `resolution`: `ours`, `theirs`, `ai_merge`, `manual` 중 하나
   - AI 병합을 선택한 경우 `choice_reason`에 통합 근거를 기록하세요
   - `discarded_intent`: 선택되지 않은 쪽의 의도를 1줄로 요약하세요
     - `ours` 선택 시: "버려진 theirs 의도: {theirs가 하려던 변경 1줄 요약}"
     - `theirs` 선택 시: "버려진 ours 의도: {ours가 하려던 변경 1줄 요약}"
     - `ai_merge` 선택 시: 양쪽 의도를 모두 기록 — "ours 의도: {요약} / theirs 의도: {요약}"
     - `manual` 선택 시: 해당하는 경우에만 기록 (선택사항)

### Phase 4.5: Integration Gate

squash merge 후, 커밋 전에 통합 검증을 수행합니다. **이 단계를 통과해야만 커밋이 진행됩니다.**

1. **기술 스택 감지**: `<original-repo>`에서 `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod` 등의 존재를 확인하여 빌드/테스트 명령을 결정합니다.

2. **의존성 설치** (lock 파일이 변경된 경우에만):
   ```bash
   # git diff --name-only HEAD에서 lock 파일 변경 감지
   # package-lock.json → npm ci
   # yarn.lock → yarn install --frozen-lockfile
   # pnpm-lock.yaml → pnpm install --frozen-lockfile
   # Cargo.lock → cargo build
   # 등등
   ```
   lock 파일 미변경 시 이 단계를 스킵합니다.

3. **빌드 검증**:
   ```bash
   # 원본 레포에서 실행
   cd <original-repo> && npm run build  # 또는 감지된 빌드 명령
   ```
   - **PASS** → 다음 단계
   - **FAIL** → 롤백 후 중단 (아래 롤백 절차 참조)

4. **테스트 검증**:
   ```bash
   cd <original-repo> && npm test  # 또는 감지된 테스트 명령
   ```
   - **PASS** → 다음 단계
   - **FAIL** → 롤백 후 중단

5. **Lint** (선택적 — `lint` 스크립트가 존재할 때만):
   ```bash
   cd <original-repo> && npm run lint
   ```
   - **PASS** → 계속
   - **FAIL** → ⚠️ 경고만 표시, 블로킹하지 않음

6. **결과 기록**: 검증 결과를 변수에 저장합니다 (Phase 5 커밋 메시지에 사용):
   - `build: PASS/FAIL`
   - `test: PASS (N passed, M failed) / FAIL`
   - `lint: PASS/FAIL/SKIP`

#### 롤백 절차 (빌드 또는 테스트 실패 시)

squash merge는 아직 커밋되지 않은 staged 상태이므로 안전하게 되돌릴 수 있습니다:

```bash
git -C <original-repo> reset --hard HEAD
```

롤백 후 사용자에게 리포트합니다:

> **❌ Integration Gate FAIL**
>
> - 실패 단계: build / test
> - 에러 출력: (실패 로그의 핵심 부분)
>
> **권장 조치:**
> 1. 워크트리로 돌아가서 `git rebase <target>` 실행
> 2. 충돌 또는 호환성 문제 수정
> 3. 빌드/테스트 통과 확인 후 `/vs-merge` 재실행

### Phase 4.7: Post-Merge Acceptance (선택적)

Integration Gate를 통과한 후, 커밋 전에 **실제 동작 검증**을 수행합니다.
squash merge는 아직 커밋되지 않은 staged 상태이므로, 실패 시 Phase 4.5와 동일하게 롤백 가능합니다.

**체크포인트**: `AskUserQuestion`으로 검증 여부를 확인하세요:
- question: "빌드/테스트가 통과했습니다. 실제 동작 검증을 실행할까요?"
- header: "Acceptance Testing"
- 선택지:
  - label: "vs-acceptance 실행 (권장)", description: "browser-control + 코드 분석으로 실제 기능 동작을 검증합니다"
  - label: "건너뛰고 커밋", description: "빌드/테스트 통과로 충분하다고 판단하고 커밋합니다"

**"vs-acceptance 실행" 선택 시:**

1. `/vs-acceptance` 스킬을 실행하세요
   - plan_id: 활성 플랜이 있으면 해당 ID 전달
   - scope: 이번 머지에서 변경된 파일 목록 전달

2. **결과 처리:**
   - **PASS** → Phase 5 커밋으로 진행. `acceptance: PASS` 결과를 기록하세요
   - **WARN** → Phase 5 커밋으로 진행. `acceptance: WARN` 결과를 기록하세요
   - **FAIL** → 롤백 절차를 실행하세요:
     ```bash
     git -C <original-repo> reset --hard HEAD
     ```
     사용자에게 실패 리포트를 보여주고 원인 수정을 안내하세요

3. **결과 기록**: Phase 4.5의 결과 변수에 추가:
   - `acceptance: PASS/WARN/FAIL/SKIP`

**"건너뛰고 커밋" 선택 시:**
- `acceptance: SKIP` 기록 후 Phase 5로 진행

### Phase 5: Commit

#### VibeSpec 태스크 컨텍스트 조회

Bash 도구로 `vs plan list --json --status active`를 실행하여 활성 플랜을 확인하고, in_progress 태스크가 있으면 커밋 메시지에 포함합니다.

#### 커밋 메시지 작성

Phase 2의 연구 결과를 바탕으로, 아래 **정확한 구조**로 커밋 메시지를 작성합니다:

```
<type>(<scope>): <한글 설명, 명령형, 72자 이내, 마침표 없음>

<2-4문장으로 무엇을 왜 했는지 설명. 동기와 접근 방식에 집중,
구현 세부사항이 아닌 WHY를 설명합니다.>

Changes:
- <변경사항 그룹별 불릿 포인트>
- <관련 항목은 서브 불릿으로>

Verified: build ✅ test ✅ (N passed) lint ✅|⚠️|skip acceptance ✅|⚠️|skip
Task: #T-<task_id>
Co-Authored-By: Claude <noreply@anthropic.com>
```

**규칙:**
- `<type>`: `feat`, `fix`, `refactor`, `docs`, `chore`, `test` 중 하나
- 여러 타입이 섞이면 지배적인 것을 사용
- 설명: 한글, 명령형, 마침표 없음, 72자 이내
- body: 한글, WHY에 집중
- Changes: 중요한 것부터, 관련 항목 그룹화
- `Verified:` 라인: Phase 4.5 + Phase 4.7 결과를 항상 포함. 각 항목은 ✅(통과), ⚠️(경고), `skip`(미실행) 중 하나
- `Task:` 라인: in_progress 태스크가 있을 때만 포함
- `Co-Authored-By`: 항상 포함

#### 커밋 메시지 사용자 확인

커밋 전에 생성된 메시지를 사용자에게 보여주고 `AskUserQuestion`으로 승인을 받으세요:
- header: "커밋 메시지 확인"
- 생성된 커밋 메시지 전문을 보여준 뒤 선택지를 제시합니다:
  - label: "승인", description: "이 메시지로 커밋합니다"
  - label: "수정", description: "커밋 메시지를 직접 수정합니다"
  - label: "재생성", description: "다른 관점으로 커밋 메시지를 다시 작성합니다"
- "수정" 선택 시: 사용자가 입력한 내용으로 커밋 메시지를 교체합니다
- "재생성" 선택 시: Phase 2 연구 결과를 바탕으로 다른 스코프나 설명으로 재작성하고 다시 확인을 받습니다

#### 커밋 실행

```bash
git -C <original-repo> commit -m "$(cat <<'EOF'
<커밋 메시지>
EOF
)"
```

### Phase 6: Verification & Merge Report

1. **커밋 확인**: `git -C <original-repo> log --oneline -3`으로 결과를 보여줍니다.

2. **머지 리포트 자동 생성**:

   Phase 2~5에서 수집한 데이터를 사용하여 머지 리포트를 생성합니다.
   **이 단계의 실패는 머지 결과에 영향을 주지 않습니다.** 리포트 생성이 실패하면 경고만 표시하고 Step 3으로 진행하세요.

   a. **Review Checklist 생성**:
      Phase 2에서 수집한 `ai_judgments`와 `conflict_log`를 바탕으로 review_checklist를 생성하세요:
      - 🔴 `must` (반드시 확인):
        - AI 병합(`ai_merge`)으로 해결된 충돌 부분
        - `confidence: low`인 AI 판단 (추측이 포함된 코드)
        - 비즈니스 로직을 변경한 파일 중 테스트가 없는 경우
      - 🟡 `should` (가능하면 확인):
        - 테스트 파일이 없는 변경된 소스 파일 (Phase 2 step 7c에서 식별)
        - `confidence: medium`인 AI 판단
        - 충돌 해결에서 `ours` 또는 `theirs`를 선택했지만 다른 쪽의 의도도 유효한 경우 — `discarded_intent`를 함께 표시하세요
      - 🟢 `info` (참고):
        - `confidence: high`인 기계적 변환
        - 빌드/테스트가 통과한 항목
        - 문서나 설정 파일 변경

   b. **마크다운 리포트 파일 생성**:
      `.claude/reports/` 디렉토리가 없으면 먼저 생성하세요.
      `Write` 도구로 `.claude/reports/merge-{YYYY-MM-DD}-{source-branch}.md` 파일을 생성하세요:

      ```markdown
      # Merge Report: {source-branch} → {target-branch}
      > {날짜} | Commit: {commit-hash}
      > Plan: {plan-id} (있을 때만)

      ## 변경 요약
      {changes_summary를 카테고리별로 그룹화하여 불릿 리스트}

      ## ⚡ Review Checklist
      {review_checklist를 level별로 그룹화}
      ### 🔴 반드시 확인
      - [ ] {file}:{line} — {description}
        └ {reason}
      ### 🟡 가능하면 확인
      - [ ] ...
      ### 🟢 참고
      - ...

      ## 충돌 해결 기록
      {conflict_log가 있을 때만 — 파일별 hunk 수, 선택, 근거, 버려진 코드 의도}
      - 🟡 {file} — {resolution} 선택, {discarded_intent} (있을 때만)

      ## AI 판단 로그
      {ai_judgments가 있을 때만 — confidence별로 그룹화}

      ## 검증 결과
      - Build: {결과}
      - Test: {결과} ({passed} passed, {failed} failed)
      - Lint: {결과}
      - Acceptance: {결과}

      ## 관련 태스크
      {task_ids가 있을 때만}

      ## 메타
      - Report: {report_path}
      - Generated: {날짜시간}
      ```

   c. **DB에 리포트 저장**:
      Bash 도구로 아래 명령을 실행하세요:
      ```bash
      vs merge-report create \
        --commit "{커밋 해시}" \
        --source "{소스 브랜치}" \
        --target "{타겟 브랜치}" \
        --changes '{changes_summary JSON}' \
        --checklist '{review_checklist JSON}' \
        --verification '{verification JSON}' \
        --report-path "{MD 파일 경로}" \
        --plan-id "{플랜 ID}" \
        --conflict-log '{conflict_log JSON}' \
        --ai-judgments '{ai_judgments JSON}' \
        --task-ids '{task_ids JSON}'
      ```
      - plan-id, conflict-log, ai-judgments, task-ids는 해당 데이터가 있을 때만 포함하세요
      - JSON 값에 작은따옴표가 포함되면 적절히 이스케이프하세요

   d. **리포트 생성 결과 표시**:
      ```
      📋 머지 리포트 생성 완료
      - 파일: {report_path}
      - Review Checklist: 🔴{must_count} 🟡{should_count} 🟢{info_count}
      - /vs-recap으로 나중에 조회할 수 있습니다
      ```

3. **사용자에게 보고**:
   - 최종 커밋 해시
   - 커밋 요약 라인
   - 어떤 브랜치에 머지되었는지
   - 워크트리 정리 안내: `git worktree remove <path>`
   - push 안내: `git push`로 리모트에 반영

## Rules

- **force-push 또는 destructive git 명령을 절대 사용하지 않음** — 사용자 명시적 확인 없이
- **pre-commit hook을 건너뛰지 않음** (`--no-verify` 금지)
- **Integration Gate를 건너뛰지 않음** — 빌드 또는 테스트 실패 시 반드시 롤백하고 커밋하지 않음
- **롤백은 `git reset --hard HEAD`만 사용** — squash merge는 커밋 전이므로 이 명령으로 안전하게 복원됨
- **충돌을 절대 자동 해결하지 않음** — 모든 충돌은 파일별로 사용자 인터뷰를 거쳐야 함
- **충돌 해결 시 사용자의 명시적 선택(ours/theirs/수동편집) 없이 진행하지 않음**
- 어떤 단계에서든 예상치 못한 상황이 발생하면 **추측하지 말고 중단 후 설명**
- 커밋 메시지 품질이 최우선 — Phase 2에서 충분히 시간을 들여 변경사항을 이해하세요
