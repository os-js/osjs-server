module.exports = {
  collectCoverage: true,
  coverageReporters: ['lcov'],

  moduleNameMapper: {
    '^osjs$': '<rootDir>/__mocks__/core.js',
    '^signale$': '<rootDir>/__mocks__/signale.js'
  },

  coveragePathIgnorePatterns: [
    'src/esdoc.js',
    'src/config.js',
    'src/providers',
    '/node_modules/'
  ]
};
