/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  packageManager: 'npm',
  reporters: ['progress', 'clear-text', 'json'],
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'homework/M6/stage4-tests-agent/service-2-tests/jest.config.cjs',
    enableFindRelatedTests: false,
  },
  mutate: ['mcp-rag/index.js', 'mcp-rag/ingest.js'],
  coverageAnalysis: 'off',
  timeoutMS: 30000,
  timeoutFactor: 2,
  concurrency: 2,
  thresholds: { high: 80, low: 60, break: null },
  tempDirName: '.stryker-tmp-rag',
  htmlReporter: { fileName: 'reports/mutation/mcp-rag.html' },
  jsonReporter: { fileName: 'reports/mutation/mcp-rag.json' },
}
