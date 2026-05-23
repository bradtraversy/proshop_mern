# Mutation Testing Analysis — mcp-rag

## Survivor patterns (starting run, 206 survived)

Two dominant clusters explained ~80% of survivors:

1. **`index.js` MCP tool/resource handlers (100 survivors).** The original test suite pinned the behaviour textually via source-regex assertions (exact error-code strings, Zod schema shape, Cohere/Qdrant call arguments) because `mcp-rag/index.js` calls `process.exit(1)` at module load when `COHERE_API_KEY` is missing and instantiates Cohere + Qdrant clients eagerly — so importing the module from a test was a non-starter. Under Stryker, those tests auto-skip (the source files are instrumented and no longer match the regexes), removing all behavioural coverage for `search_project_docs` and `proshop-docs-index`. Almost every StringLiteral, ObjectLiteral, BooleanLiteral, and ConditionalExpression mutant inside the two handlers survived as a result.

2. **`ingest.js` `chunkFile` inner loop + `main()` lifecycle (≈106 survivors).** Boundary mutants on the `minTokens=25`, `targetTokens=400`, `maxTokens=512` thresholds, the `'\n\n'` paragraph separator, the `## ` heading regex, and the truncation suffix all survived because the existing chunker tests asserted shape-only properties (chunk count > 0, no oversize chunks) without hitting exact boundaries. Inside `main()`, every mutant on `deleteCollection` / `createCollection` / `upsert` / batch indexing was unreachable: `main()` is not exported and the bottom-of-file guard `invokedDirectly && !--test && !--dump` makes it impossible to drive from an `await import(...)` call.

## Assertions added (114 mutants killed)

For `index.js`, `test-index-handlers.js` mocks `cohere-ai`, `@qdrant/js-client-rest`, and the MCP SDK's `StdioServerTransport` + `McpServer` via `jest.unstable_mockModule` BEFORE importing the production module. A spy on `McpServer.prototype.tool/resource` captures the registered handlers, which are then invoked directly with controlled fixtures. Assertions check exact-value mapping (score rounded to 2dp, payload shape `{score, source_file, section, type, text}`), exact error codes (`COLLECTION_NOT_FOUND`, `EMBED_FAILED`, `SEARCH_FAILED`) with `isError: true`, the exact Cohere call shape (`model: 'embed-multilingual-v3.0'`, `inputType: 'search_query'`, `embeddingTypes: ['float']`), and dedup + lexical sort on the resource handler. This single file lifted `index.js` MSI from 20% to 87.80%.

For `ingest.js`, `test-chunker-edges.js` adds boundary fixtures: exactly 25 tokens (kept) vs 24 (dropped), exact 2048-char content (no truncation) vs 5000-char (truncation), single `\n` vs `\n\n` paragraph separator, inline `##` mid-line (not treated as heading), trailing whitespace in heading text, mixed `.md`/`.txt`/`.json` directory walk. Lifted `ingest.js` from 48.54% to 64.08%.

## Why ingest.js MSI stops at 64% (74 survivors)

All remaining survivors live inside `main()`, which can only be driven by either (a) refactoring `ingest.js` to `export async function main()` — forbidden by the no-prod-edit constraint, or (b) spawning a subprocess with an ESM stub-loader that intercepts `cohere-ai` and `@qdrant/js-client-rest` imports. The existing source-regex tests in `describeSrc('ingest.js main() — collection lifecycle ...')` pin the contract (VECTOR_SIZE=1024, BATCH_SIZE=96, Cosine distance, search_document input type, wait:true upsert, deleteCollection→createCollection ordering, the {source_file, section, type, last_modified, text} payload shape), but those tests skip under Stryker because their assertions match against the instrumented source text. Killing this cluster would require ~1 day of stub-loader engineering for ~30 additional mutants — outside the cost/benefit envelope for this stage.
