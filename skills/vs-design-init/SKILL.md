---
name: vs-design-init
description: "[Design] Create project design system via interview."
invocation: deferred
---

# Design System 초기화

인터랙티브 인터뷰를 통해 프로젝트의 디자인 시스템을 정의하고, 프로젝트 루트에 DESIGN.md 파일을 생성합니다.

## When to Use

**사용하세요:**
- 새 프로젝트에서 UI/UX 작업을 시작할 때
- 기존 프로젝트에 일관된 디자인 시스템을 도입할 때
- vs-plan에서 DESIGN.md가 없다는 경고를 받았을 때

**사용하지 마세요:**
- DESIGN.md가 이미 존재하고 변경이 필요 없을 때 (업데이트가 필요하면 이 스킬을 사용하되, 덮어쓰기 대신 업데이트를 선택하세요)
- 백엔드 전용 프로젝트 (UI가 없는 경우)

## Prerequisites

- 프로젝트 루트 디렉토리에서 실행해야 합니다
- 프로젝트의 기술 스택(React, Vue, Svelte 등)을 미리 파악하면 더 적절한 추천이 가능합니다

## Steps

1. **DESIGN.md 존재 여부 확인**

   프로젝트 루트에서 DESIGN.md 파일이 있는지 확인하세요.

   - **존재하는 경우**: `AskUserQuestion`으로 다음 선택지를 제시하세요:
     - question: "이미 DESIGN.md가 존재합니다. 어떻게 진행할까요?"
     - header: "기존 디자인 시스템 발견"
     - multiSelect: false
     - 선택지:
       - label: "기존 디자인 시스템 업데이트", description: "현재 DESIGN.md를 기반으로 항목을 수정합니다"
       - label: "새로 생성", description: "기존 DESIGN.md를 백업하고 새로 만듭니다"
       - label: "취소", description: "현재 DESIGN.md를 유지합니다"
     - "업데이트" 선택 시: 기존 DESIGN.md를 읽어 현재 값을 기본값으로 제시하며 인터뷰 진행
     - "새로 생성" 선택 시: 기존 파일을 DESIGN.md.bak으로 백업 후 처음부터 진행
   - **존재하지 않는 경우**: Step 2로 진행

2. **디자인 시스템 인터뷰**

   아래 5개 항목을 순서대로 `AskUserQuestion`을 사용하여 사용자에게 물어보세요.
   한 번에 모든 항목을 쏟아내지 말고, 각 항목의 답변을 받은 뒤 다음 항목으로 진행하세요.

   ### 2a. Aesthetic Direction (미적 방향성)

   - question: "프로젝트의 전체적인 미적 방향성을 선택해주세요"
   - header: "Aesthetic Direction"
   - multiSelect: false
   - 선택지:
     - label: "Modern", description: "깔끔한 라인, 넉넉한 여백, 부드러운 그림자. SaaS/대시보드에 적합"
     - label: "Classic", description: "전통적 레이아웃, 세리프 폰트 활용, 격식 있는 느낌. 기업/금융에 적합"
     - label: "Minimal", description: "극도로 절제된 요소, 흑백 기반, 콘텐츠 중심. 포트폴리오/블로그에 적합"
     - label: "Brutalism", description: "과감한 타이포, 원색, 비대칭 레이아웃. 크리에이티브/실험적 프로젝트에 적합"
     - label: "Custom", description: "직접 정의합니다"
   - "Custom" 선택 시 추가 질문으로 방향성을 파악하세요

   ### 2b. Color Palette (색상 팔레트)

   - question: "색상 팔레트를 정의해주세요. 기존 브랜드 컬러가 있으면 알려주세요."
   - header: "Color Palette"
   - 다음 5개 카테고리를 정의하세요:
     - **Primary**: 브랜드 주색상 (CTA 버튼, 주요 링크)
     - **Secondary**: 보조색상 (배지, 보조 UI 요소)
     - **Accent**: 강조색상 (알림, 하이라이트)
     - **Neutral**: 중립색상 (배경, 텍스트, 보더) - 최소 gray scale 5단계
     - **Semantic**: 의미적 색상 (success/green, warning/amber, error/red, info/blue)
   - 사용자가 색상을 모르면 Aesthetic Direction에 맞는 기본 팔레트를 추천하세요

   ### 2c. Typography (타이포그래피)

   - question: "타이포그래피 설정을 정의해주세요"
   - header: "Typography"
   - 다음 3개 항목을 정의하세요:
     - **Font Family**: heading용, body용 폰트 (시스템 폰트 또는 웹 폰트)
     - **Size Scale**: 폰트 크기 체계 (예: xs=12px, sm=14px, base=16px, lg=18px, xl=20px, 2xl=24px, 3xl=30px)
     - **Font Weight**: 사용할 굵기 (regular=400, medium=500, semibold=600, bold=700)
   - 사용자가 잘 모르면 Aesthetic Direction에 맞는 기본값을 추천하세요

   ### 2d. Spacing System (간격 시스템)

   - question: "간격 시스템의 기본 단위를 선택해주세요"
   - header: "Spacing System"
   - multiSelect: false
   - 선택지:
     - label: "4px 기반", description: "4, 8, 12, 16, 20, 24, 32, 40, 48, 64. 세밀한 조정이 필요한 경우"
     - label: "8px 기반", description: "8, 16, 24, 32, 48, 64, 80, 96. 간결하고 일관된 리듬"
     - label: "Custom", description: "직접 정의합니다"

   ### 2e. Component Style Direction (컴포넌트 스타일 방향)

   - question: "UI 컴포넌트의 스타일 방향을 정의해주세요"
   - header: "Component Style"
   - 다음 항목에 대해 사용자의 선호를 파악하세요:
     - **Border Radius**: none(0px) / small(4px) / medium(8px) / large(12px) / full(9999px)
     - **Shadow Style**: none / subtle / medium / prominent
     - **Border Usage**: minimal / moderate / prominent
     - **Animation**: none / subtle transitions / expressive animations
   - `AskUserQuestion`을 활용하여 각 항목의 선호도를 효율적으로 수집하세요

3. **인터뷰 결과 확인**

   수집한 5개 항목의 결과를 요약하여 보여주고 `AskUserQuestion`으로 확인하세요:
   - question: "정의된 디자인 시스템이 맞는지 확인해주세요"
   - header: "디자인 시스템 확인"
   - multiSelect: false
   - 선택지:
     - label: "확인, DESIGN.md 생성", description: "현재 설정으로 DESIGN.md를 생성합니다"
     - label: "수정할 부분이 있습니다", description: "특정 항목을 수정합니다"
     - label: "처음부터 다시", description: "인터뷰를 처음부터 다시 진행합니다"

4. **DESIGN.md 생성**

   프로젝트 루트에 다음 구조로 DESIGN.md를 생성하세요:

   ```markdown
   # Design System

   > 이 문서는 프로젝트의 디자인 시스템을 정의합니다.
   > vs-design-init으로 생성되었으며, 구현 시 이 문서를 참조하세요.
   > 마지막 업데이트: {날짜}

   ## Aesthetic Direction

   **방향성**: {선택된 방향}
   {방향성에 대한 간략한 설명}

   ## Color Palette

   ### Primary
   - `--color-primary`: {값}
   - `--color-primary-light`: {값}
   - `--color-primary-dark`: {값}

   ### Secondary
   - `--color-secondary`: {값}
   - `--color-secondary-light`: {값}
   - `--color-secondary-dark`: {값}

   ### Accent
   - `--color-accent`: {값}

   ### Neutral
   - `--color-neutral-50`: {값}
   - `--color-neutral-100`: {값}
   - `--color-neutral-200`: {값}
   - `--color-neutral-300`: {값}
   - `--color-neutral-500`: {값}
   - `--color-neutral-700`: {값}
   - `--color-neutral-900`: {값}

   ### Semantic
   - `--color-success`: {값}
   - `--color-warning`: {값}
   - `--color-error`: {값}
   - `--color-info`: {값}

   ## Typography

   ### Font Family
   - **Heading**: {폰트}
   - **Body**: {폰트}
   - **Mono**: {폰트}

   ### Size Scale
   | Token | Size | Usage |
   |-------|------|-------|
   | `xs` | {값} | 캡션, 보조 텍스트 |
   | `sm` | {값} | 부가 정보 |
   | `base` | {값} | 본문 |
   | `lg` | {값} | 강조 텍스트 |
   | `xl` | {값} | 소제목 |
   | `2xl` | {값} | 섹션 제목 |
   | `3xl` | {값} | 페이지 제목 |

   ### Font Weight
   | Token | Weight | Usage |
   |-------|--------|-------|
   | `regular` | 400 | 본문 |
   | `medium` | 500 | 강조 |
   | `semibold` | 600 | 제목 |
   | `bold` | 700 | 주요 제목 |

   ## Spacing System

   **기본 단위**: {4px 또는 8px}

   | Token | Value | Usage |
   |-------|-------|-------|
   | `space-1` | {값} | 인라인 요소 간격 |
   | `space-2` | {값} | 관련 요소 그룹 |
   | `space-3` | {값} | 섹션 내 구분 |
   | `space-4` | {값} | 컴포넌트 패딩 |
   | `space-6` | {값} | 섹션 간 구분 |
   | `space-8` | {값} | 주요 영역 구분 |

   ## Component Style

   | Property | Value |
   |----------|-------|
   | Border Radius | {값} |
   | Shadow Style | {값} |
   | Border Usage | {값} |
   | Animation | {값} |
   ```

5. **완료 안내**

   - 생성된 DESIGN.md 파일 경로를 안내하세요
   - 이후 UI 구현 시 이 디자인 시스템을 참조하라고 안내하세요
   - `/vs-design-review`로 구현 후 디자인 감사를 받을 수 있다고 안내하세요

## 다음 단계

- -> `/vs-plan`으로 UI/UX 관련 플랜 생성 (DESIGN.md 기반)
- -> `/vs-design-review`로 구현 후 디자인 감사
