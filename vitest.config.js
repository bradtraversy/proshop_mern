import { defineConfig } from 'vitest/config'

// Vitest config for homework M6 characterization + service tests.
// Tests live under homework-m6/ (Stage 2 fixes, Stage 4 generated tests).
export default defineConfig({
  test: {
    include: [
      'homework-m6/stage2-fix-top3/tests/**/*.test.js',
      'homework-m6/stage4-tests-agent/**/*.test.{js,ts}',
      'mcp-server-feature-flags/__tests__/**/*.test.{js,ts}',
      'mcp-server-search-docs/__tests__/**/*.test.{js,ts}',
    ],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000, // mongodb-memory-server first boot can be slow
    fileParallelism: false, // each suite owns one in-memory Mongo
  },
})
