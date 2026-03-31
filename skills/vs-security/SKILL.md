---
name: vs-security
description: "OWASP Top 10 security audit for codebase."
invocation: user
type: workflow
---

# Security Audit Skill

OWASP Top 10 체크리스트를 기반으로 코드베이스의 보안 취약점을 탐지하고 리포트를 생성합니다.

## When to Use

- 보안 관련 코드(인증, 암호화, 세션 관리 등)가 변경되었을 때
- QA 프로세스에서 보안 감사가 필요할 때
- 릴리즈 전 보안 점검이 필요할 때

## Options

- `--scope <directory>`: 감사 대상 디렉토리를 제한합니다 (기본값: 프로젝트 루트)

## OWASP Top 10 Checklist

### A01: Broken Access Control (접근 제어 실패)

권한 검증 누락, 경로 우회, IDOR 취약점을 탐지합니다.

**Grep 패턴:**
- `req\.user` — 사용자 객체 직접 참조 (권한 검증 누락 가능)
- `isAdmin|isOwner|hasRole` — 권한 검증 함수 사용 여부
- `\.params\.(id|userId)` — URL 파라미터 직접 사용 (IDOR 가능)
- `bypass|skip.*auth` — 인증 우회 패턴

**검증 포인트:**
- 모든 API 엔드포인트에 인증/인가 미들웨어가 적용되어 있는가
- 리소스 접근 시 소유자 검증이 이루어지는가
- 관리자 기능에 역할 기반 접근 제어(RBAC)가 적용되어 있는가

### A02: Cryptographic Failures (암호화 실패)

약한 암호화, 하드코딩된 시크릿, 평문 전송을 탐지합니다.

**Grep 패턴:**
- `md5|sha1` — 취약한 해시 알고리즘 사용
- `password.*=.*['"]` — 하드코딩된 비밀번호
- `(secret|key|token).*=.*['"][A-Za-z0-9]` — 하드코딩된 시크릿
- `http://` — 비암호화 통신 (https가 아닌 경우)
- `createCipher\b` — 더 이상 사용하지 않아야 할 암호화 API

**검증 포인트:**
- 비밀번호가 bcrypt/scrypt/argon2로 해싱되는가
- API 키와 시크릿이 환경변수로 관리되는가
- 민감 데이터가 암호화되어 저장/전송되는가

### A03: Injection (인젝션 — SQL/XSS/Command)

SQL 인젝션, XSS, 커맨드 인젝션 취약점을 탐지합니다.

**Grep 패턴:**
- `query.*\$\{` — SQL 템플릿 리터럴 인젝션
- `query.*\+\s*` — SQL 문자열 연결 인젝션
- `exec\(.*\+` — 커맨드 인젝션
- `child_process.*exec` — 쉘 커맨드 실행
- `eval\(` — 동적 코드 실행
- `innerHTML\s*=` — DOM XSS
- `dangerouslySetInnerHTML` — React XSS
- `document\.write` — DOM XSS

**검증 포인트:**
- SQL 쿼리에 파라미터 바인딩이 사용되는가
- 사용자 입력이 출력 전에 이스케이프/새니타이즈되는가
- child_process 사용 시 execFile 또는 spawn을 사용하는가

### A04: Insecure Design (안전하지 않은 설계)

설계 수준의 보안 결함 — 하드코딩된 비밀값, 부적절한 에러 노출, 클라이언트 측 검증 의존을 탐지합니다.

**Grep 패턴:**
- `password\s*[:=]\s*['"][^'"]{3,}` — 하드코딩된 비밀번호 (변수 할당)
- `(api_key|apiKey|secret_key|secretKey)\s*[:=]\s*['"]` — 하드코딩된 API 키/시크릿
- `(err|error)\.(message|stack)` 가 응답에 직접 포함 — 에러 상세 노출
- `res\.(json|send)\(.*err` — 에러 객체를 응답에 직접 전달
- `required.*pattern.*(?!.*server)` — 클라이언트 측 폼 검증만 존재 (서버 검증 누락)
- `\.min\(|\.max\(|\.email\(` 가 프론트엔드에만 존재 — Zod/Yup 검증이 서버에 없음

**검증 포인트:**
- 비밀값이 환경변수가 아닌 소스 코드에 직접 포함되어 있는가
- 에러 응답에 스택 트레이스나 내부 SQL 에러가 노출되는가
- 폼 검증이 클라이언트에만 있고 서버 측 검증이 누락되어 있는가
- 비즈니스 로직의 보안 결정이 클라이언트에서 이루어지는가

### A05: Security Misconfiguration (보안 설정 오류)

잘못된 보안 설정 — CORS 와일드카드, 디버그 모드, 환경변수 노출을 탐지합니다.

**Grep 패턴:**
- `Access-Control-Allow-Origin.*\*` — CORS 와일드카드 허용
- `(DEBUG|debug)\s*[:=]\s*(true|1|'true')` — 디버그 모드 활성화
- `NODE_ENV.*development` 가 배포 설정에 존재 — 프로덕션에서 개발 모드
- `process\.env\.\w+` 가 클라이언트 번들에 포함 (`NEXT_PUBLIC_`/`VITE_` 접두사 없이)
- `X-Powered-By` — 서버 정보 노출 헤더
- `(admin|root|default).*password` — 기본 비밀번호 패턴
- `helmet` 미사용 — Express 보안 헤더 미설정

**검증 포인트:**
- CORS가 특정 도메인으로 제한되어 있는가
- 프로덕션 환경에서 디버그 모드가 비활성화되어 있는가
- 서버 전용 환경변수가 클라이언트 번들에 노출되지 않는가
- 보안 관련 HTTP 헤더(CSP, HSTS, X-Frame-Options 등)가 설정되어 있는가

### A06: Vulnerable and Outdated Components (취약한 컴포넌트)

알려진 취약점이 있는 의존성을 탐지합니다.

**Grep 패턴:**
- `package.json`/`requirements.txt`/`Gemfile` 존재 확인
- `"dependencies"` 섹션의 버전 범위 확인 (`^`/`~` vs 고정 버전)

**검증 절차:**
1. `package.json` 존재 시: `npm audit --json 2>/dev/null` 실행 결과 확인
2. `requirements.txt` 존재 시: `pip-audit --format json 2>/dev/null` 실행 결과 확인
3. 위 명령이 불가능하면: 알려진 취약 패턴 수동 검사
   - `lodash` < 4.17.21 (프로토타입 오염)
   - `express` < 4.17.3 (오픈 리다이렉트)
   - `jsonwebtoken` < 9.0.0 (알고리즘 혼동)
   - `axios` < 1.6.0 (SSRF)
4. `package.json`/`requirements.txt`가 없으면: 이 카테고리를 SKIP

**검증 포인트:**
- 알려진 취약점이 있는 의존성이 사용되고 있는가
- 의존성 버전이 최신 보안 패치를 포함하는가
- lock 파일(package-lock.json, yarn.lock)이 커밋되어 있는가

### A07: Identification and Authentication Failures (인증 실패)

약한 인증 메커니즘, 세션 관리 문제를 탐지합니다.

**Grep 패턴:**
- `jwt\.sign.*expiresIn` — JWT 만료 설정 확인
- `session.*maxAge` — 세션 만료 설정 확인
- `password.*length.*[<].*[86]` — 약한 비밀번호 정책
- `bcrypt.*rounds.*[<].*10` — 약한 bcrypt 라운드
- `rate.*limit|throttle` — 브루트포스 방어 확인

**검증 포인트:**
- JWT 토큰에 적절한 만료 시간이 설정되어 있는가
- 로그인 시도 제한(rate limiting)이 적용되어 있는가
- 비밀번호 복잡도 정책이 적용되어 있는가
- 세션 만료 및 갱신 로직이 존재하는가

### A09: Security Logging and Monitoring Failures (보안 로깅 실패)

보안 이벤트 로깅 누락, 민감 정보 로깅을 탐지합니다.

**Grep 패턴:**
- `console\.(log|info|debug).*password` — 비밀번호 로깅
- `console\.(log|info|debug).*token` — 토큰 로깅
- `console\.(log|info|debug).*secret` — 시크릿 로깅
- `catch.*\{[\s]*\}` — 빈 catch 블록 (에러 무시)
- `\.catch\(\(\)\s*=>` — 에러 무시 패턴

**검증 포인트:**
- 인증 성공/실패 이벤트가 로깅되는가
- 민감 정보(비밀번호, 토큰)가 로그에 노출되지 않는가
- 에러 핸들링에서 스택 트레이스가 사용자에게 노출되지 않는가

### A08: Software and Data Integrity Failures (소프트웨어 무결성 실패)

검증 없는 외부 리소스 로드, 안전하지 않은 역직렬화를 탐지합니다.

**Grep 패턴:**
- `<script.*src=.*(?!.*integrity)` — integrity 속성 없는 외부 스크립트
- `<link.*href=.*cdn.*(?!.*integrity)` — integrity 없는 CDN 리소스
- `eval\(.*JSON` — eval로 JSON 파싱 (JSON.parse 대신)
- `pickle\.load|yaml\.load\(` — 안전하지 않은 역직렬화 (Python)
- `unserialize|deserialize.*user` — 사용자 입력 역직렬화
- `require\(.*\+|import\(.*\+` — 동적 모듈 로드 (경로에 사용자 입력)

**검증 포인트:**
- CDN에서 로드하는 리소스에 SRI(Subresource Integrity) 해시가 포함되어 있는가
- JSON 파싱에 `JSON.parse`만 사용되는가 (eval/Function 아닌)
- 역직렬화 입력이 신뢰할 수 있는 소스에서만 오는가
- 동적 import/require에 사용자 입력이 포함되지 않는가

### A10: Server-Side Request Forgery (SSRF)

사용자 입력 기반 URL 요청, 내부 네트워크 접근 취약점을 탐지합니다.

**Grep 패턴:**
- `fetch\(.*req\.(body|query|params)` — 사용자 입력으로 fetch 호출
- `axios\.(get|post)\(.*req\.(body|query|params)` — 사용자 입력으로 axios 호출
- `http\.get\(.*req\b` — Node.js http 모듈로 사용자 URL 요청
- `urllib.*request.*req\b` — Python urllib로 사용자 URL 요청
- `redirect.*req\.(body|query)` — 사용자 입력 기반 리다이렉트 (오픈 리다이렉트)

**검증 포인트:**
- 사용자 입력 URL을 서버에서 직접 요청하지 않는가
- URL 화이트리스트 검증이 적용되어 있는가
- 내부 네트워크 주소(127.0.0.1, 10.x, 192.168.x, localhost)가 차단되는가
- 리다이렉트 대상이 허용된 도메인 목록으로 제한되는가

**프론트엔드 전용 프로젝트**: 서버 사이드 코드가 없으면 이 카테고리를 SKIP하세요.

## Severity Classification

발견된 취약점을 다음 기준으로 분류합니다:

| Severity | 기준 | 예시 |
|----------|------|------|
| **critical** | 즉시 악용 가능, 데이터 유출 위험 | SQL 인젝션, 하드코딩된 시크릿, 인증 우회 |
| **high** | 악용 가능하나 조건 필요 | XSS, 약한 암호화, IDOR |
| **medium** | 보안 모범 사례 위반 | 약한 비밀번호 정책, 불충분한 로깅 |
| **low** | 개선 권장 사항 | http:// 사용, 비효율적 해시 |

## Report Format

```
## Security Audit Report

### Summary
- Scan scope: {scope}
- Files scanned: {count}
- Findings: {critical} critical, {high} high, {medium} medium, {low} low

### Findings

#### [CRITICAL] {title}
- **Category**: {OWASP category}
- **File**: {file_path}:{line}
- **Pattern**: {matched pattern}
- **Description**: {description}
- **Recommendation**: {fix suggestion}

#### [HIGH] {title}
...

### OWASP Coverage
| Category | Status | Findings |
|----------|--------|----------|
| A01 Broken Access Control | Checked | N |
| A02 Cryptographic Failures | Checked | N |
| A03 Injection | Checked | N |
| A04 Insecure Design | Checked | N |
| A05 Security Misconfiguration | Checked | N |
| A06 Vulnerable Components | Checked / SKIP | N |
| A07 Auth Failures | Checked | N |
| A08 Software Integrity | Checked | N |
| A09 Security Logging | Checked | N |
| A10 SSRF | Checked / SKIP | N |
```

## qa_findings Registration

### run_id 확보

qa_findings 등록 전에 반드시 run_id를 확보하세요:

1. `vs --json qa run list --status running`으로 활성 QA Run 확인
2. **활성 Run이 있으면**: 해당 run_id를 사용
3. **활성 Run이 없으면**: 임시 Run을 자동 생성
   ```bash
   vs --json qa run create --mode security-only
   ```
   반환된 run_id를 사용합니다.
4. 스캔 완료 후 임시 Run을 완료 처리:
   ```bash
   vs --json qa run complete <run_id>
   ```

**critical** 및 **high** 심각도 발견 항목은 자동으로 qa_findings에 등록합니다:

```bash
vs --json qa finding create <run_id> \
  --title "{finding title}" \
  --description "{description}" \
  --severity "{critical|high}" \
  --category "security" \
  --file "{file_path}" \
  --line "{line_number}" \
  --recommendation "{fix suggestion}"
```

## Execution Steps

1. **Scope 결정**: `--scope` 옵션이 있으면 해당 디렉토리만, 없으면 프로젝트 루트 전체를 대상으로 합니다
2. **파일 수집**: 대상 디렉토리에서 소스 파일(`.ts`, `.js`, `.tsx`, `.jsx`, `.py` 등)을 수집합니다
3. **패턴 스캔**: 각 OWASP 카테고리의 Grep 패턴을 실행합니다
4. **컨텍스트 분석**: 패턴 매칭 결과를 주변 코드 컨텍스트와 함께 분석하여 false positive를 제거합니다
5. **심각도 분류**: 발견 항목을 severity 기준에 따라 분류합니다
6. **리포트 생성**: Report Format에 따라 리포트를 생성합니다
7. **qa_findings 등록**: critical/high 항목을 qa_findings에 자동 등록합니다

## Rules

- 패턴 매칭만으로 판단하지 말고, 반드시 주변 코드 컨텍스트를 확인하여 false positive를 최소화하세요
- `node_modules/`, `dist/`, `build/`, `.git/` 디렉토리는 스캔에서 제외하세요
- 테스트 파일(`*.test.*`, `*.spec.*`)의 발견 항목은 severity를 한 단계 낮추세요
- 이미 주석으로 `// security: acknowledged` 표시된 항목은 리포트에 포함하되 severity를 `low`로 조정하세요
