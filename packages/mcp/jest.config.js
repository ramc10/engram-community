module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@engram/core$': '<rootDir>/../core/src/index.ts',
    '^@engram/core/(.*)$': '<rootDir>/../core/src/$1',
  },
  testTimeout: 15000,
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|hash-wasm)/)',
  ],
};
