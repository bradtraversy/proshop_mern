const path = require('path')

module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  testMatch: ['<rootDir>/mcp-features/__tests__/test-*.js'],
  testEnvironment: 'node',
  transform: {},
  testTimeout: 15000,
}
