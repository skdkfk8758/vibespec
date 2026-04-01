---
name: vs-recap
description: [Lifecycle] Review merge results from previous sessions.
invocation: user
argument-hint: "[--list | --regenerate | <commit-hash>]"
---

# Merge Recap

이전 세션에서 수행한 머지 작업의 리포트를 조회합니다. 변경 요약, Review Checklist, 충돌 해결 기록, AI 판단 로그를 확인할 수 있습니다.

## When to Use

**사용하세요:**
- 워크트리 머지 후 새 세션에서 결과를 확인할 때
- "아까 뭐 했지?", "뭘 확인해야 해?" 같은 질문에 답할 때
- 과거 머지 리포트를 검색하거나 비교할 때

**사용하지 마세요:**
- 머지를 수행하려면 → `/vs-merge`
- 플랜 전체 상태를 보려면 → `/vs-dashboard`

## Current Context

- Recent merge reports: `!vs merge-report list --json 2>/dev/null | head -5`

## Steps

### 인자 파싱

`$ARGUMENTS`를 파싱하여 동작 모드를 결정하세요:
- 비어있거나 없음 → **기본 모드** (최신 리포트)
- `--list` → **목록 모드**
- `--regenerate` → **재생성 모드**
- 그 외 → **커밋 조회 모드** (인자를 commit hash로 취급)

---

### 1. 기본 모드 (인자 없음): 최신 리포트

1. Bash 도구로 `vs merge-report latest --json`을 실행하세요
2. 결과가 `null`이면:
   > "머지 리포트가 없습니다. `/vs-merge`로 머지를 완료하면 자동으로 생성됩니다."
   > "기존 머지 커밋에서 리포트를 생성하려면 `/vs-recap --regenerate`를 사용하세요."
3. 리포트가 있으면:
   - `report_path` 필드의 MD 파일을 `Read` 도구로 읽으세요
   - 아래 **출력 포맷**으로 표시하세요

---

### 2. 목록 모드 (--list): 과거 리포트

1. Bash 도구로 `vs merge-report list --json`을 실행하세요
2. 결과가 빈 배열이면: "머지 리포트가 없습니다." 표시
3. 테이블 형식으로 표시하세요:

   ```
   | # | 날짜 | 브랜치 | 커밋 | Checklist | 충돌 |
   |---|------|--------|------|-----------|------|
   | 1 | 2026-03-27 | fix_backlog → main | abc12345 | 🔴3 🟡2 🟢5 | 2 |
   | 2 | 2026-03-25 | auth-api → main | def67890 | 🔴1 🟡0 🟢3 | 0 |
   ```

4. `AskUserQuestion`으로 상세 조회할 리포트를 선택받으세요:
   - header: "리포트 선택"
   - 선택지: 각 리포트를 label로 (최대 4개), 또는 "닫기"
5. 선택된 리포트의 `report_path`를 `Read`로 읽어 **출력 포맷**으로 표시하세요

---

### 3. 커밋 조회 모드 (<commit-hash>): 특정 리포트

1. Bash 도구로 `vs merge-report show "$ARGUMENTS" --json`을 실행하세요
2. 리포트가 있으면 **출력 포맷**으로 표시
3. 리포트가 없으면:
   > "커밋 `{hash}`에 대한 리포트가 없습니다."
   > "`/vs-recap --regenerate`로 git history에서 리포트를 재생성할 수 있습니다."

---

### 4. 재생성 모드 (--regenerate): git 기반 리포트 생성

⚠️ **제한사항 경고를 반드시 먼저 표시하세요:**
> "이 리포트는 git history에서 재생성됩니다. 다음 정보는 복원할 수 없습니다:"
> - 충돌 해결 기록 (어떤 선택을 했는지)
> - AI 판단 로그 (AI가 어떤 부분을 추론/추측했는지)
> - Review Checklist의 확신도 태그 (모든 항목이 🟡 should로 설정됩니다)

1. **최근 squash merge 커밋 탐색**:
   ```bash
   git log --oneline -20
   ```
   커밋 메시지에서 squash merge 패턴을 찾으세요 (vs-merge가 생성한 커밋: `feat(scope):`, `fix(scope):` 등 conventional commit 형식 + `Co-Authored-By: Claude`)

2. `AskUserQuestion`으로 재생성할 커밋을 선택받으세요:
   - header: "재생성 대상 선택"
   - 후보 커밋 목록을 선택지로 제시

3. **diff 분석**:
   ```bash
   git diff {commit}^..{commit} --stat
   git diff {commit}^..{commit}
   ```

4. **기본 리포트 생성**:
   - `changes_summary`: diff에서 파일별 카테고리와 설명을 추출
   - `review_checklist`: 모든 변경 파일을 🟡 `should`로 설정 (확신도 판단 불가)
   - `conflict_log`: null (복원 불가)
   - `ai_judgments`: null (복원 불가)
   - `verification`: `{"build": "skip", "test": {"status": "skip"}, "lint": "skip", "acceptance": "skip"}`

5. **.claude/reports/ 에 MD 파일 생성** (Write 도구 사용)

6. **DB에 저장**: Bash로 `vs merge-report create ...` 실행

7. 생성된 리포트를 **출력 포맷**으로 표시

---

## 출력 포맷

리포트를 표시할 때 아래 섹션을 순서대로 출력하세요:

### 1. 헤더
```
# Merge Report: {source_branch} → {target_branch}
> {날짜} | Commit: {commit_hash (8자)} | Plan: {plan_id 또는 "없음"}
```

### 2. 변경 요약
카테고리별로 그룹화하여 표시:
```
## 변경 요약
### Features
- src/models/user.ts — 사용자 인증 필드 추가
### Fixes
- src/api/auth.ts — 세션 만료 처리 버그 수정
```

### 3. Review Checklist
확신도 태그별로 그룹화:
```
## ⚡ Review Checklist

### 🔴 반드시 확인 (3건)
- [ ] src/api/auth.ts:45 — 세션 만료 시간 30분 설정
  └ AI가 추측으로 설정 (요구사항에 명시 없음)

### 🟡 가능하면 확인 (2건)
- [ ] src/models/user.ts — 테스트 파일 없음
  └ 변경된 소스 파일에 대응하는 테스트가 없습니다

### 🟢 참고 (5건)
- src/utils/format.ts — import 경로 변경 (기계적 변환)
```

### 4. 충돌 해결 기록 (있을 때만)
```
## 충돌 해결 기록
| 파일 | Hunks | 선택 | 근거 |
|------|-------|------|------|
| src/api/auth.ts | 3 | AI 병합 | 양쪽 의도를 모두 반영 |
```

### 5. AI 판단 로그 (있을 때만)
```
## AI 판단 로그
### 🔴 Low Confidence
- src/api/auth.ts:45 — 세션 만료 시간 추측 (guess)
### 🟡 Medium Confidence
- ...
```

### 6. 검증 결과
```
## 검증 결과
- Build: ✅ pass
- Test: ✅ pass (23 passed)
- Lint: ✅ pass
- Acceptance: ⏭️ skip
```

### 7. 관련 태스크 (있을 때만)
```
## 관련 태스크
- #T-042: 사용자 인증 API 추가
- #T-043: 세션 관리 로직 구현
```

## Rules

- 리포트 내용을 임의로 수정하거나 생략하지 마세요 — DB에 저장된 그대로 표시합니다
- --regenerate로 생성된 리포트는 항상 제한사항 경고를 함께 표시하세요
- Review Checklist의 🔴 항목이 있으면 사용자에게 명시적으로 강조하세요
