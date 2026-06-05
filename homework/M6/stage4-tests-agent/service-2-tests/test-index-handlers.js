/**
 * Behavioural tests for mcp-rag/index.js — drive the registered tool and resource
 * handlers in-process by mocking the Cohere, Qdrant, and MCP SDK ESM modules.
 *
 * These tests kill mutants that the source-regex tests skip under Stryker:
 *   - Error envelopes (COLLECTION_NOT_FOUND / EMBED_FAILED / SEARCH_FAILED)
 *   - Field mapping + score rounding in search_project_docs
 *   - withPayload / withVector / limit / dedupe / sort / pagination in resource
 *   - Cohere embed call shape (model, inputType, embeddingTypes, texts)
 *   - Qdrant search call shape (vector, limit, withPayload)
 *
 * Mocking is at ESM-module level via jest.unstable_mockModule and MUST precede
 * the dynamic import of '../index.js'.
 */

import { jest } from '@jest/globals'

// COHERE_API_KEY must be set BEFORE importing index.js (top-level check exits 1).
process.env.COHERE_API_KEY = 'fake-test-key-for-jest'
process.env.QDRANT_URL = 'http://test-qdrant:9999'

// Mutable mock state — each test reassigns these before driving handlers.
const cohereState = {
  embed: jest.fn(),
}
const qdrantState = {
  getCollection: jest.fn(),
  search: jest.fn(),
  scroll: jest.fn(),
}
const registered = {
  toolName: null,
  toolDescription: null,
  toolSchema: null,
  toolHints: null,
  toolHandler: null,
  resourceName: null,
  resourceUri: null,
  resourceDescription: null,
  resourceHandler: null,
  serverOptions: null,
}

jest.unstable_mockModule('cohere-ai', () => ({
  CohereClient: jest.fn().mockImplementation((opts) => {
    cohereState.constructorArgs = opts
    return { embed: (...a) => cohereState.embed(...a) }
  }),
}))

jest.unstable_mockModule('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation((opts) => {
    qdrantState.constructorArgs = opts
    return {
      getCollection: (...a) => qdrantState.getCollection(...a),
      search: (...a) => qdrantState.search(...a),
      scroll: (...a) => qdrantState.scroll(...a),
    }
  }),
}))

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({})),
}))

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation((opts) => {
    registered.serverOptions = opts
    return {
      tool: (name, description, schema, hints, handler) => {
        registered.toolName = name
        registered.toolDescription = description
        registered.toolSchema = schema
        registered.toolHints = hints
        registered.toolHandler = handler
      },
      resource: (name, uri, description, handler) => {
        registered.resourceName = name
        registered.resourceUri = uri
        registered.resourceDescription = description
        registered.resourceHandler = handler
      },
      connect: jest.fn().mockResolvedValue(undefined),
    }
  }),
}))

// Drive a one-time import (handlers register at module-eval time).
beforeAll(async () => {
  // Pre-arm getCollection so main()'s top-level call doesn't surface anything noisy.
  qdrantState.getCollection.mockResolvedValue({})
  await import('../../../../mcp-rag/index.js')
})

beforeEach(() => {
  cohereState.embed.mockReset()
  qdrantState.getCollection.mockReset()
  qdrantState.search.mockReset()
  qdrantState.scroll.mockReset()
})

// ---------- registration shape ---------------------------------------------

describe('index.js — server / tool / resource registration', () => {
  test('McpServer instantiated with name "proshop-rag" and version "1.0.0"', () => {
    expect(registered.serverOptions).toEqual({ name: 'proshop-rag', version: '1.0.0' })
  })

  test('tool registered under name "search_project_docs"', () => {
    expect(registered.toolName).toBe('search_project_docs')
  })

  test('tool description is non-empty and mentions ProShop and top_k', () => {
    expect(typeof registered.toolDescription).toBe('string')
    expect(registered.toolDescription.length).toBeGreaterThan(50)
    expect(registered.toolDescription).toMatch(/ProShop/)
    expect(registered.toolDescription).toMatch(/top_k/)
  })

  test('tool hints object is exactly { readOnlyHint:true, destructiveHint:false, idempotentHint:true }', () => {
    expect(registered.toolHints).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    })
  })

  test('tool Zod schema: query is required string, top_k accepts 1..15 and defaults to 5', () => {
    const { query, top_k } = registered.toolSchema
    expect(query.safeParse('hi').success).toBe(true)
    expect(query.safeParse(123).success).toBe(false)
    expect(query.safeParse(undefined).success).toBe(false)
    expect(top_k.safeParse(undefined).data).toBe(5)
    expect(top_k.safeParse(1).success).toBe(true)
    expect(top_k.safeParse(15).success).toBe(true)
    expect(top_k.safeParse(0).success).toBe(false)
    expect(top_k.safeParse(16).success).toBe(false)
    expect(top_k.safeParse(3.5).success).toBe(false)
  })

  test('resource registered with name "proshop-docs-index" and uri "file:///proshop-docs-index"', () => {
    expect(registered.resourceName).toBe('proshop-docs-index')
    expect(registered.resourceUri).toBe('file:///proshop-docs-index')
  })

  test('Qdrant client constructed with URL from QDRANT_URL env var', () => {
    expect(qdrantState.constructorArgs).toEqual({ url: 'http://test-qdrant:9999' })
  })

  test('Cohere client constructed with token from COHERE_API_KEY env var', () => {
    expect(cohereState.constructorArgs).toEqual({ token: 'fake-test-key-for-jest' })
  })
})

// ---------- search_project_docs handler — happy path -----------------------

function makeEmbeddingResp(vec = Array(1024).fill(0.1)) {
  return { embeddings: { float: [vec] } }
}

function parseToolResult(res) {
  expect(res.content).toBeDefined()
  expect(Array.isArray(res.content)).toBe(true)
  expect(res.content[0].type).toBe('text')
  return JSON.parse(res.content[0].text)
}

describe('search_project_docs — happy path', () => {
  test('returns mapped chunks {score(rounded to 2dp), source_file, section, type, text}', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({ status: 'green' })
    const vec = Array(1024).fill(0.42)
    cohereState.embed.mockResolvedValueOnce({ embeddings: { float: [vec] } })
    qdrantState.search.mockResolvedValueOnce([
      {
        score: 0.123456,
        payload: {
          source_file: 'project-data/x.md',
          section: '## Heading',
          type: 'doc',
          text: 'hello world',
        },
      },
      {
        score: 0.555,
        payload: {
          source_file: 'project-data/y.md',
          section: '(intro)',
          type: 'adr',
          text: 'другой текст',
        },
      },
    ])

    const res = await registered.toolHandler({ query: 'hi', top_k: 2 })

    expect(res.isError).toBeUndefined()

    const parsed = parseToolResult(res)
    expect(parsed).toEqual([
      {
        score: 0.12,
        source_file: 'project-data/x.md',
        section: '## Heading',
        type: 'doc',
        text: 'hello world',
      },
      {
        score: 0.56,
        source_file: 'project-data/y.md',
        section: '(intro)',
        type: 'adr',
        text: 'другой текст',
      },
    ])
  })

  test('Cohere embed receives texts:[query], model embed-multilingual-v3.0, inputType search_query, embeddingTypes [float]', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({})
    cohereState.embed.mockResolvedValueOnce(makeEmbeddingResp())
    qdrantState.search.mockResolvedValueOnce([])

    await registered.toolHandler({ query: 'how does feature flag dark_mode work?', top_k: 5 })

    expect(cohereState.embed).toHaveBeenCalledTimes(1)
    expect(cohereState.embed).toHaveBeenCalledWith({
      texts: ['how does feature flag dark_mode work?'],
      model: 'embed-multilingual-v3.0',
      inputType: 'search_query',
      embeddingTypes: ['float'],
    })
  })

  test('Qdrant search called with collection "proshop_docs", embedded vector, limit=top_k, withPayload:true', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({})
    const vec = Array(1024).fill(0.7)
    cohereState.embed.mockResolvedValueOnce({ embeddings: { float: [vec] } })
    qdrantState.search.mockResolvedValueOnce([])

    await registered.toolHandler({ query: 'q', top_k: 7 })

    expect(qdrantState.search).toHaveBeenCalledTimes(1)
    const [collection, args] = qdrantState.search.mock.calls[0]
    expect(collection).toBe('proshop_docs')
    expect(args.vector).toBe(vec)
    expect(args.limit).toBe(7)
    expect(args.withPayload).toBe(true)
  })

  test('default top_k=5 is applied when arg omitted (destructure default)', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({})
    cohereState.embed.mockResolvedValueOnce(makeEmbeddingResp())
    qdrantState.search.mockResolvedValueOnce([])

    await registered.toolHandler({ query: 'q' })

    expect(qdrantState.search.mock.calls[0][1].limit).toBe(5)
  })

  test('result envelope is JSON.stringify(chunks, null, 2) — pretty-printed JSON array', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({})
    cohereState.embed.mockResolvedValueOnce(makeEmbeddingResp())
    qdrantState.search.mockResolvedValueOnce([
      { score: 0.5, payload: { source_file: 'a', section: 'b', type: 'doc', text: 't' } },
    ])

    const res = await registered.toolHandler({ query: 'q', top_k: 1 })
    // JSON.stringify(arr, null, 2) → newline + 4 spaces (= 2*depth) before object field names.
    expect(res.content[0].text).toContain('\n    "score"')
    expect(res.content[0].text.startsWith('[')).toBe(true)
    expect(res.content[0].text.endsWith(']')).toBe(true)
  })

  test('empty Qdrant result → empty JSON array, no error flag', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({})
    cohereState.embed.mockResolvedValueOnce(makeEmbeddingResp())
    qdrantState.search.mockResolvedValueOnce([])

    const res = await registered.toolHandler({ query: 'q', top_k: 5 })
    expect(res.isError).toBeUndefined()
    expect(JSON.parse(res.content[0].text)).toEqual([])
  })

  test('score rounding boundaries: 0.5001→0.5, 0.999→1, 0→0, 1→1', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({})
    cohereState.embed.mockResolvedValueOnce(makeEmbeddingResp())
    qdrantState.search.mockResolvedValueOnce([
      { score: 0.5001, payload: { source_file: 'a', section: 's', type: 'doc', text: 't' } },
      { score: 0.999, payload: { source_file: 'b', section: 's', type: 'doc', text: 't' } },
      { score: 0, payload: { source_file: 'c', section: 's', type: 'doc', text: 't' } },
      { score: 1, payload: { source_file: 'd', section: 's', type: 'doc', text: 't' } },
    ])

    const out = JSON.parse((await registered.toolHandler({ query: 'q', top_k: 4 })).content[0].text)
    expect(out.map((c) => c.score)).toEqual([0.5, 1, 0, 1])
  })
})

// ---------- search_project_docs handler — error paths ----------------------

describe('search_project_docs — error envelopes', () => {
  test('COLLECTION_NOT_FOUND when qdrant.getCollection rejects: isError:true + exact envelope', async () => {
    qdrantState.getCollection.mockRejectedValueOnce(
      Object.assign(new Error('not found'), { status: 404 }),
    )

    const res = await registered.toolHandler({ query: 'q', top_k: 5 })

    expect(res.isError).toBe(true)
    expect(res.content[0].type).toBe('text')
    const env = JSON.parse(res.content[0].text)
    expect(env.error).toBe('COLLECTION_NOT_FOUND')
    expect(env.message).toBe(
      "Collection 'proshop_docs' not found. Run: node mcp-rag/ingest.js",
    )
    expect(cohereState.embed).not.toHaveBeenCalled()
    expect(qdrantState.search).not.toHaveBeenCalled()
  })

  test('EMBED_FAILED when Cohere embed rejects: isError:true, interpolates err.message and mentions COHERE_API_KEY', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({})
    cohereState.embed.mockRejectedValueOnce(new Error('rate limit hit'))

    const res = await registered.toolHandler({ query: 'q', top_k: 5 })

    expect(res.isError).toBe(true)
    const env = JSON.parse(res.content[0].text)
    expect(env.error).toBe('EMBED_FAILED')
    expect(env.message).toContain('Cohere embedding failed: rate limit hit')
    expect(env.message).toContain('COHERE_API_KEY')
    expect(env.message).toContain('.env')
    expect(qdrantState.search).not.toHaveBeenCalled()
  })

  test('SEARCH_FAILED when qdrant.search rejects: isError:true, includes err.message and Qdrant URL', async () => {
    qdrantState.getCollection.mockResolvedValueOnce({})
    cohereState.embed.mockResolvedValueOnce(makeEmbeddingResp())
    qdrantState.search.mockRejectedValueOnce(new Error('connection refused'))

    const res = await registered.toolHandler({ query: 'q', top_k: 5 })

    expect(res.isError).toBe(true)
    const env = JSON.parse(res.content[0].text)
    expect(env.error).toBe('SEARCH_FAILED')
    expect(env.message).toContain('Qdrant search failed: connection refused')
    expect(env.message).toContain('http://test-qdrant:9999')
  })
})

// ---------- proshop-docs-index resource handler ----------------------------

describe('proshop-docs-index resource — happy path', () => {
  test('paginates scroll until next_page_offset is null, dedupes by source_file, sorts lexically', async () => {
    qdrantState.scroll
      .mockResolvedValueOnce({
        points: [
          { payload: { source_file: 'project-data/zebra.md', type: 'doc', last_modified: 'T1' } },
          { payload: { source_file: 'project-data/apple.md', type: 'adr', last_modified: 'T2' } },
        ],
        next_page_offset: 'page2',
      })
      .mockResolvedValueOnce({
        points: [
          { payload: { source_file: 'project-data/banana.md', type: 'feature', last_modified: 'T3' } },
          { payload: { source_file: 'project-data/apple.md', type: 'WRONG', last_modified: 'WRONG' } },
        ],
        next_page_offset: null,
      })

    const res = await registered.resourceHandler()

    expect(res.contents).toHaveLength(1)
    expect(res.contents[0].uri).toBe('file:///proshop-docs-index')
    expect(res.contents[0].mimeType).toBe('application/json')

    const idx = JSON.parse(res.contents[0].text)
    expect(idx).toEqual([
      { source_file: 'project-data/apple.md', type: 'adr', last_modified: 'T2' },
      { source_file: 'project-data/banana.md', type: 'feature', last_modified: 'T3' },
      { source_file: 'project-data/zebra.md', type: 'doc', last_modified: 'T1' },
    ])

    expect(qdrantState.scroll).toHaveBeenCalledTimes(2)
    expect(qdrantState.scroll.mock.calls[0][1].offset).toBeUndefined()
    expect(qdrantState.scroll.mock.calls[1][1].offset).toBe('page2')
  })

  test('scroll call passes limit:100, withVector:false, withPayload: [source_file,type,last_modified]', async () => {
    qdrantState.scroll.mockResolvedValueOnce({ points: [], next_page_offset: null })

    await registered.resourceHandler()

    expect(qdrantState.scroll).toHaveBeenCalledWith('proshop_docs', {
      limit: 100,
      offset: undefined,
      withPayload: ['source_file', 'type', 'last_modified'],
      withVector: false,
    })
  })

  test('pagination terminates when next_page_offset is undefined (loose != null check)', async () => {
    qdrantState.scroll.mockResolvedValueOnce({
      points: [{ payload: { source_file: 'a.md', type: 'doc', last_modified: 'X' } }],
      next_page_offset: undefined,
    })

    const res = await registered.resourceHandler()
    expect(qdrantState.scroll).toHaveBeenCalledTimes(1)
    expect(JSON.parse(res.contents[0].text)).toHaveLength(1)
  })

  test('empty scroll result → empty array, still wraps in correct contents envelope', async () => {
    qdrantState.scroll.mockResolvedValueOnce({ points: [], next_page_offset: null })

    const res = await registered.resourceHandler()
    expect(res.contents).toHaveLength(1)
    expect(res.contents[0].uri).toBe('file:///proshop-docs-index')
    expect(res.contents[0].mimeType).toBe('application/json')
    expect(JSON.parse(res.contents[0].text)).toEqual([])
  })

  test('JSON pretty-printed with 2-space indentation', async () => {
    qdrantState.scroll.mockResolvedValueOnce({
      points: [{ payload: { source_file: 'a.md', type: 'doc', last_modified: 'T' } }],
      next_page_offset: null,
    })
    const res = await registered.resourceHandler()
    // depth-2 indentation in pretty JSON: "[\n  {\n    "source_file":..."
    expect(res.contents[0].text).toContain('\n    "source_file"')
  })
})

describe('proshop-docs-index resource — failure path', () => {
  test('on scroll rejection, returns contents with error JSON (no isError flag — distinct from tool semantics)', async () => {
    qdrantState.scroll.mockRejectedValueOnce(new Error('qdrant down'))

    const res = await registered.resourceHandler()

    expect(res.isError).toBeUndefined()
    expect(res.contents).toHaveLength(1)
    expect(res.contents[0].uri).toBe('file:///proshop-docs-index')
    expect(res.contents[0].mimeType).toBe('application/json')
    const env = JSON.parse(res.contents[0].text)
    expect(env.error).toBe("Collection 'proshop_docs' not found. Run: node mcp-rag/ingest.js")
  })
})
