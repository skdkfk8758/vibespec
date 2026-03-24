---
name: vs-merge
description: Use when merging a worktree branch into a target branch. Squash-merge로 워크트리 변경사항을 정리하고, 연구 기반의 고품질 커밋 메시지를 생성합니다.
invocation: user
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

         c. **`AskUserQuestion`으로 선택지 제시**:
            - header: "충돌 #{N}: {파일명} (line {start}-{end})"
            - 선택지:
              - label: "ours (타겟)", description: "{ours 의미 요약} — {타겟 브랜치} 쪽 코드를 유지합니다"
              - label: "theirs (워크트리)", description: "{theirs 의미 요약} — 워크트리에서 작업한 코드를 유지합니다"
              - label: "양쪽 모두 (ours 먼저)", description: "ours 코드 다음에 theirs 코드를 이어붙입니다"
              - label: "양쪽 모두 (theirs 먼저)", description: "theirs 코드 다음에 ours 코드를 이어붙입니다"
              - label: "수동 편집", description: "직접 내용을 지정합니다"

         d. **선택에 따른 처리**:
            - **ours/theirs** (파일에 충돌이 1개일 때): `git -C <original-repo> checkout --ours <file>` 또는 `--theirs <file>` 실행
            - **ours/theirs** (파일에 충돌이 2개 이상일 때): `Edit`으로 해당 충돌 영역의 마커를 제거하고 선택된 쪽 내용만 남깁니다
            - **양쪽 모두**: `Edit`으로 충돌 마커를 제거하고 선택된 순서로 양쪽 내용을 이어붙입니다
            - **수동 편집**: 사용자에게 원하는 내용을 물어보고 `Edit`으로 충돌 마커를 제거하며 반영

      4. **모든 hunk 해결 후 파일 staging**: `git -C <original-repo> add <file>`

      5. **파일 해결 완료 확인**: 해결된 파일 내용을 간략히 보여주고 다음 파일로 진행합니다

   c. **모든 충돌 해소 확인**:
      ```bash
      git -C <original-repo> diff --name-only --diff-filter=U
      ```
      남은 충돌이 없으면 Phase 4.5로 진행합니다.

4. 충돌 없이 성공하면 Phase 4.5로 진행합니다.

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

Verified: build ✅ test ✅ (N passed) lint ✅|⚠️|skip
Task: #T-<task_id>
Co-Authored-By: Claude <noreply@anthropic.com>
```

**규칙:**
- `<type>`: `feat`, `fix`, `refactor`, `docs`, `chore`, `test` 중 하나
- 여러 타입이 섞이면 지배적인 것을 사용
- 설명: 한글, 명령형, 마침표 없음, 72자 이내
- body: 한글, WHY에 집중
- Changes: 중요한 것부터, 관련 항목 그룹화
- `Verified:` 라인: Phase 4.5 결과를 항상 포함. 각 항목은 ✅(통과), ⚠️(경고), `skip`(미실행) 중 하나
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

### Phase 6: Verification

1. **커밋 확인**: `git -C <original-repo> log --oneline -3`으로 결과를 보여줍니다.

2. **사용자에게 보고**:
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
