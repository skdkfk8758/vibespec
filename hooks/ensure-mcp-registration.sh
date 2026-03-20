#!/bin/bash
set -euo pipefail

# SessionStart hook: ~/.claude/.mcp.json에 vibespec MCP 등록 보장
# 플러그인 시스템의 .claude-plugin/.mcp.json 자동 등록이 동작하지 않는 문제 대응

trap 'exit 0' ERR

GLOBAL_MCP="$HOME/.claude/.mcp.json"
PLUGINS_JSON="$HOME/.claude/plugins/installed_plugins.json"

# installed_plugins.json에서 vibespec installPath 추출
if [ ! -f "$PLUGINS_JSON" ]; then
  exit 0
fi

# jq 우선, python3 폴백
if command -v jq &>/dev/null; then
  INSTALL_PATH=$(jq -r '.plugins["vibespec@vibespec"] // .plugins["vibespec@vibespec-marketplace"] | if type == "array" then .[0].installPath else .installPath end // empty' "$PLUGINS_JSON" 2>/dev/null || true)
elif command -v python3 &>/dev/null; then
  INSTALL_PATH=$(python3 -c "
import json, sys
try:
    data = json.load(open('$PLUGINS_JSON'))
    plugins = data.get('plugins', {})
    entry = plugins.get('vibespec@vibespec') or plugins.get('vibespec@vibespec-marketplace')
    if isinstance(entry, list):
        entry = entry[0]
    print(entry.get('installPath', ''))
except:
    pass
" 2>/dev/null || true)
else
  exit 0
fi

if [ -z "$INSTALL_PATH" ]; then
  exit 0
fi

# start-mcp.sh 존재 확인
if [ ! -f "$INSTALL_PATH/scripts/start-mcp.sh" ]; then
  exit 0
fi

# 글로벌 .mcp.json 확인/생성
if [ ! -f "$GLOBAL_MCP" ]; then
  echo '{"mcpServers":{}}' > "$GLOBAL_MCP"
fi

# vibespec 항목이 이미 있는지 확인
HAS_VIBESPEC=""
if command -v jq &>/dev/null; then
  HAS_VIBESPEC=$(jq -r '.mcpServers.vibespec // empty' "$GLOBAL_MCP" 2>/dev/null || true)
elif command -v python3 &>/dev/null; then
  HAS_VIBESPEC=$(python3 -c "
import json
try:
    data = json.load(open('$GLOBAL_MCP'))
    v = data.get('mcpServers', {}).get('vibespec')
    if v: print('exists')
except:
    pass
" 2>/dev/null || true)
fi

if [ -n "$HAS_VIBESPEC" ]; then
  # 이미 등록됨 — 경로가 현재 installPath와 일치하는지 확인
  if command -v python3 &>/dev/null; then
    NEEDS_UPDATE=$(python3 -c "
import json
try:
    data = json.load(open('$GLOBAL_MCP'))
    args = data.get('mcpServers', {}).get('vibespec', {}).get('args', [])
    current = '$INSTALL_PATH/scripts/start-mcp.sh'
    # args 안에 이전 경로가 있으면 갱신 필요
    if args and current not in ' '.join(args):
        print('yes')
except:
    pass
" 2>/dev/null || true)
    if [ "$NEEDS_UPDATE" = "yes" ]; then
      python3 -c "
import json
data = json.load(open('$GLOBAL_MCP'))
data['mcpServers']['vibespec'] = {
    'command': 'bash',
    'args': ['$INSTALL_PATH/scripts/start-mcp.sh']
}
with open('$GLOBAL_MCP', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
" 2>/dev/null
      echo '{"additionalContext": "vibespec MCP 경로가 갱신되었습니다. Claude Code를 재시작하면 적용됩니다."}'
    fi
  fi
  exit 0
fi

# vibespec 항목 추가
if command -v python3 &>/dev/null; then
  python3 -c "
import json
try:
    data = json.load(open('$GLOBAL_MCP'))
except:
    data = {'mcpServers': {}}
if 'mcpServers' not in data:
    data['mcpServers'] = {}
data['mcpServers']['vibespec'] = {
    'command': 'bash',
    'args': ['$INSTALL_PATH/scripts/start-mcp.sh']
}
with open('$GLOBAL_MCP', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
" 2>/dev/null
  echo '{"additionalContext": "vibespec MCP 서버가 글로벌 설정에 등록되었습니다. Claude Code를 재시작하면 MCP 도구를 사용할 수 있습니다."}'
elif command -v jq &>/dev/null; then
  TMP=$(mktemp)
  jq --arg path "$INSTALL_PATH/scripts/start-mcp.sh" \
    '.mcpServers.vibespec = {"command": "bash", "args": [$path]}' \
    "$GLOBAL_MCP" > "$TMP" && mv "$TMP" "$GLOBAL_MCP"
  echo '{"additionalContext": "vibespec MCP 서버가 글로벌 설정에 등록되었습니다. Claude Code를 재시작하면 MCP 도구를 사용할 수 있습니다."}'
fi

exit 0
