#!/usr/bin/env python3
"""
simulate_wf1.py — dispatcher для WF1 manual trigger workflow.

Дёргает webhook n8n WF1 по таймеру разными командами. traffic_percentage
меняется по синусоиде. Опционально шлёт намеренно невалидные команды
для теста галлюцинаций.

Usage:
    python3 simulate_wf1.py --webhook-url https://your-n8n.com/webhook --api-key XXX
    python3 simulate_wf1.py ... --duration 120 --interval 10
    python3 simulate_wf1.py ... --include-invalid
"""

import argparse
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests


def build_payload(feature_id: str, iteration: int, include_invalid: bool, invalid_every: int):
    """Build payload for iteration N (used by both loop and burst modes)."""
    actions_cycle = ["check", "test", "rollout", "check", "rollback", "check"]
    action = actions_cycle[iteration % len(actions_cycle)]
    traffic_percentage = int(50 + 40 * math.sin(2 * math.pi * iteration / 6))

    payload = {"feature_id": feature_id, "action": action}
    if action == "rollout":
        payload["traffic_percentage"] = traffic_percentage
    elif action in ("test", "rollback"):
        payload["target_state"] = "Testing" if action == "test" else "Disabled"

    is_invalid = include_invalid and iteration > 0 and invalid_every > 0 and iteration % invalid_every == 0
    if is_invalid:
        payload["traffic_percentage"] = -50
        payload["action"] = "rollout"
    return payload, is_invalid


def send_one(idx: int, webhook_url: str, headers: dict, payload: dict, is_invalid: bool):
    """Send one POST and print result. Used by burst mode."""
    tag = "[INVALID]" if is_invalid else ""
    ts = datetime.now().isoformat()
    print(f"[{ts}] #{idx} {tag} payload={payload}")
    try:
        r = requests.post(webhook_url, headers=headers, json=payload, timeout=30)
        try:
            data = r.json()
        except ValueError:
            data = {"raw": r.text}
        print(f"  → #{idx} status={r.status_code} success={data.get('success')} message={data.get('message')}")
        return r.status_code
    except requests.exceptions.RequestException as e:
        print(f"  → #{idx} network error: {e}", file=sys.stderr)
        return None


def run_burst(
    webhook_url: str,
    api_key: str,
    feature_id: str,
    burst: int,
    include_invalid: bool,
    invalid_every: int,
) -> None:
    """Fire N requests in parallel via ThreadPoolExecutor."""
    headers = {"Content-Type": "application/json", "X-API-Key": api_key}
    print(f"BURST mode — отправляю {burst} запросов параллельно...")
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=burst) as ex:
        futures = []
        for i in range(burst):
            payload, is_invalid = build_payload(feature_id, i, include_invalid, invalid_every)
            futures.append(ex.submit(send_one, i, webhook_url, headers, payload, is_invalid))
        results = [f.result() for f in as_completed(futures)]
    elapsed = time.time() - t0
    ok = sum(1 for r in results if r and 200 <= r < 300)
    print(f"---\nBurst done: {burst} requests in {elapsed:.2f}s — 2xx={ok}, other={len(results) - ok}")


def run(
    webhook_url: str,
    api_key: str,
    feature_id: str,
    duration: float,
    interval: float,
    include_invalid: bool,
    invalid_every: int = 3,
) -> None:
    """Runs the WF1 dispatcher loop."""
    start = time.time()
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
    }

    # Цикл команд (sine-driven rotation).
    actions_cycle = ["check", "test", "rollout", "check", "rollback", "check"]
    iteration = 0

    while time.time() - start < duration:
        t = time.time() - start

        # Sine-wave traffic_percentage между 10 и 90 с периодом 60s
        traffic_percentage = int(50 + 40 * math.sin(2 * math.pi * t / 60))
        # Sine modulates action choice
        action = actions_cycle[iteration % len(actions_cycle)]

        payload = {
            "feature_id": feature_id,
            "action": action,
        }
        if action == "rollout":
            payload["traffic_percentage"] = traffic_percentage
        elif action in ("test", "rollback"):
            payload["target_state"] = "Testing" if action == "test" else "Disabled"

        # Каждый N-й запрос — намеренно невалидный (тест галлюцинаций)
        if include_invalid and iteration > 0 and invalid_every > 0 and iteration % invalid_every == 0:
            payload["traffic_percentage"] = -50  # должен быть отвергнут на Switch
            payload["action"] = "rollout"
            print(f"[{datetime.now().isoformat()}] [INVALID test] payload={payload}")
        else:
            print(f"[{datetime.now().isoformat()}] action={action} payload={payload}")

        try:
            r = requests.post(webhook_url, headers=headers, json=payload, timeout=30)
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
            print(f"  → status={r.status_code} success={data.get('success')} message={data.get('message')}")
        except requests.exceptions.RequestException as e:
            print(f"  → network error: {e}", file=sys.stderr)

        iteration += 1
        time.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="WF1 dispatcher simulator")
    p.add_argument("--webhook-url", required=True, help="Full URL of /feature-control webhook")
    p.add_argument("--api-key", default=os.environ.get("N8N_API_KEY", ""), help="X-API-Key header value (or env N8N_API_KEY)")
    p.add_argument("--feature-id", default="search_v2", help="Target feature_id (default: search_v2)")
    p.add_argument("--duration", type=float, default=120, help="Run for N seconds (default: 120)")
    p.add_argument("--interval", type=float, default=10, help="Seconds between requests (default: 10)")
    p.add_argument("--include-invalid", action="store_true", help="Send hallucination-test payloads (traffic_percentage=-50)")
    p.add_argument("--invalid-every", type=int, default=3, help="Periodicity for invalid payloads (default: 3 — каждый 3-й запрос)")
    p.add_argument("--burst", type=int, default=0, help="Fire N parallel requests at once, then exit (overrides --duration/--interval)")
    args = p.parse_args()

    if not args.api_key:
        sys.exit("X-API-Key не задан: --api-key или env N8N_API_KEY")

    print(f"Webhook: {args.webhook_url}")
    print(f"Feature: {args.feature_id}, include_invalid={args.include_invalid}, invalid_every={args.invalid_every}")

    if args.burst > 0:
        print(f"Mode: BURST (parallel={args.burst})")
        print("---")
        run_burst(
            webhook_url=args.webhook_url,
            api_key=args.api_key,
            feature_id=args.feature_id,
            burst=args.burst,
            include_invalid=args.include_invalid,
            invalid_every=args.invalid_every,
        )
    else:
        print(f"Mode: LOOP (duration={args.duration}s, interval={args.interval}s)")
        print("---")
        run(
            webhook_url=args.webhook_url,
            api_key=args.api_key,
            feature_id=args.feature_id,
            duration=args.duration,
            interval=args.interval,
            include_invalid=args.include_invalid,
            invalid_every=args.invalid_every,
        )

    print("---\nЗавершено.")


if __name__ == "__main__":
    main()
