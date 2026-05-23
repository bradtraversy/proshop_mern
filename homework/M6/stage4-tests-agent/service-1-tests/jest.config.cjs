const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../../../..')

module.exports = {
  rootDir: REPO_ROOT,
  testMatch: ['<rootDir>/homework/M6/stage4-tests-agent/service-1-tests/test-*.js'],
  testEnvironment: 'node',
  transform: {},
  testTimeout: 15000,
  moduleDirectories: [
    'node_modules',
    path.join(REPO_ROOT, 'mcp-features/node_modules'),
  ],
}
