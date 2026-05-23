#!/usr/bin/env bash
# run_simulate_wf2.sh — launcher для simulate_wf2.py с пресетами.
#
# simulate_wf2.py пишет события success/error в logs.json с error_rate по синусоиде.
# WF2 (cron-trigger n8n) читает этот файл и toggle'ит фичу при переходе через threshold.
#
# Usage:
#   ./run_simulate_wf2.sh smoke           # 2 мин, period 60s — быстрый полный цикл
#   ./run_simulate_wf2.sh demo            # 10 мин, period 300s — один полный период для screencast
#   ./run_simulate_wf2.sh full            # 30 мин, period 300s — стандартный прогон (3 цикла)
#   ./run_simulate_wf2.sh stress          # 5 мин, period 60s, rps 20 — высокая нагрузка
#
# Переопределить через env:
#   OUTPUT=./custom/logs.json ./run_simulate_wf2.sh demo   # если WF2 читает файл из другого пути
#   FEATURE_ID=checkout_v3 ./run_simulate_wf2.sh smoke

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
PY_SCRIPT="$SCRIPT_DIR/simulate_wf2.py"

if [[ ! -f "$PY_SCRIPT" ]]; then
  echo "ERROR: simulate_wf2.py не найден: $PY_SCRIPT" >&2
  exit 1
fi

read_env() {
  { grep -E "^${1}=" "$ENV_FILE" || true; } | head -n1 | cut -d= -f2- | tr -d '"'"'"''
}

ENV_FEATURE_ID=""
if [[ -f "$ENV_FILE" ]]; then
  ENV_FEATURE_ID="$(read_env FEATURE_ID)"
fi

# Приоритет: shell env > .env > default
FEATURE_ID="${FEATURE_ID:-${ENV_FEATURE_ID:-search_v2}}"
OUTPUT="${OUTPUT:-$SCRIPT_DIR/logs.json}"

PRESET="${1:-}"
if [[ -z "$PRESET" ]]; then
  echo "Usage: $0 {smoke|demo|full|stress}" >&2
  exit 1
fi

case "$PRESET" in
  smoke)
    # 2 полных цикла за 2 минуты — быстро проверить что WF2 реагирует
    DURATION=120
    PERIOD=60
    RPS=5
    ;;
  demo)
    # Один полный period=5min — удобно для screencast (видно один toggle вверх + вниз)
    DURATION=600
    PERIOD=300
    RPS=5
    ;;
  full)
    # Стандартный 30-минутный прогон — 3 полных цикла period=5min
    DURATION=1800
    PERIOD=300
    RPS=5
    ;;
  stress)
    # Высокий RPS — тест на конкурентную запись в logs.json
    DURATION=300
    PERIOD=60
    RPS=20
    ;;
  *)
    echo "ERROR: неизвестный пресет '$PRESET'. Доступно: smoke|demo|full|stress" >&2
    exit 1
    ;;
esac

echo "Preset:    $PRESET (duration=${DURATION}s, period=${PERIOD}s, rps=${RPS})"
echo "Feature:   $FEATURE_ID"
echo "Output:    $OUTPUT"
echo "---"

exec python3 "$PY_SCRIPT" \
  --output "$OUTPUT" \
  --feature-id "$FEATURE_ID" \
  --duration "$DURATION" \
  --period "$PERIOD" \
  --rps "$RPS"
