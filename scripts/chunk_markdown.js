#!/usr/bin/env node
/**
 * Markdown chunker for docs/project-data.
 * Splits markdown files into semantic chunks based on heading structure.
 * Output: docs/project-data/chunks.jsonl
 *
 * Usage: node scripts/chunk_markdown.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = resolve(__dirname, '..', 'docs', 'project-data');
const OUTPUT_FILE = join(BASE_DIR, 'chunks.jsonl');

const TARGET_TOKENS = 400;
const MAX_TOKENS = 600;
const MIN_TOKENS = 50;

function estimateTokens(text) {
    return Math.floor(text.length / 4);
}

function detectLanguage(text) {
    const cyrillic = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
    const totalAlpha = (text.match(/[a-zA-Zа-яА-ЯёЁ]/g) || []).length;
    if (totalAlpha === 0) return 'en';
    return cyrillic / totalAlpha > 0.3 ? 'ru' : 'en';
}

function extractKeywords(text) {
    const keywords = new Set();

    // PascalCase words (component names)
    const pascal = text.match(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g);
    if (pascal) pascal.forEach((w) => keywords.add(w));

    // camelCase (function/variable names)
    const camel = text.match(/\b([a-z]+(?:[A-Z][a-z]+)+)\b/g);
    if (camel) camel.forEach((w) => keywords.add(w));

    // Backtick-wrapped code terms
    const backtick = text.match(/`([^`]{2,30})`/g);
    if (backtick) backtick.forEach((w) => keywords.add(w.replace(/`/g, '')));

    // Known tech terms
    const techTerms = [
        'Redux', 'React', 'Express', 'MongoDB', 'Mongoose', 'JWT', 'PayPal',
        'Stripe', 'localStorage', 'axios', 'Node.js', 'REST', 'API',
        'middleware', 'controller', 'reducer', 'action', 'thunk', 'multer',
        'bcrypt', 'Bootstrap', 'Docker', 'nginx', 'PostgreSQL', 'pgvector'
    ];
    const textLower = text.toLowerCase();
    for (const term of techTerms) {
        if (textLower.includes(term.toLowerCase())) {
            keywords.add(term);
        }
    }

    return [...keywords].sort().slice(0, 7);
}

function generateSummary(text, headings) {
    const lines = text.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
    if (!lines.length) {
        return headings.length ? headings.join(' > ') : '';
    }

    const firstLine = lines[0];
    if (firstLine.length <= 150) return firstLine;

    const match = firstLine.match(/^(.{50,150}[.!?])\s/);
    if (match) return match[1];
    return firstLine.slice(0, 150) + '...';
}

function parseMarkdownSections(content) {
    const sections = [];
    const currentHeadings = {};
    let currentTextLines = [];
    let currentLevel = 0;

    const lines = content.split('\n');

    for (const line of lines) {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            if (currentTextLines.length) {
                const text = currentTextLines.join('\n').trim();
                if (text) {
                    const breadcrumbs = Object.keys(currentHeadings)
                        .map(Number)
                        .sort((a, b) => a - b)
                        .filter((lvl) => lvl > 1)
                        .map((lvl) => currentHeadings[lvl]);
                    sections.push({ text, headings: breadcrumbs, level: currentLevel });
                }
                currentTextLines = [];
            }

            const level = headingMatch[1].length;
            const headingText = headingMatch[2].trim();
            currentLevel = level;
            currentHeadings[level] = headingText;
            // Clear deeper headings
            for (const k of Object.keys(currentHeadings).map(Number)) {
                if (k > level) delete currentHeadings[k];
            }
        } else {
            currentTextLines.push(line);
        }
    }

    // Last section
    if (currentTextLines.length) {
        const text = currentTextLines.join('\n').trim();
        if (text) {
            const breadcrumbs = Object.keys(currentHeadings)
                .map(Number)
                .sort((a, b) => a - b)
                .filter((lvl) => lvl > 1)
                .map((lvl) => currentHeadings[lvl]);
            sections.push({ text, headings: breadcrumbs, level: currentLevel });
        }
    }

    return sections;
}

function splitTable(text) {
    const lines = text.split('\n');
    const headerLines = [];
    const dataLines = [];
    let inHeader = true;

    for (const line of lines) {
        if (inHeader) {
            headerLines.push(line);
            if (/^\|[-:\s|]+\|$/.test(line.trim())) {
                inHeader = false;
            }
        } else if (line.trim()) {
            dataLines.push(line);
        }
    }

    if (!dataLines.length) return [text];

    const header = headerLines.join('\n');
    const headerTokens = estimateTokens(header);
    const chunks = [];
    let currentRows = [];
    let currentSize = headerTokens;

    for (const row of dataLines) {
        const rowTokens = estimateTokens(row);
        if (currentSize + rowTokens > MAX_TOKENS && currentRows.length) {
            chunks.push(header + '\n' + currentRows.join('\n'));
            currentRows = [row];
            currentSize = headerTokens + rowTokens;
        } else {
            currentRows.push(row);
            currentSize += rowTokens;
        }
    }

    if (currentRows.length) {
        chunks.push(header + '\n' + currentRows.join('\n'));
    }

    return chunks;
}

function splitLargeSection(text, target = TARGET_TOKENS) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;

    for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);

        // If a single paragraph is too large, split it
        if (paraTokens > MAX_TOKENS) {
            if (currentChunk.length) {
                chunks.push(currentChunk.join('\n\n'));
                currentChunk = [];
                currentSize = 0;
            }

            const paraLines = para.trim().split('\n');
            const isTable = paraLines.slice(0, 3).some((l) => /^\|.*\|$/.test(l.trim()));
            if (isTable) {
                chunks.push(...splitTable(para));
            } else {
                let group = [];
                let groupSize = 0;
                for (const line of paraLines) {
                    const lineTokens = estimateTokens(line);
                    if (groupSize + lineTokens > MAX_TOKENS && group.length) {
                        chunks.push(group.join('\n'));
                        group = [line];
                        groupSize = lineTokens;
                    } else {
                        group.push(line);
                        groupSize += lineTokens;
                    }
                }
                if (group.length) chunks.push(group.join('\n'));
            }
            continue;
        }

        if (currentSize + paraTokens > MAX_TOKENS && currentChunk.length) {
            const chunkText = currentChunk.join('\n\n');
            chunks.push(chunkText);
            // Overlap: keep last sentence of previous chunk
            const lastSentences = currentChunk[currentChunk.length - 1].match(/[^.!?]*[.!?]/g);
            if (lastSentences && lastSentences.length > 1) {
                const overlap = lastSentences[lastSentences.length - 1].trim();
                currentChunk = [overlap, para];
                currentSize = estimateTokens(overlap) + paraTokens;
            } else {
                currentChunk = [para];
                currentSize = paraTokens;
            }
        } else {
            currentChunk.push(para);
            currentSize += paraTokens;
        }
    }

    if (currentChunk.length) {
        chunks.push(currentChunk.join('\n\n'));
    }

    return chunks;
}

function getTitle(content) {
    const match = content.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : '';
}

function findMarkdownFiles(dir) {
    const results = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            results.push(...findMarkdownFiles(full));
        } else if (entry.endsWith('.md')) {
            results.push(full);
        }
    }
    return results.sort();
}

function processFile(filepath) {
    const content = readFileSync(filepath, 'utf-8');
    const relativePath = relative(resolve(__dirname, '..'), filepath);
    const sourceFile = relative(BASE_DIR, filepath);
    const title = getTitle(content);

    const sections = parseMarkdownSections(content);
    const chunks = [];

    // Merge tiny sections with next sibling
    const mergedSections = [];
    let i = 0;
    while (i < sections.length) {
        const section = sections[i];
        let tokens = estimateTokens(section.text);

        if (tokens < MIN_TOKENS && i + 1 < sections.length) {
            let mergedText = section.text;
            let headings = section.headings;
            const level = section.level;
            i++;
            while (i < sections.length && estimateTokens(mergedText) < MIN_TOKENS) {
                mergedText += '\n\n' + sections[i].text;
                if (!headings.length) headings = sections[i].headings;
                i++;
            }
            mergedSections.push({ text: mergedText, headings, level });
        } else {
            mergedSections.push(section);
            i++;
        }
    }

    for (const section of mergedSections) {
        const tokens = estimateTokens(section.text);
        const makeMeta = (text) => ({
            source_file: sourceFile,
            file_path: relativePath,
            title,
            parent_headings: section.headings,
            keywords: extractKeywords(text),
            summary: generateSummary(text, section.headings),
            language: detectLanguage(text)
        });

        if (tokens <= MAX_TOKENS) {
            chunks.push({ text: section.text, metadata: makeMeta(section.text) });
        } else {
            const subChunks = splitLargeSection(section.text);
            for (const chunkText of subChunks) {
                chunks.push({ text: chunkText, metadata: makeMeta(chunkText) });
            }
        }
    }

    return chunks;
}

function main() {
    const mdFiles = findMarkdownFiles(BASE_DIR);
    console.log(`Processing ${mdFiles.length} markdown files...`);

    const allChunks = [];
    for (const filepath of mdFiles) {
        const fileChunks = processFile(filepath);
        allChunks.push(...fileChunks);
        console.log(`  ${relative(BASE_DIR, filepath)}: ${fileChunks.length} chunks`);
    }

    // Write JSONL
    const lines = allChunks.map((c) => JSON.stringify(c));
    writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n', 'utf-8');

    // Stats
    const tokenCounts = allChunks.map((c) => estimateTokens(c.text));
    const sorted = [...tokenCounts].sort((a, b) => a - b);
    console.log('\n--- Results ---');
    console.log(`Total chunks: ${allChunks.length}`);
    console.log(`Output: ${OUTPUT_FILE}`);
    console.log(`Token stats: min=${sorted[0]}, max=${sorted[sorted.length - 1]}, ` +
        `avg=${Math.floor(tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length)}, ` +
        `median=${sorted[Math.floor(sorted.length / 2)]}`);

    const langs = {};
    for (const c of allChunks) {
        const lang = c.metadata.language;
        langs[lang] = (langs[lang] || 0) + 1;
    }
    console.log(`Languages: ${JSON.stringify(langs)}`);
}

main();
