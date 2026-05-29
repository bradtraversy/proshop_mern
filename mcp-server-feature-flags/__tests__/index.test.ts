import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

// --- Black-box MCP-protocol tests for the feature-flags server ---
//
// The server has no exports and runs main() on import, and it reads/writes the
// REAL backend/features.json (hardcoded relative to dist). So we drive it over
// stdio with the MCP SDK client, and we sandbox the data file by overwriting it
// with a known fixture in beforeAll and restoring the original bytes in afterAll.
//
// Each test sets the precise feature state it needs INSIDE the test so the suite
// is order-independent, even though the server mutates the fixture file across
// calls.

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(here, "..", "dist", "index.js");
const dataPath = resolve(here, "..", "..", "backend", "features.json");

const FIXTURE = {
  search_v2: {
    name: "Search v2",
    description: "New search engine",
    status: "Disabled",
    traffic_percentage: 0,
    last_modified: "2026-01-01",
    targeted_segments: [],
    rollout_strategy: "gradual",
  },
  semantic_search: {
    name: "Semantic Search",
    description: "Vector search",
    status: "Testing",
    traffic_percentage: 25,
    last_modified: "2026-01-01",
    targeted_segments: ["beta"],
    rollout_strategy: "canary",
    dependencies: ["search_v2"],
  },
  dark_mode: {
    name: "Dark Mode",
    description: "Dark theme",
    status: "Enabled",
    traffic_percentage: 100,
    last_modified: "2026-01-01",
    targeted_segments: [],
    rollout_strategy: "full",
  },
};

function writeFixture(): void {
  writeFileSync(dataPath, JSON.stringify(FIXTURE, null, 2) + "\n", "utf-8");
}

let client: Client;
let originalBytes: string;

/** Parse the single text content item of a successful tool result as JSON. */
function parseToolJson(res: any): any {
  return JSON.parse(res.content[0].text as string);
}

beforeAll(async () => {
  // Preserve the real file, then install our known fixture before the server boots.
  originalBytes = readFileSync(dataPath, "utf-8");
  writeFixture();

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: { ...process.env },
  });
  client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
}, 30000);

afterAll(async () => {
  try {
    if (client) await client.close();
  } finally {
    // Always restore the operator's real features.json, byte-for-byte.
    writeFileSync(dataPath, originalBytes, "utf-8");
  }
});

describe("proshop-feature-flags MCP server", () => {
  it("list_features returns every feature with its key, name, status and traffic_percentage", async () => {
    writeFixture();
    const res = await client.callTool({ name: "list_features", arguments: {} });
    expect(res.isError).toBeFalsy();

    const list = parseToolJson(res) as Array<{
      key: string;
      name: string;
      status: string;
      traffic_percentage: number;
    }>;
    expect(list).toHaveLength(3);

    const darkMode = list.find((f) => f.key === "dark_mode");
    expect(darkMode).toEqual({
      key: "dark_mode",
      name: "Dark Mode",
      status: "Enabled",
      traffic_percentage: 100,
    });

    const keys = list.map((f) => f.key).sort();
    expect(keys).toEqual(["dark_mode", "search_v2", "semantic_search"]);
  });

  it("get_feature_info resolves a feature's metadata and its dependency states", async () => {
    writeFixture();
    const res = await client.callTool({
      name: "get_feature_info",
      arguments: { feature_name: "semantic_search" },
    });
    expect(res.isError).toBeFalsy();

    const info = parseToolJson(res);
    expect(info.key).toBe("semantic_search");
    expect(info.name).toBe("Semantic Search");
    expect(info.status).toBe("Testing");
    expect(info.description).toBe("Vector search");
    expect(info.traffic_percentage).toBe(25);
    expect(info.depends_on).toEqual([
      { key: "search_v2", name: "Search v2", status: "Disabled" },
    ]);
  });

  it("get_feature_info returns an error that names the missing key for an unknown feature", async () => {
    writeFixture();
    const res = await client.callTool({
      name: "get_feature_info",
      arguments: { feature_name: "no_such_flag" },
    });
    expect(res.isError).toBe(true);
    const text = (res.content as any[])[0].text as string;
    expect(text).toContain("not found");
    expect(text).toContain("no_such_flag");
  });

  it("set_feature_state refuses to enable a feature whose dependency is Disabled", async () => {
    writeFixture(); // search_v2 is Disabled in the fixture
    const res = await client.callTool({
      name: "set_feature_state",
      arguments: { feature_name: "semantic_search", state: "Enabled" },
    });
    expect(res.isError).toBe(true);
    const text = (res.content as any[])[0].text as string;
    expect(text).toContain("search_v2");
    expect(text.toLowerCase()).toContain("disabled");

    // The blocked write must NOT have persisted an Enabled status.
    const after = await client.callTool({
      name: "get_feature_info",
      arguments: { feature_name: "semantic_search" },
    });
    expect(parseToolJson(after).status).toBe("Testing");
  });

  it("set_feature_state to Disabled forces traffic_percentage to 0", async () => {
    writeFixture(); // dark_mode starts Enabled at 100%
    const res = await client.callTool({
      name: "set_feature_state",
      arguments: { feature_name: "dark_mode", state: "Disabled" },
    });
    expect(res.isError).toBeFalsy();

    const result = parseToolJson(res);
    expect(result.status).toBe("Disabled");
    expect(result.traffic_percentage).toBe(0);
  });

  it("set_feature_state allows enabling a dependent feature once its dependency is enabled", async () => {
    writeFixture();

    // First enable the dependency (search_v2 has no dependencies of its own).
    const depRes = await client.callTool({
      name: "set_feature_state",
      arguments: { feature_name: "search_v2", state: "Enabled" },
    });
    expect(depRes.isError).toBeFalsy();
    expect(parseToolJson(depRes).status).toBe("Enabled");

    // Now the dependency guard should pass for semantic_search.
    const res = await client.callTool({
      name: "set_feature_state",
      arguments: { feature_name: "semantic_search", state: "Enabled" },
    });
    expect(res.isError).toBeFalsy();
    const result = parseToolJson(res);
    expect(result.status).toBe("Enabled");
    expect(result.depends_on).toEqual([
      { key: "search_v2", name: "Search v2", status: "Enabled" },
    ]);
  });

  it("adjust_traffic_rollout hard-locks a Disabled feature against any positive traffic", async () => {
    writeFixture();

    // Make the precise precondition explicit: search_v2 must be Disabled.
    const disableRes = await client.callTool({
      name: "set_feature_state",
      arguments: { feature_name: "search_v2", state: "Disabled" },
    });
    expect(disableRes.isError).toBeFalsy();
    expect(parseToolJson(disableRes).status).toBe("Disabled");

    const res = await client.callTool({
      name: "adjust_traffic_rollout",
      arguments: { feature_name: "search_v2", percentage: 30 },
    });
    expect(res.isError).toBe(true);
    const text = (res.content as any[])[0].text as string;
    expect(text.toLowerCase()).toContain("disabled");

    // The locked write must not have changed traffic away from 0.
    const after = await client.callTool({
      name: "get_feature_info",
      arguments: { feature_name: "search_v2" },
    });
    expect(parseToolJson(after).traffic_percentage).toBe(0);
  });

  it("adjust_traffic_rollout sets the traffic percentage on a non-Disabled feature", async () => {
    writeFixture(); // dark_mode is Enabled
    const res = await client.callTool({
      name: "adjust_traffic_rollout",
      arguments: { feature_name: "dark_mode", percentage: 50 },
    });
    expect(res.isError).toBeFalsy();
    const result = parseToolJson(res);
    expect(result.traffic_percentage).toBe(50);
    expect(result.status).toBe("Enabled");
  });

  it("server://status resource reports ok with a numeric uptime", async () => {
    const r = await client.readResource({ uri: "server://status" });
    const status = JSON.parse(r.contents[0].text as string);
    expect(status.status).toBe("ok");
    expect(typeof status.uptime).toBe("number");
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });
});
