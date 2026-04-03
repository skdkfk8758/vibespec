# VibeSpec — Project Policy

<!-- skeleton:type=policy -->
<!-- skeleton:version=1.0 -->

<!-- [REQUIRED] Tech Stack -->
## Tech Stack

| 영역 | 기술 | 버전 | 선택 근거 |
|------|------|------|----------|
| Language | TypeScript | 5.x | 타입 안전성, 생태계 |
| Runtime | Node.js | 20+ | LTS, ESM 지원 |
| CLI Framework | Commander.js | 12.x | 경량, 널리 사용 |
| Database | better-sqlite3 | 11.x | 로컬 임베디드, 무설정 |
| Testing | Vitest | 3.x | 빠른 실행, ESM 네이티브 |
| Build | tsup | 8.x | 빠른 번들링 |
| Schema | Zod | 3.x | 런타임 검증 |

<!-- [REQUIRED] Dependencies Policy -->
## Dependencies Policy

- **신규 의존성 추가 기준**: 번들 사이즈 100KB 미만, 주간 다운로드 50K 이상, 6개월 내 업데이트
- **금지 의존성**: moment.js (→ dayjs), lodash 전체 import (→ 개별 함수), express (→ 불필요, CLI 전용)
- **업데이트 주기**: 패치 월 1회, 마이너 분기 1회, 메이저 반기 1회
- **라이선스 허용**: MIT, Apache-2.0, BSD — GPL 제외

<!-- [REQUIRED] Security Policy -->
## Security Policy

- **인증 방식**: 해당 없음 (로컬 CLI 도구, 서버 없음)
- **민감 데이터 저장**: 프로젝트 로컬 .claude/ 디렉토리에만 저장. 절대 외부 전송 금지.
- **입력 검증**: Zod 스키마 기반 모든 CLI 입력 검증 필수
- **파일 접근**: 프로젝트 루트 내부만 읽기/쓰기. 상위 디렉토리 접근 금지.

<!-- [REQUIRED] Data Policy -->
## Data Policy

- **개인정보 처리**: 개인정보 수집 없음. 프로젝트 메타데이터만 로컬 저장.
- **데이터 보존**: SQLite DB는 프로젝트 수명과 동일. 별도 만료 없음.
- **백업**: 사용자 책임 (git에 포함 권장)

<!-- [REQUIRED] Naming Convention -->
## Naming Convention

| 대상 | 규칙 | 예시 |
|------|------|------|
| 파일명 | kebab-case | `qa-config.ts` |
| 클래스/타입 | PascalCase | `ResolvedQaConfig` |
| 함수 | camelCase | `resolveConfig` |
| 상수 | UPPER_SNAKE_CASE | `DEFAULT_QA_CONFIG` |
| DB 테이블 | snake_case | `skeleton_checks` |
| CLI 명령 | kebab-case | `vs plan create` |
| 스킬명 | kebab-case with prefix | `vs-skeleton-init` |

<!-- [OPTIONAL] Code Review Policy -->
## Code Review Policy

- **리뷰 프로세스**: PR 기반, GitHub Actions CI 통과 필수
- **자동 검증**: `tsc --noEmit` (타입 체크) + `vitest run` (테스트) + `validate-plugin.ts` (플러그인 구조 검증)
- **머지 조건**: CI 전체 통과 + 빌드 성공
- **리뷰 범위**: 기능 변경 시 관련 테스트 포함 필수

<!-- [OPTIONAL] Testing Policy -->
## Testing Policy

- **프레임워크**: Vitest 3.x (ESM 네이티브)
- **테스트 위치**: 소스 파일과 같은 디렉토리의 `__tests__/` 하위
- **네이밍**: `{모듈명}.test.ts`
- **현재 커버리지**: 64개 테스트 파일 (엔진 22, 모델 15, CLI 12, DB, 스크립트)
- **필수 테스트 대상**: 모든 engine/model 모듈, CLI 명령어
- **TDD 원칙**: 새 엔진 기능 추가 시 반드시 같은 태스크에서 테스트 동시 작성 (SESSION_LEARNING 규칙)
- **커버리지 도구**: 미설정 (향후 `@vitest/coverage-v8` 도입 권장)

<!-- [OPTIONAL] Deployment Policy -->
## Deployment Policy

- **배포 방식**: npm 레지스트리 퍼블리시 (`npm publish --access public`)
- **트리거**: git 태그 `v*` 푸시 시 자동 배포 (`.github/workflows/release.yml`)
- **파이프라인**: `npm ci` → `npm test` → `npm run build` → `npm pack --dry-run` → `npm publish`
- **GitHub Release**: `softprops/action-gh-release@v2`로 자동 생성
- **시크릿**: `NPM_TOKEN` (GitHub Secrets)
- **릴리스 스킬**: `/vs-release`로 버전 범프 + 태그 + 변경로그 자동 생성
