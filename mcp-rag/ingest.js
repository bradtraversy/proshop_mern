import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { CohereClient } from 'cohere-ai'
import { QdrantClient } from '@qdrant/js-client-rest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
dotenv.config({ path: join(PROJECT_ROOT, '.env') })

const DATA_DIR = join(PROJECT_ROOT, 'project-data')

function inferType(absPath) {
  if (absPath.includes('/runbooks/')) return 'runbook'
  if (absPath.includes('/incidents/')) return 'incident'
  if (absPath.includes('/adrs/')) return 'adr'
  if (absPath.includes('/features/')) return 'feature'
  if (absPath.includes('/api/')) return 'api'
  if (absPath.includes('/pages/')) return 'page'
  return 'doc'
}

function walkMd(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkMd(full))
    else if (entry.name.endsWith('.md')) files.push(full)
  }
  return files
}

// ~4 chars per token for multilingual text — rough but sufficient
function approxTokens(text) {
  return Math.ceil(text.length / 4)
}

function chunkFile(content, maxTokens = 512, targetTokens = 400, minTokens = 25) {
  // Split on ## headings (keep heading with its content)
  const sections = content.split(/(?=\n## )/).map(s => s.trim()).filter(Boolean)
  const chunks = []

  for (const section of sections) {
    if (approxTokens(section) <= maxTokens) {
      if (approxTokens(section) >= minTokens) chunks.push(section)
      continue
    }
    // Section too large — split on blank lines (paragraph boundaries)
    const paragraphs = section.split(/\n\n+/)
    let current = ''
    for (const para of paragraphs) {
      const candidate = current ? current + '\n\n' + para : para
      if (approxTokens(candidate) > targetTokens && current) {
        if (approxTokens(current) >= minTokens) {
          const trimmed = current.trim()
          const maxChars = maxTokens * 4
          chunks.push(trimmed.length > maxChars ? trimmed.slice(0, maxChars) + ' [truncated]' : trimmed)
        }
        current = para
      } else {
        current = candidate
      }
    }
    if (current.trim()) {
      const trimmed = current.trim()
      if (approxTokens(trimmed) >= minTokens) {
        // Hard truncate single oversized paragraphs at maxTokens * 4 chars
        const maxChars = maxTokens * 4
        chunks.push(trimmed.length > maxChars ? trimmed.slice(0, maxChars) + ' [truncated]' : trimmed)
      }
    }
  }
  return chunks
}

function extractSection(chunkText) {
  const match = chunkText.match(/^##\s+(.+)/m)
  return match ? `## ${match[1].trim()}` : '(intro)'
}

export function buildChunks() {
  const files = walkMd(DATA_DIR)
  const allChunks = []

  for (const absPath of files) {
    const content = readFileSync(absPath, 'utf-8')
    const relPath = relative(PROJECT_ROOT, absPath)
    const type = inferType(absPath)
    const lastModified = statSync(absPath).mtime.toISOString()

    for (const text of chunkFile(content)) {
      allChunks.push({
        text,
        source_file: relPath,
        section: extractSection(text),
        type,
        last_modified: lastModified,
      })
    }
  }
  return allChunks
}

// Quick smoke test when run directly with --test flag
if (process.argv.includes('--test')) {
  const chunks = buildChunks()
  console.log(`Files found: ${walkMd(DATA_DIR).length}`)
  console.log(`Chunks produced: ${chunks.length}`)
  console.log('Sample chunk:')
  console.log(JSON.stringify(chunks[0], null, 2))
}

// Dump all chunks to JSONL without touching Qdrant/Cohere
if (process.argv.includes('--dump')) {
  const idx = process.argv.indexOf('--dump')
  const outArg = process.argv[idx + 1]
  const outPath = outArg && !outArg.startsWith('--')
    ? (outArg.startsWith('/') ? outArg : join(process.cwd(), outArg))
    : join(__dirname, 'chunks.jsonl')
  const chunks = buildChunks()
  const lines = chunks.map(c => JSON.stringify(c)).join('\n') + '\n'
  writeFileSync(outPath, lines, 'utf-8')
  console.log(`Wrote ${chunks.length} chunks to ${outPath}`)
  process.exit(0)
}

const COLLECTION = 'proshop_docs'
const VECTOR_SIZE = 1024
const BATCH_SIZE = 96

async function main() {
  if (!process.env.COHERE_API_KEY) {
    console.error('Error: COHERE_API_KEY is not set in .env')
    process.exit(1)
  }

  const cohere = new CohereClient({ token: process.env.COHERE_API_KEY })
  const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' })

  const chunks = buildChunks()
  console.log(`Indexing ${chunks.length} chunks from ${walkMd(DATA_DIR).length} files...`)

  // Recreate collection for idempotency
  try { await qdrant.deleteCollection(COLLECTION) } catch { /* first run */ }
  await qdrant.createCollection(COLLECTION, {
    vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
  })
  console.log(`Collection '${COLLECTION}' created`)

  let pointId = 0
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    const response = await cohere.embed({
      texts: batch.map(c => c.text),
      model: 'embed-multilingual-v3.0',
      inputType: 'search_document',
      embeddingTypes: ['float'],
    })

    if (response.embeddings.float.length !== batch.length) {
      throw new Error(`Cohere returned ${response.embeddings.float.length} embeddings for ${batch.length} texts`)
    }

    const points = batch.map((chunk, j) => ({
      id: pointId++,
      vector: response.embeddings.float[j],
      payload: {
        source_file: chunk.source_file,
        section: chunk.section,
        type: chunk.type,
        last_modified: chunk.last_modified,
        text: chunk.text,
      },
    }))

    await qdrant.upsert(COLLECTION, { wait: true, points })
    console.log(`Batch ${batchNum}/${totalBatches} upserted (${points.length} points)`)
  }

  console.log(`\nDone. ${pointId} vectors indexed in '${COLLECTION}'.`)
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly && !process.argv.includes('--test') && !process.argv.includes('--dump')) {
  main().catch(err => { console.error(err); process.exit(1) })
}
