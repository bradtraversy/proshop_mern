> **Language / Язык:** **English** (current version) · [Русский](mcp-vs-cli-vs-skills-decision-framework.md)

---

# MCP vs CLI vs Skills — decision framework for AI agents, 2026

> **Audience:** developers choosing how to integrate external tools and workflows with AI coding agents and chatbots.
> **Goal:** give you a clear, data-backed framework for deciding when each approach — MCP server, CLI tool, or Claude Code Skill — is the right choice. No hand-waving, no "it depends" without specifics.
> **Date:** 2026-04-27. Numbers from production benchmarks, Anthropic documentation, and documented case studies.

---

## TL;DR — 1-page decision matrix

| Dimension | CLI | MCP | Skills |
|---|---|---|---|
| **Primary use case** | Coding agents with shell access | Chatbots, cross-device, enterprise auth | Domain knowledge, workflow orchestration, documentation |
| **Context window cost** | Low (1 Bash tool + lazy Skill) | High (full schema at session start) | Minimal (~50–100 tokens per skill in context) |
| **Monthly cost (agent use)** | ~$3.20 | **~$55.20 (×17× CLI)** | ~$4.50 |
| **Reliability** | 100% (no protocol layer) | ~72% (28% timeout rate in tests) | Self-maintaining when Skills break |
| **Auth / permissions** | Broad (whole shell) | Scoped (OAuth 2.1 per tool) | N/A (no live connections) |
| **Multi-user / enterprise audit** | No | Yes | No |
| **Remote / cross-device** | No | Yes | No |
| **Setup complexity** | Medium (shell + Skill) | Low (JSON config) | Low (Markdown file) |
| **Live data / current state** | Yes (via CLI commands) | Yes (native) | No (static knowledge) |
| **Coding agent fit** | Excellent | Good | Excellent |
| **Chatbot fit** | Poor (requires shell) | Excellent | Good |

**Decision rule in one sentence:** use Skills for knowledge and workflow orchestration, CLI for coding agents with filesystem access, and MCP when you need multi-user authentication, remote access, or enterprise centralized governance.

---

## Part 1 — Definitions

### MCP (Model Context Protocol)

MCP is an open standard (initially published by Anthropic, now adopted industry-wide) that defines how AI agents connect to external tools and data sources. An MCP server exposes a set of typed tools, resources, and prompts over a JSON-RPC protocol. The client (Claude Code, Cursor, Claude Desktop, ChatGPT) loads the server at session start and presents the tools to the model.

**Key characteristic:** the tool schema for every tool in every connected MCP server loads into the context window at session start. This is the eager-loading model.

**Adopted by:** Anthropic, OpenAI, Google, Microsoft, and effectively every AI company by April 2026. Over 10,000 MCP servers exist across catalogs.

### CLI (Command Line Interface)

A CLI is a program that takes input and produces output through a terminal. The AI agent calls CLI tools through its Bash/shell access. Agents like Claude Code, Codex CLI, and Cursor already have direct terminal access — they can run any installed CLI tool natively.

**Key characteristic:** the agent writes shell commands at runtime. This is composable (commands can be piped together dynamically), and LLMs have been trained extensively on CLI patterns. A CLI-based integration requires one generic Bash tool in the agent's toolset — not a schema-per-function load.

**Examples:** `gh` (GitHub CLI), `supabase` CLI, Google Workspace CLI (gws), Stripe CLI, Ramp CLI.

### Skills (Claude Code Skills)

A Skill is a Markdown file (`SKILL.md`) with YAML frontmatter that describes a workflow, domain knowledge pattern, or set of instructions. The agent loads only the frontmatter (name, description, trigger phrases — ~50–100 tokens) at session start. The full body of the Skill is loaded only when the model decides to activate it.

**Key characteristic:** lazy loading. A Skill carries no live connections — it is documentation and workflow orchestration, not a runtime integration. This is what makes it cheap: 200 Skills cost approximately the same context as 3 MCP servers.

**Not appropriate for:** anything that requires querying current state, executing commands, or accessing live data. For those cases, pair a Skill with a CLI tool.

---

## Part 2 — The ScaleKit benchmark: 17× cost difference

The most comprehensive independent cost comparison of the three approaches was published by themenonlab.blog ([Prahlad Menon, March 2026](https://themenonlab.blog/blog/skills-vs-mcp-token-efficiency-ai-agents)):

| Setup | Monthly agent cost |
|---|---|
| CLI only | **$3.20** |
| CLI + Skills | **$4.50** |
| MCP (Direct) | **$55.20** |

**MCP is 17× more expensive than CLI for equivalent functionality in a personal or small-team development context.**

Two additional metrics from the same study:
- **MCP reliability:** 28% timeout failure rate in tests.
- **CLI reliability:** 100% — no protocol layer to fail.
- **Skills self-maintenance:** when a Skill's referenced CLI breaks, the agent can diagnose and fix it. MCP servers change their API without warning, causing silent integration failures.

**Why MCP costs more:** at every interaction, the full tool schemas are in the context window. Every token in context costs money at inference time. A lean CLI setup uses one `bash` tool, while an MCP server for the same capability might contribute 13,000–46,000 tokens per session.

---

## Part 3 — The MCP critique and the response

### Geoffrey Huntley's critique

In mid-March 2026, two high-profile figures triggered the "MCP is dead" debate:
- The CTO of Perplexity publicly announced dropping MCP internally in favor of APIs and CLI — despite Perplexity having already built and released their own official MCP server.
- Gary Tan (CEO of Y Combinator) quote-tweeted with "MCP sucks" and demonstrated that 100 lines of CLI code built in 30 minutes achieved results he described as "100× better."

The technical case against MCP:
- Context window contamination — every MCP tool loads its full definition into the agent's context.
- Authentication friction — each MCP server handles its own auth, creating per-server setup overhead.
- Architecture mismatch — agents that already live in the terminal and write shell commands do not need a JSON-RPC translation layer between themselves and tools.

**Geoffrey Huntley** (open-source contributor) articulated the core argument: coding agents that have terminal access are already doing CLI natively. Adding MCP for the same tools is adding an unnecessary layer that consumes context and introduces failure modes.

### Allen Hutchison's response and the 3-interface pattern

The counterargument, synthesized from industry responses including Phil Whittaker's analysis:

> "Skills and MCPs aren't competing solutions. Skills excel at information delivery and adaptive context management. MCPs provide structured tool access."

**The 3-interface architectural pattern** describes the production reality at mature teams:

1. **CLI:** for coding agents that need direct, composable access to tools in a terminal environment. The agent writes the command, chains multiple CLI calls, uses flags dynamically. Best for: Claude Code, Codex CLI, Cursor, any agent with shell access.

2. **MCP:** for structured external integrations where OAuth scoping, multi-user audit trails, remote access, and enterprise governance matter. Best for: chatbots (Claude Desktop, Claude Co-work, ChatGPT), B2B SaaS, enterprise deployments, any context where "a non-technical person needs to authorize an AI to act on their behalf."

3. **Skills:** for workflow knowledge and orchestration instructions that do not require live connections. Best for: encoding domain expertise, multi-step workflows, reducing prompt engineering per session, lazy-loading detailed instructions.

**Ринат Абдуллин** (llm_under_hood, production deployment experience) put it directly: for personal agents, MCP; for corporate and business systems with LLM backends, terminal sessions on a server with agents communicating via CLI instead of "noisy and unstable MCP."

Source: [llm_under_hood Telegram](https://t.me/s/llm_under_hood/777), 2026-03-20.

---

## Part 4 — When CLI wins

Use CLI when:

**1. The agent has shell access.** Coding agents (Claude Code, Codex CLI, Cursor, OpenCode) already run in a terminal with filesystem access. Adding an MCP server for GitHub or Supabase when the `gh` CLI and `supabase` CLI are installable is adding overhead for no capability gain.

**2. Composability matters.** CLI commands can be piped together dynamically. The agent writes the exact combination of flags and pipes that the task requires. MCP tools have fixed schemas; the agent can only call them as designed. JeredBlu: "Agents are better at writing code than calling tools in a specific order or format. A good CLI lets the agent chain commands and build its own workflow on the fly."

**3. Token budget is tight.** A single Bash tool handles any CLI command. Compare this to a GitHub MCP server consuming 46,000 tokens (25% of a 200K context window) at session start.

**4. The integration is for a single developer or small team.** MCP's governance features (OAuth scoping, multi-user audit, centralized management) add overhead that is not needed for personal automation.

**5. The target platform has a mature, well-documented CLI.** GitHub (`gh`), Supabase CLI, Google Workspace CLI (gws), Stripe CLI, Ramp CLI — all are well-documented, LLM-familiar, and actively maintained.

**The Playwright example (JeredBlu, [2026-04-05](https://www.youtube.com/watch?v=DJSkyZIxVWE)):**

> "The Playwright MCP fills up the context window really fast, whereas the Playwright CLI, paired with a CLI Skill, does the same exact thing and takes a fraction of the context."

Playwright MCP: ~13,647 tokens at session start. Playwright CLI + Skill: ~100 tokens (Skill frontmatter) + the Bash tool.

---

## Part 5 — When MCP wins

Use MCP when:

**1. The agent environment is a chatbot, not a coding agent.** Claude Desktop, Claude Co-work, ChatGPT — these do not have terminal access. MCP is the only option for giving them external tool capabilities. If the agent is not running in a shell, CLI is not available.

**2. Authentication scoping matters.** MCP allows OAuth 2.1 scoped permissions: read-only invoices vs full-write accounting, specific Supabase project access vs all projects. CLI tools typically inherit the full credentials of the current user — there is no fine-grained scoping without custom wrapper scripts.

JeredBlu: "In general, MCP does authentication a bit better. You can scope it and give it specific permissions. Whereas, a CLI generally has access to all your credentials, your whole computer."

**3. Remote / cross-device access is required.** MCP supports remote servers. A remote Supabase MCP can be accessed from a phone via the Claude mobile app, or shared across Claude Desktop, Claude Co-work, and Claude Code simultaneously. CLI requires the CLI to be installed on every device.

**4. Multi-user enterprise governance.** When multiple teams or agents need access to the same integration, MCP provides: centralized configuration, OAuth audit trails, per-tool permission scoping, RBAC. Individual CLI setups per developer do not.

**5. Persistent connections to stateful systems.** Database connections, real-time data streams, systems that require session state — these are natural fits for MCP where a persistent connection is maintained.

**6. The integration target is a low-code platform.** n8n, Flowise, and similar no-code/low-code platforms work naturally with MCP as the integration layer between an AI agent and workflow automation.

**The Supabase example:** JeredBlu explicitly prefers Supabase MCP over Supabase CLI for production use because of auth scoping, project isolation, and remote access from non-development devices.

**Decision heuristic from systemprompt.io:** "If the prompt includes words like `query`, `fetch`, or `check current state` → you probably need MCP. Otherwise → Skill."

---

## Part 6 — When Skills win (lazy loading)

Use Skills when:

**1. The agent needs domain knowledge or a multi-step workflow that does not require live data.** A Skill can encode "how to do a code review for this project" or "how to generate a weekly digest from these sources" — multi-step orchestration that would otherwise require repetitive prompting.

**2. Token budget is the primary constraint.** 200 Skills cost ~15,000 tokens at session start. 5 MCP servers cost ~55,000 tokens. For an agent that performs dozens of different task types, Skills are the scalable choice.

**3. The knowledge needs to evolve frequently.** Skills are Markdown files in a git repository. Updating them requires no API changes, no server restarts, no protocol version bumps.

**4. You want self-maintaining integrations.** When a CLI tool changes its interface, a Skill can be updated to document the new pattern — the agent reads the updated Skill and adapts. When an MCP server changes its API, integrations break silently until the schema is updated.

**5. The workflow is personal or small-team.** For individual developers and small teams, the overhead of hosting and maintaining an MCP server is rarely justified when a Skill + CLI achieves the same result.

**Rakuten case:** 87.5% time reduction through Skills vs MCP for equivalent task completion. Source: [intuitionlabs.ai](http://intuitionlabs.ai/articles/claude-skills-vs-mcp).

**Simple rule (docs.bswen.com):** "Skills for yourself, MCP for the team."

### Skill loading model in detail

| Tier | Content | When loaded | Size |
|---|---|---|---|
| Tier 1 | YAML frontmatter (name + description + triggers) | Always, every session | ~50–100 tokens per skill |
| Tier 2 | Full Skill body (step-by-step instructions) | When the model activates the skill | ≤200 lines recommended |
| Tier 3 | Referenced materials (scripts, templates, references) | Only when explicitly referenced in a step | Unlimited, loaded on demand |

Source: Simon Scrapes analysis of Claude Code Skills architecture; Armin Ronacher on Skills lazy loading.

---

## Part 7 — The hybrid pattern: Claude Code + Bash + MCP

The mature production pattern is not "choose one" — it is layering all three approaches:

**Claude Code default architecture:**
- Bash tool handles all CLI interactions natively.
- MCP servers handle external authenticated integrations (database connections, cloud APIs).
- Skills handle domain knowledge, workflow orchestration, and CLI documentation.

**Concrete example:**
```
Task: "Review these GitHub PRs and create Jira tickets for the ones needing follow-up"

Approach:
- GitHub: use `gh` CLI (coding agent has shell, no extra context cost)
  └─→ Pair with a "GitHub PR review workflow" Skill (~75 tokens)
- Jira: use Jira MCP (requires OAuth scoped to project, not global credentials)
  └─→ Tool descriptions load once, persist across the session
- Analysis logic: encoded in a "PR-to-ticket decision" Skill
  └─→ Loaded only when the PR review step activates it
```

JeredBlu's documented workflow: uses remote MCP connectors (shared across Claude Desktop + Claude Co-work + Claude Code) for services where remote access and cross-device sharing matter, **plus** CLI tools in purely coding contexts for the same services when working in Claude Code.

The key insight: **you can use both MCP and CLI for the same service** in different contexts. The choice is per-session based on which environment you are working in and what you need from the integration.

---

## Part 8 — `mcp2cli` and auto-conversion utilities

As the CLI-vs-MCP debate evolved, tooling emerged to convert between the two. The `mcp2cli` pattern (referenced in community discussions from March 2026) converts MCP server definitions into CLI-compatible wrappers, enabling agents with shell access to use the same underlying integrations through the CLI path with lower context cost.

**Practical application:** if you have an MCP server that works well in a chatbot context (Claude Desktop), you can generate a CLI wrapper using `mcp2cli` to use the same integration in a coding agent context (Claude Code) at a fraction of the context cost. The underlying API calls are identical; only the interface layer changes.

This reinforces the 3-interface pattern: the integration logic is implemented once, then exposed through whichever interface is appropriate for the agent environment.

**Limitation:** auto-converted CLIs inherit the description quality of the original MCP server. If the MCP tool descriptions were poorly written (generic verbs, no examples, no when-NOT-to-use guidance), the CLI wrapper will have the same problems. The conversion does not fix underlying description quality.

---

## Part 9 — The 3-interface architectural pattern

The 3-interface pattern describes how mature agent systems in 2026 structure their tool integrations:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent System                           │
│                                                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Skills Layer  │  │   CLI Layer  │  │   MCP Layer   │  │
│  │                 │  │              │  │               │  │
│  │ Domain knowledge│  │ Shell tools  │  │ Authenticated │  │
│  │ Workflow rules  │  │ Composable   │  │ integrations  │  │
│  │ Lazy loaded     │  │ Terminal ops │  │ Remote access │  │
│  │ ~50 tok/skill   │  │ 1 Bash tool  │  │ Enterprise    │  │
│  └─────────────────┘  └──────────────┘  └───────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Rules for each layer:**

| Layer | What belongs here | What does NOT belong here |
|---|---|---|
| **Skills** | Workflow orchestration, domain knowledge, CLI documentation, decision frameworks | Live data queries, runtime state checks, authenticated external calls |
| **CLI** | Any tool with a mature CLI, coding agent tasks, composable shell operations | Cross-device sharing, non-technical user interfaces, multi-user auth scoping |
| **MCP** | Authenticated external APIs, enterprise integrations, chatbot tools, remote/cross-device | Simple REST APIs that an agent can call directly with `curl`, tools that require no auth |

**When a REST API needs no auth and is simple:** skip MCP entirely. Have the agent write a `curl` or Python `requests` call. This is "Programmatic Tool Calling" — token cost drops from 150,000 tokens (MCP schema overhead at scale) to approximately **2,000 tokens** for a typical agentic API task.

Source: NotebookLM synthesis from KB; [neuraldeep Telegram](https://t.me/s/neuraldeep/1987) — 100 MCP tools = 50K tokens; 100 CLI commands = 1 Bash tool + Skill description.

---

## Decision flowchart

```
START: You need an external integration
│
├── Does the agent have terminal / shell access?
│   ├── NO → Chatbot environment (Claude Desktop, ChatGPT, Co-work)
│   │         └─→ USE MCP (only option for tool access)
│   │             └─→ Apply MCP design principles (5–15 tools, OAuth, etc.)
│   │
│   └── YES → Coding agent (Claude Code, Codex CLI, Cursor)
│             │
│             ├── Does this integration require:
│             │   - OAuth scoped permissions?
│             │   - Multi-user audit trails?
│             │   - Remote / cross-device access?
│             │   - Enterprise centralized governance?
│             │
│             ├── YES to any → USE MCP
│             │               └─→ Keep tool count ≤15
│             │                   └─→ Consider adding matching CLI Skill
│             │
│             └── NO to all
│                 │
│                 ├── Does the target service have a mature CLI?
│                 │   YES → USE CLI + Skill
│                 │         └─→ One Skill encodes how to use the CLI
│                 │             Bash tool handles execution
│                 │
│                 ├── Does the target service have a REST API with no auth?
│                 │   YES → Have the agent write the curl/requests call directly
│                 │         (Programmatic Tool Calling — lowest context cost)
│                 │
│                 └── The integration is workflow knowledge / domain rules
│                     with no live data requirement
│                     → USE Skill only (no CLI, no MCP)

AFTER CHOOSING:
│
├── Does the workflow need domain knowledge or step-by-step orchestration?
│   YES → Add a Skill regardless of CLI or MCP choice
│
└── Is token budget a concern?
    YES → Audit total MCP token cost at session start
          Enable Tool Search (ENABLE_TOOL_SEARCH=true) if using MCP
          Replace rarely-used MCP tools with Programmatic Tool Calling
```

---

## Sources

**Benchmark data (cost, reliability):**
- themenonlab.blog — Skills vs MCP Token Efficiency: https://themenonlab.blog/blog/skills-vs-mcp-token-efficiency-ai-agents
- intuitionlabs.ai — Claude Skills vs MCP: http://intuitionlabs.ai/articles/claude-skills-vs-mcp

**JeredBlu — MCP or CLI (primary source, April 2026):**
- YouTube: https://www.youtube.com/watch?v=DJSkyZIxVWE

**Architecture analysis:**
- Jenny Ouyang — Claude Code MCP vs Skills vs Plugins: https://buildtolaunch.substack.com/p/claude-code-mcp-vs-plugins-vs-skills
- docs.bswen.com — MCP vs Claude Skills: https://docs.bswen.com/blog/2026-03-18-mcp-vs-claude-skills/
- systemprompt.io — Skills vs Agents vs MCP: https://systemprompt.io/guides/claude-skills-vs-agents-vs-mcp

**Production context:**
- llm_under_hood Telegram (Ринат Абдуллин): https://t.me/s/llm_under_hood/777
- neuraldeep Telegram: https://t.me/s/neuraldeep/1987

**MCP critique and response:**
- agentpatterns.ai — MCP Server Design: http://agentpatterns.ai/tool-engineering/mcp-server-design/
- Anthropic — Writing effective tools for AI agents: https://www.anthropic.com/engineering/writing-tools-for-agents

---

*Version 1.0 | 2026-04-27 | M3 guide for HSS AI-Driven Development Level 1.*
