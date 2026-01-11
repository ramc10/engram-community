/**
 * Mock implementation of Dexie for testing
 */

import { jest } from '@jest/globals';

export class Dexie {
  public memories: any;
  public conversations: any;
  public metadata: any;
  public syncQueue: any;
  public searchIndex: any;
  public devices: any;
  public syncOperations: any;
  public hnswIndex: any;

  private _dbName: string;
  private _mockTables: Map<string, any> = new Map();

  constructor(dbName: string) {
    this._dbName = dbName;

    // Ensure version method is bound to this instance
    this.version = this.version.bind(this);
  }

  /**
   * Mock version() method for schema definition
   * Returns a mock object with stores() method for chaining
   */
  version(_versionNumber: number): any {
    const self = this;

    // Create chainable version builder
    const versionBuilder = {
      stores: (schema: Record<string, string>) => {
        // Initialize mock tables based on schema
        Object.keys(schema).forEach((tableName) => {
          if (!self._mockTables.has(tableName)) {
            // Create a default mock table
            const mockTable = self._createMockTable(tableName);
            self._mockTables.set(tableName, mockTable);
            // @ts-ignore - Dynamically assign table to Dexie instance
            self[tableName] = mockTable;
          }
        });
        // Return builder to allow chaining .upgrade()
        return versionBuilder;
      },
      upgrade: (fn: any) => {
        // Mock upgrade callback - don't actually run it
        // Return the Dexie instance for further chaining
        return self;
      },
    };

    return versionBuilder;
  }

  /**
   * Mock open() method
   */
  async open() {
    return this;
  }

  /**
   * Mock close() method
   */
  close() {
    // No-op for mock
  }

  /**
   * Mock delete() method
   */
  async delete() {
    return undefined;
  }

  /**
   * Mock table() method
   */
  table(tableName: string) {
    if (this._mockTables.has(tableName)) {
      return this._mockTables.get(tableName);
    }
    // @ts-ignore
    return this[tableName];
  }

  /**
   * Helper to create a mock table with common Dexie table methods
   */
  private _createMockTable(tableName: string) {
    return {
      put: jest.fn<any>().mockResolvedValue(undefined),
      add: jest.fn<any>().mockResolvedValue(undefined),
      get: jest.fn<any>().mockResolvedValue(null),
      update: jest.fn<any>().mockResolvedValue(1),
      delete: jest.fn<any>().mockResolvedValue(undefined),
      clear: jest.fn<any>().mockResolvedValue(undefined),
      bulkPut: jest.fn<any>().mockResolvedValue(undefined),
      bulkAdd: jest.fn<any>().mockResolvedValue(undefined),
      bulkDelete: jest.fn<any>().mockResolvedValue(undefined),
      bulkGet: jest.fn<any>().mockResolvedValue([]),
      count: jest.fn<any>().mockResolvedValue(0),
      toArray: jest.fn<any>().mockResolvedValue([]),
      toCollection: jest.fn<any>().mockReturnThis(),
      where: jest.fn<any>().mockReturnThis(),
      filter: jest.fn<any>().mockReturnThis(),
      equals: jest.fn<any>().mockReturnThis(),
      above: jest.fn<any>().mockReturnThis(),
      below: jest.fn<any>().mockReturnThis(),
      between: jest.fn<any>().mockReturnThis(),
      anyOf: jest.fn<any>().mockReturnThis(),
      anyOfIgnoreCase: jest.fn<any>().mockReturnThis(),
      noneOf: jest.fn<any>().mockReturnThis(),
      startsWithIgnoreCase: jest.fn<any>().mockReturnThis(),
      equalsIgnoreCase: jest.fn<any>().mockReturnThis(),
      notEqual: jest.fn<any>().mockReturnThis(),
      startsWith: jest.fn<any>().mockReturnThis(),
      endsWith: jest.fn<any>().mockReturnThis(),
      limit: jest.fn<any>().mockReturnThis(),
      offset: jest.fn<any>().mockReturnThis(),
      reverse: jest.fn<any>().mockReturnThis(),
      orderBy: jest.fn<any>().mockReturnThis(),
      sortBy: jest.fn<any>().mockResolvedValue([]),
      each: jest.fn<any>().mockResolvedValue(undefined),
      first: jest.fn<any>().mockResolvedValue(null),
      last: jest.fn<any>().mockResolvedValue(null),
      keys: jest.fn<any>().mockResolvedValue([]),
      primaryKeys: jest.fn<any>().mockResolvedValue([]),
      uniqueKeys: jest.fn<any>().mockResolvedValue([]),
      modify: jest.fn<any>().mockResolvedValue(0),
      or: jest.fn<any>().mockReturnThis(),
      and: jest.fn<any>().mockReturnThis(),
    };
  }

  /**
   * Set custom mock table for testing
   */
  setMockTable(tableName: string, mockTable: any) {
    this._mockTables.set(tableName, mockTable);
    // @ts-ignore
    this[tableName] = mockTable;
  }
}

// Mock Table type (Dexie uses this for typed table references)
export class Table<T = any, TKey = any> {
  constructor() {}
}

export default Dexie;
