---
name: vs-update
description: Use when updating VibeSpec plugin to the latest version. 마켓플레이스 캐시 갱신, 플러그인 캐시 교체, 레지스트리 업데이트를 자동 수행합니다.
invocation: user
---

# VibeSpec Update

VibeSpec 플러그인을 GitHub 최신 커밋으로 업데이트합니다.

## Steps

1. **현재 설치 정보 확인**
   - `~/.claude/plugins/installed_plugins.json`에서 `vibespec@vibespec-marketplace` 항목을 읽으세요
   - 현재 설치된 버전과 installPath를 기록하세요
   - 항목이 없으면 STOP: "VibeSpec이 설치되어 있지 않습니다. `/plugin marketplace add skdkfk8758/vibespec` 후 `/plugin install vibespec`으로 설치하세요."

2. **마켓플레이스 캐시 갱신**
   ```bash
   cd ~/.claude/plugins/marketplaces/vibespec-marketplace && git fetch origin && git reset --hard origin/main
   ```
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
     cp -R .claude-plugin agents skills hooks "$TMP_DIR/"
     ```
   - 빌드가 필요한 경우 (dist/ 디렉토리):
     ```bash
     cd ~/.claude/plugins/marketplaces/vibespec-marketplace
     npm ci && npm run build
     cp -R dist "$TMP_DIR/"
     cp package.json "$TMP_DIR/"
     ```
   - **빌드 검증** — 아래 필수 항목이 모두 존재하는지 확인하세요:
     - `$TMP_DIR/.claude-plugin/plugin.json`
     - `$TMP_DIR/skills/` (1개 이상의 SKILL.md)
     - dist가 필요한 경우: `$TMP_DIR/dist/mcp/server.js`
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
     - `version` → 새 버전
     - `lastUpdated` → 현재 ISO 타임스탬프
     - `gitCommitSha` → 새 커밋 SHA

6. **이전 캐시 정리**
   - 이전 버전의 캐시 디렉토리를 삭제하세요:
     ```bash
     rm -rf {old_installPath}
     ```
   - 이전 경로와 새 경로가 동일하면 이 단계를 건너뛰세요 (이미 Step 4에서 교체됨).

7. **MCP 설정 경로 갱신**
   - 프로젝트별 `.mcp.json`에 이전 캐시 경로가 하드코딩되어 있으면 MCP 연결이 깨집니다.
   - 아래 위치의 `.mcp.json` 파일에서 이전 경로를 새 경로로 치환하세요:
     1. 현재 작업 디렉토리: `./.mcp.json`
     2. 홈 디렉토리: `~/.mcp.json`
   - 치환 대상: `{old_installPath}` → `{new_installPath}`
   - 예시:
     ```
     vibespec-marketplace/vibespec/0.5.0/dist/mcp/server.js
     → vibespec-marketplace/vibespec/0.6.1/dist/mcp/server.js
     ```
   - `.mcp.json` 파일이 없거나 vibespec 경로가 없으면 건너뛰세요.
   - 플러그인의 `.claude-plugin/.mcp.json`은 `${CLAUDE_PLUGIN_ROOT}` 변수를 사용하므로 별도 갱신이 불필요합니다.

8. **결과 보고**
   ```
   VibeSpec 업데이트 완료!
   - 이전: v{old_version}
   - 최신: v{new_version}
   - MCP 경로: {갱신됨 / 변경 없음}

   변경사항을 적용하려면 Claude Code를 재시작하세요.
   ```
