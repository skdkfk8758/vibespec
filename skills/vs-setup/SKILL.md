---
name: vs-setup
description: Use when setting up VibeSpec for the first time. 초기 설정 및 SDD 워크플로우를 안내하고 첫 플랜 생성을 도와줍니다.
---

# VibeSpec Setup

VibeSpec을 처음 사용하는 사용자의 초기 설정을 도와줍니다.

## Steps

1. **MCP 서버 자동 등록**
   - 먼저 `vp_dashboard`를 호출하여 MCP 서버가 이미 연결되어 있는지 확인하세요
   - 성공하면 → MCP 이미 등록됨, Step 2로 건너뛰세요
   - 실패하면 (MCP 서버 미등록) → 아래 자동 등록 절차를 실행하세요:

   **자동 등록 절차:**

   a. 플러그인 캐시에서 설치 경로를 탐지합니다:
      ```bash
      ls -d ~/.claude/plugins/cache/vibespec/vibespec/*/ | sort -V | tail -1
      ```
      - 결과 예: `~/.claude/plugins/cache/vibespec/vibespec/0.10.2/`
      - 이 경로를 `PLUGIN_DIR`로 사용

   b. `PLUGIN_DIR/dist/mcp/server.js` 파일이 존재하는지 확인합니다:
      ```bash
      test -f "$PLUGIN_DIR/dist/mcp/server.js" && echo "OK"
      ```
      - 없으면: `PLUGIN_DIR`에서 `npm install && npm run build` 실행 후 재확인

   c. 프로젝트의 `.mcp.json` 파일을 생성하거나 업데이트합니다:
      - 파일이 없으면 새로 생성, 있으면 기존 내용에 vibespec 항목 추가
      - **주의**: `PLUGIN_DIR`의 실제 절대 경로를 `~`가 아닌 풀 경로로 기록하세요
      ```json
      {
        "mcpServers": {
          "vibespec": {
            "command": "node",
            "args": ["<PLUGIN_DIR>/dist/mcp/server.js"],
            "env": {
              "VP_DB_PATH": "./vibespec.db"
            }
          }
        }
      }
      ```

   d. 등록 완료 안내:
      - "MCP 서버가 `.mcp.json`에 등록되었습니다."
      - "**Claude Code를 재시작**해야 MCP 서버가 활성화됩니다."
      - 재시작 후 `/vs-setup`을 다시 실행하라고 안내하세요
      - **여기서 STOP** — 재시작 전에는 다음 단계로 진행하지 마세요

2. **환경 진단**
   - `vp_dashboard`를 호출하여 MCP 서버 연결 상태를 확인하세요
   - 성공하면 "VibeSpec MCP 서버가 정상 연결되었습니다." 안내
   - 실패하면 트러블슈팅:
     - `.mcp.json`의 경로가 올바른지 확인
     - `node <PLUGIN_DIR>/dist/mcp/server.js`를 직접 실행해서 오류 확인
     - `vibespec.db` 파일이 프로젝트 루트에 생성 가능한지 확인

3. **기존 데이터 확인**
   - 대시보드 결과에 기존 플랜이 있으면:
     → "기존 플랜이 있습니다. `/vs-resume`으로 이어서 작업할 수 있습니다." 안내
   - 기존 플랜이 없으면 다음 단계로 진행

4. **SDD 워크플로우 설명**
   사용자에게 다음을 설명하세요:
   - VibeSpec은 **Spec → Plan → Tasks → Implementation** 사이클을 따릅니다
   - 매 세션 시작 시 `/vs-resume`으로 이전 컨텍스트를 복원합니다
   - `/vs-plan`으로 스펙을 작성하고 태스크로 분해합니다
   - `/vs-next`로 다음 태스크를 가져와 작업합니다
   - `/vs-commit`으로 변경사항을 태스크와 연동하여 커밋합니다
   - `/vs-dashboard`로 전체 진행 현황을 봅니다

5. **첫 플랜 생성 (선택)**
   - 사용자에게 첫 플랜을 만들지 물어보세요
   - 원하면 `/vs-plan`을 실행하여 스펙 기반 플랜을 생성하세요

6. **컨텍스트 저장**
   - `vp_context_save`로 셋업 완료 내용을 요약 저장하세요
