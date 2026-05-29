#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "..", "..", "backend", "features.json");

// --- Feature Flag Data Store (file-backed) ---

interface Feature {
  name: string;
  description: string;
  status: "Enabled" | "Disabled" | "Testing" | "Shadow";
  traffic_percentage: number;
  last_modified: string;
  targeted_segments: string[];
  rollout_strategy: string;
  dependencies?: string[];
}

type FeaturesDB = Record<string, Feature>;

function loadFeatures(): FeaturesDB {
  const raw = readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as FeaturesDB;
}

function saveFeatures(db: FeaturesDB): void {
  writeFileSync(DATA_PATH, JSON.stringify(db, null, 2) + "\n", "utf-8");
}

function nowDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

function resolveDependencies(
  db: FeaturesDB,
  feature: Feature
): Array<{ key: string; name: string; status: string }> {
  if (!feature.dependencies) return [];
  return feature.dependencies.map((dep) => {
    const depFeature = db[dep];
    return {
      key: dep,
      name: depFeature ? depFeature.name : dep,
      status: depFeature ? depFeature.status : "Unknown",
    };
  });
}

// --- Server ---

const server = new McpServer({
  name: "proshop-feature-flags",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "list_features",
  [
    "List all feature flags with their key, name, status, and traffic percentage.",
    "",
    "WHEN TO USE: Call this tool when the user wants an overview of all features, their statuses, or to find a specific feature key.",
    "WHEN NOT TO USE: Do not use this to get full details of a single feature — use get_feature_info instead.",
    "",
    "INPUT: None.",
    "OUTPUT: JSON array of objects with fields: key, name, status, traffic_percentage.",
  ].join("\n"),
  {},
  async () => {
    const db = loadFeatures();
    const result = Object.entries(db).map(([key, feature]) => ({
      key,
      name: feature.name,
      status: feature.status,
      traffic_percentage: feature.traffic_percentage,
    }));

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_feature_info",
  [
    "Retrieve full metadata for a feature flag including status, traffic percentage, last modification date, and dependency states.",
    "",
    "WHEN TO USE: Call this tool when the user asks about a specific feature's current configuration, rollout progress, or dependency chain.",
    "WHEN NOT TO USE: Do not use this to change feature state — use set_feature_state or adjust_traffic_rollout instead.",
    "",
    "INPUT: feature_name — exact feature key (snake_case string matching a key in features.json).",
    "OUTPUT: JSON object with fields: key, name, description, status, traffic_percentage, last_modified, targeted_segments, rollout_strategy, depends_on (array of {key, name, status}).",
    "",
    "Examples:",
    '  { "feature_name": "checkout_v2" }',
    '  { "feature_name": "semantic_search" }',
    '  { "feature_name": "dark_mode" }',
  ].join("\n"),
  {
    feature_name: z
      .string()
      .describe("Exact feature key in snake_case as it appears in features.json, e.g. 'search_v2'"),
  },
  async ({ feature_name }) => {
    const db = loadFeatures();
    const feature = db[feature_name];

    if (!feature) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Feature '${feature_name}' not found. Available features: ${Object.keys(db).join(", ")}. Verify the key and retry.`,
          },
        ],
      };
    }

    const result = {
      key: feature_name,
      name: feature.name,
      description: feature.description,
      status: feature.status,
      traffic_percentage: feature.traffic_percentage,
      last_modified: feature.last_modified,
      targeted_segments: feature.targeted_segments,
      rollout_strategy: feature.rollout_strategy,
      depends_on: resolveDependencies(db, feature),
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "set_feature_state",
  [
    "Change the status of a feature flag to Enabled, Disabled, Testing, or Shadow.",
    "",
    "WHEN TO USE: Call this tool when the user explicitly requests enabling, disabling, or changing the rollout phase of a feature.",
    "WHEN NOT TO USE: Do not use this to adjust traffic percentage — use adjust_traffic_rollout for that. Do not use this for read-only queries — use get_feature_info.",
    "",
    "You MUST NOT set state to 'Enabled' if any dependency has status 'Disabled'. The server will reject the request with an error listing the blocking dependencies.",
    "",
    "INPUT: feature_name (string), state ('Enabled' | 'Disabled' | 'Testing' | 'Shadow').",
    "OUTPUT: JSON with final state, traffic_percentage, last_modified, and dependency list.",
    "",
    "Examples:",
    '  { "feature_name": "semantic_search", "state": "Enabled" }  → rejected if search_v2 is Disabled',
    '  { "feature_name": "dark_mode", "state": "Disabled" }',
    '  { "feature_name": "stripe_alternative", "state": "Enabled" }',
  ].join("\n"),
  {
    feature_name: z
      .string()
      .describe("Exact feature key in snake_case"),
    state: z
      .enum(["Enabled", "Disabled", "Testing", "Shadow"])
      .describe("Target state. You MUST ensure all dependencies are not Disabled before setting 'Enabled'."),
  },
  async ({ feature_name, state }) => {
    const db = loadFeatures();
    const feature = db[feature_name];

    if (!feature) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Feature '${feature_name}' not found. Available features: ${Object.keys(db).join(", ")}. Verify the key and retry.`,
          },
        ],
      };
    }

    if (state === "Enabled" && feature.dependencies) {
      const disabledDeps = feature.dependencies.filter((dep) => {
        const d = db[dep];
        return !d || d.status === "Disabled";
      });

      if (disabledDeps.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Cannot enable '${feature_name}': dependencies [${disabledDeps.join(", ")}] are Disabled. You MUST enable all dependencies first, then retry.`,
            },
          ],
        };
      }
    }

    feature.status = state;
    feature.last_modified = nowDate();

    if (state === "Disabled") {
      feature.traffic_percentage = 0;
    }

    saveFeatures(db);

    const result = {
      key: feature_name,
      name: feature.name,
      status: feature.status,
      traffic_percentage: feature.traffic_percentage,
      last_modified: feature.last_modified,
      depends_on: resolveDependencies(db, feature),
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "adjust_traffic_rollout",
  [
    "Set the traffic rollout percentage (0–100) for a feature flag.",
    "",
    "WHEN TO USE: Call this tool when the user wants to gradually roll out or roll back traffic for a feature (canary release, percentage-based rollout).",
    "WHEN NOT TO USE: Do not use this to enable/disable a feature — use set_feature_state. Do not use this for read-only queries — use get_feature_info.",
    "",
    "You MUST NOT set percentage > 0 when the feature status is 'Disabled'. The server enforces a hard lock and will reject the request.",
    "",
    "INPUT: feature_name (string), percentage (integer 0–100).",
    "OUTPUT: JSON with updated traffic_percentage, status, and last_modified.",
    "",
    "Examples:",
    '  { "feature_name": "search_v2", "percentage": 50 }    → gradual rollout',
    '  { "feature_name": "cart_redesign", "percentage": 0 }  → pause traffic',
    '  { "feature_name": "apple_pay", "percentage": 10 }     → rejected if Disabled',
  ].join("\n"),
  {
    feature_name: z
      .string()
      .describe("Exact feature key in snake_case"),
    percentage: z
      .number()
      .int()
      .min(0)
      .max(100)
      .describe("Traffic rollout percentage (0–100). You MUST NOT set > 0 when feature is Disabled."),
  },
  async ({ feature_name, percentage }) => {
    const db = loadFeatures();
    const feature = db[feature_name];

    if (!feature) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Feature '${feature_name}' not found. Available features: ${Object.keys(db).join(", ")}. Verify the key and retry.`,
          },
        ],
      };
    }

    if (percentage > 0 && feature.status === "Disabled") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Cannot set traffic to ${percentage}% for '${feature_name}': feature status is Disabled. You MUST first enable the feature via set_feature_state, then adjust traffic.`,
          },
        ],
      };
    }

    feature.traffic_percentage = percentage;
    feature.last_modified = nowDate();

    saveFeatures(db);

    const result = {
      key: feature_name,
      name: feature.name,
      status: feature.status,
      traffic_percentage: feature.traffic_percentage,
      last_modified: feature.last_modified,
      depends_on: resolveDependencies(db, feature),
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Resources ---

server.resource("status", "server://status", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({ status: "ok", uptime: process.uptime() }),
    },
  ],
}));

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ProShop Feature Flags MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
