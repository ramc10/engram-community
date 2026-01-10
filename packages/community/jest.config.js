/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/__mocks__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 65,
      functions: 70,
      lines: 70,
    },
    // Critical flows should have higher coverage
    './src/background/**/*.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    './src/lib/crypto-service.ts': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
    './src/lib/storage.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
  },

  // Module configuration
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@engram/core$': '<rootDir>/../core/src/index.ts',
    '^@engram/core/(.*)$': '<rootDir>/../core/src/$1',
    '^dexie$': '<rootDir>/../../node_modules/dexie/dist/dexie.js',
    '^edgevec$': '<rootDir>/tests/__mocks__/edgevec.ts',
    '@xenova/transformers': '<rootDir>/tests/__mocks__/@xenova/transformers.ts',
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/jest.setup.ts',
  ],

  // Test environment configuration
  testTimeout: 10000,
  transformIgnorePatterns: [
    'node_modules/(?!(dexie|@noble|hash-wasm)/)',
  ],

  // Globals
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },

  // Test categorization via testPathIgnorePatterns
  // To run specific test types:
  // - Unit: npm run test:unit (jest --testPathPattern=tests/unit)
  // - Integration: npm run test:integration (jest --testPathPattern=tests/integration)
  // - E2E: npm run test:e2e (jest --testPathPattern=tests/e2e)
  // - API: npm run test:api (jest --testPathPattern=tests/api-contract)
};
