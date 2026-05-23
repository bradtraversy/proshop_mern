const path = require('path')

module.exports = {
  rootDir: path.resolve(__dirname, '../../..'),
  testMatch: ['<rootDir>/homework/M6/stage2-fix-top3/tests/test-*.js'],
  testEnvironment: 'node',
  transform: {},
  testTimeout: 15000,
}
