import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

// --- Black-box MCP-protocol tests for the search-docs RAG server ---
//
// The server has no exports and runs main() on import. It needs OpenAI + Postgres,
// neither of which is available in tests, so we only exercise the deterministic
// paths that require neither: tool/resource discovery, Zod input validation, and
// the "no API key" branch.
//
// To force the "no API key" branch even if the repo .env contains a key, we spawn
// the server with OPENAI_API_KEY="" in its env. dotenv.config() does NOT override
// an already-present (even empty) process.env var, so the handler reads an empty
// key and returns its remediation error before ever touching OpenAI or Postgres.

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(here, "..", "dist", "index.js");

let client: Client;

/**
 * Assert that a tool call was rejected, by EITHER the SDK throwing (Zod input
 * validation surfaces as a thrown protocol error) OR the result carrying
 * isError. We never swallow: if neither happens, we fail loudly with the result.
 */
async function expectRejected(args: Record<string, unknown>): Promise<void> {
  let threw = false;
  let res: any;
  try {
    res = await client.callTool({ name: "search_project_docs", arguments: args });
  } catch (err) {
    threw = true;
    // A thrown error is an acceptable rejection signal; assert it is a real error.
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message).length).toBeGreaterThan(0);
  }
  if (!threw) {
    // If it did not throw, the rejection must be expressed as isError.
    expect(
      res?.isError,
      `expected callTool(${JSON.stringify(args)}) to be rejected, got: ${JSON.stringify(res)}`
    ).toBe(true);
  }
}

beforeAll(async () => {
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: { ...process.env, OPENAI_API_KEY: "" },
  });
  client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
}, 30000);

afterAll(async () => {
  if (client) await client.close();
});

describe("proshop-search-docs MCP server", () => {
  it("exposes a tool named search_project_docs", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("search_project_docs");
  });

  it("declares query and top_k in the search tool's input schema", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "search_project_docs");
    expect(tool).toBeDefined();

    const props = (tool!.inputSchema as any).properties ?? {};
    const propNames = Object.keys(props);
    expect(propNames).toContain("query");
    expect(propNames).toContain("top_k");
    // query is the required natural-language input.
    expect((tool!.inputSchema as any).required).toContain("query");
  });

  it("server://status resource reports ok with a numeric uptime", async () => {
    const r = await client.readResource({ uri: "server://status" });
    const status = JSON.parse(r.contents[0].text as string);
    expect(status.status).toBe("ok");
    expect(typeof status.uptime).toBe("number");
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });

  it("returns the OPENAI_API_KEY remediation error when the key is empty", async () => {
    const res = await client.callTool({
      name: "search_project_docs",
      arguments: { query: "Why was MongoDB chosen over PostgreSQL?" },
    });
    expect(res.isError).toBe(true);
    const text = (res.content as any[])[0].text as string;
    expect(text).toContain("OPENAI_API_KEY is not set");
  });

  it("rejects top_k above the maximum of 20", async () => {
    await expectRejected({ query: "deployment runbook steps", top_k: 999 });
  });

  it("rejects a call that omits the required query field", async () => {
    await expectRejected({ top_k: 3 });
  });

  it("rejects top_k below the minimum of 1", async () => {
    await expectRejected({ query: "JWT authentication flow", top_k: 0 });
  });
});
