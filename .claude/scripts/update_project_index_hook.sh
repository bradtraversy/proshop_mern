#!/usr/bin/env bash
# Wrapper around update_project_index.py for PostToolUse hook.
# Captures python stderr and emits a Claude Code hook JSON with `systemMessage`
# so the output is visible in the CC UI (raw stderr from PostToolUse hooks is
# hidden on exit 0).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PY="$SCRIPT_DIR/update_project_index.py"

# Read hook stdin (tool_name, tool_input...) — keep for forwarding context.
HOOK_INPUT="$(cat || true)"

# Run python; capture stderr, discard stdout (script writes none).
PY_OUT="$(python3 "$PY" 2>&1 1>/dev/null)"
PY_EXIT=$?

# Escape for JSON (newlines + quotes + backslashes).
MSG=$(printf '%s' "$PY_OUT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

# systemMessage shows in CC UI; exit 0 = non-blocking.
printf '{"systemMessage": %s}\n' "$MSG"
exit "$PY_EXIT"
