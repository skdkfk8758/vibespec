# {프로젝트명} — Project Policy

<!-- skeleton:type=policy -->
<!-- skeleton:version=1.0 -->

<!-- [REQUIRED] Tech Stack -->
## Tech Stack

| 영역 | 기술 | 버전 | 선택 근거 |
|------|------|------|----------|
| Language | {예: TypeScript} | {버전} | {근거} |
| Framework | {예: Next.js} | {버전} | {근거} |
| Database | {예: PostgreSQL} | {버전} | {근거} |
| Testing | {예: Vitest} | {버전} | {근거} |

<!-- [REQUIRED] Dependencies Policy -->
## Dependencies Policy

- **신규 의존성 추가 기준**: {번들 사이즈, 다운로드 수, 업데이트 빈도}
- **금지 의존성**: {예: moment.js → dayjs}
- **업데이트 주기**: {패치/마이너/메이저 주기}
- **라이선스 허용**: {MIT, Apache-2.0, BSD 등}

<!-- [REQUIRED] Security Policy -->
## Security Policy

- **인증 방식**: {예: JWT, OAuth 2.0}
- **민감 데이터 저장**: {환경변수, 암호화 정책}
- **입력 검증**: {검증 방식}
- **HTTPS**: {적용 범위}

<!-- [REQUIRED] Data Policy -->
## Data Policy

- **개인정보 처리**: {수집/저장/삭제 정책}
- **데이터 보존 기간**: {보존 기간}
- **백업 정책**: {백업 주기/보관 기간}
- **데이터 접근 제어**: {RBAC 등}

<!-- [REQUIRED] Naming Convention -->
## Naming Convention

| 대상 | 규칙 | 예시 |
|------|------|------|
| 파일명 | {예: kebab-case} | `user-profile.ts` |
| 컴포넌트 | {예: PascalCase} | `UserProfile` |
| 함수 | {예: camelCase} | `getUserProfile` |
| 상수 | {예: UPPER_SNAKE_CASE} | `MAX_RETRY_COUNT` |
| DB 테이블 | {예: snake_case} | `user_profiles` |

<!-- [OPTIONAL] Code Review Policy -->
## Code Review Policy

- **필수 리뷰어 수**: {수}
- **자동 머지 조건**: {조건}

<!-- [OPTIONAL] Testing Policy -->
## Testing Policy

- **최소 커버리지**: {%}
- **필수 테스트 유형**: {유형}

<!-- [OPTIONAL] Deployment Policy -->
## Deployment Policy

- **배포 전략**: {전략}
- **환경**: {환경 목록}
- **롤백 기준**: {기준}

<!-- [OPTIONAL] Environment Management -->
## Environment Management

### 환경변수 관리 전략
- **관리 위치**: {예: 루트 `.env`에서 통합 관리}
- **파일 구조**:
  - `.env` — 공통 환경변수 (공유 가능한 기본값)
  - `.env.local` — 로컬 오버라이드 (git 제외)
  - `.env.development` / `.env.production` — 환경별
  - `packages/*/`에는 .env 금지 (루트 참조만 허용)
- **시크릿 관리**: {예: 환경변수로만 주입, 코드 하드코딩 금지, 시크릿 매니저 사용}

### 모노레포 설정
- **워크스페이스 도구**: {예: pnpm workspaces / yarn workspaces / npm workspaces}
- **공유 설정**: 루트 tsconfig.json, eslint, prettier를 각 패키지에서 extends
- **패키지 간 의존성**: {예: workspace: 프로토콜 사용}

### 금지 사항
- 패키지 내부에 독립 .env 파일 생성 금지 (루트에서 통합 관리)
- 하드코딩 환경변수 금지 (process.env를 통해서만 접근)
- 루트 .env에 시크릿 직접 기록 금지 (시크릿 매니저 또는 CI/CD 환경변수 사용)
