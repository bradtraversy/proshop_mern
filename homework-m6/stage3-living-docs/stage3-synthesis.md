# Stage 3 Synthesis — Living Documentation Pack (proshop_mern)

**Date:** 2026-05-29
**Auditor:** legacy-auditor-mate (main CC session in-role)
**Inputs:** 5 reverse-engineering specs (`docs/specs/`) + reused Stage-1 findings
(`homework-m6/stage1-code-review/synthesis.md`, read-only) + docs audit (`docs-audit.md`).
> Note: Stage-1 `synthesis.md` is a graded artifact and was **not** modified — this is a new file.

---

## 1. What was produced

| Deliverable | Location |
|---|---|
| Machine-readable repo map | `project-index.json` (repo root) |
| 5 module specs (4-step) | `docs/specs/*.md` |
| Architecture overview | `docs/architecture/README.md` |
| New ADR-0004 (Tailwind migration) | `docs/adr/0004-tailwind-v4-design-system-migration.md` |
| New docs index | `docs/README.md` |
| Docs audit verdicts | `homework-m6/stage3-living-docs/docs-audit.md` |
| Index update automation | `.claude/scripts/update_project_index.py` + PostToolUse hook |
| Agent-rules sections | `CLAUDE.md` + `.github/copilot-instructions.md` |
| Archived historical/stale docs | `docs-archived-2026-05-29/` |

## 2. Module specs (reverse-engineered)

| Module | Spec | Key risks surfaced (cross-ref Stage 1) |
|---|---|---|
| Feature-flags MCP (`mcp-server-feature-flags/src/index.ts`) | `feature-flags-mcp-spec.md` | Dual-writer TOCTOU on `features.json`; validation contract diverges from backend; sync I/O. 21 edge cases. |
| Search-docs RAG MCP (`mcp-server-search-docs/src/index.ts`) | `search-docs-rag-mcp-spec.md` | Per-call `pg.Client` (no pool); no embedding cache; prompt-injection from retrieved text; hardcoded default DB creds. 22 edge cases. |
| `backend/controllers/featureFlagController.js` | `featureFlagController-spec.md` | `readFileSync` hot path; race with MCP; `Number('')→0` coercion; reflected `req.params.name`. 14 edge cases. |
| `backend/controllers/orderController.js` | `orderController-spec.md` | Post-fix owner/admin guard documented; still-open `updateOrderToPaid` ownership + client-trusted totals (ADR-0004... pricing candidate). 18 edge cases. |
| `backend/controllers/userController.js` | `userController-spec.md` | Post-fix `.select('-password')`; still-open NoSQL email injection, no password/email validation, 30-day JWT. 18 edge cases. |

## 3. Findings carried from Stage 1 (status after Stage 2)

| Finding | Stage-1 severity | Status now |
|---|---|---|
| `getUsers` password-hash leak | HIGH (×3 reviewers) | ✅ Fixed (Stage 2 #1) |
| `getOrderById` IDOR | HIGH | ✅ Fixed (Stage 2 #2) |
| Public `POST /api/upload` | HIGH | ✅ Fixed (Stage 2 #3) |
| `updateOrderToPaid` no ownership / no server-side PayPal verify | HIGH | ⏳ Open — documented in orderController spec + ADR-0002 |
| Client-trusted order totals | C1 (arch) | ⏳ Open — **proposed ADR (server-authoritative pricing)** |
| Feature-flag dual-writer race + divergent validation | C1/C2 + PERF | ⏳ Open — **proposed ADR (single-owner flag store)**; documented in both flag specs |
| RAG per-call pg connect + no embedding cache | HIGH (perf) | ⏳ Open — documented in RAG spec |
| `jsonwebtoken@8` CVEs; broader `npm audit` | HIGH | ⏳ Open — dependency hardening epic |
| NoSQL operator injection on login email | MED | ⏳ Open — documented in user spec |

## 4. Documentation outcome (from audit verdicts)

- **23 ✅** carried unchanged; **18 🔄** carried with `TODO(audit-2026-05-29)` markers
  (32 files marked, incl. the 3 security-fix API docs as priority); **6 📦 + 3 ❌** archived.
- Two ADR sets merged under `docs/adr/`: canonical `0001-0004` + carried `adr-001/002/004`;
  `adr-003` (duplicate) and `adr-005` (reversed by Tailwind rework) archived.
- Polyglot persistence (Mongo + `features.json` + Postgres/pgvector) now documented in the
  architecture overview — previously claimed Mongo-only.

## 5. Proposed new ADRs (for the team to formalize)

1. **Server-authoritative order pricing** — recompute totals from DB product prices; stop trusting client-supplied money. (From arch C1 + orderController spec.)
2. **Feature-flag store: single owner & concurrency model** — one authoritative writer / lock / shared module; one validated status enum across backend + MCP. (From flag specs + arch C1.)
3. **(amends adr-001) Polyglot persistence boundaries** — document the three stores explicitly.

ADR-0004 (Tailwind v4 migration) was written this stage as it documents a *completed* decision.

## 6. Cost-awareness footer

Stage 3 token usage (approx): docs-audit sub-agent ~51k; 5 spec sub-agents ~134k combined;
main orchestration ~60k. Total ~245k. Reverse-engineering was parallelized (5 sub-agents) to
keep the orchestrator's context lean.
