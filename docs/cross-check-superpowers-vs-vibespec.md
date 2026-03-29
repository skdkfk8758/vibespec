# VibeSpec vs Superpowers 크로스체크 분석

> 목적: Superpowers의 설계 패턴에서 VibeSpec이 배울 수 있는 개선 방향 도출
> 분석일: 2026-03-28

---

## 1. 아키텍처 비교 요약

| 항목 | VibeSpec (v0.28.0) | Superpowers (120k stars) |
|------|-------------------|------------------------|
| 스킬 수 | 38개 | 9개 |
| 에이전트 수 | 10개 | 1개 (+ 5개 프롬프트 템플릿) |
| 훅 수 | 11개 | 1개 |
| 데이터 저장 | SQLite (14 테이블) | 파일 기반 (markdown) |
| 플랫폼 | Claude Code 전용 | Claude Code, Cursor, Codex, OpenCode, Gemini CLI |
| 설치 | 마켓플레이스 | 마켓플레이스 + 멀티플랫폼 |

---

## 2. Superpowers에서 배울 수 있는 개선 포인트

### 2.1 HARD-GATE 패턴 (높은 우선순위)

**Superpowers 방식:**
```
<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project,
or take any implementation action until you have presented a design and
the user has approved it.
</HARD-GATE>
```
- brainstorming 스킬에 HARD-GATE를 걸어서 "아무리 간단해도" 디자인 승인 없이는 코드 작성 불가
- "This Is Too Simple To Need A Design" 안티패턴을 명시적으로 금지

**VibeSpec 현황:**
- vs-plan이 스펙 작성을 유도하지만, **강제하는 메커니즘이 없음**
- 사용자가 스킬을 건너뛰고 바로 코딩할 수 있음

**개선 방향:**
- vs-plan 또는 vs-ideate에 HARD-GATE 패턴 도입
- "간단한 프로젝트" 예외를 허용하지 않는 명시적 규칙
- 단, VibeSpec은 adhoc 스킬이 있으므로 "빠른 수정"용 예외 경로는 유지

---

### 2.2 2단계 리뷰 시스템 (높은 우선순위)

**Superpowers 방식:**
구현 후 2단계 리뷰를 **반드시** 거침:
1. **Spec Reviewer** — 구현이 스펙과 일치하는지 (기능 검증)
2. **Code Quality Reviewer** — 코드 품질, 유지보수성 (품질 검증)

핵심 원칙: "구현자의 리포트를 신뢰하지 마라" (DO NOT trust the report)

**VibeSpec 현황:**
- verification 스킬이 AC 기반 검증을 하지만, **스펙 준수와 코드 품질을 분리하지 않음**
- vs-code-review가 존재하지만 구현 파이프라인에 필수로 통합되어 있지 않음
- QA 에이전트 팀이 있지만 "구현 직후 즉시 리뷰"와는 다른 타이밍

**개선 방향:**
- vs-exec/vs-next 태스크 완료 후 2단계 리뷰 자동 트리거
  - Phase 1: spec-compliance-check (AC 일치 여부)
  - Phase 2: code-quality-check (품질 검증)
- "구현자 self-report 불신" 원칙 도입 — 독립 검증 에이전트가 코드를 직접 읽도록

---

### 2.3 서브에이전트 프롬프트 템플릿 체계 (중간 우선순위)

**Superpowers 방식:**
- 서브에이전트 디스패치 시 **정밀하게 설계된 프롬프트 템플릿**을 사용
- `implementer-prompt.md`, `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md`
- 각 템플릿에 플레이스홀더({WHAT_WAS_IMPLEMENTED}, {BASE_SHA} 등) 포함
- "세션 컨텍스트를 상속하지 않고, 필요한 것만 정확히 구성"

**핵심 원칙:**
> "They should never inherit your session's context or history — you construct exactly what they need."

**VibeSpec 현황:**
- 에이전트 파일에 역할 정의는 있지만, **디스패치 시 프롬프트 구성 가이드가 없음**
- tdd-implementer 등이 에이전트로 정의되어 있지만 컨텍스트 격리 원칙이 약함

**개선 방향:**
- 각 에이전트에 대응하는 `dispatch-prompt.md` 템플릿 작성
- 컨텍스트 격리 원칙 명문화: 코디네이터가 서브에이전트에 전달할 정보를 정밀 구성
- 플레이스홀더 기반 템플릿으로 표준화

---

### 2.4 Visual Companion / 시각적 브레인스토밍 (중간 우선순위)

**Superpowers 방식:**
- `visual-companion.md`로 브라우저 기반 HTML 목업 서빙
- brainstorming 중 "시각적 질문인가?" 판단 → 브라우저로 목업 표시
- HTML 파일 워치 → 자동 서빙 → 사용자 클릭 선택 → 이벤트 수집

**VibeSpec 현황:**
- browser-control 스킬이 있지만 주로 QA 검증용
- 브레인스토밍 단계에서 시각적 도구 없음
- Figma 연동은 있지만 외부 도구 의존

**개선 방향:**
- vs-ideate에 "시각적 질문 감지" 로직 추가
- 간단한 HTML 목업 생성 + browser-control로 프리뷰하는 경로 추가
- 또는 pencil MCP 활용하여 시각적 brainstorming 지원

---

### 2.5 using-superpowers 메타 스킬 패턴 (중간 우선순위)

**Superpowers 방식:**
- `using-superpowers` 스킬이 SessionStart 훅으로 **전문이 자동 주입**됨
- "1%라도 스킬이 적용될 가능성이 있으면 반드시 호출" 강제
- 스킬 우선순위 체계: 사용자 지시 > Superpowers 스킬 > 기본 시스템 프롬프트

**VibeSpec 현황:**
- vs-setup/vs-resume가 있지만 "스킬 사용 규칙" 자체를 강제하는 메타 스킬이 없음
- 각 스킬의 트리거 조건이 description에 있지만, 통합 라우팅 로직이 없음

**개선 방향:**
- `vs-router` 또는 `vs-meta` 같은 메타 스킬 도입
- SessionStart에서 "어떤 상황에 어떤 스킬을 써야 하는지" 라우팅 테이블 주입
- 스킬 호출 강제성 레벨 정의 (MUST / SHOULD / MAY)

---

### 2.6 finishing-a-development-branch 패턴 (낮은 우선순위)

**Superpowers 방식:**
구현 완료 후 4개 옵션을 **정확히** 제시:
1. Merge locally
2. Push and create PR
3. Keep as-is
4. Discard

→ 선택 실행 → 워크트리 정리

**VibeSpec 현황:**
- vs-merge가 squash-merge를 수행하지만, **옵션 제시 패턴이 없음**
- 워크트리 정리는 수동

**개선 방향:**
- vs-merge에 옵션 선택 UI 패턴 도입
- Discard 시 확인 단계 강화

---

### 2.7 플랜 문서 저장 위치 표준화 (낮은 우선순위)

**Superpowers 방식:**
- 스펙: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- 플랜: `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- 파일 기반이라 git으로 버전 관리 + 코드 리뷰 가능

**VibeSpec 현황:**
- 모든 데이터가 SQLite DB에 저장됨
- 스펙/플랜을 파일로 내보내는 기능 없음

**개선 방향:**
- DB 저장과 병행하여 markdown 파일 export 기능 추가
- `docs/vibespec/specs/`, `docs/vibespec/plans/` 경로로 자동 내보내기
- git diff로 스펙/플랜 변경 이력 추적 가능하게

---

## 3. VibeSpec이 이미 우위에 있는 영역

| 영역 | VibeSpec 강점 | Superpowers 약점 |
|------|-------------|-----------------|
| **QA 파이프라인** | 5개 QA 에이전트 팀 (coordinator, func, flow, acceptance, security) | QA 없음, 코드 리뷰로만 대체 |
| **데이터 추적** | SQLite 14테이블, 메트릭, 이벤트 감사 로그 | 파일 기반, 메트릭 추적 없음 |
| **에러 학습** | error-kb + self-improve + self-improve-review | 없음 |
| **안전 가드** | careful + freeze + guard 3단계 | 없음 |
| **백로그 관리** | vs-backlog으로 사전 관리 | 없음 |
| **세션 연속성** | vs-resume + vs-dashboard + context_log | 없음 |
| **디자인 시스템** | vs-design-init + vs-design-review + DESIGN.md | 없음 |
| **커밋 추적성** | vs-commit으로 태스크 ID 자동 포함 | 없음 |

---

## 4. 개선 우선순위 로드맵

### Phase 1: 즉시 적용 가능 (스킬 텍스트 수정만)
1. **HARD-GATE 패턴** — vs-ideate/vs-plan에 구현 차단 게이트 추가
2. **"구현자 불신" 원칙** — verification 스킬에 "리포트를 신뢰하지 말고 코드를 직접 읽어라" 추가
3. **스킬 호출 강제성** — 각 스킬 description에 MUST/SHOULD/MAY 레벨 명시

### Phase 2: 구조적 개선 (새 파일/기능 추가)
4. **2단계 리뷰 시스템** — spec-compliance + code-quality 분리 리뷰 도입
5. **서브에이전트 프롬프트 템플릿** — 각 에이전트용 dispatch-prompt.md 작성
6. **메타 라우팅 스킬** — 스킬 선택 라우팅 테이블 자동 주입

### Phase 3: 기능 확장
7. **스펙/플랜 markdown export** — DB와 파일 이중 저장
8. **시각적 brainstorming** — vs-ideate에 시각적 도구 통합
9. **브랜치 완료 옵션 UI** — vs-merge에 4가지 옵션 패턴 도입

---

## 5. 핵심 인사이트

### Superpowers의 성공 요인 (120k stars)
1. **극단적 단순성**: 9개 스킬로 전체 워크플로우 커버
2. **강제성**: HARD-GATE, EXTREMELY_IMPORTANT 같은 강한 어조로 스킬 준수 강제
3. **불신 기반 검증**: "구현자를 신뢰하지 마라"는 원칙
4. **멀티플랫폼**: 5개 플랫폼 지원으로 넓은 사용자층
5. **낮은 진입 장벽**: DB 없이 파일 기반으로 즉시 사용 가능

### VibeSpec의 차별화 요인
1. **데이터 기반 워크플로우**: 메트릭, 이벤트, 통계로 개발 프로세스 정량화
2. **QA 자동화**: 에이전트 팀 기반 포괄적 품질 검증
3. **자기 학습**: error-kb + self-improve로 반복 실수 방지
4. **안전 가드**: 파괴적 작업 자동 차단
5. **깊은 통합**: 커밋, 배포, 세션 관리까지 end-to-end

### 균형점
- Superpowers는 "적은 스킬, 강한 강제"로 단순하고 효과적
- VibeSpec은 "많은 스킬, 깊은 기능"으로 포괄적이고 강력
- **VibeSpec이 배울 점**: 강제성과 불신 기반 검증 패턴
- **과도하게 따라할 필요 없는 점**: 멀티플랫폼 (Claude Code 집중이 더 깊은 통합 가능)
