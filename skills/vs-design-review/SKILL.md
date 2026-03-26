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

3. **코드 정적 분석 (기본 검증)**

   대상 파일을 읽고 다음 5개 항목을 검증하세요:

   ### 3a. Color Consistency (색상 일관성)

   - DESIGN.md에 정의된 색상 토큰 대신 하드코딩된 hex/rgb 값이 사용되었는지 확인
   - 검사 패턴: `#[0-9a-fA-F]{3,8}`, `rgb(`, `rgba(`, `hsl(`
   - DESIGN.md에 정의된 색상과 매칭되는 하드코딩 값은 토큰 사용을 권장
   - DESIGN.md에 없는 색상은 "미정의 색상" 경고 (Severity: High)

   ### 3b. Typography Consistency (타이포그래피 일관성)

   - 정의된 폰트 패밀리 외의 폰트가 사용되었는지 확인
   - 정의된 사이즈 스케일 외의 `font-size` 값이 사용되었는지 확인
   - 정의된 weight 외의 `font-weight` 값이 사용되었는지 확인
   - Severity: High (미정의 폰트/사이즈), Medium (미세한 차이)

   ### 3c. Spacing Consistency (간격 일관성)

   - `margin`, `padding`, `gap` 값이 DESIGN.md의 간격 시스템을 따르는지 확인
   - 기본 단위(4px/8px)의 배수가 아닌 값 감지
   - 인라인 스타일의 임의 간격 값 감지
   - Severity: Medium (간격 토큰 미사용), Low (미세한 차이)

   ### 3d. Responsive Breakpoints (반응형 브레이크포인트)

   - 미디어 쿼리 또는 반응형 유틸리티 사용 여부 확인
   - 비표준 브레이크포인트 값 감지
   - 모바일 퍼스트 접근법 확인
   - Severity: Critical (반응형 미적용으로 레이아웃 깨짐), Medium (비표준 브레이크포인트)

   ### 3e. AI Slop Detection (AI 생성 코드 품질 감지)

   AI가 생성한 UI 코드에서 흔히 나타나는 품질 문제를 감지하세요:
   - **과도한 그라디언트**: 3개 이상 색상을 사용한 복잡한 그라디언트, 불필요한 그라디언트 남용
   - **제네릭 아이콘**: placeholder 아이콘, 의미 없는 장식 아이콘 반복 사용
   - **불일치하는 간격**: 같은 컴포넌트 내에서 간격 값이 제각각 (`p-2`, `p-3`, `p-5`가 혼재)
   - **과도한 장식**: 불필요한 그림자, 보더, 배경색이 과다하게 적용
   - **복붙 패턴**: 거의 동일한 스타일 블록이 반복 (컴포넌트 추출 필요)
   - Severity: High (과도한 장식/불일치), Medium (제네릭 아이콘), Low (미세한 반복)

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

   ### Summary
   - Critical: {N}건
   - High: {N}건
   - Medium: {N}건
   - Low: {N}건

   ### Findings

   #### Critical
   | # | 파일 | 라인 | 문제 | 권장 수정 |
   |---|------|------|------|-----------|
   | 1 | ... | ... | ... | ... |

   #### High
   ...

   #### Medium
   ...

   #### Low
   ...

   ### Recommendations
   - {전체적인 개선 제안}
   ```

6. **수정 제안**

   `AskUserQuestion`으로 다음 단계를 물어보세요:
   - question: "감사 결과를 확인해주세요. 어떻게 진행할까요?"
   - header: "디자인 감사 결과"
   - multiSelect: false
   - 선택지:
     - label: "Critical/High 항목 자동 수정", description: "심각도가 높은 항목을 자동으로 수정합니다"
     - label: "개별 항목 검토 후 선택 수정", description: "각 항목을 하나씩 검토하며 수정 여부를 결정합니다"
     - label: "리포트만 저장", description: "결과를 확인만 하고 수정은 나중에 합니다"

   - 자동 수정 시: 하드코딩된 값을 토큰으로 교체하는 변경을 적용하세요
   - 리포트 저장 시: 결과를 context에 저장하세요 (`vs context save`)

## 다음 단계

- -> `/vs-design-init`으로 디자인 시스템 업데이트 (토큰 추가/변경 필요 시)
- -> `/vs-commit`으로 수정사항 커밋
- -> `/vs-merge`로 PR 머지 전 최종 확인
