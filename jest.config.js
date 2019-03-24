module.exports = {
  collectCoverage: true,
  coverageReporters: ['lcov'],

  moduleNameMapper: {
    '^osjs$': '<rootDir>/__mocks__/core.js'
  },

  coveragePathIgnorePatterns: [
    'src/esdoc.js',
    'src/config.js',
    'src/providers',
    '/node_modules/'
  ]
};
