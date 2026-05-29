# CLAUDE.md — proshop_mern

> Agent rules for this repo. Detailed conventions live in `.github/copilot-instructions.md`
> and `DESIGN.md`; this file is the entry point and the project-index contract.

## ⭐ START HERE — repo navigation

**ALWAYS read `project-index.json` FIRST** at the start of each session.

It contains:
- `subprojects` — annotated map of all subprojects (backend, frontend, the two MCP servers, scripts)
- `system_folders` — `.claude/`, `docs/`, `uploads/`, etc. with their purpose
- `hard_rules` — project-wide rules (feature flags via MCP, polyglot persistence, test-first, …)
- `ai_routing` — which MCP/tool/folder answers which kind of question
- `filesystem_tree` — full tree (auto-maintained, depth 4)

It is faster and more accurate than `find`/`tree`/`ls`, and it's machine-readable.
For module internals, read the 4-step specs in `docs/specs/`. For decisions, `docs/adr/`.

## ⭐ Keeping project-index.json current — MANDATORY

**ALWAYS** update `project-index.json` when you:
- create a file or folder
- delete or rename files/folders
- change the purpose of a subproject

How:
```
python3 .claude/scripts/update_project_index.py
```
Or automatically via the PostToolUse hook in `.claude/settings.local.json` (fires on
Write/Edit/Bash under the watched paths: `backend/`, `frontend/src/`,
`mcp-server-feature-flags/`, `mcp-server-search-docs/`, `scripts/`).

After editing docs, also re-ingest the RAG corpus (`docs/project-data/chunks.jsonl`) so the
search-docs MCP stays accurate. For the 4-step analysis pattern used on new modules, see the
examples in `docs/specs/`.
