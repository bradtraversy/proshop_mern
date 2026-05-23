#!/usr/bin/env python3
"""
update_project_index.py — refresh `filesystem_tree` + `last_updated` in
project-index.json without touching any human-curated fields.

Designed for proshop_mern (M6 stage3). Tracks structural changes (added/removed
files & directories) under WATCH_PATHS. If structure is unchanged, exits without
bumping `last_updated` to avoid noise.

Run manually after structural changes:
    python3 .claude/scripts/update_project_index.py

Or wired as PostToolUse hook (Write|Edit matcher) in .claude/settings*.json.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
INDEX_PATH = REPO_ROOT / "project-index.json"

# Maximum directory depth recorded in filesystem_tree (relative to repo root).
# Depth 4 means: repo-root/L1/L2/L3/L4 are visible; deeper dirs collapse to "...".
TREE_DEPTH = 4

# Top-level entries to ALWAYS exclude from filesystem_tree (noise).
EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    ".idea",
    "dist",
    "build",
    "qdrant-data",
    ".cache",
    "coverage",
}
EXCLUDE_FILES = {
    ".DS_Store",
    "prompt.md",  # ephemeral user prompts
}


DOT_ALLOWED = {".env.example", ".mcp.json", ".gitignore", ".dockerignore", ".claude"}


def _skip(name: str) -> bool:
    if name in EXCLUDE_DIRS or name in EXCLUDE_FILES:
        return True
    if name.startswith(".") and name not in DOT_ALLOWED:
        return True
    return False


def walk(path: Path, depth: int) -> dict | list | None:
    """Build nested tree up to `depth` directory levels.

    Files at any level -> appear as bare names in the parent dict (value None).
    Dirs at depth < limit -> recurse.
    Dirs at depth >= limit -> collapsed to "..." marker.
    """
    if not path.exists() or not path.is_dir():
        return None
    out: dict[str, object] = {}
    for child in sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        if _skip(child.name):
            continue
        if child.is_dir():
            if depth <= 1:
                out[child.name + "/"] = "..."
            else:
                sub = walk(child, depth - 1)
                out[child.name + "/"] = sub if sub else {}
        else:
            out[child.name] = None
    return out


def build_tree() -> dict:
    return walk(REPO_ROOT, TREE_DEPTH) or {}


def main() -> int:
    if not INDEX_PATH.exists():
        print(f"[update-index] {INDEX_PATH} not found — nothing to do.", file=sys.stderr)
        return 0

    try:
        data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"[update-index] ERROR: project-index.json invalid JSON: {e}", file=sys.stderr)
        return 1

    current_tree = data.get("filesystem_tree", {})
    new_tree = build_tree()

    if current_tree == new_tree:
        print("[update-index] no structural change, last_updated NOT bumped.", file=sys.stderr)
        return 0

    data["filesystem_tree"] = new_tree
    data["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    INDEX_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"[update-index] ✅ updated project-index.json (last_updated={data['last_updated']})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
