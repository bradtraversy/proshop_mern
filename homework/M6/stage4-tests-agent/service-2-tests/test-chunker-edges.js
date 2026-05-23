/**
 * Mutant-killer edge tests for mcp-rag/ingest.js chunker internals.
 * Drives buildChunks() through the public API with carefully chosen fixtures
 * that flip individual survived mutants from /tmp/stryker-rag.full.log.
 *
 * No mocking required — pure fs-driven.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const PROJECT_DATA = path.join(REPO_ROOT, 'project-data')
const FIXTURES_ROOT = path.join(PROJECT_DATA, '__test_fixtures_edges__')
const INGEST_SRC = path.join(REPO_ROOT, 'mcp-rag', 'ingest.js')

function writeFixture(relSubdir, name, body) {
  const dir = path.join(FIXTURES_ROOT, relSubdir)
  fs.mkdirSync(dir, { recursive: true })
  const abs = path.join(dir, name)
  fs.writeFileSync(abs, body, 'utf-8')
  return abs
}

async function loadBuildChunks() {
  const url = 'file://' + INGEST_SRC + '?bust=' + Date.now() + Math.random()
  return (await import(url)).buildChunks
}

function cleanup() {
  if (fs.existsSync(FIXTURES_ROOT)) fs.rmSync(FIXTURES_ROOT, { recursive: true, force: true })
}

beforeEach(cleanup)
afterAll(cleanup)

// --------------------------------------------------------------------------
// minTokens boundary: chunkFile uses approxTokens(section) >= minTokens (25).
// approxTokens = Math.ceil(len/4). So 96 chars → 24 tokens (DROP),
// 100 chars → 25 tokens (KEEP). Tests both > and >= mutants.
// --------------------------------------------------------------------------

describe('chunker — minTokens >= boundary (kills >= → > mutant)', () => {
  test('section with exactly 25 approx-tokens (100 chars after trim) is KEPT', async () => {
    // "## H\n" = 5 chars. Body 95 a's + trailing \n. After trim:
    // "## H\n" + "a"*95 = 100 chars, approxTokens = ceil(100/4) = 25.
    // >= 25 keeps; > 25 (mutant) drops.
    const body = '## H\n' + 'a'.repeat(95) + '\n'
    writeFixture('boundary25', 'b.md', body)
    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('boundary25/b.md'))
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.length).toBe(100)
  })

  test('section with 24 approx-tokens (96 chars) is DROPPED', async () => {
    // "## H\n" (5) + "a"*91 (91) = 96 chars after trim → ceil(96/4) = 24 tokens.
    const body = '## H\n' + 'a'.repeat(91) + '\n'
    writeFixture('boundary24', 'b.md', body)
    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('boundary24/b.md'))
    expect(chunks).toEqual([])
  })
})

// --------------------------------------------------------------------------
// Paragraph separator '\n\n' (line 53): if mutated to '' paragraphs concatenate
// directly. Use many small paragraphs that force section > maxTokens (so the
// paragraph splitter runs) but candidate buildup happens via '\n\n' joins.
// --------------------------------------------------------------------------

describe('chunker — paragraph join uses literal "\\n\\n"', () => {
  test('consecutive paragraphs inside one oversize section are joined with "\\n\\n"', async () => {
    // 12 small paragraphs of ~60 tokens (~240 chars) each → total ~720 tokens
    // → exceeds maxTokens=512, so paragraph splitter runs.
    // Each "## H\n" + p1 etc. Inside the loop, candidate buildup adds '\n\n'
    // between paragraphs until candidate > targetTokens=400.
    const paras = []
    for (let i = 0; i < 12; i++) {
      paras.push(`PARA${i}_TAG ` + 'word '.repeat(55))
    }
    const body = '## H\n' + paras.join('\n\n') + '\n'
    writeFixture('sep', 's.md', body)
    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('sep/s.md'))
    expect(chunks.length).toBeGreaterThanOrEqual(2)

    // At least one chunk must contain TWO paragraph tags joined by '\n\n'.
    // If the '\n\n' literal was mutated to '', paragraphs would directly
    // concatenate ("...word PARA1_TAG..."), and "\n\n" between tags absent.
    const hasNewlineJoin = chunks.some((c) =>
      /PARA\d+_TAG[\s\S]*?\n\nPARA\d+_TAG/.test(c.text),
    )
    expect(hasNewlineJoin).toBe(true)
  })
})

// --------------------------------------------------------------------------
// extractSection regex: /^##\s+(.+)/m — kills:
//   - "^" removal mutant (matches "##" mid-line)
//   - match[1].trim() removal mutant (heading with trailing spaces)
// --------------------------------------------------------------------------

describe('chunker — extractSection heading regex anchors and trim', () => {
  test('inline "##" mid-line does NOT count as heading (^ anchor)', async () => {
    // No leading "## " heading; inline "## " appears mid-paragraph.
    // With ^-anchor: no match → '(intro)'.
    // Without ^-anchor (mutant): matches inline "## bar..." → section becomes wrong.
    const body = 'Some intro text. ' + 'word '.repeat(60) + ' foo ## bar middle ' + 'word '.repeat(40)
    writeFixture('inline', 'i.md', body)
    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('inline/i.md'))
    expect(chunks).toHaveLength(1)
    expect(chunks[0].section).toBe('(intro)')
  })

  test('heading with trailing whitespace is trimmed in section name (match[1].trim())', async () => {
    // "## Heading With Trailing   " — without .trim(), section retains spaces.
    const body = '## Heading With Trailing   \n' + 'word '.repeat(40) + '\n'
    writeFixture('trail', 't.md', body)
    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('trail/t.md'))
    expect(chunks).toHaveLength(1)
    expect(chunks[0].section).toBe('## Heading With Trailing')
    expect(chunks[0].section.endsWith(' ')).toBe(false)
  })
})

// --------------------------------------------------------------------------
// walkMd '.md' extension filter (line 29): kills empty-string mutant by
// proving non-.md files are excluded.
// --------------------------------------------------------------------------

describe('walkMd — only .md files included', () => {
  test('non-.md files in the same folder are ignored', async () => {
    writeFixture('mixed', 'kept.md', '## H\n' + 'word '.repeat(40))
    writeFixture('mixed', 'ignored.txt', 'text content ' + 'word '.repeat(40))
    writeFixture('mixed', 'ignored.json', '{"foo":"bar"}')

    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('__test_fixtures_edges__/mixed/'))
    expect(chunks.length).toBe(1)
    expect(chunks[0].source_file.endsWith('kept.md')).toBe(true)
    expect(chunks.every((c) => c.source_file.endsWith('.md'))).toBe(true)
  })
})

// --------------------------------------------------------------------------
// .filter(Boolean) on sections (line 41): leading empty section produced by
// content starting with '\n## ' must be filtered, not emitted as empty chunk.
// --------------------------------------------------------------------------

describe('chunker — empty leading section filtered out', () => {
  test('content starting with blank line then "## H" does not emit an empty intro chunk', async () => {
    const body = '\n## H\n' + 'word '.repeat(40) + '\n'
    writeFixture('lead', 'l.md', body)
    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('lead/l.md'))
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.startsWith('## H')).toBe(true)
    for (const c of chunks) expect(c.text.length).toBeGreaterThan(0)
  })
})

// --------------------------------------------------------------------------
// Hard-truncation suffix (line 58 + 70): " [truncated]" appended to oversized
// single paragraphs (>maxChars=2048). Kills:
//   - " [truncated]" → "" string-literal mutant
//   - slice(0, maxChars) → trimmed (no-slice) mutant
//   - trimmed.length > maxChars → >= mutant
// --------------------------------------------------------------------------

describe('chunker — truncation suffix and boundary', () => {
  test('section exactly at maxTokens (2048 chars / 512 tokens) is NOT truncated', async () => {
    // "## H\n" (5) + "x"*2043 = 2048 chars after trim. approxTokens = 512.
    // <= maxTokens → single chunk path, no truncation suffix.
    const body = '## H\n' + 'x'.repeat(2043) + '\n'
    writeFixture('exact', 'e.md', body)
    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('exact/e.md'))
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.endsWith(' [truncated]')).toBe(false)
    expect(chunks[0].text.length).toBe(2048)
  })

  test('oversize single paragraph (>2048 chars) gets truncated AT 2048 chars + " [truncated]"', async () => {
    const body = '## H\n' + 'y'.repeat(5000)
    writeFixture('over', 'o.md', body)
    const buildChunks = await loadBuildChunks()
    const chunks = buildChunks().filter((c) => c.source_file.includes('over/o.md'))
    const truncated = chunks.find((c) => c.text.endsWith(' [truncated]'))
    expect(truncated).toBeDefined()
    expect(truncated.text.length).toBe(2048 + ' [truncated]'.length)
    // The sliced portion is the FIRST 2048 chars — must contain heading prefix.
    expect(truncated.text.startsWith('## H')).toBe(true)
  })
})
