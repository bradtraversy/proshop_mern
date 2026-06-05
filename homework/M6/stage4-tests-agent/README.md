# Stage 4 — test-writer-mate submission

## Files

- `test-writer-mate.md` — agent definition (copy of `.claude/agents/test-writer-mate.md`, 130 lines).
- `service-1-tests/` — tests for `mcp-features` MCP server (feature-flag CRUD + dual transport).
- `service-2-tests/` — tests for `mcp-rag` MCP server (semantic search + chunker).
- `coverage-report.jpeg` — Jest run screenshot.
- `starting_msi.txt`, `final_msi.txt`, `msi-analysis.md` — Stryker mutation testing artefacts (bonus track).

## Agent file checklist

- [x] YAML frontmatter: `name`, `description`, `model: claude-opus-4-7`, `tools: [Read, Grep, Glob, Write]`.
- [x] ROLE-LOCK section — Write tests only, no production-code edits, no mutation runs.
- [x] Strong-test principles — values not aliveness, one behaviour per test, no try-catch swallows.
- [x] 4 test types per unit — happy / edge / error / security.
- [x] Anti-patterns section.
- [x] 130 lines (≤ 250).

## Services covered (from M3-M5 modules)

- **Service 1: `mcp-features/index.js`** — MCP server, 4 tools (`list_features`, `get_feature_info`, `set_feature_state`, `adjust_traffic_rollout`), dual transport (stdio / HTTP+Bearer), atomic write to `backend/features.json`.
- **Service 2: `mcp-rag/index.js` + `mcp-rag/ingest.js`** — semantic search via Qdrant+Cohere, markdown chunker pipeline, CLI flags `--test` / `--dump`.

## Test stats

| Service | Tests | Happy | Edge | Error | Security |
|---|---|---|---|---|---|
| mcp-features | 31 | 9 | 12 | 6 | 4 (Bearer auth on HTTP transport, fail-open, atomic-write guard) |
| mcp-rag | 75 (42 char. + 33 behavioural after strengthening) | 12 | 38 | 15 | 10 (no eval/exec, no API-key leak, prompt-injection bytes, URL fallback) |

All assertions check exact values (`isError === true`, `payload.error === 'COLLECTION_NOT_FOUND'`, `score === 0.12`, byte-for-byte chunk text equality). No `expect(x).toBeDefined()`, no try-catch wrappers, no `assert 2+2 == 4` filler.

## Run

```bash
npm test                      # both services
npm run test:mcp-features     # service 1 only
npm run test:mcp-rag          # service 2 only
```

Current state: **106/106 tests pass** (31 mcp-features + 75 mcp-rag).

## Bonus — mutation testing (Stryker)

Stryker is the Node.js equivalent of mutmut.

| Module | Starting MSI | Final MSI | Δ |
|---|---|---|---|
| mcp-features | **93.23%** | 93.23% (no work needed) | 0 |
| mcp-rag combined | 37.76% | **72.95%** | +35.19 pp |
| └ index.js | 20.00% | 87.80% | +67.80 pp |
| └ ingest.js | 48.54% | 64.08% | +15.54 pp |

Target ≥ 70% met. Detailed survivor analysis in `msi-analysis.md`.

## Re-run instructions

```bash
# Tests
npm test

# Mutation testing (slow — 5-10 min per service)
cross-env NODE_OPTIONS=--experimental-vm-modules npx stryker run stryker.mcp-features.conf.cjs
cross-env NODE_OPTIONS=--experimental-vm-modules npx stryker run stryker.mcp-rag.conf.cjs
```
