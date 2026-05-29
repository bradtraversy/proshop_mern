# proshop_mern — Documentation Index

> Rebuilt during the **M6 Stage 3 living-documentation audit** (2026-05-29).
> Start with `project-index.json` at the repo root for the machine-readable map, then this index.
> Per-doc audit verdicts: `homework-m6/stage3-living-docs/docs-audit.md`.

## Map

| Area | Path | What's there |
|---|---|---|
| **Architecture overview** | [`architecture/README.md`](architecture/README.md) | Subsystems, data stores, security posture, links to archived history |
| Architecture (C4 diagram) | [`architecture.md`](architecture.md) | Mermaid C4 of the order/PayPal flow 🔄 |
| **Module specs** | [`specs/`](specs/) | 4-step reverse-engineering specs (2 MCP servers + 3 controllers) |
| **ADRs** | [`adr/`](adr/) | Decision records — canonical numbered set `0001-0004` + carried older records |
| API reference | [`api/`](api/) | Per-resource REST docs (auth, products, users🔄, orders🔄, uploads🔄) |
| Features | [`features/`](features/) | Per-domain behaviour/flows 🔄 |
| Pages | [`pages/`](pages/) | Per-screen route/access/Redux/API docs 🔄 |
| Runbooks | [`runbooks/`](runbooks/) | Operational procedures (seed, deploy🔄, feature-flag toggle, A/B, incident response, local-setup🔄) |
| Design system | [`design/`](design/) | `DESIGN.md` (Tailwind v4 tokens) + anti-slop guard-rails |
| Reference guides | [`guides/`](guides/) | RAG / MCP / embeddings / vector-DB reference (RU + `-en`) |
| Project data | [`project-data/`](project-data/) | best-practices, glossary🔄, feature-flags-spec, features-analysis🔄, features.json, chunks.jsonl (RAG corpus) |

🔄 = contains `TODO(audit-2026-05-29)` markers — behaviour accurate, noted sections need a refresh.

## Decision records (ADRs)

Canonical numbered set (keep numbering, do not restart):

- `0001` — Stateless JWT auth with localStorage
- `0002` — Client-trusted PayPal payment verification
- `0003` — No database migration tooling (schema via Mongoose)
- `0004` — Tailwind v4 + shadcn design-system migration *(supersedes archived `adr-005`)*

Carried older records (still valid, cross-linked): `adr-001` (Mongo vs Postgres — now polyglot 🔄),
`adr-002` (Redux vs Context), `adr-004` (PayPal vs Stripe 🔄).

## Archived (not deleted)

`docs-archived-2026-05-29/` holds historical/superseded material — project timeline
(`dev-history.md`), incident postmortems (`incidents/`), duplicate/reversed ADRs
(`adr-003`, `adr-005`), the empty DESIGN_SYSTEM template, the foreign design-system example pack,
and old homework run logs (`report.md`). The architecture overview links the still-relevant ones.

## Keeping docs current

Structure is mirrored in `project-index.json`; run `.claude/scripts/update_project_index.py`
(or the PostToolUse hook) after adding/moving files. The RAG corpus `project-data/chunks.jsonl`
must be re-ingested after doc edits or search-docs MCP results go stale.
