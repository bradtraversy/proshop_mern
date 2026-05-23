#!/usr/bin/env python3
"""
simulate_wf2.py — log generator with sine-wave error rate.

Пишет события success/error в logs.json. error_rate меняется по синусоиде
с конфигурируемым периодом, чтобы WF2 (cron-trigger n8n) видел переход
через threshold туда и обратно — фича автоматически выключается и
включается.

Usage:
    python3 simulate_wf2.py --output logs.json --duration 1800 --period 300
    python3 simulate_wf2.py ... --rps 5 --amplitude 0.10 --baseline 0.05
"""

import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def sine_error_rate(t: float, period: float, amplitude: float, baseline: float) -> float:
    """Returns instantaneous error_rate at time t.

    error_rate(t) = max(0, min(1, baseline + amplitude * sin(2π·t/period)))
    """
    raw = baseline + amplitude * math.sin(2 * math.pi * t / period)
    return max(0.0, min(1.0, raw))


def run(
    output_path: Path,
    feature_id: str,
    duration: float,
    rps: float,
    period: float,
    amplitude: float,
    baseline: float,
) -> None:
    """Runs the log generator until duration expires."""
    # Если файла нет — создать с пустым массивом
    if not output_path.exists():
        output_path.write_text("[]")

    start = time.time()
    interval = 1.0 / rps

    while time.time() - start < duration:
        t = time.time() - start
        rate = sine_error_rate(t, period, amplitude, baseline)
        status = "error" if random.random() < rate else "success"

        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "feature_id": feature_id,
            "status": status,
            "error_rate_now": round(rate, 3),  # для отладки — текущая sine точка
        }

        # Append (читаем целиком, добавляем, пишем — для домашки достаточно)
        try:
            existing = json.loads(output_path.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            existing = []

        existing.append(event)
        # Ограничим файл последними 10_000 событиями чтобы он не разнёс диск
        if len(existing) > 10_000:
            existing = existing[-10_000:]
        output_path.write_text(json.dumps(existing, ensure_ascii=False, indent=None))

        # На stdout печатаем редко (раз в 5 секунд), чтобы не спамить
        if int(t) % 5 == 0 and int(t * rps) % int(rps * 5) == 0:
            print(f"t={int(t)}s rate={rate:.1%} status={status} total_events={len(existing)}")

        time.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="WF2 log generator (sine error rate)")
    p.add_argument("--output", default="logs.json", help="Path to logs.json (default: ./logs.json)")
    p.add_argument("--feature-id", default="search_v2")
    p.add_argument("--duration", type=float, default=1800, help="Run for N seconds (default: 1800 = 30 min)")
    p.add_argument("--rps", type=float, default=5, help="Events per second (default: 5)")
    p.add_argument("--period", type=float, default=300, help="Sine period in seconds (default: 300 = 5 min)")
    p.add_argument("--amplitude", type=float, default=0.03, help="Sine amplitude (default: 0.03)")
    p.add_argument("--baseline", type=float, default=0.03, help="Sine baseline error_rate (default: 0.03)")
    args = p.parse_args()

    print(f"simulate_wf2.py — duration={args.duration}s, rps={args.rps}, period={args.period}s")
    print(f"sine: baseline={args.baseline:.1%}, amplitude={args.amplitude:.1%} → rate в [{max(0, args.baseline-args.amplitude):.1%}; {min(1, args.baseline+args.amplitude):.1%}]")
    print(f"Threshold WF2 = 5% → фича toggle'ится примерно каждые {args.period/2:.0f}s")
    print(f"Файл: {args.output}")
    print("---")

    run(
        output_path=Path(args.output),
        feature_id=args.feature_id,
        duration=args.duration,
        rps=args.rps,
        period=args.period,
        amplitude=args.amplitude,
        baseline=args.baseline,
    )


if __name__ == "__main__":
    main()
