# Audit Plan — proshop_mern (homework M6 Stage 3)

**Auditor:** legacy-auditor-mate (main CC session in-role)
**Date:** 2026-05-29
**Output dir:** `homework-m6/stage3-living-docs/`
**Findings input:** reuse `homework-m6/stage1-code-review/synthesis.md` (Stage 1 already ran security/perf/arch — do NOT re-dispatch them; Phase 3 goes straight to reverse-engineering).

---

## Project shape (from Phase 1 discovery)

- **Type:** fullstack monorepo
- **Tech stack:**
  - backend — Node + Express 4 + Mongoose 5 (MongoDB), ESM
  - frontend — React + Redux thunk + React Router v5, **Tailwind v4 + shadcn-style** components (`frontend/src/components/good-shop/`)
  - `mcp-server-feature-flags/` — **Node/TypeScript** MCP server (stdio), reads/writes `backend/features.json`
  - `mcp-server-search-docs/` — **Node/TypeScript** RAG MCP server, OpenAI embeddings + Postgres/pgvector (`pg`)
- **Subprojects discovered:** backend, frontend, mcp-server-feature-flags, mcp-server-search-docs (+ `scripts/` Node utilities, `uploads/` static)
- **Existing docs surface:** `docs/` with `adr/` (0001-0003), `guides/` (6 RU + 6 -en pairs), `project-data/` (api, features, pages, runbooks, incidents, adrs/, architecture, glossary, dev-history, specs), `design-system-pack-example/`, plus loose `DESIGN.md`, `FINDINGS.md`, `report.md`, `README.md`, `docs/DESIGN_SYSTEM.md`, `docs/anti-slop-supplement.md`, `docs/architecture.md`
- **Tests surface:** none in the app; only `homework-m6/stage2-fix-top3/tests/` (added today)
- **Legacy markers:** Mongoose 5 (4 majors behind, see FINDINGS.md); two parallel ADR sets; example index in course materials describes an outdated layout (Python MCP / `rag/` / `superpowers/`) that does NOT match this fork.

## Existing docs audit (from Phase 1.5 → `docs-audit.md`)

- ✅ **Keep as-is: 23** — DESIGN.md, anti-slop-supplement, `docs/adr/0001-0003`, adr-002, api/auth+products, 4 runbooks, best-practices, feature-flags-spec, features.json, all 12 guide files
- 🔄 **Update + keep: 18** — README, FINDINGS, both architecture.md, adr-001 (Mongo-only, now deviated), adr-004, api/users+orders+uploads (pre-fix behavior), features/ folder, pages/ folder, local-setup+deploy runbooks, glossary, features-analysis-ru
- 📦 **Archive (historical): 6** — report.md, adr-003 (dup of canonical 0001), dev-history.md, incidents i-001/i-002/i-003 (`chunks.jsonl` kept as data)
- ❌ **Archive (stale): 3** — `docs/DESIGN_SYSTEM.md` (empty template), `docs/design-system-pack-example/` (foreign example pack), adr-005-bootstrap-vs-tailwind (code reversed it)
- Full table: `homework-m6/stage3-living-docs/docs-audit.md`

**Highest-priority TODO markers:** today's 3 Stage-2 security fixes (getUsers password projection, order IDOR guard, upload admin-auth) are NOT reflected in `api/users.md`, `orders.md`, `uploads.md`, `FINDINGS.md`.

## Audit scope (confirmed)

- **In scope:** whole repo code (`backend/`, `frontend/src/`, both `mcp-server-*`) + all documentation above.
- **Out of scope:** `node_modules/`, `dist/`, `build/`, `frontend/public/`, `homework*/` (submission), `.git/`, `.idea/`, `uploads/` contents.

---

## Phase 3 — REVERSE ENGINEERING (no specialist re-dispatch — findings reused from Stage 1)

- [ ] 3.0 Reuse `stage1-code-review/synthesis.md` as findings input (specialists already ran).
- [ ] 3.4 4-step reverse engineering (UNDERSTAND → DECISION TABLE → SEQUENCE DIAGRAM → EDGE CASES) per module → `docs/specs/<module>-spec.md`. Proposed module set (serial, small repo):
  - [ ] `mcp-server-feature-flags` (`src/index.ts`) — **required for Stage 4**
  - [ ] `mcp-server-search-docs` (`src/index.ts`, RAG) — **required for Stage 4**
  - [ ] `backend/controllers/featureFlagController.js` — dual-writer hotspot (synthesis MED + ADR-0005 candidate)
  - [ ] `backend/controllers/orderController.js` — IDOR fix + client-trusted pricing (ADR-0004 candidate)
  - [ ] `backend/controllers/userController.js` — password-projection fix + auth flows
  > Specs land in repo `docs/specs/` (working location) and are copied to submission `docs-new/specs/` in 3.7.

## Phase 4 — AGGREGATE

- [ ] 4.1 `stage3-synthesis.md` — combine the 5 specs + the reused Stage-1 findings into one Stage-3 report (Stage-1 `synthesis.md` stays read-only — it is a graded artifact).
- [ ] 4.2 Build `project-index.json` at repo root (machine-readable map; schema below).
- [ ] 4.3 Assemble NEW `docs/` from audit verdicts:
  - copy ✅ unchanged; copy 🔄 with `TODO(audit-2026-05-29): …` markers (esp. the 3 security-fix API docs)
  - new `docs/specs/` (Phase 3), new `docs/architecture/README.md` overview (links dev-history + incidents), `docs/README.md` index
  - keep canonical ADR numbering: `docs/adr/0001-0003`; carry the still-valid older ADRs (adr-001 amended, adr-002, adr-004) with TODO markers; adr-003/adr-005 archived
- [ ] 4.4 Archive 📦 + ❌ items → `docs-archived-2026-05-29/` (via `git mv`, never `rm`)
- [ ] 4.5 New structure becomes repo `docs/` (build in `docs-new/`, swap after archive)

## Phase 5 — AUTOMATE

- [ ] 5.1 Copy `update_project_index.py` → `.claude/scripts/`, `chmod +x`
- [ ] 5.2 Set `WATCH_PATHS = ("backend/", "frontend/src/", "mcp-server-feature-flags/", "mcp-server-search-docs/")`
- [ ] 5.3 (optional) PostToolUse + SessionStart hook in `.claude/settings.local.json`; smoke-test → `hook-screenshot.png`
- [ ] 5.4 Create `CLAUDE.md` (root) with the two sections («⭐ START HERE» + «⭐ Keeping project-index.json current»); mirror the key parts into `.github/copilot-instructions.md` (your decision: both files)
- [ ] 5.5 Copy deliverables into submission folder (Шаг 3.7): project-index.json, update script, `docs-new/`, `docs-archived/`, CLAUDE.md copy

## project-index.json — planned shape (fork-accurate, NOT the course example)

```
name, type=fullstack-monorepo, description, tech_stack
subprojects: backend, frontend, mcp-server-feature-flags, mcp-server-search-docs  (≥4 annotated)
system_folders: .claude/, .claude/agents/, .claude/scripts/, docs/, uploads/, scripts/
root_files: README.md, package.json, docker-compose.yml, .env.example, CLAUDE.md, DESIGN.md, FINDINGS.md
hard_rules: ≥5 incl. "ALWAYS read project-index.json FIRST", feature flags via MCP, search via RAG MCP, conventional commits, never commit .env
ai_routing: feature_flag_* → feature-flags MCP; docs_search → search-docs MCP; structure → this file; api_design → docs/api
filesystem_tree: depth 4 (auto-maintained by update script)
last_updated: ISO-8601 UTC
```

## Time estimate

- Phase 3 (5 specs, serial): ~40-60 min
- Phase 4 (synthesis + index + docs swap + archive): ~30-45 min
- Phase 5 (script + hook + CLAUDE.md + copies): ~20-30 min

## Open questions for you

1. **Module set for specs (Phase 3.4):** OK with the 5 proposed (2 MCP servers + 3 controllers), or trim to the 2 MCP servers + 1 controller to save time?
2. **Hook (5.3):** set up the PostToolUse auto-update hook + screenshot (optional in the rubric), or skip it and rely on running the script manually?
3. **ADR carry-over:** I plan to keep `docs/adr/0001-0003` as canonical, amend `adr-001` (polyglot persistence note) and keep adr-002/adr-004 with TODO markers, and archive adr-003 (dup) + adr-005 (reversed). Agree, or keep all old ADRs untouched?
4. **`scripts/` and `frontend/` deeper subprojects:** include `scripts/` as an annotated subproject in the index, or just list it under system_folders?

---

> **Plan ready.** Review `docs-audit.md` (the per-doc verdicts — the most important decision here) and this plan's TODOs + open questions. On approval I switch to EXECUTE mode and run Phase 3-5, ticking checkboxes as I go. Nothing is moved/archived until then.
