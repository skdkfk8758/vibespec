---
name: vs-wrap
description: "[Lifecycle] Use when wrapping up a session with multi-agent learning pipeline. (세션 마무리)"
invocation: deferred
argument-hint: "[commit message] [--quick]"
---

# vs-wrap (세션 마무리)

세션 종료 시 3개 에이전트로 학습, 자동화 기회, 후속 작업을 추출하는 파이프라인입니다.
self-improve가 에러에서 학습한다면, vs-wrap은 성공 패턴에서도 학습합니다.

## When to Use

**사용하세요:**
- 세션 마무리 시 학습과 후속 작업을 정리하고 싶을 때
- 커밋과 함께 세션을 마무리하고 싶을 때 (`/vs-wrap "commit msg"`)
- 빠른 요약만 원할 때 (`/vs-wrap --quick`)

**사용하지 마세요:**
- merge 결과를 리뷰하려면 → `/vs-recap`
- 에러 패턴만 기록하려면 → `/error-kb`
- 커밋만 하려면 → `/vs-commit`

## Steps

### Step 1: 인자 파싱

`$ARGUMENTS`를 파싱하세요:
- `--quick` 플래그 존재 여부 확인
- `--quick` 제거 후 나머지 텍스트가 커밋 메시지
- 예: `/vs-wrap --quick "fix: auth bug"` → quick=true, commit_msg="fix: auth bug"
- 예: `/vs-wrap "fix: auth bug"` → quick=false, commit_msg="fix: auth bug"
- 예: `/vs-wrap --quick` → quick=true, commit_msg=null
- 예: `/vs-wrap` → quick=false, commit_msg=null

### Step 2: 사전 조건 확인

1. Bash 도구로 `git status --porcelain` 실행
2. 변경사항이 없고 commit_msg도 없으면:
   - "분석할 변경사항이 없습니다." 출력 후 종료
3. commit_msg가 있으면:
   - `/vs-commit` 스킬 로직으로 커밋 실행
   - 커밋 완료 후 Step 3으로 계속

### Step 3: 세션 데이터 수집

아래 4개 명령을 **병렬로** 실행하세요 (Bash 도구 4회):

```bash
# 1. 변경 통계
git diff --stat HEAD~$(git log --oneline --since="8 hours ago" | wc -l) 2>/dev/null || git diff --stat

# 2. 세션 커밋 로그
git log --oneline --since="8 hours ago"

# 3. 플랜 상태
vs --json plan list --status active 2>/dev/null | head -20

# 4. TODO/FIXME/HACK (변경 파일만)
git diff --name-only HEAD~5 2>/dev/null | xargs grep -n "TODO\|FIXME\|HACK" 2>/dev/null | head -30
```

수집 데이터를 변수에 저장하세요:
- `session_diff_stat`: 변경 통계
- `session_log`: 커밋 로그
- `plan_status`: 플랜 상태 (없으면 "adhoc")
- `todo_list`: TODO/FIXME/HACK 목록

**대용량 diff 보호** (EC2):
수집 후 diff 라인 수를 확인하세요:
```bash
DIFF_LINES=$(git diff HEAD~5 2>/dev/null | wc -l)
```
- 1000줄 이하: `session_diff_stat`를 그대로 에이전트에 전달
- 1000줄 초과: `git diff --stat`만 에이전트에 전달 (전체 diff 생략). 에이전트 프롬프트에 `"[대용량 세션: diff --stat만 제공됨]"` 명시

### Step 4: 모드 분기

**--quick 모드** (Step 4a):
에이전트 없이 수집 데이터만으로 경량 요약을 생성하세요:

```
## Quick Session Summary

### 변경 사항
{session_diff_stat}

### 커밋 ({N}개)
{session_log}

### TODO/FIXME ({N}개)
{todo_list 요약}
```

인라인으로 출력만 하고 파일 저장 없이 종료하세요.

**일반 모드** (Step 4b):
Step 5로 진행하세요.

### Step 5: 세션 분석 에이전트 디스패치

session-analyst 에이전트를 Agent 도구로 디스패치하세요 (model: haiku, run_in_background: true):

```
당신은 session-analyst 에이전트입니다.
agents/session-analyst.md의 Execution Process를 따라 실행하세요.

git_diff_stat: {session_diff_stat}
git_log: {session_log}
plan_status: {plan_status}
todo_list: {todo_list}
```

### Step 6: 결과 수집 + Partial Report Fallback

에이전트 완료를 대기하세요 (최대 60초).

**Partial Report 정책**:
- 3개 모두 성공 → 전체 리포트 생성
- 1~2개 성공 → 성공한 에이전트 결과만으로 리포트 생성 + 실패 섹션에 "에이전트 타임아웃" 표시
- 0개 성공 → quick 모드 fallback (Step 4a와 동일한 경량 요약)

각 에이전트 출력에서 JSON을 파싱하세요. 파싱 실패 시 해당 에이전트를 실패로 처리하세요.

### Step 7: 세션 리포트 생성

수집된 결과를 통합하여 리포트를 생성하세요.

**리포트 경로**: `.claude/session-reports/YYYY-MM-DD-{plan_id|adhoc}.md`

```markdown
## Session Report — {date}

### Learnings ({N}개)
{session-analyst 결과의 learnings를 포맷}
- [{type}] {summary} (commit: {hash})
  {detail}

### Automation Opportunities ({N}개)
{session-analyst 결과의 opportunities를 포맷}
- [{effort}] {pattern} → {suggestion}

### Follow-ups ({N}개, priority 순)
{session-analyst 결과의 followups를 포맷}
- [{priority}] {title} — {context}

### Session Stats
- Commits: {N}
- Files changed: {N}
- Learnings: {N} (success: {N}, mistake: {N}, insight: {N})
- Automation opportunities: {N}
- Follow-ups: {N} (high: {N}, medium: {N}, low: {N})
```

Bash 도구로 `mkdir -p .claude/session-reports` 후 Write 도구로 파일을 저장하세요.

### Step 7a: Self-Improve 통합 (학습 규칙 변환)

session-analyst의 learnings에서 규칙으로 변환할 항목을 처리하세요.

**변환 대상**: `type`이 `"success"` 또는 `"mistake"`인 항목

**중복 검증** (3단계):
1. **self-improve pending 충돌 방지**: 각 학습 항목의 `source_commit`이 `.claude/self-improve/pending/` 디렉토리의 JSON 파일에 이미 존재하는지 확인
   ```bash
   grep -rl "{source_commit}" .claude/self-improve/pending/ 2>/dev/null
   ```
   - 매칭되면 해당 항목 건너뛰기 (self-improve가 이미 처리 예정)

2. **기존 rules 중복 확인**: 같은 카테고리 + 유사한 제목의 규칙이 이미 있는지 확인
   ```bash
   ls .claude/rules/SESSION_LEARNING-*.md 2>/dev/null
   ```
   - 기존 규칙의 title과 학습 항목의 summary가 70% 이상 유사하면 건너뛰기

3. **상한 체크**: 활성 규칙이 30개를 초과하면 변환을 중단하고 `/self-improve-review`를 권장

**규칙 파일 생성**:
변환 대상 항목마다 `.claude/rules/SESSION_LEARNING-{slug}.md` 파일을 Write 도구로 생성하세요:

```markdown
---
title: {summary}
source: vs-wrap
category: SESSION_LEARNING
prevented: 0
created: {YYYY-MM-DD}
last_triggered: {YYYY-MM-DD}
---

## Rule
{summary를 명령형 규칙으로 변환}

## Why
{detail — 이 규칙이 필요한 이유}

## Examples
### {type == "success" ? "Good Pattern" : "Bad → Good"}
{source_commit에서 관련 코드 패턴 참조}

## Applies When
{category에 해당하는 상황 — 파일 패턴이나 모듈 힌트}
```

- `{slug}`: summary를 lowercase, 공백→하이픈, 50자 이내로 변환

**변환 결과 표시**:
```
### Self-Improve 연동
- 규칙 변환: {N}건 (success: {N}, mistake: {N})
- 중복 건너뜀: {N}건 (pending: {N}, 기존 rules: {N})
```

### Step 8: 사용자에게 요약 표시

리포트 핵심을 사용자에게 인라인으로 표시하세요:
- Learnings 상위 3개
- Automation 상위 2개
- Follow-ups 상위 3개 (high 우선)
- 리포트 파일 경로

### Step 8a: 아티팩트 정리 (자동)

세션 리포트 생성 후 .claude/ 아티팩트를 자동으로 정리합니다.

Bash 도구로 실행하세요:
```bash
vs --json artifact cleanup 2>/dev/null
```

**결과 처리**:
- 성공 시 (삭제 건수 > 0): 세션 요약에 정리 결과를 포함하세요:
  ```
  ### Artifact Cleanup
  - handoffs: {N}, reports: {N}, empty dirs: {N}
  - rules — archived: {N}, conflicts: {N}
  ```
- 성공 시 (삭제 건수 = 0): "Artifact cleanup: 정리 대상 없음" 한 줄만 표시
- **실패 시**: 경고만 출력하고 vs-wrap을 정상 종료하세요:
  ```
  ⚠ Artifact cleanup 실패 — 다음에 다시 시도합니다.
  ```

### Step 9: 백로그 연결 (선택적)

session-analyst의 followups에서 `priority`가 `"high"`인 항목을 백로그 추가 대상으로 처리하세요.

**adhoc 세션 스킵**: plan_status가 "adhoc"이면 이 단계를 건너뛰세요.
→ "백로그 연결 스킵 — adhoc 세션" 메시지 표시

**high priority 항목이 있을 때**:
`AskUserQuestion`으로 제안하세요:
- question: "다음 후속 작업을 백로그에 추가할까요?"
- header: "백로그 추가"
- multiSelect: true
- 각 high 항목을 선택지로 제시:
  - label: "{title}", description: "{context}"

**사용자 승인 시**: 선택된 항목마다 Bash 도구로 실행:
```bash
vs --json backlog add --title "{title}" --description "{context}" --tags "vs-wrap,followup"
```

**결과 표시**:
```
### 백로그 연동
- 추가: {N}건
- 건너뜀: {N}건
```

## Integration

- **self-improve**: session-analyst의 learnings 중 성공/실수 패턴은 Step 7a에서 `.claude/rules/SESSION_LEARNING-*.md`로 자동 변환
- **backlog**: session-analyst의 followups 중 high 항목은 Step 9에서 백로그 추가 제안
- **vs-recap**: merge 후 리뷰는 vs-recap, 세션 마무리는 vs-wrap으로 역할 분리

## 다음 단계

- → `/vs-next`로 다음 태스크 재개
- → `/vs-dashboard`로 전체 진행률 확인
- → `/self-improve`로 학습 규칙 생성 (session-analyst 결과 기반)
