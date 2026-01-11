// @ts-nocheck
import { jest } from '@jest/globals';

export class Dexie {
  constructor(dbName) {
    this._dbName = dbName;
    this._mockTables = new Map();
    this._data = new Map();
    this._primaryKeys = new Map();
    this.version = this.version.bind(this);
  }

  version(_versionNumber) {
    const self = this;
    return {
      stores: (schema) => {
        Object.keys(schema).forEach((tableName) => {
          const pk = schema[tableName].split(',')[0].trim().replace(/^[&|*]*/, '') || 'id';
          self._primaryKeys.set(tableName, pk);
          if (!self._data.has(tableName)) self._data.set(tableName, new Map());
          if (!self._mockTables.has(tableName)) {
            const mockTable = self._createMockTable(tableName);
            self._mockTables.set(tableName, mockTable);
            self[tableName] = mockTable;
          }
        });
        return { upgrade: (fn) => self };
      },
      upgrade: (fn) => self
    };
  }

  async open() { return this; }
  close() { }
  async delete() { return undefined; }
  table(tableName) { return this._mockTables.get(tableName) || this[tableName]; }

  _createCollection(items, tableMock) {
    let result = [...items];
    const collection = {
      toArray: jest.fn().mockImplementation(async () => result),
      count: jest.fn().mockImplementation(async () => result.length),
      limit: jest.fn().mockImplementation((n) => { result = result.slice(0, n); return collection; }),
      offset: jest.fn().mockImplementation((n) => { result = result.slice(n); return collection; }),
      reverse: jest.fn().mockImplementation(() => { result.reverse(); return collection; }),
      sortBy: jest.fn().mockImplementation(async (prop) => {
        result.sort((a, b) => (a[prop] > b[prop] ? 1 : -1));
        return result;
      }),
      filter: jest.fn().mockImplementation((fn) => { result = result.filter(fn); return collection; }),
      first: jest.fn().mockImplementation(async () => result[0]),
      last: jest.fn().mockImplementation(async () => result[result.length - 1]),
      each: jest.fn().mockImplementation(async (cb) => { for (const item of result) await cb(item); }),
      or: jest.fn().mockImplementation((idx) => tableMock && tableMock.where(idx)),
      and: jest.fn().mockImplementation((fn) => { result = result.filter(fn); return collection; })
    };
    return collection;
  }

  _createMockTable(tableName) {
    const tableStore = this._data.get(tableName);
    const pkField = this._primaryKeys.get(tableName) || 'id';
    const self = this;

    const putImpl = async (item) => {
      const pk = item[pkField];
      if (pk) tableStore.set(pk, item);
      return pk;
    };
    const bulkPutImpl = async (items) => {
      items.forEach(item => {
        const pk = item[pkField];
        if (pk) tableStore.set(pk, item);
      });
      return items[items.length - 1]?.[pkField];
    };
    const toArrayImpl = async () => Array.from(tableStore.values());

    const tableMock = {
      put: jest.fn().mockImplementation(putImpl),
      add: jest.fn().mockImplementation(putImpl),
      get: jest.fn().mockImplementation(async (key) => tableStore.get(key)),
      delete: jest.fn().mockImplementation(async (k) => tableStore.delete(k)),
      clear: jest.fn().mockImplementation(async () => tableStore.clear()),
      update: jest.fn().mockImplementation(async (key, changes) => {
        const item = tableStore.get(key);
        if (item) { Object.assign(item, changes); return 1; }
        return 0;
      }),
      bulkPut: jest.fn().mockImplementation(bulkPutImpl),
      bulkAdd: jest.fn().mockImplementation(bulkPutImpl),
      bulkGet: jest.fn().mockImplementation(async (keys) => keys.map(k => tableStore.get(k))),
      bulkDelete: jest.fn().mockImplementation(async (keys) => keys.forEach(k => tableStore.delete(k))),
      count: jest.fn().mockImplementation(async () => tableStore.size),
      toArray: jest.fn().mockImplementation(toArrayImpl),
      filter: jest.fn().mockImplementation((fn) => {
        const items = Array.from(tableStore.values()).filter(fn);
        return self._createCollection(items, tableMock);
      }),
      orderBy: jest.fn().mockImplementation((index) => {
        const items = Array.from(tableStore.values());
        items.sort((a, b) => (a[index] > b[index] ? 1 : -1));
        return self._createCollection(items, tableMock);
      }),
      where: jest.fn().mockImplementation((index) => {
        const items = Array.from(tableStore.values());
        return {
          equals: jest.fn().mockImplementation((val) => self._createCollection(items.filter(x => x[index] === val), tableMock)),
          above: jest.fn().mockImplementation((val) => self._createCollection(items.filter(x => x[index] > val), tableMock)),
          below: jest.fn().mockImplementation((val) => self._createCollection(items.filter(x => x[index] < val), tableMock)),
          between: jest.fn().mockImplementation((min, max) => self._createCollection(items.filter(x => x[index] >= min && x[index] <= max), tableMock)),
          anyOf: jest.fn().mockImplementation((...vals) => {
            const flatVals = vals.flat();
            return self._createCollection(items.filter(x => flatVals.includes(x[index])), tableMock);
          }),
          startsWith: jest.fn().mockImplementation((val) => self._createCollection(items.filter(x => typeof x[index] === 'string' && x[index].startsWith(val)), tableMock)),
          equalsIgnoreCase: jest.fn().mockImplementation((val) => self._createCollection(items.filter(x => typeof x[index] === 'string' && x[index].toLowerCase() === val.toLowerCase()), tableMock)),
          startsWithIgnoreCase: jest.fn().mockImplementation((val) => self._createCollection(items.filter(x => typeof x[index] === 'string' && x[index].toLowerCase().startsWith(val.toLowerCase())), tableMock)),
          or: jest.fn().mockImplementation((idx) => tableMock.where(idx))
        };
      }),
      limit: jest.fn().mockImplementation((n) => self._createCollection(Array.from(tableStore.values()), tableMock).limit(n)),
      offset: jest.fn().mockImplementation((n) => self._createCollection(Array.from(tableStore.values()), tableMock).offset(n)),
      reverse: jest.fn().mockImplementation(() => self._createCollection(Array.from(tableStore.values()), tableMock).reverse()),
      toCollection: jest.fn().mockImplementation(() => self._createCollection(Array.from(tableStore.values()), tableMock)),
      keys: jest.fn().mockResolvedValue(Array.from(tableStore.keys())),
      primaryKeys: jest.fn().mockResolvedValue(Array.from(tableStore.keys())),
    };
    return tableMock;
  }
  setMockTable(tableName, mockTable) {
    this._mockTables.set(tableName, mockTable);
    this[tableName] = mockTable;
  }
}
export class Table { constructor() { } }
export default Dexie;
