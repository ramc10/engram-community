/**
 * Jest setup file
 * Registers custom matchers and global test configuration
 */

import { registerCustomMatchers } from './__utils__/assertions';
import '@testing-library/jest-dom';

// Register custom matchers
registerCustomMatchers();

// Note: Test timeout is configured in jest.config.js (testTimeout: 10000)

// Suppress console errors in tests (optional - comment out to debug)
// global.console.error = jest.fn();
// global.console.warn = jest.fn();
