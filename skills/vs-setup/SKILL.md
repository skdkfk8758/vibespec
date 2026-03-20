---
name: vs-setup
description: Use when setting up VibeSpec for the first time. 초기 설정 및 SDD 워크플로우를 안내하고 첫 플랜 생성을 도와줍니다.
invocation: user
---

# VibeSpec Setup

VibeSpec을 처음 사용하는 사용자의 초기 설정을 도와줍니다.

## Steps

1. **MCP 서버 연결 확인**
   - `vs_dashboard`를 호출하여 MCP 서버가 연결되어 있는지 확인하세요
   - 성공하면 → Step 2로 건너뛰세요
   - 실패하면 → 아래 **원인 진단**을 실행하세요

   **원인 진단 (vs_dashboard 실패 시):**

   MCP 서버는 `~/.claude/.mcp.json`에 등록되어야 Claude Code가 시작할 때 자동으로 연결합니다.
   프로젝트별 `.mcp.json`을 수동 생성하지 마세요. 실패 원인을 순서대로 확인합니다:

   a. **플러그인 설치 확인**:
      ```bash
      cat ~/.claude/plugins/installed_plugins.json | grep vibespec
      ```
      - 결과가 없으면 STOP: "VibeSpec 플러그인이 설치되어 있지 않습니다. `claude plugins install vibespec` 후 재시작하세요."
      - `installPath`를 `PLUGIN_DIR`로 기록

   b. **글로벌 MCP 등록 확인**:
      ```bash
      cat ~/.claude/.mcp.json 2>/dev/null | grep vibespec
      ```
      - vibespec 항목이 없으면 → **자동 등록 실행:**
        ```bash
        python3 -c "
        import json
        path = '$HOME/.claude/.mcp.json'
        try:
            data = json.load(open(path))
        except:
            data = {'mcpServers': {}}
        if 'mcpServers' not in data:
            data['mcpServers'] = {}
        data['mcpServers']['vibespec'] = {
            'command': 'bash',
            'args': ['$PLUGIN_DIR/scripts/start-mcp.sh']
        }
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n')
        print('등록 완료')
        "
        ```
      - 등록 후 "Claude Code를 재시작하세요"라고 안내하고 STOP
      - 이미 등록되어 있으면 → 경로가 현재 `PLUGIN_DIR`과 일치하는지 확인, 불일치 시 갱신

   c. **MCP 시작 스크립트 확인**:
      ```bash
      test -f "$PLUGIN_DIR/scripts/start-mcp.sh" && echo "OK"
      ```
      - 없으면: `/vs-update`를 실행하여 플러그인을 재설치하라고 안내하고 STOP

   d. **native 의존성 확인**:
      ```bash
      test -d "$PLUGIN_DIR/node_modules/better-sqlite3" && echo "OK"
      ```
      - 없으면:
        ```bash
        cd "$PLUGIN_DIR" && npm ci --production
        ```
      - 설치 후 "Claude Code를 재시작하세요"라고 안내하고 STOP

   e. **서버 직접 실행 테스트**:
      ```bash
      cd "$PLUGIN_DIR" && bash scripts/start-mcp.sh 2>&1 | head -5
      ```
      - 에러가 있으면 에러 내용을 사용자에게 보여주고 STOP
      - `[vibespec] CWD:`, `[vibespec] DB:` 로그가 정상 출력되면:
        → "MCP 서버는 정상이지만 Claude Code에 연결되지 않았습니다. Claude Code를 재시작하세요."
        → STOP

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
   - `/vs-commit`으로 변경사항을 태스크와 연동하여 커밋합니다
   - `/vs-dashboard`로 전체 진행 현황을 봅니다

4. **첫 플랜 생성 (선택)**
   - 사용자에게 첫 플랜을 만들지 물어보세요
   - 원하면 `/vs-plan`을 실행하여 스펙 기반 플랜을 생성하세요

5. **컨텍스트 저장**
   - `vs_context_save`로 셋업 완료 내용을 요약 저장하세요
