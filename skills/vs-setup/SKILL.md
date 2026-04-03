---
name: vs-setup
description: [Util] Initial VibeSpec setup and SDD onboarding.
invocation: deferred
---

# VibeSpec Setup

VibeSpec을 처음 사용하는 사용자의 초기 설정을 도와줍니다.

## Prerequisites

셋업 전 아래 항목을 확인하세요:

1. **Node.js**: `node -v`로 버전을 확인하세요. v18 이상이 필요합니다 (better-sqlite3 native 모듈 호환).
2. **Git**: `git rev-parse --is-inside-work-tree`로 현재 디렉토리가 git 저장소인지 확인하세요.
   - git 저장소가 아니면: "VibeSpec의 워크트리/커밋 기능을 사용하려면 git 저장소가 필요합니다. `git init`으로 초기화하세요." 안내

## Steps

1. **CLI 연결 확인**
   - Bash 도구로 `vs dashboard --json` 명령을 실행하여 CLI가 정상 동작하는지 확인하세요
   - 성공하면 → Step 2로 건너뛰세요
   - 실패하면 → 아래 **Troubleshooting** 섹션을 실행하세요

2. **기존 데이터 확인**
   - 대시보드 결과에 기존 플랜이 있으면:
     → "기존 플랜이 있습니다. `/vs-resume`으로 이어서 작업할 수 있습니다." 안내
   - 기존 플랜이 없으면 다음 단계로 진행

3. **SDD 워크플로우 설명**
   사용자에게 다음을 설명하세요:
   - VibeSpec은 **Spec → Plan → Tasks → Implementation** 사이클을 따릅니다
   - 매 세션 시작 시 `/vs-resume`으로 이전 컨텍스트를 복원합니다
   - `/vs-plan`으로 스펙을 작성하고 태스크로 분해합니다
   - `/vs-next`로 다음 태스크를 가져와 작업합니다
   - `/vs-pick`으로 특정 태스크를 골라 작업할 수도 있습니다
   - `/vs-exec`로 플랜의 전체 태스크를 일괄 실행합니다
   - `/vs-worktree`로 격리된 환경에서 안전하게 작업할 수 있습니다
   - `/vs-commit`으로 변경사항을 태스크와 연동하여 커밋합니다
   - `/vs-dashboard`로 전체 진행 현황을 봅니다

4. **골격 문서 안내**
   - 프로젝트 루트에서 PRD.md, DESIGN.md, POLICY.md, ARCHITECTURE.md 존재 여부를 확인하세요
   - 골격 문서가 있으면: "골격 문서가 감지되었습니다. `/vs-skeleton-status`로 건강도를 확인하세요."
   - 없으면: "프로젝트 골격 문서(PRD/DESIGN/POLICY/ARCHITECTURE)를 설정하면 플래닝/구현 시 자동 정합성 체크가 활성화됩니다. `/vs-skeleton-init`으로 생성하세요."

5. **모노레포 환경 안내** (모노레포 감지 시)
   - `packages/` 또는 `apps/` 디렉토리, `pnpm-workspace.yaml`, `turbo.json` 존재 시:
     "모노레포 프로젝트입니다. `/vs-skeleton-init`에서 환경변수 통합 관리 정책(Environment Management)을 설정하면 패키지 간 설정 일관성을 유지할 수 있습니다."
   - 루트에 `.env`가 없고 패키지별 `.env`가 있으면:
     "⚠️ 패키지별 .env가 감지되었습니다. 루트 통합 관리를 권장합니다."

6. **첫 플랜 생성 (선택)**
   - 사용자에게 첫 플랜을 만들지 물어보세요
   - 원하면 `/vs-plan`을 실행하여 스펙 기반 플랜을 생성하세요

## Troubleshooting

`vs dashboard --json` 실패 시 아래 순서로 원인을 진단하세요:

### a. 플러그인 설치 확인

```bash
PLUGIN_DIR=$(node -e "const p=require('$HOME/.claude/plugins/installed_plugins.json');const v=p.find(x=>x.name&&x.name.includes('vibespec'));if(v)console.log(v.installPath);else process.exit(1)")
echo "PLUGIN_DIR=$PLUGIN_DIR"
```
- 결과가 없으면 STOP: "VibeSpec 플러그인이 설치되어 있지 않습니다. `claude plugins install vibespec` 후 재시작하세요."

### b. CLI 바이너리 확인

```bash
test -f "$PLUGIN_DIR/dist/cli/index.js" && echo "OK"
```
- 없으면: `/vs-update`를 실행하여 플러그인을 재설치하라고 안내하고 STOP

### c. native 의존성 확인

```bash
test -d "$PLUGIN_DIR/node_modules/better-sqlite3" && echo "OK"
```
- 없으면:
  ```bash
  cd "$PLUGIN_DIR" && npm ci --production
  ```
- `npm ci` 실패 시 아래 단계를 순서대로 시도하세요:
    1. **Node.js 버전 확인**: `node -v`로 v18 이상인지 확인하세요. v18 미만이면 업그레이드를 안내하세요.
    2. **node-gyp 빌드 도구 확인**: native 모듈 빌드에 필요한 도구가 설치되어 있는지 확인하세요.
       - macOS: `xcode-select --install`로 Command Line Tools 설치
       - Linux: `sudo apt-get install -y build-essential python3` (Debian/Ubuntu 기준)
       - Windows: `npm install -g windows-build-tools` 또는 Visual Studio Build Tools 설치
    3. **better-sqlite3 수동 빌드**: 위 도구가 있는데도 실패하면 직접 빌드를 시도하세요:
       ```bash
       cd "$PLUGIN_DIR" && npm rebuild better-sqlite3
       ```
    4. **캐시 정리 후 재시도**: 여전히 실패하면 캐시를 정리한 뒤 다시 설치하세요:
       ```bash
       cd "$PLUGIN_DIR" && rm -rf node_modules && npm cache clean --force && npm ci --production
       ```
    5. 그래도 실패하면 에러 로그를 사용자에게 보여주고 GitHub 이슈 리포트를 안내하세요.
- 설치 후 다시 `vs dashboard --json`을 실행하여 확인하세요

### d. 직접 실행 테스트

```bash
node "$PLUGIN_DIR/dist/cli/index.js" dashboard --json
```
- 에러가 있으면 에러 내용을 사용자에게 보여주고 STOP
- 해결이 어려우면 https://github.com/skdkfk8758/vibespec/issues 에 이슈를 등록하도록 안내하세요

## 다음 단계 (셋업 완료 후)

셋업이 완료되면 사용자에게 아래 워크플로우 요약과 각 경로를 안내하세요:

> **VibeSpec 워크플로우**: Ideate → Spec → Plan → Tasks → Implementation → Commit → Release → Deploy

| 경로 | 설명 | 추천 상황 |
|------|------|----------|
| `/vs-ideate` | 아이디어를 구조화하고 SDD 스펙 초안을 생성합니다 | 아이디어는 있지만 요구사항이 아직 정리 안 됐을 때 |
| `/vs-plan` | 스펙을 작성하고 태스크로 분해합니다 | 새로운 기능을 시작할 때 |
| `/vs-next` | 다음 태스크를 자동으로 가져옵니다 | 이미 플랜이 있고 순서대로 진행할 때 |
| `/vs-pick` | 특정 태스크를 골라 작업합니다 | 우선순위가 높은 태스크를 먼저 처리할 때 |
| `/vs-exec` | 플랜의 전체 태스크를 일괄 실행합니다 | 단순 반복 태스크를 한꺼번에 처리할 때 |
| `/vs-worktree` | 격리된 환경에서 작업합니다 | 메인 브랜치를 건드리지 않고 실험할 때 |
| `/vs-dashboard` | 전체 진행 현황을 확인합니다 | 현재 상태를 파악하고 싶을 때 |

다음 세션 시작 시에는 반드시 `/vs-resume`을 실행하여 이전 컨텍스트를 복원하세요.
