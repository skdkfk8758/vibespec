# {프로젝트명} — Architecture Document

<!-- skeleton:type=architecture -->
<!-- skeleton:version=1.0 -->

<!-- [REQUIRED] System Overview -->
## System Overview

{시스템의 전체 구조를 1-2문단으로 설명하세요}

```
{시스템 다이어그램 (ASCII)}
```

<!-- [REQUIRED] Module Structure -->
## Module Structure

| 모듈 | 경로 | 책임 | 의존성 |
|------|------|------|--------|
| {모듈 1} | `src/{path}` | {책임} | {의존 모듈} |

### 디렉토리 구조
```
src/
├── {디렉토리 1}/     # {설명}
├── {디렉토리 2}/     # {설명}
└── {디렉토리 3}/     # {설명}
```

<!-- [REQUIRED] Data Flow -->
## Data Flow

### 주요 데이터 흐름
1. **{흐름 1}**: {시작점} → {처리} → {끝점}

### 상태 관리
- **서버 상태**: {방식}
- **클라이언트 상태**: {방식}
- **영속 데이터**: {방식}

<!-- [REQUIRED] ADR -->
## Architecture Decision Records

### ADR-001: {결정 제목}
- **상태**: {Accepted / Proposed / Deprecated}
- **컨텍스트**: {상황}
- **결정**: {결정}
- **근거**: {이유}
- **결과**: {영향}

<!-- [OPTIONAL] Infrastructure -->
## Infrastructure

- **호스팅**: {서비스}
- **CDN**: {서비스}
- **시크릿 관리**: {방식}

<!-- [OPTIONAL] Monitoring -->
## Monitoring

| 영역 | 도구 | 알림 기준 |
|------|------|----------|
| 에러 추적 | {도구} | {기준} |
| APM | {도구} | {기준} |

<!-- [OPTIONAL] Scaling Strategy -->
## Scaling Strategy

- **수평 확장**: {방식}
- **캐싱 전략**: {방식}
- **병목 예상 지점**: {지점}
