---
name: vs-update
description: [Util] Update VibeSpec plugin to the latest version.
invocation: deferred
---

# VibeSpec Update

VibeSpec 플러그인을 GitHub 최신 커밋으로 업데이트합니다.

## When to Use

**사용하세요:**
- VibeSpec 플러그인을 최신 버전으로 업데이트할 때
- 새로운 기능이나 버그 수정이 릴리즈되었을 때

**사용하지 마세요:**
- VibeSpec이 아직 설치되지 않았다면 → 마켓플레이스에서 설치 먼저
- 릴리즈를 만들려면 → `/vs-release`

## Steps

1. **현재 설치 정보 확인**
   - `~/.claude/plugins/installed_plugins.json`에서 `vibespec@vibespec-marketplace` 항목을 읽으세요
   - 현재 설치된 버전과 installPath를 기록하세요
   - 항목이 없으면 STOP: "VibeSpec이 설치되어 있지 않습니다. `/plugin marketplace add skdkfk8758/vibespec` 후 `/plugin install vibespec`으로 설치하세요."

2. **마켓플레이스 캐시 갱신**
   ```bash
   cd ~/.claude/plugins/marketplaces/vibespec-marketplace && git fetch origin && git reset --hard origin/main
   ```
   - **네트워크 실패 시**: `git fetch`가 실패하면 **1회 재시도**하세요
     ```bash
     cd ~/.claude/plugins/marketplaces/vibespec-marketplace && git fetch origin
     ```
   - 재시도도 실패하면 **오프라인 모드**로 전환하고 다음을 안내하세요:
     ```
     네트워크 연결에 실패했습니다. 오프라인 모드로 전환합니다.
     - 현재 버전(v{current_version})이 유지됩니다
     - 네트워크 복구 후 `/vs-update`를 다시 실행하세요
     - 수동 업데이트: cd ~/.claude/plugins/marketplaces/vibespec-marketplace && git pull origin main
     ```
   - 오프라인 모드에서는 이후 단계를 실행하지 않고 STOP하세요
   - 갱신 후 `.claude-plugin/marketplace.json`에서 최신 version을 읽으세요
   - 현재 설치된 버전과 동일하면 STOP: "이미 최신 버전입니다 (v{version})."

3. **새 버전 캐시를 임시 디렉토리에 생성 (안전한 빌드)**
   - 최신 version 값과 git commit SHA를 기록하세요:
     ```bash
     cd ~/.claude/plugins/marketplaces/vibespec-marketplace && git rev-parse HEAD
     ```
   - **임시 디렉토리**에 새 캐시를 생성하세요 (구 버전을 건드리지 않음):
     ```bash
     NEW_DIR=~/.claude/plugins/cache/vibespec-marketplace/vibespec/{new_version}
     TMP_DIR="${NEW_DIR}.tmp"
     rm -rf "$TMP_DIR"
     mkdir -p "$TMP_DIR"
     cd ~/.claude/plugins/marketplaces/vibespec-marketplace
     cp -R .claude-plugin agents skills hooks scripts "$TMP_DIR/"
     ```
   - 빌드가 필요한 경우 (dist/ 디렉토리):
     ```bash
     cd ~/.claude/plugins/marketplaces/vibespec-marketplace
     npm ci && npm run build
     cp -R dist "$TMP_DIR/"
     cp package.json package-lock.json "$TMP_DIR/"
     ```
   - **런타임 의존성 설치** (better-sqlite3 등 native 모듈이 external로 빌드되므로 필수):
     ```bash
     cd "$TMP_DIR" && npm ci --production
     ```
     - 이 단계가 없으면 CLI 실행 시 `better-sqlite3` 모듈을 찾지 못해 명령이 실패합니다.
   - **빌드 검증** — 아래 필수 항목이 모두 존재하는지 확인하세요:
     - `$TMP_DIR/.claude-plugin/plugin.json`
     - `$TMP_DIR/skills/` (1개 이상의 SKILL.md)
     - `$TMP_DIR/dist/cli/index.js`
     - native 의존성: `$TMP_DIR/node_modules/better-sqlite3`
   - 검증 실패 시 임시 디렉토리를 정리하고 STOP:
     ```bash
     rm -rf "$TMP_DIR"
     ```
     "빌드 검증 실패: {누락된 항목}. 구 버전(v{old_version})이 유지됩니다."

4. **임시 디렉토리를 최종 경로로 승격 (atomic swap)**
   ```bash
   rm -rf "$NEW_DIR"
   mv "$TMP_DIR" "$NEW_DIR"
   ```
   - `mv`는 같은 파일시스템 내에서 원자적이므로, 중간에 불완전한 상태가 노출되지 않습니다.

5. **레지스트리 업데이트**
   - `~/.claude/plugins/installed_plugins.json`의 `vibespec@vibespec-marketplace` 항목을 업데이트하세요:
     - `installPath` → 새 캐시 디렉토리 경로
     - `previousVersion` → 업데이트 전 버전 (롤백 참조용)
     - `version` → 새 버전
     - `lastUpdated` → 현재 ISO 타임스탬프
     - `gitCommitSha` → 새 커밋 SHA
   - **롤백 정보 보존**: `previousVersion` 필드에 이전 버전을 기록하여, 문제 발생 시 사용자가 어떤 버전으로 돌아가야 하는지 참조할 수 있도록 하세요

6. **이전 캐시 정리**
   - 이전 버전의 캐시 디렉토리를 삭제하세요:
     ```bash
     rm -rf {old_installPath}
     ```
   - 이전 경로와 새 경로가 동일하면 이 단계를 건너뛰세요 (이미 Step 4에서 교체됨).

7. **결과 보고**
   ```
   VibeSpec 업데이트 완료!
   - 이전: v{old_version}
   - 최신: v{new_version}

   변경사항을 적용하려면 Claude Code를 재시작하세요.
   ```
