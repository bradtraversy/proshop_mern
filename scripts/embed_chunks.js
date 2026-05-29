#!/usr/bin/env node
/**
 * Embed chunks from chunks.jsonl using OpenAI text-embedding-3-small
 * and load them into pgvector (PostgreSQL).
 *
 * Usage: node scripts/embed_chunks.js
 *
 * Environment variables (from .env):
 *   OPENAI_API_KEY    — OpenAI API key
 *   POSTGRES_USER     — default: proshop
 *   POSTGRES_PASSWORD — default: proshop
 *   POSTGRES_DB       — default: proshop
 *   POSTGRES_HOST     — default: localhost
 *   POSTGRES_PORT     — default: 5432
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const CHUNKS_FILE = resolve(__dirname, '..', 'docs', 'project-data', 'chunks.jsonl');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const BATCH_SIZE = 100;

const DB_CONFIG = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'proshop',
    user: process.env.POSTGRES_USER || 'proshop',
    password: process.env.POSTGRES_PASSWORD || 'proshop',
};

async function initDb(client) {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await client.query(`
        CREATE TABLE IF NOT EXISTS chunks (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            source_file TEXT,
            file_path TEXT,
            title TEXT,
            parent_headings TEXT[],
            keywords TEXT[],
            summary TEXT,
            language TEXT,
            embedding vector(${EMBEDDING_DIM})
        );
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS chunks_embedding_idx
        ON chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 20);
    `);
}

function loadChunks(path) {
    const content = readFileSync(path, 'utf-8');
    return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
}

async function getEmbeddings(texts, openai) {
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: batch,
        });
        const batchEmbeddings = response.data.map((item) => item.embedding);
        allEmbeddings.push(...batchEmbeddings);

        if (i + BATCH_SIZE < texts.length) {
            await new Promise((r) => setTimeout(r, 500));
        }
        console.log(`  Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length} chunks`);
    }

    return allEmbeddings;
}

async function insertChunks(client, chunks, embeddings) {
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (let i = 0; i < chunks.length; i++) {
        const meta = chunks[i].metadata || {};
        const placeholders = [];

        // text
        params.push(chunks[i].text);
        placeholders.push(`$${paramIdx++}`);
        // source_file
        params.push(meta.source_file || null);
        placeholders.push(`$${paramIdx++}`);
        // file_path
        params.push(meta.file_path || null);
        placeholders.push(`$${paramIdx++}`);
        // title
        params.push(meta.title || null);
        placeholders.push(`$${paramIdx++}`);
        // parent_headings
        params.push(meta.parent_headings || []);
        placeholders.push(`$${paramIdx++}`);
        // keywords
        params.push(meta.keywords || []);
        placeholders.push(`$${paramIdx++}`);
        // summary
        params.push(meta.summary || null);
        placeholders.push(`$${paramIdx++}`);
        // language
        params.push(meta.language || null);
        placeholders.push(`$${paramIdx++}`);
        // embedding
        const embStr = '[' + embeddings[i].join(',') + ']';
        params.push(embStr);
        placeholders.push(`$${paramIdx++}::vector`);

        values.push(`(${placeholders.join(', ')})`);
    }

    // Insert in batches of 50 to avoid param limit
    const batchSize = 50;
    const paramsPerRow = 9;
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batchValues = values.slice(i, i + batchSize);
        const batchParams = params.slice(i * paramsPerRow, (i + batchSize) * paramsPerRow);

        // Re-index placeholders for this batch
        const reindexedValues = [];
        let idx = 1;
        for (let j = i; j < Math.min(i + batchSize, chunks.length); j++) {
            const meta = chunks[j].metadata || {};
            const embStr = '[' + embeddings[j].join(',') + ']';
            reindexedValues.push(
                `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::vector)`
            );
        }

        const batchParamsClean = [];
        for (let j = i; j < Math.min(i + batchSize, chunks.length); j++) {
            const meta = chunks[j].metadata || {};
            batchParamsClean.push(
                chunks[j].text,
                meta.source_file || null,
                meta.file_path || null,
                meta.title || null,
                meta.parent_headings || [],
                meta.keywords || [],
                meta.summary || null,
                meta.language || null,
                '[' + embeddings[j].join(',') + ']'
            );
        }

        const sql = `INSERT INTO chunks
            (text, source_file, file_path, title, parent_headings,
             keywords, summary, language, embedding)
            VALUES ${reindexedValues.join(', ')}`;

        await client.query(sql, batchParamsClean);
    }
}

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('ERROR: OPENAI_API_KEY not set. Add it to .env or export it.');
        process.exit(1);
    }

    console.log(`Loading chunks from ${CHUNKS_FILE}...`);
    const chunks = loadChunks(CHUNKS_FILE);
    console.log(`  Loaded ${chunks.length} chunks`);

    console.log(`Connecting to PostgreSQL at ${DB_CONFIG.host}:${DB_CONFIG.port}...`);
    const client = new pg.Client(DB_CONFIG);
    await client.connect();
    await initDb(client);
    console.log('  Database initialized (pgvector extension + chunks table)');

    console.log(`Generating embeddings with ${EMBEDDING_MODEL}...`);
    const openai = new OpenAI({ apiKey });
    const texts = chunks.map((c) => c.text);
    const embeddings = await getEmbeddings(texts, openai);
    console.log(`  Got ${embeddings.length} embeddings (${EMBEDDING_DIM} dimensions each)`);

    console.log('Inserting into PostgreSQL...');
    await insertChunks(client, chunks, embeddings);
    console.log(`  Inserted ${chunks.length} rows into chunks table`);

    await client.end();
    console.log('Done!');
}

main();
