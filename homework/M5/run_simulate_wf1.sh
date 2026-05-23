#!/usr/bin/env bash
# run_simulate_wf1.sh — launcher для simulate_wf1.py с пресетами.
#
# Читает N8N_WEBHOOK_URL и N8N_API_KEY из корневого .env репозитория.
#
# Usage:
#   ./run_simulate_wf1.sh smoke           # 30s, interval 5s
#   ./run_simulate_wf1.sh demo            # 120s, interval 10s (для screencast)
#   ./run_simulate_wf1.sh stress          # 60s, interval 2s
#   ./run_simulate_wf1.sh hallucination   # 120s, interval 10s, --include-invalid
#
# Опционально: FEATURE_ID=other_feature ./run_simulate_wf1.sh demo

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
PY_SCRIPT="$SCRIPT_DIR/simulate_wf1.py"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env не найден: $ENV_FILE" >&2
  exit 1
fi
if [[ ! -f "$PY_SCRIPT" ]]; then
  echo "ERROR: simulate_wf1.py не найден: $PY_SCRIPT" >&2
  exit 1
fi

# Берём только нужные ключи из .env, без побочного экспорта всего файла.
read_env() {
  { grep -E "^${1}=" "$ENV_FILE" || true; } | head -n1 | cut -d= -f2- | tr -d '"'"'"''
}

N8N_WEBHOOK_URL="$(read_env N8N_WEBHOOK_URL)"
N8N_API_KEY="$(read_env N8N_API_KEY)"
ENV_FEATURE_ID="$(read_env FEATURE_ID)"
ENV_WEBHOOK_PATH="$(read_env WEBHOOK_PATH)"

if [[ -z "${N8N_WEBHOOK_URL:-}" ]]; then
  echo "ERROR: N8N_WEBHOOK_URL не задан в $ENV_FILE" >&2
  exit 1
fi
if [[ -z "${N8N_API_KEY:-}" ]]; then
  echo "ERROR: N8N_API_KEY не задан в $ENV_FILE" >&2
  exit 1
fi

# WF1 webhook path (n8n manual trigger workflow).
# Приоритет: shell env > .env file > default.
WEBHOOK_PATH="${WEBHOOK_PATH:-${ENV_WEBHOOK_PATH:-/feature-control}}"
FULL_URL="${N8N_WEBHOOK_URL%/}${WEBHOOK_PATH}"
FEATURE_ID="${FEATURE_ID:-${ENV_FEATURE_ID:-search_v2}}"

PRESET="${1:-}"
if [[ -z "$PRESET" ]]; then
  echo "Usage: $0 {smoke|demo|stress|hallucination}" >&2
  exit 1
fi

case "$PRESET" in
  smoke)
    DURATION=30
    INTERVAL=5
    EXTRA=()
    ;;
  demo)
    DURATION=120
    INTERVAL=10
    EXTRA=()
    ;;
  stress)
    # Burst mode — N запросов параллельно через ThreadPoolExecutor, без loop.
    DURATION=1
    INTERVAL=1
    EXTRA=(--burst "${BURST:-10}")
    ;;
  hallucination)
    DURATION=120
    INTERVAL=10
    EXTRA=(--include-invalid --invalid-every "${INVALID_EVERY:-3}")
    ;;
  *)
    echo "ERROR: неизвестный пресет '$PRESET'. Доступно: smoke|demo|stress|hallucination" >&2
    exit 1
    ;;
esac

echo "Preset: $PRESET (duration=${DURATION}s, interval=${INTERVAL}s)"
echo "Webhook: $FULL_URL"
echo "Feature: $FEATURE_ID"
echo "---"

exec python3 "$PY_SCRIPT" \
  --webhook-url "$FULL_URL" \
  --api-key "$N8N_API_KEY" \
  --feature-id "$FEATURE_ID" \
  --duration "$DURATION" \
  --interval "$INTERVAL" \
  ${EXTRA[@]+"${EXTRA[@]}"}
