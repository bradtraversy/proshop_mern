#!/usr/bin/env python3
"""
Auto-update project-index.json filesystem_tree + last_updated.

Triggered by Claude Code PostToolUse hook on Write/Edit/Bash with file ops.
Also runnable standalone: python3 .claude/scripts/update_project_index.py

Reads stdin JSON (hook payload) if present; otherwise runs unconditionally.
"""
from __future__ import annotations
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # .claude/scripts/ → up to repo root
INDEX_FILE = REPO_ROOT / "project-index.json"

# Folders to skip when building filesystem_tree
EXCLUDE_DIRS = {
    ".git", "node_modules", "build", "dist", ".next", ".venv", "venv",
    "__pycache__", ".pytest_cache", ".vscode", ".idea",
}

# Files to skip
EXCLUDE_FILES = {".DS_Store", "*.pyc"}

# Only fire on operations under these directories (relative to repo root).
# Demo defaults: frontend/, backend/, mcp/, rag/ — feel free to extend.
# Standalone runs always update unconditionally.
WATCH_PATHS = ("backend/", "frontend/src/", "mcp-server-feature-flags/", "mcp-server-search-docs/", "scripts/")


def _path_is_watched(path_str: str) -> bool:
    """Return True if path_str (relative or absolute) lies under one of WATCH_PATHS."""
    if not path_str:
        return False
    # Normalize: absolute → relative to REPO_ROOT
    try:
        abs_p = Path(path_str).resolve()
        rel = abs_p.relative_to(REPO_ROOT).as_posix() + "/"
    except (ValueError, OSError):
        # Path is already relative or outside repo — use as-is
        rel = path_str if path_str.endswith("/") else path_str + "/"
    return any(rel.startswith(w) for w in WATCH_PATHS)


def is_structural_change(payload: dict) -> bool:
    """Return True if the tool call likely changed repo structure under a watched dir."""
    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {})

    if tool_name in ("Write", "Edit"):
        file_path = tool_input.get("file_path", "")
        return _path_is_watched(file_path)

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        keywords = ["mkdir", "rmdir", "mv ", "rm ", "touch ", "cp -r"]
        if not any(kw in command for kw in keywords):
            return False
        # Path-aware: only fire if command mentions a watched dir
        return any(w.rstrip("/") in command for w in WATCH_PATHS)

    return False


def walk_tree(root: Path, max_depth: int = 4) -> dict:
    """Build a dict-of-arrays filesystem_tree."""
    tree = {}
    for dirpath, dirnames, filenames in os.walk(root):
        # Apply excludes (mutating dirnames in-place skips them)
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        rel = Path(dirpath).relative_to(root)
        depth = len(rel.parts) if rel != Path(".") else 0
        if depth > max_depth:
            dirnames.clear()
            continue
        # Filter out excluded files
        filtered_files = [f for f in filenames if f not in EXCLUDE_FILES]
        key = "." if rel == Path(".") else str(rel)
        tree[key] = sorted(dirnames + filtered_files)
    return tree


def update_index(mode: str = "manual") -> int:
    """Update index. `mode` is 'hook' or 'manual' — controls log prefix."""
    prefix = f"[update-index {mode}]"
    if not INDEX_FILE.exists():
        print(f"{prefix} {INDEX_FILE.name} not found — skipping", file=sys.stderr)
        return 0

    try:
        with INDEX_FILE.open("r", encoding="utf-8") as f:
            index = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"{prefix} ❌ failed to read {INDEX_FILE.name}: {e}", file=sys.stderr)
        return 1

    old_tree = index.get("filesystem_tree", {})
    new_tree = walk_tree(REPO_ROOT)

    if old_tree == new_tree:
        print(f"{prefix} no structural change, last_updated NOT bumped", file=sys.stderr)
        return 0

    index["filesystem_tree"] = new_tree
    index["last_updated"] = datetime.now(timezone.utc).isoformat()

    try:
        with INDEX_FILE.open("w", encoding="utf-8") as f:
            json.dump(index, f, indent=2, ensure_ascii=False)
            f.write("\n")
    except OSError as e:
        print(f"{prefix} ❌ failed to write {INDEX_FILE.name}: {e}", file=sys.stderr)
        return 1

    print(f"{prefix} ✅ updated {INDEX_FILE.name} (tree + last_updated)", file=sys.stderr)
    return 0


def main() -> int:
    # Read stdin if hook payload present; otherwise standalone mode
    try:
        if not sys.stdin.isatty():
            payload = json.load(sys.stdin)
        else:
            payload = None
    except (json.JSONDecodeError, OSError):
        payload = None

    if payload is None:
        # Standalone mode — run unconditionally
        return update_index(mode="manual")

    # Hook mode — only update on structural change in watched dirs
    if is_structural_change(payload):
        tool_name = payload.get("tool_name", "?")
        file_path = payload.get("tool_input", {}).get("file_path", "")
        if file_path:
            print(f"[update-index hook] triggered by {tool_name} on {file_path}", file=sys.stderr)
        else:
            print(f"[update-index hook] triggered by {tool_name}", file=sys.stderr)
        return update_index(mode="hook")
    return 0


if __name__ == "__main__":
    sys.exit(main())
