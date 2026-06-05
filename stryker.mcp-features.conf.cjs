/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  packageManager: 'npm',
  reporters: ['progress', 'clear-text', 'json'],
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'homework/M6/stage4-tests-agent/service-1-tests/jest.config.cjs',
    enableFindRelatedTests: false,
  },
  mutate: ['mcp-features/index.js'],
  coverageAnalysis: 'off',
  timeoutMS: 30000,
  timeoutFactor: 2,
  concurrency: 2,
  thresholds: { high: 80, low: 60, break: null },
  tempDirName: '.stryker-tmp-features',
  htmlReporter: { fileName: 'reports/mutation/mcp-features.html' },
  jsonReporter: { fileName: 'reports/mutation/mcp-features.json' },
}
