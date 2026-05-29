#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", "..", ".env") });

// --- Configuration ---

const EMBEDDING_MODEL = "text-embedding-3-small";

const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  database: process.env.POSTGRES_DB || "proshop",
  user: process.env.POSTGRES_USER || "proshop",
  password: process.env.POSTGRES_PASSWORD || "proshop",
};

// --- Helpers ---

async function embedText(text: string, client: OpenAI): Promise<number[]> {
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: [text],
  });
  return response.data[0]!.embedding;
}

interface ChunkRow {
  text: string;
  source_file: string;
  file_path: string;
  title: string;
  parent_headings: string[];
  similarity: number;
}

// --- Server ---

const server = new McpServer({
  name: "proshop-search-docs",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "search_project_docs",
  [
    "Semantic search over ProShop MERN project documentation corpus (architecture, features, ADRs, runbooks, incidents, glossary, dev history, API specs, page descriptions).",
    "",
    "WHEN TO USE: You MUST use this FIRST when the user asks about product functionality, architecture decisions, how a feature works, what happened during an incident, deployment procedures, or any knowledge about the proshop_mern codebase. Covers 47 markdown documents with 723 indexed chunks.",
    "WHEN NOT TO USE: Do not use this for current feature flag state (status, traffic %, dependencies) — use get_feature_info or list_features from the proshop-feature-flags MCP server instead. Do not use this to modify feature flags — use set_feature_state or adjust_traffic_rollout.",
    "",
    "INPUT: query (natural language search string), top_k (number of results, default 5).",
    "OUTPUT: JSON array of chunks, each with: source_file, file_path, title, parent_headings (breadcrumb trail), score (cosine similarity), snippet (~200 chars of matching text).",
    "",
    "Examples:",
    '  { "query": "Why was MongoDB chosen over PostgreSQL?" }',
    '  { "query": "PayPal double-charge incident timeline" }',
    '  { "query": "How does JWT authentication work in proshop?" }',
    '  { "query": "deployment runbook steps", "top_k": 3 }',
  ].join("\n"),
  {
    query: z
      .string()
      .describe("Natural language search query about the proshop_mern project"),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Number of results to return (default: 5, max: 20)"),
  },
  async ({ query, top_k }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: "OPENAI_API_KEY is not set. Add it to .env in the project root and restart the MCP server.",
          },
        ],
      };
    }

    const openai = new OpenAI({ apiKey });

    let embedding: number[];
    try {
      embedding = await embedText(query, openai);
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Failed to generate embedding: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }

    const embeddingStr = "[" + embedding.join(",") + "]";

    const sql = `
      SELECT
        text,
        source_file,
        file_path,
        title,
        parent_headings,
        1 - (embedding <=> $1::vector) AS similarity
      FROM chunks
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    let rows: ChunkRow[];
    const client = new pg.Client(DB_CONFIG);
    try {
      await client.connect();
      const result = await client.query(sql, [embeddingStr, top_k]);
      rows = result.rows as ChunkRow[];
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Database query failed: ${err instanceof Error ? err.message : String(err)}. Ensure PostgreSQL is running and chunks are loaded (node scripts/embed_chunks.js).`,
          },
        ],
      };
    } finally {
      await client.end();
    }

    const chunks = rows.map((row) => ({
      source_file: row.source_file,
      file_path: row.file_path,
      title: row.title,
      parent_headings: row.parent_headings || [],
      score: parseFloat(parseFloat(String(row.similarity)).toFixed(4)),
      snippet:
        row.text.length > 200 ? row.text.slice(0, 200) + "..." : row.text,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(chunks, null, 2) }],
    };
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
  console.error("ProShop Search Docs MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
