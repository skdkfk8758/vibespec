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
