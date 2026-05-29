> **Language / Язык:** **English** (current version) · [Русский](grep-lsp-agents-md-guide.md)

---

# `grep + LSP + Agents.md` — Code Navigation Without Vector RAG

## TL;DR

By early 2026, leading AI-coding tools (Anthropic Claude Code, Aider, Codex CLI, OpenCode, Cline, Continue) **abandoned classic vector RAG over codebases**. The replacement is a stack of three simple primitives: **grep + LSP + Agents.md**. It's cheaper, more accurate on identifiers, and requires no indexing.

This triad isn't the opposite of RAG — it's a **separate pattern for code**. For documentation, FAQ, knowledge bases — vector RAG remains the standard. Code plays by different rules.

---

## Three Components

### 1. `grep` — Text Search Across Files

Plain text search (`ripgrep` / `grep` / IDE Find in Files). The agent forms queries itself and reads relevant files.

**What it gives you:**

- **Exact match for identifiers.** Function names, variables, types, constants are matched precisely, with no semantic blur. Vector embeddings often miss on short tokens.
- **Zero indexing.** Nothing to vectorize ahead of time, no index updates, no invalidation tracking.
- **Freshness guaranteed.** Search always runs against the current code state — `git pull` is enough.
- **No security liability.** Code never leaves the repo for embeddings — critical for proprietary code.

**Limitation:** queries like "find code that does X conceptually" are weak with grep. Either fall back to vector embeddings or read `Agents.md` and navigate by structure.

**Example** (Claude Code / Codex CLI):

```
User: "Where is double payment handled?"
Agent: grep -rn "duplicate.*payment\|idempot" .
       ↓ reads 3 files
       ↓ returns answer with code references
```

---

### 2. LSP — Language Server Protocol

A Microsoft standard (2016) that gave IDEs uniform access to structural code information: types, references, definitions, class hierarchies.

**What it gives you:**

- **`go-to-definition`** — where a symbol is defined.
- **`find-references`** — who calls this function, where this type is used.
- **Type info** — what type a variable holds at this line.
- **`rename-symbol`** — safe rename across all call sites.

Vector RAG fundamentally **can't do structural queries** — it operates on semantic text similarity, not the call graph. LSP gives "structural knowledge" of code "for free" — it's already there in any language server (`tsserver`, `pyright`, `rust-analyzer`, `gopls`, `clangd`).

**When critical:** "find all subclasses of X", "where is this module imported", "which functions return type Y". Vector embeddings don't work for these.

**Where it lives:** agents connect to LSP via MCP servers or built-in IDE integrations. Cursor, Continue, Claude Code (via extension) call into LSP under the hood.

---

### 3. `Agents.md` — Project Map for AI

A file at the repo root with a **high-level project description** for the AI agent. Alternative names: `CLAUDE.md`, `AGENTS.md`, `.cursorrules` (Cursor), `WARP.md` (Warp). The `AGENTS.md` standard became cross-tool by late 2025.

**What goes inside:**

- **Architecture in one paragraph.** "Frontend in React, backend in Express+Mongoose, payments via PayPal SDK."
- **Where to look for X.** "Checkout logic — `frontend/src/screens/PlaceOrderScreen.js` and `backend/controllers/orderController.js`."
- **Conventions.** Where tests live, file naming, accepted commit message formats.
- **Domain glossary.** Project shorthand and terms (SKU, PSP, CRM, RBAC) explained.
- **What NOT to do.** Pitfalls, deprecated paths, legacy zones.
- **Commands.** `npm run dev`, `npm test`, how to run the linter.

**Core rule:** **≤ 200 lines**. More than that, the agent either won't read it all or will bloat the context. If you need depth, move it into nested files (`docs/architecture.md`, `docs/conventions.md`) and link from `Agents.md`.

**Langchain research:** agents with `Claude.md` / `Agents.md` in the repo show **double-digit percentage** improvements on coding tasks. This is the cheapest quality lift available — one file, one hour of work.

---

## When Each Approach Wins (Code Only)

| Scenario | Pick |
|----------|------|
| Agent writes code in a project up to ~200K LOC | grep + LSP + Agents.md |
| Lookup of a specific identifier (function, type, constant) | grep |
| "Who calls this function" / "all subclasses of class X" | LSP |
| Conceptual search "how does authentication work" | Agents.md → links to relevant files |
| Monorepo 1000+ files, multi-language, dependency graph | Knowledge graph (CodeAlive, GitHub Spec Index) or Cursor with custom embeddings |
| Product docs / API references / RFCs | **vector RAG** (different domain — not code) |

**Cursor** is a special case. Uses custom code-embeddings + Turbopuffer + a Merkle tree for incremental indexing. On monorepos with >1000 files, it gives **+12.5% accuracy** over plain grep. But this isn't classic vector RAG — it's a hybrid: grep + structural embed.

---

## Production Tools

| Tool | Uses | Approach |
|------|------|----------|
| Anthropic Claude Code | grep + LSP (via MCP) + CLAUDE.md | Agentic search, no preindex |
| OpenAI Codex CLI | grep + AGENTS.md | Same — abandoned the embedding index |
| Aider | repo map + grep + conventions from Agents.md | repo map = auto-generated project skeleton |
| Cline / OpenCode | grep + LSP + custom context | Open-source, same pattern |
| Continue | grep + LSP + optional RAG | Hybrid, vector is a toggleable feature |
| Cursor | Custom code-embeddings + grep | The only top tool with real vector |

---

## Setup For Your Project (10 minutes)

**1. Create `AGENTS.md` at the repo root.** Template:

```markdown
# Project Name

## What this is
[One paragraph: what the product does, what it's built on, who uses it.]

## Architecture
- Frontend: React + Redux, in `frontend/src/`
- Backend: Node + Express + Mongoose, in `backend/`
- DB: MongoDB Atlas
- Payments: PayPal SDK

## Where to look
- Auth flow → `backend/middleware/authMiddleware.js`
- Order logic → `backend/controllers/orderController.js`
- Cart state → `frontend/src/reducers/cartReducers.js`

## Conventions
- Tests in `__tests__/` next to the module
- Async/await, no callbacks
- Mongoose schemas — in `backend/models/`

## Don't
- Don't edit `seeder.js` without running `data:destroy` first
- Don't use `Date.now()` in tests — needs a mock

## Commands
- `npm run dev` — frontend + backend
- `npm test`
- `npm run mongo:up` — start MongoDB locally
```

**2. Confirm LSP works.** Open the project in an IDE with the language extension installed (TypeScript, Python, Go, etc.). If `Cmd+Click` on a function jumps to its definition, LSP is working.

**3. Connect to your agent.** Claude Code / Cursor / Continue **read `AGENTS.md` / `CLAUDE.md` automatically** at session start. For others, add it to the system prompt via `--context` or manually.

**4. Don't index code into a vector DB.** For code, that's a needless extra layer. For project documentation (`docs/`, `README`, `wiki`) — yes, but that's a different domain.

---

## Anti-patterns

- **"I dumped my code into Pinecone and now I have RAG over my codebase."** On 200+ files, the index goes stale after a few refactors, top-K returns chunks from deleted functions. Cole Medin: "agentic search outperformed by a lot, surprising."
- **`Agents.md` at 1000 lines.** The agent either won't read it all or will eat half the context window. Hard limit 200 lines, the rest goes into linked files.
- **`AGENTS.md` no one updates.** After three months it diverges from reality, the agent gets things wrong by following stale guidance. Make `AGENTS.md` review part of the Definition of Done for every major feature.
- **Vector embeddings for finding a specific function.** "Find function `calculateTotal`" — that's grep's job, not cosine similarity. Embedding short tokens poorly distinguishes synonyms.

---

## Key Quotes

> "agentic search outperformed by a lot, surprising"
> — Boris Cherny (Anthropic, Claude Code lead)

> "RAG dead — only for code. Enterprise RAG keeps growing."
> — Cole Medin, "Why the best AI-coding tools abandoned RAG"

> "Code agents with access to Claude.md / Agents.md show meaningfully better results — double-digit percentages"
> — Langchain research, 2025

---

## Connection To The Rest Of The Course

- **M3 (this module)** — `grep + LSP + Agents.md` as the counter-pattern to classic vector RAG. See `vector-db-comparison-2026.md`, "When vector DB is NOT needed".
- **M4** — UI on top of the MCP you build in homework Part 1. An `Agents.md` at the UI repo level helps too.
- **M6** — AI code review over `proshop_mern`. `Agents.md` is critical: without it the review is surface-level, with it — structural.

---

## Sources

- Cole Medin, "Why the best AI-coding tools abandoned RAG" (YouTube, 2026-02-18)
- Anthropic Claude Code documentation: <https://docs.claude.com/en/docs/claude-code/memory>
- AGENTS.md cross-tool standard: <https://agents.md>
- Microsoft Language Server Protocol: <https://microsoft.github.io/language-server-protocol/>
- ripgrep (`rg`) — production-grade grep replacement: <https://github.com/BurntSushi/ripgrep>
- Aider repo map docs: <https://aider.chat/docs/repomap.html>
