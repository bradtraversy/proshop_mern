diff --git a/CLAUDE.md b/CLAUDE.md
index dbe0b0a..5eac7b0 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -2,6 +2,46 @@
 
 This file provides guidance when working with code in this repository.
 
+## ⭐ START HERE — repo navigation
+
+**ALWAYS read `project-index.json` FIRST** at the start of every session.
+
+It contains:
+- subprojects — annotated map of all subprojects
+- system_folders — .claude/, docs/, uploads/ with purpose
+- hard_rules — project-wide rules
+- filesystem_tree — full directory tree (auto-updated, depth 4)
+
+This file is faster than find / tree / ls, accurate, and machine-readable.
+
+For deep-context questions ("how does feature X work?", "why was Y chosen?") use the **`proshop-rag` MCP server** (`search_project_docs` tool) — it semantically searches `project-data/` (architecture, ADRs, API docs, runbooks, incidents, features, pages).
+
+Stage3 living-documentation pack (M6) lives under `homework/M6/stage3-living-docs/`:
+- `synthesis.md` — Stage3 delta findings (security + performance + architecture).
+- `specs/*.md` — 6 module-level reverse-engineering specs (backend controllers/middleware, mcp-features, mcp-rag, feature-flags layer, autopilot integration).
+- `docs-new/` — new API docs (featureflags, autopilot) + architecture M3-M5 addendum.
+- `proposed-adrs/adr-008-*.md` — dual-transport MCP-features ADR draft.
+
+## ⭐ Keeping project-index.json current — MANDATORY
+
+**ALWAYS** update `project-index.json` when:
+- Creating a new file or folder
+- Deleting / renaming files or folders
+- Changing subproject purpose / description
+
+How: `python3 .claude/scripts/update_project_index.py`
+Or: auto-fires via PostToolUse hook (see `.claude/settings.local.json`) — matcher `Write|Edit`. Script refreshes only `filesystem_tree` + `last_updated`; human-curated fields preserved. If structure unchanged, `last_updated` not bumped.
+
+After **any change to `project-data/`** also reindex RAG store:
+
+```bash
+cd mcp-rag && node ingest.js
+```
+
+Otherwise `search_project_docs` returns stale chunks.
+
+For 4-step legacy analysis on new modules: see `docs/specs/` for past examples.
+
 ## Design System — read before any frontend work
 
 **[DESIGN.md](./DESIGN.md)** is the single source of truth for visual language, component patterns, spacing, typography, color tokens, and interactive states (hover / focus / loading / empty / error). It also encodes the anti-AI-slop guards from `homework/M4` (no Inter, no box-shadows, no `dark:` prefixes, no gradients, no 2-column comparison blocks, semantic tokens only, etc.).
