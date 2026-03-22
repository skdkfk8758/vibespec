---
name: vs-commit
description: Use when committing changes with VibeSpec task traceability. 변경사항을 논리 단위로 그룹화하고, 현재 진행 중인 태스크 ID를 커밋 메시지에 포함합니다.
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

## 커밋 메시지 규칙

- **type(scope)**: 영문 — `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `ci`, `perf`
- **설명**: 한글, 명령형, 마침표 없음, 72자 이내
- **body**: 선택사항, 한글, WHAT이 아닌 WHY 설명
- **Task**: `#T-<id>` 형식으로 VibeSpec 태스크 참조
- **Co-Authored-By**: 영문 유지

### Scope 결정

1. 변경 파일의 주요 디렉토리에서 추출
   - `src/auth/login.ts` → `auth`
   - `agents/tdd-implementer.md` → `tdd-implementer`
2. 여러 디렉토리에 걸치면 가장 상위 공통 모듈
3. 프로젝트 전반 변경 → `project`

## Rules

- NEVER commit without showing the plan to user first
- NEVER stage files that look like secrets (.env, credentials, tokens)
- NEVER use `git add -A` or `git add .` — 항상 파일을 명시적으로 지정
- 논리적으로 무관한 변경을 하나의 커밋에 섞지 않음
- 테스트 파일은 대응하는 구현 변경과 같은 커밋에 포함
- staged된 파일이 이미 있으면 해당 파일을 첫 번째 그룹으로 우선 배치
- 태스크 상태(done 등)는 변경하지 않음 — 태스크 라이프사이클은 vs-next가 관리

## 다음 단계

- → `/vs-next`로 다음 태스크 진행
- → `/vs-dashboard`로 진행률 확인
- 플랜 완료 근접 시 → `/vs-release`로 릴리즈 준비
