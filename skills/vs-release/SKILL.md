---
name: vs-release
description: Use when releasing a new VibeSpec version. Conventional Commits 기반 체인지로그 생성, 버전 범프, git tag, GitHub Release를 자동 수행합니다.
---

# VibeSpec Release

Conventional Commits 기반으로 체인지로그를 생성하고, 버전을 범프하고, git tag와 GitHub Release를 만듭니다.

## Input Resolution

1. **`patch`** / **`minor`** / **`major`** — 지정된 버전 범프 적용
2. **인자 없음** — 커밋 내역을 분석하여 자동 결정:
   - `feat` 포함 → minor
   - `fix`만 → patch
   - BREAKING CHANGE → major

## Process

### Phase 1: 사전 검증

```bash
git status -s
git log --oneline v{current}..HEAD
```

- 커밋되지 않은 변경사항이 있으면 STOP: "커밋되지 않은 변경사항이 있습니다. 먼저 커밋하세요."
- 새로운 커밋이 없으면 STOP: "마지막 릴리즈 이후 변경사항이 없습니다."
- 테스트 실행: `npm test` — 실패하면 STOP: "테스트가 실패합니다. 수정 후 다시 시도하세요."
- 빌드 실행: `npm run build` — 실패하면 STOP: "빌드가 실패합니다. 수정 후 다시 시도하세요."
- README 동기화 검증:
  1. `README.md`의 Slash Commands 테이블과 `skills/` 디렉토리의 실제 스킬 목록을 비교
  2. `README.md`의 MCP Tools 테이블과 `src/`의 실제 MCP 도구 목록을 비교
  3. `README.md`의 Plugin Structure 트리와 실제 디렉토리 구조를 비교
  4. 누락/불일치가 있으면 사용자에게 보고하고 자동 수정 제안:
     ```
     README 동기화 필요:
     - 누락된 스킬: /vs-pick, /vs-review
     - 누락된 MCP 도구: vp_plan_update, vp_insights
     자동 수정할까요? (Y / 건너뛰기)
     ```
  5. **Y** → README를 수정하고 릴리즈 커밋에 포함
  6. **건너뛰기** → 경고만 남기고 계속 진행

### Phase 2: 버전 결정

1. 현재 버전을 `package.json`에서 읽음
2. `git log --oneline v{current}..HEAD`에서 커밋 타입 분석
3. 버전 범프 규칙:
   - `BREAKING CHANGE` 또는 `!:` → **major**
   - `feat` → **minor**
   - `fix`, `refactor`, `perf`, `chore`, `docs`, `test`, `ci` → **patch**
4. 사용자에게 확인 (릴리즈 전체 흐름을 한 번에 결정):
   ```
   현재 버전: v{current}
   새 버전: v{next} ({bump_type})

   포함될 커밋 ({count}개):
   - abc1234 feat(auth): 로그인 API 추가
   - def5678 fix(db): 쿼리 타임아웃 수정

   진행할까요?
   - Y: 릴리즈 생성 + push + GitHub Release까지 전부 수행
   - local: 릴리즈 커밋 + 태그만 생성 (push 안 함)
   - 버전 직접 입력 (예: 1.0.0)
   ```
   → **Y** 선택 시 Phase 3~7을 push + GitHub Release 포함하여 논스톱 실행
   → **local** 선택 시 Phase 3~5만 실행하고 Phase 7에서 "로컬만" 보고
   → 버전 직접 입력 시 해당 버전으로 덮어쓰고 동일하게 진행

### Phase 3: 체인지로그 생성

`v{current}..HEAD` 범위의 커밋을 분석하여 CHANGELOG.md 업데이트:

1. 커밋을 카테고리별로 분류:
   - `feat` → **새 기능**
   - `fix` → **버그 수정**
   - `refactor` → **리팩토링**
   - `perf` → **성능 개선**
   - `test` → **테스트**
   - `docs` → **문서**
   - `chore`, `ci` 등 → **기타**
2. 각 항목 형식: `- **{scope}**: {한글 설명} ({short_hash})`
3. CHANGELOG.md 최상단에 새 섹션 추가 (기존 내용 유지)

```markdown
## [{next_version}] - {YYYY-MM-DD}

### 새 기능
- **skills**: vs-pick 태스크 선택 스킬 추가 (94d67a0)

### 버그 수정
- ...
```

### Phase 4: 버전 파일 업데이트

아래 파일들의 version 필드를 새 버전으로 변경:

1. `package.json` — `"version": "{next}"`

### Phase 5: 릴리즈 커밋 + 태그

```bash
git add CHANGELOG.md package.json README.md
git commit -m "$(cat <<'EOF'
chore(release): v{next} 릴리즈

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
git tag v{next}
```

### Phase 6: Push + GitHub Release 생성

Phase 2에서 **Y**를 선택한 경우에만 실행. **local** 선택 시 이 단계를 건너뛰고 Phase 7로 이동.

```bash
git push origin main
git push origin v{next}
gh release create v{next} --title "v{next}" --notes-file - <<'EOF'
{changelog_section}
EOF
```

### Phase 7: 결과 보고

```
릴리즈 완료!

| 항목 | 값 |
|------|-----|
| 버전 | v{next} |
| 타입 | {bump_type} |
| 커밋 | {commit_count}개 포함 |
| 태그 | v{next} |
| Release | {github_release_url 또는 "로컬만"} |
```

## Rules

- NEVER release with failing tests or build
- NEVER release with uncommitted changes
- NEVER force-push tags — 태그가 이미 존재하면 STOP
- NEVER skip user confirmation at Phase 2 — 이것이 유일한 확인 지점
- 체인지로그는 한글로 작성
- 커밋 메시지의 scope와 설명을 그대로 활용
- CHANGELOG.md의 기존 내용을 절대 삭제하지 않음
- `Co-Authored-By` 라인은 릴리즈 커밋에 항상 포함
