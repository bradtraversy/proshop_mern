#!/usr/bin/env node
/**
 * Semantic search over pgvector chunks using OpenAI embeddings.
 *
 * Usage:
 *   node scripts/search_chunks.js "your query here"
 *   node scripts/search_chunks.js "query" --top_k 10
 *   node scripts/search_chunks.js "query" --source_file incidents
 *   node scripts/search_chunks.js "query" --type adr
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const EMBEDDING_MODEL = 'text-embedding-3-small';

const DB_CONFIG = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'proshop',
    user: process.env.POSTGRES_USER || 'proshop',
    password: process.env.POSTGRES_PASSWORD || 'proshop',
};

async function embedQuery(text, openai) {
    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: [text],
    });
    return response.data[0].embedding;
}

export async function search(query, { topK = 5, sourceFile = null, fileType = null } = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('ERROR: OPENAI_API_KEY not set.');
        process.exit(1);
    }

    const openai = new OpenAI({ apiKey });
    const embedding = await embedQuery(query, openai);
    const embeddingStr = '[' + embedding.join(',') + ']';

    const conditions = [];
    const params = [embeddingStr];
    let paramIdx = 2;

    if (sourceFile) {
        conditions.push(`source_file ILIKE $${paramIdx++}`);
        params.push(`%${sourceFile}%`);
    }

    if (fileType) {
        conditions.push(`file_path ILIKE $${paramIdx++}`);
        params.push(`%${fileType}%`);
    }

    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // $1 is embedding, filters are $2+, last two are embedding again + limit
    params.push(embeddingStr);
    const embIdx2 = paramIdx++;
    params.push(topK);
    const limitIdx = paramIdx++;

    const sql = `
        SELECT
            text,
            source_file,
            file_path,
            title,
            parent_headings,
            keywords,
            summary,
            1 - (embedding <=> $1::vector) AS similarity
        FROM chunks
        ${whereClause}
        ORDER BY embedding <=> $${embIdx2}::vector
        LIMIT $${limitIdx}
    `;

    const client = new pg.Client(DB_CONFIG);
    await client.connect();
    const result = await client.query(sql, params);
    await client.end();

    return result.rows.map((row) => ({
        text: row.text.length > 300 ? row.text.slice(0, 300) + '...' : row.text,
        full_text: row.text,
        source_file: row.source_file,
        file_path: row.file_path,
        title: row.title,
        parent_headings: row.parent_headings,
        keywords: row.keywords,
        summary: row.summary,
        similarity: parseFloat(parseFloat(row.similarity).toFixed(4)),
    }));
}

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            top_k: { type: 'string', default: '5' },
            source_file: { type: 'string', default: '' },
            type: { type: 'string', default: '' },
        },
    });

    const query = positionals[0];
    if (!query) {
        console.error('Usage: node search_chunks.js "query" [--top_k N] [--source_file X] [--type Y]');
        process.exit(1);
    }

    const topK = parseInt(values.top_k, 10);
    const sourceFile = values.source_file || null;
    const fileType = values.type || null;

    const results = await search(query, { topK, sourceFile, fileType });

    console.log('\n' + '='.repeat(60));
    console.log(`Query: "${query}"`);
    if (sourceFile) console.log(`Filter: source_file ~ "${sourceFile}"`);
    if (fileType) console.log(`Filter: file_path ~ "${fileType}"`);
    console.log(`Results: ${results.length}`);
    console.log('='.repeat(60) + '\n');

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`--- Result ${i + 1} (score: ${r.similarity}) ---`);
        console.log(`  Source: ${r.source_file}`);
        console.log(`  Path:   ${r.file_path}`);
        console.log(`  Title:  ${r.title}`);
        if (r.parent_headings && r.parent_headings.length) {
            console.log(`  Section: ${r.parent_headings.join(' > ')}`);
        }
        console.log(`  Text:   ${r.text.slice(0, 200)}...`);
        console.log();
    }
}

main();
