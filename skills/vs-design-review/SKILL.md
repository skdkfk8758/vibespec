---
name: vs-design-review
description: "Use when auditing UI implementation against design system. 구현된 UI가 DESIGN.md에 정의된 디자인 시스템과 일치하는지 감사합니다."
invocation: user
---

# Design Review (디자인 감사)

구현 완료 후 UI가 DESIGN.md에 정의된 디자인 시스템을 준수하는지 검증합니다.

## When to Use

**사용하세요:**
- UI/프론트엔드 태스크 구현 완료 후
- 디자인 일관성에 의문이 있을 때
- PR 머지 전 디자인 품질 확인이 필요할 때

**사용하지 마세요:**
- DESIGN.md가 없는 프로젝트 (먼저 `/vs-design-init`을 실행하세요)
- 백엔드 전용 변경

## Prerequisites

- 프로젝트 루트에 DESIGN.md가 존재해야 합니다
- 감사 대상 UI가 구현되어 있어야 합니다

## Severity Levels

| 레벨 | 의미 | 예시 |
|------|------|------|
| **Critical** | 레이아웃이 깨지거나 사용 불가 | 요소 겹침, 반응형 깨짐, 클릭 불가 영역 |
| **High** | 디자인 토큰 미준수 | 하드코딩된 색상, 정의되지 않은 폰트 크기 사용 |
| **Medium** | 미세한 간격/정렬 불일치 | 간격 토큰과 2-4px 차이, 미세한 정렬 오류 |
| **Low** | 스타일 선호 수준 | 그림자 강도, 애니메이션 속도 등 미세 조정 |

## Steps

1. **DESIGN.md 로드**

   프로젝트 루트에서 DESIGN.md를 읽어 디자인 시스템 기준을 파악하세요.
   - DESIGN.md가 없으면: "DESIGN.md가 없습니다. `/vs-design-init`으로 디자인 시스템을 먼저 정의하세요." 안내 후 종료
   - 각 섹션(Color, Typography, Spacing, Component Style)의 토큰 값을 기준으로 삼으세요

2. **감사 대상 파일 식별**

   `AskUserQuestion`으로 감사 범위를 확인하세요:
   - question: "디자인 감사 범위를 선택해주세요"
   - header: "감사 범위"
   - multiSelect: false
   - 선택지:
     - label: "현재 플랜의 변경 파일", description: "현재 active 플랜에서 변경된 UI 파일을 자동 감지합니다"
     - label: "특정 파일/디렉토리 지정", description: "감사할 파일이나 디렉토리를 직접 지정합니다"
     - label: "최근 커밋 변경분", description: "최근 N개 커밋에서 변경된 UI 파일을 감사합니다"

   대상 파일을 수집한 후, UI 관련 파일(`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`)만 필터링하세요.

3. **80항목 디자인 감사**

   대상 파일을 읽고 아래 **10개 카테고리, 80개 항목**을 순서대로 검증하세요.
   각 항목은 고유 ID로 식별되며, PASS/FAIL로 판정합니다.

   ### 3a. Color (15항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | CLR-01 | 하드코딩 hex 색상 | `#[0-9a-fA-F]{3,8}` | high |
   | CLR-02 | 하드코딩 rgb/rgba | `rgba?\(` | high |
   | CLR-03 | 하드코딩 hsl | `hsla?\(` | high |
   | CLR-04 | DESIGN.md 미정의 색상 | 토큰 목록 대조 | high |
   | CLR-05 | 시맨틱 색상 미사용 (success/error/warning) | `green|red|yellow` 직접 사용 | medium |
   | CLR-06 | opacity 불일치 (같은 요소 다른 투명도) | `opacity:` 값 비교 | medium |
   | CLR-07 | 다크모드 미대응 색상 | `dark:` 클래스 누락 확인 | medium |
   | CLR-08 | 색상 대비 부족 (텍스트/배경) | 색상값 대비 계산 | high |
   | CLR-09 | 브랜드 색상 일관성 | primary 색상 변형 확인 | medium |
   | CLR-10 | 그라디언트 과다 사용 | `gradient` 3회 이상 | medium |
   | CLR-11 | 투명 배경 위 텍스트 가독성 | `bg-transparent`+텍스트 | medium |
   | CLR-12 | 호버/포커스 색상 미정의 | `:hover`/`:focus` 색상 | low |
   | CLR-13 | 비활성 상태 색상 미정의 | `disabled` 스타일 | low |
   | CLR-14 | 선택 상태 색상 미정의 | `selected`/`active` | low |
   | CLR-15 | 색상 변수명 불일치 | CSS 변수명과 토큰명 대조 | low |

   ### 3b. Typography (10항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | TYP-01 | 미정의 폰트 패밀리 | `font-family:` 토큰 외 | high |
   | TYP-02 | 미정의 폰트 사이즈 | `font-size:` 스케일 외 | high |
   | TYP-03 | 미정의 폰트 웨이트 | `font-weight:` 정의 외 | medium |
   | TYP-04 | line-height 불일치 | `line-height:` 비표준 | medium |
   | TYP-05 | letter-spacing 임의값 | `letter-spacing:` 토큰 외 | low |
   | TYP-06 | 텍스트 truncation 누락 | 긴 텍스트에 `truncate`/`line-clamp` 없음 | medium |
   | TYP-07 | 제목 계층 스킵 | h1→h3 (h2 누락) | medium |
   | TYP-08 | 본문 최대 너비 미설정 | `max-width` 없는 텍스트 블록 | low |
   | TYP-09 | 폰트 로딩 전략 미설정 | `font-display:` 누락 | low |
   | TYP-10 | 언어/i18n 폰트 미대응 | CJK 폰트 fallback | low |

   ### 3c. Spacing (10항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | SPC-01 | 간격 토큰 미사용 | `margin`/`padding` 임의값 | medium |
   | SPC-02 | 기본 단위 배수 위반 | 4px/8px 배수 아닌 값 | medium |
   | SPC-03 | 인라인 스타일 임의 간격 | `style=".*margin\|padding"` | high |
   | SPC-04 | 컴포넌트 내 간격 불일치 | 같은 컴포넌트 다른 padding | medium |
   | SPC-05 | 섹션 간 간격 불일치 | 형제 섹션 다른 gap | medium |
   | SPC-06 | 네거티브 마진 남용 | `margin:.*-` 3회 이상 | low |
   | SPC-07 | gap과 margin 혼용 | flex/grid에서 gap 대신 margin | low |
   | SPC-08 | padding 방향 불일치 | `px-` vs `pl-`+`pr-` 혼재 | low |
   | SPC-09 | 컨테이너 패딩 누락 | 최외곽 컨테이너에 padding 없음 | medium |
   | SPC-10 | 모바일 간격 미조정 | 반응형에서 간격 축소 없음 | medium |

   ### 3d. Layout (10항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | LAY-01 | 고정 너비 사용 | `width: \d+px` (컨테이너) | high |
   | LAY-02 | 고정 높이 사용 | `height: \d+px` (콘텐츠 영역) | medium |
   | LAY-03 | z-index 관리 부재 | `z-index:` 임의값 (10, 999, 9999) | medium |
   | LAY-04 | 절대 위치 남용 | `position: absolute` 3회 이상 | medium |
   | LAY-05 | overflow 미처리 | 스크롤 가능 영역에 `overflow` 없음 | high |
   | LAY-06 | flex/grid 미사용 레이아웃 | `float:` 사용 | low |
   | LAY-07 | 중첩 레이아웃 과다 | flex 안 flex 안 flex (3단계+) | low |
   | LAY-08 | 컨테이너 max-width 누락 | 최외곽에 `max-width` 없음 | medium |
   | LAY-09 | 사이드바/메인 비율 하드코딩 | `width: 250px` + `calc(100%-250px)` | medium |
   | LAY-10 | sticky/fixed 요소 겹침 | 같은 위치에 sticky 다수 | high |

   ### 3e. Responsive (8항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | RSP-01 | 반응형 미적용 | 미디어 쿼리/반응형 유틸리티 0건 | critical |
   | RSP-02 | 비표준 브레이크포인트 | `@media.*\d+px` 토큰 외 | medium |
   | RSP-03 | 모바일 퍼스트 미적용 | `min-width` 대신 `max-width` 우선 | low |
   | RSP-04 | 터치 타겟 크기 부족 | 버튼/링크 `min-height` < 44px | high |
   | RSP-05 | 가로 스크롤 발생 | `overflow-x: scroll` 또는 너비 초과 | high |
   | RSP-06 | 뷰포트 단위 남용 | `100vh` (모바일 주소바 미고려) | medium |
   | RSP-07 | 이미지 반응형 미처리 | `<img>` 에 `max-width:100%` 없음 | medium |
   | RSP-08 | 테이블 반응형 미처리 | `<table>` 에 모바일 대응 없음 | medium |

   ### 3f. Accessibility (10항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | A11Y-01 | alt 텍스트 누락 | `<img` 에 `alt=` 없음 | high |
   | A11Y-02 | ARIA 레이블 누락 | 인터랙티브 요소에 `aria-label` 없음 | high |
   | A11Y-03 | 키보드 네비게이션 불가 | `onClick` 만 있고 `onKeyDown` 없음 | high |
   | A11Y-04 | focus 스타일 제거 | `outline: none`/`outline: 0` | critical |
   | A11Y-05 | role 속성 누락 | 커스텀 위젯에 `role=` 없음 | medium |
   | A11Y-06 | 시맨틱 HTML 미사용 | `<div onClick>` 대신 `<button>` 사용 확인 | medium |
   | A11Y-07 | tabindex 남용 | `tabindex` > 0 사용 | medium |
   | A11Y-08 | aria-hidden 오사용 | 포커스 가능 요소에 `aria-hidden="true"` | high |
   | A11Y-09 | 색상만으로 정보 전달 | 에러 표시가 색상만 (아이콘/텍스트 없음) | medium |
   | A11Y-10 | skip navigation 누락 | 페이지에 `#main-content` 스킵 링크 없음 | low |

   ### 3g. Animation (5항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | ANI-01 | prefers-reduced-motion 미대응 | `animation`/`transition` 에 `prefers-reduced-motion` 없음 | medium |
   | ANI-02 | 과도한 애니메이션 지속시간 | `duration` > 500ms | low |
   | ANI-03 | 레이아웃 트리거 애니메이션 | `width`/`height`/`top`/`left` 애니메이션 | medium |
   | ANI-04 | 무한 애니메이션 | `animation.*infinite` 로딩 외 사용 | low |
   | ANI-05 | 전환 일관성 | 같은 유형 인터랙션에 다른 easing/duration | low |

   ### 3h. Icon (5항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | ICN-01 | 아이콘 라이브러리 혼용 | 2개+ 아이콘 라이브러리 import | medium |
   | ICN-02 | 아이콘 크기 불일치 | 같은 맥락 다른 `size`/`width` | medium |
   | ICN-03 | 장식용 아이콘 과다 | 의미 없는 아이콘 반복 사용 | low |
   | ICN-04 | 아이콘 aria-label 누락 | 의미 전달 아이콘에 `aria-label` 없음 | high |
   | ICN-05 | 장식 아이콘 aria-hidden 누락 | 장식용에 `aria-hidden="true"` 없음 | low |

   ### 3i. Form (7항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | FRM-01 | label 연결 누락 | `<input>` 에 `<label>` 또는 `aria-label` 없음 | high |
   | FRM-02 | 에러 상태 미정의 | 폼 필드에 에러 스타일 없음 | high |
   | FRM-03 | 필수 표시 누락 | `required` 필드에 시각적 표시 없음 | medium |
   | FRM-04 | placeholder만 사용 | `placeholder` 있지만 `label` 없음 | high |
   | FRM-05 | autocomplete 미설정 | 이메일/비밀번호 필드에 `autocomplete` 없음 | low |
   | FRM-06 | 폼 제출 피드백 없음 | submit 버튼에 로딩 상태 없음 | medium |
   | FRM-07 | 입력 타입 부정확 | 이메일에 `type="text"`, 전화에 `type="text"` | low |

   ### 3j. AI Slop Detection (10항목)

   | ID | 검사 항목 | Grep 패턴 | Severity |
   |----|----------|-----------|----------|
   | AIS-01 | 과도한 그라디언트 | `gradient` 3색 이상 또는 3회 이상 사용 | medium |
   | AIS-02 | 제네릭 placeholder 아이콘 | `placeholder`/`default-icon` 패턴 | medium |
   | AIS-03 | 불일치 간격 (같은 컴포넌트) | 형제 요소 padding 편차 > 2단계 | high |
   | AIS-04 | 과도한 그림자 | `shadow` 3개+ 중첩 또는 5회+ 사용 | medium |
   | AIS-05 | 불필요한 보더 과다 | `border` 모든 면 + `shadow` 동시 사용 | low |
   | AIS-06 | 복붙 스타일 블록 | 90%+ 동일한 스타일 블록 반복 | high |
   | AIS-07 | 매직 넘버 | `mt-[17px]`, `w-[347px]` 임의 값 | medium |
   | AIS-08 | 과도한 둥근 모서리 | `rounded-full` 이 비원형 요소에 사용 | low |
   | AIS-09 | Lorem ipsum 잔존 | `lorem|ipsum|dolor sit` | critical |
   | AIS-10 | 의미 없는 색상 변형 | 인접 요소에 미세하게 다른 색상 (#333 vs #343434) | medium |

4. **스크린샷 기반 시각 검증 (선택적)**

   브라우저 제어가 가능한 환경인 경우 추가 시각 검증을 수행하세요:
   - 개발 서버가 실행 중인지 확인
   - 주요 페이지/컴포넌트의 스크린샷을 캡처
   - 스크린샷을 기반으로 시각적 불일치를 추가 검증

   브라우저 제어가 불가능한 경우 이 단계를 건너뛰고 Step 3의 정적 분석 결과만으로 진행하세요.

5. **감사 결과 리포트**

   검증 결과를 다음 형식으로 정리하세요:

   ```
   ## Design Review Report

   **감사 일시**: {날짜}
   **DESIGN.md 기준**: {마지막 업데이트 날짜}
   **감사 범위**: {파일 수}개 파일

   ### Design Score: {등급} ({통과율}%)
   ### AI Slop Score: {등급} ({AIS 통과율}%)

   ### 카테고리별 통과율
   | 카테고리 | 항목 수 | PASS | FAIL | 통과율 |
   |----------|---------|------|------|--------|
   | Color | 15 | {N} | {N} | {N}% |
   | Typography | 10 | ... | ... | ...% |
   | Spacing | 10 | ... | ... | ...% |
   | Layout | 10 | ... | ... | ...% |
   | Responsive | 8 | ... | ... | ...% |
   | Accessibility | 10 | ... | ... | ...% |
   | Animation | 5 | ... | ... | ...% |
   | Icon | 5 | ... | ... | ...% |
   | Form | 7 | ... | ... | ...% |
   | AI Slop | 10 | ... | ... | ...% |
   | **총계** | **80** | **{N}** | **{N}** | **{N}%** |

   ### Findings (FAIL 항목만)

   #### Critical
   | ID | 파일:라인 | 문제 | 권장 수정 |
   |----|----------|------|-----------|
   | {ID} | ... | ... | ... |

   #### High / Medium / Low
   ...
   ```

   **등급 산출 기준:**
   - 전체 80항목 통과율: A=90%+(72+/80), B=80%+(64+), C=70%+(56+), D=60%+(48+), E=50%+(40+), F=50%미만
   - AI Slop Score: AIS-01~10 통과율로 별도 산출 (같은 등급 기준)

6. **수정 제안**

   `AskUserQuestion`으로 다음 단계를 물어보세요:
   - question: "감사 결과를 확인해주세요. 어떻게 진행할까요?"
   - header: "디자인 감사 결과"
   - multiSelect: false
   - 선택지:
     - label: "Critical/High 항목 자동 수정", description: "심각도가 높은 항목을 자동으로 수정합니다 (수정 루프 적용)"
     - label: "개별 항목 검토 후 선택 수정", description: "각 항목을 하나씩 검토하며 수정 여부를 결정합니다"
     - label: "리포트만 저장", description: "결과를 확인만 하고 수정은 나중에 합니다"

   - 자동 수정 시: Step 7(수정 루프)로 진행
   - 리포트 저장 시: 결과를 context에 저장하세요 (`vs context save --summary "[design-review] {등급}: ..."`)
   - DESIGN.md 부분 정의 시: 정의된 섹션만 검증하고, 미정의 카테고리는 SKIP 표시

7. **수정 루프 (Atomic Commit)**

   Step 6에서 "자동 수정"을 선택한 경우 실행합니다. 각 FAIL 항목을 개별적으로 수정하고 커밋합니다.

   **수정 절차** (각 항목마다 반복):

   1. FAIL 항목의 소스 파일과 라인을 확인
   2. DESIGN.md 토큰을 참조하여 최소한의 수정 적용
   3. **before/after 출력**:
      ```
      ### FINDING-{NNN} ({ID}): {문제 요약}
      **파일**: {file}:{line}

      Before:
      ```{language}
      {수정 전 코드}
      ```

      After:
      ```{language}
      {수정 후 코드}
      ```
      ```
   4. 수정 내용을 커밋: `git add {file} && git commit -m "style(design): FINDING-{NNN} {간단 설명}"`
   5. 브라우저 제어 가능 시: 수정된 페이지 스크린샷 캡처하여 시각 확인
   6. 다음 항목으로 이동

   **리스크 캡 시스템** _(Step 8에서 상세 정의)_:
   - 수정 상한 및 리스크 예산 관리
   - 테스트 실패 시 롤백 처리

8. **리스크 캡 시스템**

   수정 루프(Step 7) 실행 중 리스크를 관리합니다.

   #### 리스크 예산

   | 수정 대상 | 리스크 가중치 | 설명 |
   |----------|-------------|------|
   | CSS/SCSS 파일만 | 0% | 스타일 변경은 본질적으로 안전하고 되돌리기 쉬움 |
   | Tailwind 클래스 변경 | 0% | CSS와 동일 |
   | JSX/TSX 파일 | 파일당 +5% | 컴포넌트 구조 변경 위험 |
   | 공유 컴포넌트 파일 | 파일당 +10% | 영향 범위 넓음 |

   #### 제한 규칙

   - **총 수정 상한**: 최대 **30개** — 30번째 수정 후 자동 중단
   - **리스크 예산 상한**: **20%** — 누적 리스크가 20% 초과 시 자동 중단
   - **중단 시**: 남은 FAIL 항목을 리포트에만 기록하고, 수정하지 않음
   - **중단 메시지**: "리스크 예산 {N}% 도달 (상한 20%). 남은 {M}개 항목은 리포트만 생성합니다."

   #### 테스트 실패 시 롤백

   수정 루프 중 테스트가 실패하면:
   1. 해당 수정의 커밋을 `git revert HEAD --no-edit`로 즉시 롤백
   2. 리포트에 WARN 기록: "FINDING-{NNN} 수정이 테스트를 깨뜨려 롤백됨"
   3. 리스크 예산에 +5% 페널티 추가
   4. 다음 항목으로 계속 진행

   #### 수정 루프 완료 리포트

   ```
   ## 수정 루프 결과

   - 수정 시도: {N}건
   - 수정 성공: {N}건 (커밋 {N}개)
   - 수정 롤백: {N}건
   - 미수정 (리스크 상한): {N}건
   - 최종 리스크: {N}%
   ```

## 다음 단계

- -> `/vs-design-init`으로 디자인 시스템 업데이트 (토큰 추가/변경 필요 시)
- -> `/vs-commit`으로 수정사항 커밋
- -> `/vs-merge`로 PR 머지 전 최종 확인
