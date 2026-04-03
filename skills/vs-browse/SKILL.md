---
name: vs-browse
description: [QA] Use when running exploratory browser QA without structured AC.
invocation: deferred
argument-hint: "[--url <dev-server-url>] [--focus <area>]"
---

# 탐색적 브라우저 QA

구조화된 Acceptance Criteria 없이, 실제 브라우저에서 앱을 자유롭게 탐색하며 이슈를 발견하는 **탐색적 테스팅** 스킬입니다.

## vs-acceptance와의 차이

| 구분 | vs-acceptance | vs-browse |
|------|--------------|-----------|
| 방식 | AC 기반 구조화된 검증 | 자유 탐색 기반 발견 |
| 입력 | plan_id + AC 목록 | URL + 선택적 focus 영역 |
| 목적 | "AC가 충족되는가?" 확인 | "눈에 보이는 이슈가 있는가?" 발견 |
| 시나리오 | 사전 생성 후 실행 | 탐색 중 동적으로 발견 |
| 적합한 상황 | 머지 전/후 검증 | 프로토타입 점검, 디자인 리뷰, UX 감사 |

## When to Use

**사용하세요:**
- 프로토타입이나 MVP를 빠르게 훑어보고 싶을 때
- 디자인/UX 이슈를 탐색적으로 찾고 싶을 때
- AC가 아직 정의되지 않은 기능을 점검할 때
- AI slop (과도한 그라디언트, 제네릭 아이콘, 불일치 간격) 탐지

**사용하지 마세요:**
- AC 기반 구조화된 검증 → `/vs-acceptance`
- 체계적 QA 시나리오 검증 → `/vs-qa`
- 코드 품질 리뷰 → `/vs-review`

## Prerequisites

이 스킬은 **Playwright MCP** 도구를 사용하여 브라우저를 조작합니다.
Playwright MCP가 설치되지 않은 환경에서는 **Graceful Degradation 모드**로 동작합니다 (아래 참조).

### Playwright MCP 설치
```bash
claude mcp add playwright -- npx @playwright/mcp@latest
```

### 사용 가능한 Playwright MCP 도구
| 도구명 | 용도 |
|--------|------|
| `mcp__playwright__browser_navigate` | URL로 이동 |
| `mcp__playwright__browser_snapshot` | 페이지 접근성 스냅샷 (구조 분석) |
| `mcp__playwright__browser_take_screenshot` | 시각적 스크린샷 캡처 |
| `mcp__playwright__browser_click` | 요소 클릭 |
| `mcp__playwright__browser_type` | 텍스트 입력 |
| `mcp__playwright__browser_hover` | 요소 호버 |
| `mcp__playwright__browser_select_option` | 드롭다운 선택 |
| `mcp__playwright__browser_press_key` | 키보드 입력 |
| `mcp__playwright__browser_console_messages` | 콘솔 메시지 확인 |
| `mcp__playwright__browser_wait_for` | 요소/상태 대기 |

## Steps

### Phase 1: 환경 확인 및 브라우저 준비

1. **Playwright MCP 가용성 확인**
   - `ToolSearch`로 `playwright` 키워드를 검색하여 Playwright MCP 도구 사용 가능 여부를 확인하세요
   - `mcp__playwright__browser_navigate` 도구가 존재하면 → Phase 2로 진행
   - 도구가 없으면 → Graceful Degradation 모드로 전환 (Phase 5 참조)

2. **Dev Server 확인**
   - `--url`이 지정되었으면 해당 URL 사용
   - 미지정이면 `package.json`에서 dev server 명령 감지
   - 기존 서버가 실행 중인지 확인 (`curl`로 health check)
   - 실행 중이 아니면 dev server를 백그라운드로 시작:
     ```bash
     npm run dev &
     DEV_PID=$!
     ```
   - 최대 30초 대기, health check 반복
   - 시작 실패 → Graceful Degradation 모드로 전환

3. **Focus 영역 설정**
   - `--focus`가 지정되었으면 해당 영역부터 탐색
   - 미지정이면 홈/루트 페이지부터 시작

### Phase 2: 탐색적 브라우징

Playwright MCP를 사용하여 앱을 자유롭게 탐색합니다. 다음 체크리스트를 기반으로 탐색하되, 체크리스트에 없는 이슈도 자유롭게 기록하세요.

1. **페이지 순회**
   - `mcp__playwright__browser_navigate`로 루트 페이지 열기
   - `mcp__playwright__browser_snapshot`으로 페이지 구조 분석
   - `mcp__playwright__browser_take_screenshot`으로 시각적 스크린샷 캡처
   - 네비게이션 링크를 `mcp__playwright__browser_click`으로 따라 이동
   - `--focus` 영역이 있으면 해당 영역을 우선 탐색

2. **시각적 검사 체크리스트**
   - [ ] 레이아웃 깨짐: 요소 겹침, 넘침(overflow), 잘림
   - [ ] 반응형 레이아웃: 뷰포트 크기 변경 시 레이아웃 유지
   - [ ] 폰트/색상 일관성: 동일 역할의 텍스트에 동일 스타일 적용
   - [ ] 간격/정렬: 일관된 spacing, 정렬 유지
   - [ ] AI slop 탐지: 과도한 그라디언트, 제네릭 placeholder 아이콘, 불일치 spacing, 무의미한 장식 요소
   - [ ] 다크모드/라이트모드 (지원 시): 모드 전환 후 시각적 이상 없음
   - [ ] 이미지/아이콘: 깨진 이미지, 누락된 아이콘 없음

3. **기능적 탐색 체크리스트**
   - [ ] 네비게이션: `browser_click`으로 모든 링크/버튼이 올바른 대상으로 이동하는지 확인
   - [ ] 폼 입력: `browser_click` → `browser_type`으로 필드 포커스, 입력, 유효성 검사 동작 확인
   - [ ] 인터랙션: `browser_hover`, `browser_click`으로 호버, 클릭, 토글 등 기본 인터랙션 확인
   - [ ] 에러 상태: 빈 입력, 잘못된 입력 시 적절한 에러 표시
   - [ ] 로딩 상태: `browser_wait_for`로 비동기 작업 중 로딩 인디케이터 표시 확인
   - [ ] 콘솔 에러: `browser_console_messages`로 브라우저 콘솔 에러 확인 (HMR/vite 관련 제외)

4. **UX 감사 체크리스트**
   - [ ] 접근성: 기본 키보드 내비게이션, 포커스 순서
   - [ ] 빈 상태: 데이터 없을 때 적절한 빈 상태 메시지
   - [ ] 피드백: 사용자 액션에 대한 시각적/텍스트 피드백

### Phase 3: 이슈 기록

탐색 중 발견한 이슈를 기록합니다:

1. **이슈 분류**
   - **visual**: 시각적 깨짐, 스타일 불일치, AI slop
   - **functional**: 기능 미동작, 에러 발생
   - **ux**: UX 개선 필요 사항
   - **performance**: 느린 로딩, 렌더링 지연

2. **이슈별 기록**
   - 스크린샷 (`.claude/browse-screenshots/` 디렉토리에 저장)
   - 발견 위치 (URL, 페이지 영역)
   - 심각도: critical / high / medium / low
   - 재현 경로 (어떤 동작으로 이슈를 발견했는지)

### Phase 4: 리포트 생성

```
## 탐색적 QA 리포트

### 탐색 범위
- 시작 URL: {url}
- Focus: {focus 영역 또는 "전체"}
- 탐색한 페이지: {N}개
- 탐색 모드: {browser | degraded}

### 발견 이슈
| # | 카테고리 | 심각도 | 위치 | 설명 | 스크린샷 |
|---|---------|--------|------|------|---------|
| 1 | visual | high | /dashboard | 카드 간격 불일치 | browse-001.png |

### AI Slop 탐지 결과
- {발견 항목 또는 "AI slop 징후 없음"}

### 종합 소견
- {전반적인 품질 평가 1-2문장}
- {우선 수정 권장 사항}
```

### Phase 5: Graceful Degradation 모드

Playwright MCP를 사용할 수 없거나 dev server를 시작할 수 없는 경우:

1. **사용자 알림**
   ```
   ⚠️ Playwright MCP를 사용할 수 없어 코드 분석 기반 탐색적 QA로 전환합니다.
   실제 브라우저 확인은 제한됩니다.
   
   설치: claude mcp add playwright -- npx @playwright/mcp@latest
   설치 후 Claude Code를 재시작하세요.
   ```

2. **코드 기반 시각적 분석**
   - 프로젝트의 CSS/SCSS/스타일 파일을 Grep/Read로 분석
   - 컴포넌트 파일 (.tsx/.vue/.svelte)의 구조와 스타일을 검토
   - 일관성 없는 spacing, 하드코딩된 색상값, 미사용 스타일 탐지
   - DESIGN.md가 있으면 디자인 가이드 대비 코드 일치 여부 확인

3. **정적 AI slop 탐지**
   - CSS에서 과도한 `linear-gradient`, `box-shadow` 사용 패턴 검색
   - 제네릭 placeholder 텍스트 (Lorem ipsum, placeholder.com 등) 검색
   - 인라인 스타일 남용 패턴 검색

4. **Degraded 리포트 생성**
   - 위와 동일한 형식이되, `탐색 모드: degraded (코드 분석)` 표시
   - "Playwright MCP 설치 후 `/vs-browse`를 재실행하면 실제 브라우저 검증이 가능합니다" 안내

### Phase 6: 정리

1. **Dev Server 정리** (시작한 경우)
   ```bash
   kill $DEV_PID 2>/dev/null
   ```

2. **후속 안내**
   - `AskUserQuestion`으로 다음 단계 선택:
     - "이슈 기반 수정 시작" → 발견된 이슈 우선순위별로 수정 가이드 제공
     - "AC 기반 검증 진행" → `/vs-acceptance`로 전환
     - "종합 QA 실행" → `/vs-qa`로 전환
     - "완료" → 리포트만 남기고 종료

## Rules

- Playwright MCP 불가 시 에러로 중단하지 말고 반드시 Graceful Degradation으로 전환하세요
- 스크린샷은 `.claude/browse-screenshots/` 디렉토리에 저장하세요
- 콘솔 에러 중 `[HMR]`, `[vite]`, `[webpack-dev-server]` 관련 메시지는 무시하세요
- 탐색은 최대 10개 페이지 또는 5분 이내로 제한하세요 (심층 탐색은 `--focus`로)
- DESIGN.md 파일이 프로젝트 루트에 있으면 반드시 참조하여 디자인 가이드 일치 여부를 확인하세요
- 코드를 **수정하지 마세요** — 이슈 발견과 리포트만 수행합니다

## 다음 단계

- → `/vs-acceptance`로 AC 기반 구조화된 검증
- → `/vs-qa`로 종합 QA 실행
- → `/vs-qa-findings`로 이슈 관리
