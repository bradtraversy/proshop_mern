# Stage 4 — Tests Agent

## What was done

Used the **`test-writer-mate`** write-agent (`.claude/agents/test-writer-mate.md`, copied here)
to generate tests for the **two MCP services** from my M3-M5 code, using their Stage-3 reverse-
engineering specs (`docs/specs/feature-flags-mcp-spec.md`, `docs/specs/search-docs-rag-mcp-spec.md`)
as the edge-case inventory.

| Service | Source | Tests | Location (canonical) | Submission copy |
|---|---|---|---|---|
| 1 — Feature-flags MCP | `mcp-server-feature-flags/src/index.ts` | 9 | `mcp-server-feature-flags/__tests__/index.test.ts` | `service-1-tests/` |
| 2 — Search-docs RAG MCP | `mcp-server-search-docs/src/index.ts` | 7 | `mcp-server-search-docs/__tests__/index.test.ts` | `service-2-tests/` |

**Result: 16/16 pass** (full repo suite incl. Stage-2: **30/30**). See `coverage-report.txt`.

## Testing strategy — black-box over the MCP protocol

Both servers have **no exports** and call `main()` (stdio transport) on import, so they cannot be
unit-imported. The faithful approach is to **spawn the built server and drive it with the MCP SDK
`Client`** over stdio — testing the real tool handlers end-to-end without modifying production code
(test-writer ROLE-LOCK). Harness: `@modelcontextprotocol/sdk` `Client` + `StdioClientTransport`,
running under Vitest from the repo root.

- **Feature-flags (real file I/O):** the server reads/writes the real `backend/features.json`.
  The suite backs up the original bytes, installs a known fixture (3 features with a dependency
  chain to exercise the dependency/traffic guards), and **restores the original in a `try/finally`**
  — verified byte-identical afterwards (`git status` clean). Each test sets its own precondition,
  so the suite is order-independent despite the server mutating the file across calls.
- **Search-docs (needs OpenAI + Postgres):** those aren't available in tests, so the suite covers
  the deterministic paths that need neither — tool/schema discovery, the `server://status`
  resource, the `OPENAI_API_KEY is not set` error branch (forced via `OPENAI_API_KEY: ""` in the
  child env so dotenv won't override it), and input-validation rejections (`top_k` out of 1–20,
  missing required `query`). No external services, no flakiness.

Assertions check concrete **values** (exact status/traffic/`depends_on`, error text, parsed JSON),
not aliveness; no exception-swallowing; realistic query data.

## How to run

```bash
# from repo root
npx vitest run mcp-server-feature-flags/__tests__ mcp-server-search-docs/__tests__
# or the whole suite (Stage 2 + Stage 4):
npx vitest run
```
> If sources changed, rebuild first: `(cd mcp-server-feature-flags && npm run build)` and likewise
> for `mcp-server-search-docs` — the tests spawn `dist/index.js`.

## Notes

- **`coverage-report.txt`, not `.png`:** this run was driven from a non-interactive agent session
  with no GUI/terminal screenshot capability, so the passing run is captured as text (the rubric
  asks for the runner stats, which are included).
- **MSI / mutation testing (Stage 4.4):** intentionally skipped per the agreed scope.
- **Failing tests:** none. All 16 service tests pass on the current code.
