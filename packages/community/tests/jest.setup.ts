/**
 * Jest setup file
 * Registers custom matchers and global test configuration
 */

import { registerCustomMatchers } from './__utils__/assertions';
import '@testing-library/jest-dom';

// Register custom matchers
registerCustomMatchers();

// Extend timeout for integration tests
jest.setTimeout(10000);

// Suppress console errors in tests (optional - comment out to debug)
// global.console.error = jest.fn();
// global.console.warn = jest.fn();
