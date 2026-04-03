---
name: vs-pr-merge
description: [Env] GitHub PR을 안전하게 머지 (충돌 자동 해결 포함).
invocation: deferred
argument-hint: "<PR번호 또는 URL>"
---

# PR Merge

GitHub PR을 안전하게 머지합니다. 충돌 발생 시 4단계로 분류하여 Level 1-2는 규칙 기반으로 자동 해결, Level 3-4는 AI 분석 후 사용자에게 위임하는 하이브리드 방식을 채택합니다. 머지 후 브랜치 정리, 이슈 닫기, 머지 리포트 생성까지 풀 라이프사이클을 처리합니다.

## Current Context

- Git dir: `!git rev-parse --git-dir`
- Current branch: `!git branch --show-current`
- Remote URL: `!git remote get-url origin`
- Working tree status: `!git status --short`

## Safety Protocol

> **절대 규칙:**
> - `git stash` 사용 금지 — 임시 브랜치로만 작업
> - 모든 파괴적 작업 전 `AskUserQuestion`으로 사용자 확인 필수
> - 실패 시 임시 브랜치 삭제로 원상 복구 보장
> - `execFileSync` 패턴으로 shell injection 방지

## Steps

### Phase 1: Validation

1. **gh CLI 확인**: `gh --version` 실행.
   - 실패 시 **즉시 중단**:
     > "gh CLI가 설치되어 있지 않습니다. `brew install gh` (macOS) 또는 https://cli.github.com 에서 설치하세요."

2. **gh 인증 확인**: `gh auth status` 실행.
   - 실패 시 **즉시 중단**:
     > "gh CLI 인증이 필요합니다. `! gh auth login`을 실행하세요."

3. **PR 식별**:
   - `$ARGUMENTS`가 있으면:
     - 숫자만 포함 (`/^\d+$/`) → PR 번호로 사용
     - URL 포함 (`/\/pull\/(\d+)/`) → regex로 PR 번호 추출
     - 그 외 → "유효하지 않은 PR 식별자입니다. PR 번호 또는 URL을 입력하세요." 중단
   - `$ARGUMENTS`가 없으면:
     - `gh pr list --state open --limit 10 --json number,title,author,headRefName`으로 열린 PR 목록 조회
     - `AskUserQuestion`으로 PR 선택:
       - header: "PR 선택"
       - 각 PR을 선택지로 표시: `#{number} {title} ({author.login}, {headRefName})`
       - "직접 입력" 선택지 추가 (번호 또는 URL 직접 입력)

4. **PR 상태 검증**: `gh pr view {pr_number} --json state,mergeable,reviewDecision,statusCheckRollup,isDraft,headRefName,baseRefName,body,title,author`로 상세 정보 조회.

   a. **이미 머지/닫힘 검사**:
      - `state`가 `MERGED` 또는 `CLOSED` → **즉시 중단**:
        > "PR #{number}은 이미 {state} 상태입니다."

   b. **Draft PR 경고**:
      - `isDraft`가 `true` → `AskUserQuestion`으로 경고:
        - question: "PR #{number}은 draft 상태입니다. 계속 진행하시겠습니까?"
        - header: "Draft PR"
        - 선택지: "진행" / "중단"

   c. **CI 상태 확인**:
      - `statusCheckRollup`에서 실패한 체크가 있으면 → `AskUserQuestion`으로 경고:
        - question: "CI 체크가 실패했습니다: {실패한 체크 목록}. 계속 진행하시겠습니까?"
        - header: "CI 실패"
        - 선택지: "머지 진행 (리스크 감수)" / "CI 통과 대기 후 재시도"
      - "대기 후 재시도" 선택 시 → **중단** (사용자가 나중에 다시 실행)

   d. **리뷰 승인 확인**:
      - `reviewDecision`이 `APPROVED`가 아니면 → `AskUserQuestion`으로 경고:
        - question: "리뷰가 아직 승인되지 않았습니다 (현재: {reviewDecision}). 계속 진행하시겠습니까?"
        - header: "리뷰 미승인"
        - 선택지: "머지 진행" / "리뷰 승인 후 재시도"

   e. **머지 권한 확인**:
      - `gh api repos/{owner}/{repo}/collaborators/{viewer}/permission --jq '.permission'` 실행
      - 결과가 `admin`, `write`, `maintain` 중 하나가 아니면 → **즉시 중단**:
        > "PR을 머지할 권한이 없습니다. (현재 권한: {permission})"

5. **머지 방식 선택**: `AskUserQuestion`으로 선택:
   - header: "머지 방식"
   - question: "어떤 방식으로 머지하시겠습니까?"
   - 선택지:
     - label: "Squash merge (권장)", description: "모든 커밋을 하나로 합칩니다"
     - label: "Rebase merge", description: "커밋을 base 위에 리베이스합니다"
     - label: "Merge commit", description: "머지 커밋을 생성합니다"

6. **Mergeable 상태 확인**:
   - `mergeable`이 `MERGEABLE` → Phase 4로 바로 진행 (충돌 없음)
   - `mergeable`이 `CONFLICTING` → Phase 2로 진행 (충돌 해결 필요)
   - `mergeable`이 `UNKNOWN` → `gh pr view`를 5초 후 재시도 (최대 2회), 여전히 UNKNOWN이면 사용자에게 "GitHub이 아직 mergeable 상태를 계산 중입니다. 잠시 후 다시 시도하세요." 안내 후 중단

### Phase 2: Research + 충돌 분류

> Phase 1에서 `mergeable`이 `CONFLICTING`인 경우에만 진입합니다.

1. **PR diff 분석**: `gh pr diff {pr_number}`로 전체 diff를 가져옵니다. 변경 규모와 파일 목록을 파악하세요.

2. **충돌 감지**: 로컬에서 충돌 파일을 정확히 식별합니다.
   ```
   git fetch origin
   git checkout -b vibespec/pr-merge-{pr_number}-{timestamp} origin/{baseRefName}
   git merge --no-commit --no-ff origin/{headRefName}
   ```
   - 충돌이 발생하면 `git diff --name-only --diff-filter=U`로 충돌 파일 목록을 수집합니다.
   - 충돌 파일이 없으면 (clean merge) → Phase 4로 진행
   - 충돌 파일이 있으면 → Step 3으로 진행
   - `git merge --abort`로 임시 머지를 되돌립니다 (분류 분석을 위해)

3. **충돌 분류**: 각 충돌 파일에 대해 아래 4-Level 분류 체계를 적용합니다.

#### Level 1: Trivial (규칙 기반 자동 해결)

| 패턴 | 판별 조건 | 해결 전략 |
|------|-----------|-----------|
| 공백/포매팅 | 충돌 hunk이 whitespace/indent만 다름 | prettier/eslint 기준 통일 |
| import 순서 | 양쪽이 다른 import를 추가, 겹침 없음 | 알파벳 순 정렬 병합 |
| 리스트 추가 (비중첩) | exports, enum 멤버 등에 양쪽이 다른 항목 추가 | 양쪽 모두 포함 |
| 주석 변경 | 한쪽만 주석 수정, 다른쪽은 무변경 | 수정된 쪽 채택 |
| lock 파일 | package-lock.json, yarn.lock 등 | 재생성 (`npm install` 등) |

**판별 방법**: 충돌 마커(`<<<<<<<`, `=======`, `>>>>>>>`) 사이의 hunk을 파싱하여:
- 양쪽의 차이가 공백/개행만이면 → 공백/포매팅
- 양쪽 모두 `import`/`from` 키워드를 포함하고 겹치는 모듈이 없으면 → import 순서
- 양쪽 모두 배열/객체 리터럴 내에서 다른 항목을 추가했으면 → 리스트 추가
- 한쪽이 `//` 또는 `/* */` 주석만 변경했으면 → 주석 변경
- 파일명이 lock 파일 패턴 (`*-lock.*`, `*.lock`, `*.lockb`)이면 → lock 파일

#### Level 2: Mechanical (규칙 기반 자동 해결)

| 패턴 | 판별 조건 | 해결 전략 |
|------|-----------|-----------|
| 같은 파일 다른 위치 | 충돌 hunk이 1개이고 양쪽 변경이 20줄+ 떨어져 있음 | 양쪽 변경 모두 적용 |
| 일관된 rename | 동일 식별자가 양쪽에서 같은 새 이름으로 변경 | rename 적용 + 참조 검증 |
| 설정 파일 (비중첩 키) | `.json`, `.yaml`, `.toml` 설정 파일에서 다른 키 추가 | 양쪽 키 병합 |
| 타입 정의 확장 | interface/type에 양쪽이 다른 필드 추가, 겹침 없음 | 양쪽 필드 모두 포함 |

**판별 방법**:
- 충돌 hunk 수와 위치로 "같은 파일 다른 위치" 판별
- AST-free 휴리스틱: 양쪽 diff에서 `oldName → newName` 패턴이 일치하면 → 일관된 rename
- 파일 확장자 + JSON/YAML 파싱으로 키 겹침 확인
- `interface`/`type` 키워드 뒤의 블록에서 필드명 추출 후 교집합 확인

#### Level 3: Semantic (LLM 분석 + 사용자 확인 필수)

| 패턴 | 판별 조건 | 분석 방법 |
|------|-----------|-----------|
| 같은 함수 다른 부분 수정 | 동일 함수 스코프 내 양쪽 변경 | 전체 함수 컨텍스트 읽기 + 의존성 추적 |
| 리팩토링 vs 기능 확장 | 한쪽이 구조 변경, 다른쪽이 기능 추가 | 리팩토링 결과 위에 기능 재적용 제안 |
| 타입 체인 변경 | API 시그니처 변경 + downstream 소비자 | 타입 체인 전체 추적 |
| 테스트 충돌 | 같은 유닛의 다른 행동 테스트 | 양쪽 테스트 의도 분석 후 병합 제안 |

**판별 방법**: Level 1-2에 해당하지 않고, 아래 중 하나라도 충족:
- 동일 함수/메서드 스코프 내에 양쪽 변경이 존재
- 한쪽이 함수 시그니처/구조를 변경하고 다른쪽이 해당 함수를 확장
- 변경이 타입 정의와 그 소비자에 걸쳐 있음
- `.test.` / `.spec.` 파일에서 같은 `describe` 블록 내 충돌

**LLM 분석 프로세스**:
1. 충돌 파일 **전체**를 Read로 읽음 (hunk만이 아닌 전체 컨텍스트)
2. 양쪽 **커밋 메시지**에서 변경 의도 파악 (`git log --oneline origin/{base}..origin/{head}`)
3. **PR description** (`body` 필드)에서 맥락 추출
4. 변경된 코드의 **downstream 영향** 추적 (Grep으로 import/참조 검색)
5. 해결 제안을 **diff 형태**로 생성
6. 제안과 함께 **confidence level** (high/medium/low) 표시

#### Level 4: Logic (LLM 분석 + 사용자 결정 필수)

| 패턴 | 판별 조건 | 처리 |
|------|-----------|------|
| 같은 줄 다른 의도 | 동일 라인에 양쪽이 다른 값/로직 적용 | 양쪽 버전 + 컨텍스트 제시 |
| 아키텍처 결정 충돌 | 같은 문제를 다른 패턴/구조로 해결 | 양쪽 접근 비교 분석표 제시 |
| 상태 관리 충돌 | 상태 구조/흐름이 양쪽에서 다르게 변경 | 사용자에게 완전 위임 |
| 비즈니스 로직 충돌 | 비즈니스 규칙이 상충 | 도메인 전문가 판단 필요 표시 |

**판별 방법**: Level 1-3에 해당하지 않는 모든 충돌 → Level 4로 분류

**사용자 지원 방식**:
1. 3-way diff 시각화: base / ours (base branch) / theirs (PR branch)
2. 양쪽 변경의 **의도 요약** (커밋 메시지 + PR description 기반)
3. `AskUserQuestion`으로 선택지 제시:
   - "Base 쪽 유지 (ours)"
   - "PR 쪽 채택 (theirs)"
   - "직접 작성" → 사용자가 직접 입력한 코드를 적용

4. **충돌 분류 요약**: 모든 파일 분류 완료 후 요약 테이블을 표시합니다.

   ```
   ## 충돌 분류 결과

   | 파일 | Level | 해결 방식 |
   |------|-------|-----------|
   | src/api/auth.ts | L1 (Trivial) | 자동 해결 |
   | src/models/user.ts | L2 (Mechanical) | 자동 해결 |
   | src/services/payment.ts | L3 (Semantic) | AI 제안 → 확인 필요 |
   | src/core/state.ts | L4 (Logic) | 사용자 결정 필요 |

   - 자동 해결 대상: {N}개 파일
   - 사용자 확인 필요: {N}개 파일
   - 사용자 결정 필요: {N}개 파일
   ```

   - `AskUserQuestion`으로 분류 결과를 확인받습니다:
     - header: "충돌 분류 확인"
     - question: "충돌 분류 결과를 확인해주세요. Phase 3(충돌 해결)으로 진행할까요?"
     - 선택지:
       - label: "진행", description: "Level 1-2 자동 해결 → Level 3-4 사용자 위임 순서로 해결합니다"
       - label: "분류 수정", description: "특정 파일의 Level을 수동으로 조정합니다"

   - 충돌 파일이 50개 초과 시: 50개 단위 배치로 분류하고, 배치 간 진행률 표시

### Phase 3: Conflict Resolution (충돌 해결 엔진)

> Phase 2에서 충돌이 분류된 후 진입합니다.
> **핵심 원칙**: 자동 해결 → 테스트 검증 → 사용자 확인 → 머지. 어떤 단계에서든 실패하면 임시 브랜치 삭제로 원상 복구.

#### Step 1: 임시 브랜치 준비

1. **backup ref 생성**: 현재 HEAD를 백업합니다.
   ```
   git update-ref refs/backup/pr-merge-{pr_number} HEAD
   ```

2. **임시 브랜치에서 머지 시작**:
   ```
   git checkout vibespec/pr-merge-{pr_number}-{timestamp}
   git merge --no-commit --no-ff origin/{headRefName}
   ```
   - 이 시점에서 충돌 마커가 파일에 삽입됩니다.
   - 충돌 파일 목록을 `git diff --name-only --diff-filter=U`로 수집합니다.

> **stash 사용 절대 금지**: 이 과정에서 `git stash`를 사용하지 않습니다. 모든 작업은 임시 브랜치 위에서 진행하며, 실패 시 `git merge --abort` + `git checkout` + `git branch -D`로 정리합니다.

#### Step 2: Level 1-2 자동 해결

Phase 2에서 Level 1 또는 Level 2로 분류된 파일을 순서대로 처리합니다.

1. **파일별 자동 해결 적용**:
   - Level 1 (Trivial): Phase 2의 해결 전략표에 따라 규칙 적용
     - lock 파일: `git checkout --theirs {file}` 후 `npm install` (또는 해당 패키지 매니저)로 재생성
     - import 순서: 양쪽 import를 추출 → 합집합 → 알파벳 정렬 → 파일에 Write
     - 공백/주석: 수정된 쪽을 채택 (`git checkout --theirs` 또는 `--ours`)
   - Level 2 (Mechanical): Phase 2의 해결 전략표에 따라 규칙 적용
     - 비중첩 변경: 양쪽 변경을 모두 적용 (`git checkout --merge` 후 수동 병합)
     - 설정 파일: JSON/YAML 파싱 → 키 합집합 → 재직렬화

2. **각 파일 해결 후 `git add {file}`** 으로 스테이징

3. **자동 해결 결과 요약**:
   ```
   ## Level 1-2 자동 해결 결과

   | 파일 | Level | 해결 방식 | 상태 |
   |------|-------|-----------|------|
   | package-lock.json | L1 | 재생성 | ✅ |
   | src/utils/index.ts | L1 | import 병합 | ✅ |
   | tsconfig.json | L2 | 키 병합 | ✅ |
   ```

#### Step 3: Integration Gate (테스트 검증)

자동 해결된 파일에 대해 테스트를 실행합니다.

1. **빌드 검증**: `npx tsc --noEmit` (TypeScript 프로젝트인 경우)
2. **테스트 실행**: `npx vitest run` 또는 프로젝트의 테스트 러너
3. **린트 검증**: `npx eslint {changed_files}` (설정이 있는 경우)

**결과 분기**:
- **모두 통과** → Step 4 (사용자 확인)으로 진행
- **테스트 실패** → **자동 해결 롤백 + Level 3 승격**:
  1. 실패한 테스트와 관련된 자동 해결 파일을 식별
  2. 해당 파일의 자동 해결을 되돌림: `git checkout --merge {file}`
  3. 해당 파일을 Level 3 (Semantic)으로 승격
  4. 사용자에게 경고:
     ```
     ⚠️ 자동 해결 후 테스트 실패: {실패한 테스트 목록}
     관련 파일 {파일명}을 Level 3으로 승격합니다.
     ```
  5. 나머지 자동 해결은 유지하고, 승격된 파일은 Step 5에서 처리

#### Step 4: 자동 해결 사용자 확인

`AskUserQuestion`으로 자동 해결 결과를 확인받습니다:
- header: "자동 해결 확인"
- question: "Level 1-2 자동 해결 결과를 확인해주세요. (위 테이블 참조)"
- 선택지:
  - label: "승인", description: "자동 해결을 적용하고 Level 3-4 해결로 진행합니다"
  - label: "개별 검토", description: "각 파일의 자동 해결을 하나씩 검토합니다"
  - label: "모두 취소", description: "자동 해결을 모두 되돌리고 수동으로 해결합니다"

- **"개별 검토"** 선택 시: 각 파일별로 diff를 보여주고 "승인" / "수동 해결로 전환" 선택
- **"모두 취소"** 선택 시: 모든 자동 해결 되돌림, 전체를 Level 3-4로 승격

#### Step 5: Level 3 해결 (AI 분석 + 사용자 확인)

Level 3으로 분류된 (또는 승격된) 각 파일에 대해:

1. **깊이 분석 실행**:
   - 충돌 파일 **전체**를 Read로 읽음
   - base, ours, theirs 3개 버전을 각각 추출:
     ```
     git show :1:{file} > /tmp/base.txt    # base 버전
     git show :2:{file} > /tmp/ours.txt    # base branch 버전
     git show :3:{file} > /tmp/theirs.txt  # PR branch 버전
     ```
   - 양쪽 커밋 히스토리에서 해당 파일 변경 의도 파악
   - downstream 영향 추적: 해당 파일을 import/참조하는 다른 파일 검색

2. **해결 제안 생성**:
   - 3개 버전을 분석하여 통합된 해결안을 제안
   - confidence level 표시 (high / medium / low)
   - 제안 근거 설명 (어떤 변경을 왜 선택했는지)

3. **사용자 확인**: `AskUserQuestion`
   - header: "{파일명} 충돌 해결"
   - question: "AI가 제안한 해결안을 검토해주세요. (confidence: {level})"
   - 선택지:
     - label: "제안 승인", description: "AI 해결안을 적용합니다"
     - label: "수정 후 적용", description: "제안을 기반으로 수정합니다"
     - label: "직접 해결", description: "AI 제안을 무시하고 직접 작성합니다"

4. **5개 이상 Level 3 파일**: 카테고리별 배치 처리 제안
   - `AskUserQuestion`: "Level 3 파일이 {N}개입니다. 카테고리별 배치 처리하시겠습니까?"
   - 선택지: "배치 처리 (유사 파일 그룹)" / "개별 처리"

#### Step 6: Level 4 해결 (사용자 직접 결정)

Level 4로 분류된 각 파일에 대해:

1. **3-way diff 시각화**: base / ours / theirs 각 버전의 핵심 차이를 표시
2. **양쪽 의도 요약**: 커밋 메시지, PR description 기반으로 각 쪽의 변경 의도를 1-2줄로 요약
3. **`AskUserQuestion`으로 결정**:
   - header: "{파일명} 로직 충돌"
   - question: "양쪽 변경의 의도가 상충합니다. 어떻게 해결하시겠습니까?"
   - 선택지:
     - label: "Base 쪽 유지 (ours)", description: "{base 변경 의도 요약}"
     - label: "PR 쪽 채택 (theirs)", description: "{PR 변경 의도 요약}"
     - label: "직접 작성", description: "에디터에서 직접 코드를 작성합니다"
   - "Base 쪽 유지" → `git checkout --ours {file} && git add {file}`
   - "PR 쪽 채택" → `git checkout --theirs {file} && git add {file}`
   - "직접 작성" → 사용자에게 코드를 받아 Write로 적용 후 구문 검증 (`npx tsc --noEmit`)

#### Step 7: 최종 검증 + 커밋

모든 충돌 해결 후:

1. **미해결 충돌 확인**: `git diff --name-only --diff-filter=U` → 비어있어야 함
2. **전체 테스트 실행**: Integration Gate (빌드 + 테스트 + 린트)
3. **결과 분기**:
   - **통과** → 머지 커밋 생성: `git commit -m "resolve: PR #{pr_number} 충돌 해결"`
   - **실패** → `AskUserQuestion`:
     - "최종 테스트가 실패했습니다. 어떻게 처리하시겠습니까?"
     - 선택지:
       - label: "수정 시도", description: "실패한 테스트를 분석하고 수정합니다"
       - label: "강제 진행", description: "테스트 실패를 무시하고 머지합니다 (위험)"
       - label: "전체 취소", description: "모든 해결을 롤백하고 원상 복구합니다"
     - "전체 취소" → `git merge --abort && git checkout {original_branch} && git branch -D vibespec/pr-merge-{pr}-{ts}`

4. **충돌 해결 로그 수집** (Phase 5 리포트용):
   ```json
   {
     "conflict_log": [
       {"file": "src/api/auth.ts", "level": 1, "resolution": "auto", "strategy": "import_merge"},
       {"file": "src/core/state.ts", "level": 4, "resolution": "manual", "choice": "theirs", "choice_reason": "PR의 새 상태 구조가 더 적합"}
     ],
     "auto_resolved_files": ["src/api/auth.ts", "tsconfig.json"],
     "conflict_levels": {"src/api/auth.ts": 1, "src/core/state.ts": 4}
   }
   ```

→ Phase 4 (Merge Execution)로 진행

### Phase 4: Merge Execution

> 충돌이 없는 경우 Phase 1에서 직접 진입합니다.
> 충돌이 있었던 경우 Phase 3 완료 후 진입합니다.

1. **Base 브랜치 재검증** (race condition 방지):
   ```
   git fetch origin {baseRefName}
   ```
   - Phase 1에서 기록한 base HEAD와 현재 `origin/{baseRefName}` HEAD를 비교
   - **다르면** → `AskUserQuestion`:
     - header: "Base 브랜치 변경 감지"
     - question: "머지 프로세스 동안 base 브랜치({baseRefName})가 업데이트되었습니다. 어떻게 처리하시겠습니까?"
     - 선택지:
       - label: "재시작 (권장)", description: "최신 base 기준으로 충돌 분류부터 다시 시작합니다"
       - label: "그대로 머지", description: "현재 상태로 머지를 진행합니다 (추가 충돌 발생 가능)"
     - "재시작" → 임시 브랜치 삭제 후 Phase 2부터 재시작

2. **머지 실행**: Phase 1 Step 5에서 선택한 방식에 따라 실행
   ```
   # 충돌 해결이 필요했던 경우: 로컬에서 이미 해결 완료, push 후 머지
   git push origin vibespec/pr-merge-{pr}-{ts}:{headRefName} --force-with-lease

   # gh pr merge 실행
   gh pr merge {pr_number} --squash    # squash인 경우
   gh pr merge {pr_number} --rebase    # rebase인 경우
   gh pr merge {pr_number} --merge     # merge commit인 경우
   ```

   **충돌이 없었던 경우** (Phase 1에서 직접 진입):
   ```
   gh pr merge {pr_number} --{merge_method}
   ```

3. **머지 결과 확인**:
   - `gh pr view {pr_number} --json state`로 `MERGED` 상태 확인
   - 실패 시:
     - 에러 메시지 분석 (branch protection, required checks 등)
     - `AskUserQuestion`: "머지가 실패했습니다: {에러}. 재시도하시겠습니까?"
     - 선택지: "재시도" / "중단"

### Phase 5: Post-merge (후처리)

1. **리모트 브랜치 삭제**:
   - `gh pr view {pr_number} --json headRefName`에서 PR의 head 브랜치 확인
   - `AskUserQuestion`으로 확인:
     - header: "브랜치 정리"
     - question: "머지된 브랜치 `{headRefName}`을 삭제하시겠습니까?"
     - 선택지:
       - label: "삭제 (권장)", description: "리모트 브랜치를 삭제합니다"
       - label: "유지", description: "브랜치를 삭제하지 않습니다"
   - 삭제 선택 시: `gh pr close {pr_number} --delete-branch` 또는 `git push origin --delete {headRefName}`

2. **로컬 브랜치 동기화**:
   ```
   git fetch origin --prune
   git pull origin {baseRefName}
   ```

3. **연관 이슈 자동 닫기**:
   - Phase 1에서 조회한 PR `body`에서 이슈 참조 파싱:
     ```
     regex: /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi
     ```
   - 매칭된 각 이슈에 대해:
     - `gh issue view {issue_number} --json state`로 상태 확인
     - 이미 닫혀있으면 스킵
     - 열려있으면 `gh issue close {issue_number} --comment "Closed via PR #{pr_number} merge"`
   - 닫힌 이슈 목록을 리포트에 포함

4. **임시 브랜치 정리** (충돌 해결을 위해 생성했던 경우):
   ```
   git branch -D vibespec/pr-merge-{pr_number}-{timestamp} 2>/dev/null
   git update-ref -d refs/backup/pr-merge-{pr_number} 2>/dev/null
   ```

5. **머지 리포트 생성**:
   - `vs merge-report create` CLI를 호출하여 MergeReport를 생성합니다:
     ```bash
     vs --json merge-report create \
       --plan-id "{plan_id 또는 null}" \
       --commit-hash "$(git rev-parse HEAD)" \
       --source-branch "{headRefName}" \
       --target-branch "{baseRefName}" \
       --changes-summary '{changes_summary JSON}' \
       --review-checklist '{review_checklist JSON}' \
       --conflict-log '{conflict_log JSON 또는 null}' \
       --ai-judgments '{ai_judgments JSON 또는 null}' \
       --verification '{verification JSON}' \
       --pr-number {pr_number} \
       --pr-url "https://github.com/{owner}/{repo}/pull/{pr_number}" \
       --merge-method "{squash|rebase|merge}" \
       --closed-issues '{closed_issues JSON}' \
       --auto-resolved-files '{auto_resolved_files JSON}' \
       --conflict-levels '{conflict_levels JSON}'
     ```
   - 마크다운 리포트를 `.claude/reports/merge-{date}-pr-{pr_number}.md`에 저장

6. **최종 요약 표시**:
   ```
   ## PR Merge 완료

   | 항목 | 결과 |
   |------|------|
   | PR | #{pr_number} — {title} |
   | 머지 방식 | {merge_method} |
   | 충돌 해결 | {N}개 파일 (자동: {auto}개, 수동: {manual}개) 또는 "충돌 없음" |
   | 브랜치 | {headRefName} → {삭제됨/유지} |
   | 이슈 | {closed_issues 목록} 닫힘 또는 "연관 이슈 없음" |
   | 리포트 | .claude/reports/merge-{date}-pr-{pr_number}.md |
   ```

## Rules

- gh CLI 호출 타임아웃: 30초, 실패 시 최대 2회 재시도
- PR URL 파싱 regex: `/(?:https?:\/\/)?github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/`
- PR 번호 검증: 양의 정수만 허용 (`/^\d+$/`)
- 모든 gh 명령은 `execFileSync('gh', [...args])` 패턴 사용 (shell injection 방지)
- stash 사용 절대 금지 — 임시 브랜치 `vibespec/pr-merge-{pr번호}-{timestamp}` 사용
- 실패 시 임시 브랜치 삭제로 원상 복구
- 충돌 파일 50개 이하: 단일 처리 / 51개 이상: 50개 단위 배치 처리

## 다음 단계

- → `/vs-dashboard`로 진행률 확인
- → `/vs-commit`으로 변경사항 커밋
- → `/vs-next`로 다음 태스크 시작
