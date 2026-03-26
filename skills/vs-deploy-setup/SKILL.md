---
name: vs-deploy-setup
description: Use when setting up deployment configuration for a project. 프로젝트 파일을 분석하여 배포 플랫폼을 자동 감지하고, 배포 명령/URL 등을 config에 저장합니다. "배포 설정", "deploy setup", "배포 구성" 등에 사용하세요.
invocation: user
argument-hint: "[platform override]"
---

# vs-deploy-setup (배포 환경 설정)

프로젝트의 배포 플랫폼을 자동 감지하고, 배포에 필요한 설정을 VibeSpec config KV에 저장합니다.

## When to Use

**사용하세요:**
- 프로젝트에 배포 파이프라인을 처음 연결할 때
- 배포 플랫폼을 변경했을 때
- `vs deploy status`에서 설정이 없다고 표시될 때

**사용하지 마세요:**
- 이미 배포 설정이 완료된 경우 → `/vs-deploy`로 직접 배포
- 배포 자체를 실행하려는 경우 → `/vs-deploy`

## Process

### Phase 1: 플랫폼 자동 감지

프로젝트 루트에서 아래 파일을 순서대로 탐색하여 플랫폼을 결정합니다:

| 파일 | 플랫폼 | 기본 배포 명령 |
|------|--------|---------------|
| `fly.toml` | Fly.io | `fly deploy` |
| `vercel.json` 또는 `.vercel/` | Vercel | `vercel --prod` |
| `netlify.toml` | Netlify | `netlify deploy --prod` |
| `Dockerfile` + `docker-compose.yml` | Docker | `docker compose up -d --build` |
| `app.yaml` | GCP App Engine | `gcloud app deploy` |
| `Procfile` | Heroku | `git push heroku main` |

감지 순서대로 **첫 번째 매칭**을 사용합니다.

### Phase 2: 사용자 확인

```
배포 플랫폼 감지 결과:

| 항목 | 값 |
|------|-----|
| 플랫폼 | {detected_platform} |
| 배포 명령 | {default_command} |
| 감지 근거 | {matched_file} |

맞습니까?
- Y: 이대로 저장
- 명령 수정: 배포 명령만 변경 (예: "fly deploy --ha=false")
- URL 추가: 배포 URL과 헬스체크 URL 입력
- N: 수동 설정으로 전환
```

### Phase 3: 수동 설정 (감지 실패 또는 N 선택 시)

자동 감지에 실패하거나 사용자가 N을 선택한 경우:

```
배포 플랫폼을 수동으로 설정합니다.

1. 플랫폼 이름: (예: fly.io, vercel, aws, custom)
2. 배포 명령: (예: fly deploy, npm run deploy)
3. 배포 URL: (예: https://myapp.fly.dev) [선택]
4. 헬스체크 URL: (예: https://myapp.fly.dev/health) [선택]
```

### Phase 4: Config 저장

아래 키를 VibeSpec config KV에 저장합니다:

```bash
vs config set deploy.platform "{platform}"
vs config set deploy.command "{command}"
vs config set deploy.url "{url}"           # 선택
vs config set deploy.health_url "{health_url}"  # 선택
```

### Phase 5: 결과 보고

```
배포 설정 완료!

| 항목 | 값 |
|------|-----|
| 플랫폼 | {platform} |
| 배포 명령 | {command} |
| 배포 URL | {url 또는 "미설정"} |
| 헬스체크 URL | {health_url 또는 "미설정"} |

다음 단계:
- /vs-deploy — 배포 실행
- /vs-canary — 헬스체크 실행 (health_url 설정 시)
- vs deploy status — 현재 설정 확인
```

## Rules

- 자동 감지는 프로젝트 루트 기준으로만 수행
- 감지 결과를 사용자에게 반드시 확인받은 후 저장
- deploy.command는 반드시 설정 — 나머지는 선택
- 기존 설정이 있으면 덮어쓰기 전에 경고
- config KV 저장은 `vs config set` CLI를 사용
