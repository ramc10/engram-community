/**
 * Mock implementation of Dexie for testing
 */

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
      put: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      bulkPut: jest.fn().mockResolvedValue(undefined),
      bulkAdd: jest.fn().mockResolvedValue(undefined),
      bulkDelete: jest.fn().mockResolvedValue(undefined),
      bulkGet: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      toArray: jest.fn().mockResolvedValue([]),
      toCollection: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      equals: jest.fn().mockReturnThis(),
      above: jest.fn().mockReturnThis(),
      below: jest.fn().mockReturnThis(),
      between: jest.fn().mockReturnThis(),
      anyOf: jest.fn().mockReturnThis(),
      anyOfIgnoreCase: jest.fn().mockReturnThis(),
      noneOf: jest.fn().mockReturnThis(),
      startsWithIgnoreCase: jest.fn().mockReturnThis(),
      equalsIgnoreCase: jest.fn().mockReturnThis(),
      notEqual: jest.fn().mockReturnThis(),
      startsWith: jest.fn().mockReturnThis(),
      endsWith: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      reverse: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      sortBy: jest.fn().mockResolvedValue([]),
      each: jest.fn().mockResolvedValue(undefined),
      first: jest.fn().mockResolvedValue(null),
      last: jest.fn().mockResolvedValue(null),
      keys: jest.fn().mockResolvedValue([]),
      primaryKeys: jest.fn().mockResolvedValue([]),
      uniqueKeys: jest.fn().mockResolvedValue([]),
      modify: jest.fn().mockResolvedValue(0),
      or: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
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
