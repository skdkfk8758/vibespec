---
name: vs-commit
description: [Core] Commit changes with task tracing. (커밋)
invocation: user
---

# VibeSpec Commit

변경사항을 분석하여 논리 단위로 그룹화하고, 한글 커밋 메시지로 커밋합니다.
현재 in_progress 태스크가 있으면 커밋 메시지에 태스크 ID를 자동 포함합니다.

## Input Resolution

1. **`all`** — 모든 변경사항을 논리 단위로 분석 후 다중 커밋
2. **파일/디렉토리 패턴** — 해당 범위만 분석 후 커밋
3. **인자 없음** — `git status`로 전체 변경사항 확인 후 `all`과 동일하게 진행

## Process

### Phase 0: 코드 정리 (선택적 게이트)

커밋 전에 코드 품질을 높이기 위한 선택적 단계입니다.

**체크포인트**: `AskUserQuestion`으로 코드 정리 여부를 확인하세요:
- question: "커밋 전에 코드 정리를 실행할까요?"
- header: "코드 정리"
- multiSelect: false
- 선택지:
  - label: "simplify-loop 실행", description: "3개 리뷰 에이전트(재사용/품질/효율)가 코드를 검토하고 개선점 0까지 반복합니다"
  - label: "건너뛰고 바로 커밋", description: "코드 정리 없이 커밋을 진행합니다"

- "simplify-loop 실행" → `/simplify-loop`을 실행하세요. 완료 후 Phase 1로 진행합니다.
- "건너뛰고 바로 커밋" → Phase 1로 바로 진행합니다.

### Phase 1: 변경사항 수집

```bash
git status -s
git diff --stat
git diff --cached --stat
```

- staged 파일과 unstaged 파일을 구분하여 표시
- 변경사항이 없으면 STOP: "커밋할 변경사항이 없습니다."

### Phase 2: 태스크 컨텍스트 조회

`vs plan list --json --status active`를 Bash 도구로 실행하여 활성 플랜을 확인하고,
활성 플랜이 있으면 해당 플랜에서 in_progress 상태의 태스크를 `vs plan list --json --status active`를 Bash 도구로 실행하여 조회합니다.

- in_progress 태스크가 있으면:
  → 태스크 ID와 제목을 기록하고 Phase 3에서 활용
- in_progress 태스크가 없으면:
  → 태스크 연동 없이 일반 커밋으로 진행

### Phase 3: 논리 단위 분석

변경된 파일들을 **의미적으로 연관된 그룹**으로 분류:

1. `git diff` (unstaged) + `git diff --cached` (staged) 내용을 분석
2. 아래 기준으로 논리 그룹 생성:
   - **같은 기능/모듈**에 속하는 변경은 하나의 그룹
   - **독립적인 관심사**(config, 문서, 새 기능, 버그 수정 등)는 별도 그룹
   - **테스트**는 대응하는 구현과 같은 그룹
3. 각 그룹에 대해:
   - **파일 목록**: 포함된 파일들
   - **변경 요약**: 무엇이 왜 바뀌었는지 1-2문장
   - **커밋 타입**: `feat`, `fix`, `refactor`, `chore`, `docs`, `test` 등
   - **scope**: 변경의 주요 모듈/디렉토리

### Phase 4: 커밋 계획 제시

사용자에게 그룹화 결과를 보여줌:

```
커밋 계획:

| # | Type(Scope) | 설명 | 파일 | Task |
|---|-------------|------|------|------|
| 1 | feat(auth) | 로그인 API 추가 | src/auth.ts, ... | #T-3 |
| 2 | test(auth) | 로그인 테스트 추가 | tests/auth.test.ts | #T-3 |
| 3 | chore(config) | eslint 설정 추가 | .eslintrc | - |

진행할까요? (Y / 수정할 그룹 번호 / 재분류)
```

- **Y** → Phase 5 진행
- **번호** → 해당 그룹 수정 (파일 이동, 분할, 합치기)
- **재분류** → Phase 3 재수행

### Phase 5: 순차 커밋 실행

각 그룹을 순서대로 커밋:

```bash
# 1. 해당 그룹의 파일만 staging
git add <files-in-group>

# 2. 커밋
git commit -m "$(cat <<'EOF'
<type>(<scope>): <한글 설명>

<optional 한글 body — WHY not WHAT>

Task: #T-<task_id>
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

- `Task:` 라인은 in_progress 태스크가 있을 때만 포함
- 태스크와 무관한 그룹(config, 독립 문서 등)에는 `Task:` 라인 생략

### Phase 6: 결과 보고

```
커밋 완료 (N개):

| # | Hash | 메시지 | Task |
|---|------|--------|------|
| 1 | abc1234 | feat(auth): 로그인 API 추가 | #T-3 |
| 2 | def5678 | chore(config): eslint 설정 추가 | - |
```

### Phase 6.5: 골격 Auto 업데이트 트리거

커밋된 파일 중 골격 관련 영역 변경이 있으면 Auto tier 수정을 자동 적용합니다.

- 조건: 프로젝트 루트에 골격 문서 1개 이상 존재 AND 커밋 파일에 아래 패턴 포함:
  - `src/` 하위 디렉토리 구조 변경 → ARCHITECTURE.md Module Structure 업데이트 후보
  - `package.json` 변경 → POLICY.md Dependencies 업데이트 후보
  - `tsconfig.json`/eslint config 변경 → POLICY.md Naming Convention 업데이트 후보
- 조건 미충족 시 이 단계를 스킵하세요
- skeleton-evolve의 Auto tier 로직만 경량 실행:
  1. 해당 골격 문서를 Read
  2. 변경 사항과 대조하여 Auto 수준(경로 업데이트, 의존성 추가)만 감지
  3. 감지되면 .bak 백업 후 자동 적용
  4. skeleton_changes에 기록: `{ plan_id, change_type: 'auto', approved_by: 'system' }`
  5. "골격 문서 자동 업데이트: {N}건 적용됨" 표시
- 변경 없으면 조용히 스킵

### Phase 6.6: 백로그 자동 매칭

커밋된 파일과 관련된 백로그 항목이 있는지 확인하세요:

1. 방금 커밋된 파일 목록을 수집하세요 (Phase 5에서 각 그룹의 파일 목록 활용)
2. `vs --json backlog list --status open`으로 open 백로그를 조회하세요
3. 각 백로그 항목의 title/description/tags에 커밋 파일명 또는 디렉토리명이 포함되면 매칭
4. 매칭된 항목이 있으면 `AskUserQuestion`으로 제안하세요:
   - question: "이 커밋이 백로그 항목 '{title}'을 해결한 것 같습니다. done으로 처리할까요?"
   - header: "백로그 매칭"
   - multiSelect: true (여러 항목 동시 선택 가능)
   - 각 매칭 항목을 선택지로 제시
   - 선택된 항목에 대해 `vs --json backlog update <id> --status done` 실행
5. 매칭 항목이 없거나 open 백로그가 없으면 이 Phase를 조용히 건너뛰세요

### Phase 7: 플랜 완료 감지

커밋 완료 후, 활성 플랜이 있으면 남은 태스크를 확인하세요:
- `vs --json task next <plan_id>`를 Bash 도구로 실행하세요
- 남은 todo 태스크가 없으면 (모든 태스크가 done/skipped/blocked):
  1. `vs --json qa config resolve <plan_id>`로 auto_trigger 설정을 조회하세요
  2. auto_trigger 연동:
     - `auto_trigger.enabled`가 `true`이고 `qa_overrides.dismissed_milestones`에 100이 **없으면**:
       → 선택지의 "플랜 검증" label을 **"플랜 검증 (강력 권장)"**으로 표시
       → description에 "QA 자동 트리거 설정에 의한 권장"을 추가
     - `auto_trigger.enabled`가 `false`이거나 `dismissed_milestones`에 100이 **있으면**:
       → 기존 동작 유지 ("플랜 검증 (권장)")
  → **체크포인트**: `AskUserQuestion`으로 플랜 완료 흐름을 제시하세요:
  - question: "모든 태스크가 완료되었습니다. 플랜 검증을 진행할까요?"
  - header: "플랜 완료 감지"
  - multiSelect: false
  - 선택지:
    - label: "{위에서 결정된 라벨}", description: "vs-qa → vs-plan-verify 순서로 플랜 전체를 검증합니다 {auto_trigger 연동 문구}"
    - label: "나중에", description: "플랜 검증 없이 종료합니다"
  - "플랜 검증" → `/vs-qa` 실행 후 → `/vs-plan-verify` 실행
- 남은 태스크가 있으면 이 Phase를 건너뛰세요

## 커밋 메시지 규칙

- **type(scope)**: 영문 — `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `ci`, `perf`
- **설명**: 한글, 명령형, 마침표 없음, 72자 이내
- **body**: 선택사항, 한글, WHAT이 아닌 WHY 설명
- **Task**: `#T-<id>` 형식으로 VibeSpec 태스크 참조
- **Co-Authored-By**: 영문 유지

### Scope 결정

1. **파일 경로 기반 추출** (기본):
   - `src/auth/login.ts` → `auth`
   - `agents/tdd-implementer.md` → `tdd-implementer`
2. **diff 내용 기반 보정** (경로만으로 부족할 때):
   - `git diff`의 실제 변경 내용(함수명, 클래스명, 모듈 import)을 분석하세요
   - 같은 디렉토리 내 파일이라도 서로 다른 기능(함수/클래스)을 수정했으면 별도 scope로 분리
   - 서로 다른 디렉토리 파일이라도 동일 모듈/기능을 수정했으면 하나의 scope로 통합
   - 예: `src/api/user.ts`와 `src/models/user.ts`가 모두 `UserProfile` 관련 변경이면 → `user-profile`
3. 여러 디렉토리에 걸치면 가장 상위 공통 모듈
4. 프로젝트 전반 변경 → `project`

## Rules

- NEVER commit without showing the plan to user first
- NEVER stage files that look like secrets (.env, credentials, tokens)
- NEVER use `git add -A` or `git add .` — 항상 파일을 명시적으로 지정
- 논리적으로 무관한 변경을 하나의 커밋에 섞지 않음
- 테스트 파일은 대응하는 구현 변경과 같은 커밋에 포함
- staged된 파일이 이미 있으면 아래 절차를 따르세요:
  1. 기존 staged 내용과 unstaged 변경사항을 각각 요약하여 사용자에게 보여주세요
  2. AskUserQuestion으로 처리 방식을 확인하세요:
     - "staged 내용만 먼저 커밋" — staged 변경사항을 별도 커밋으로 분리하고, 나머지는 이후 Phase 3에서 분석
     - "전체 통합 분석" — staged를 unstage(`git reset`)한 뒤 모든 변경사항을 함께 논리 그룹화
     - "staged 유지하고 나머지만 커밋" — staged 변경사항은 그대로 두고 unstaged만 분석/커밋
- 태스크 상태(done 등)는 변경하지 않음 — 태스크 라이프사이클은 vs-next가 관리

## 다음 단계

- → `/vs-next`로 다음 태스크 진행
- → `/vs-dashboard`로 진행률 확인
- → `/vs-qa` + `/vs-plan-verify`로 플랜 검증
- 플랜 완료 시 → `/vs-release`로 릴리즈 준비
