import { modelCache } from '../src/ModelCache.js';

function createRequest(resolver) {
  const request = { onsuccess: null, onerror: null, error: null, result: undefined };
  resolver(request);
  return request;
}

function createFakeIndexedDB() {
  const databases = {};

  return {
    databases,
    open(name, version) {
      const request = {};
      setTimeout(() => {
        if (!databases[name]) {
          databases[name] = { stores: {} };
          if (request.onupgradeneeded) {
            const db = {
              objectStoreNames: {
                contains: (storeName) => Boolean(databases[name].stores[storeName]),
              },
              createObjectStore: (storeName) => {
                databases[name].stores[storeName] = new Map();
              },
            };
            request.onupgradeneeded({ target: { result: db } });
          }
        }
        const db = {
          objectStoreNames: {
            contains: (storeName) => Boolean(databases[name].stores[storeName]),
          },
          createObjectStore: () => {},
          transaction: (storeNames, mode) => {
            const storeName = storeNames[0];
            const store = databases[name].stores[storeName];
            return {
              objectStore: () => ({
                get: (key) => createRequest((req) => {
                  setTimeout(() => {
                    req.result = store.get(key);
                    req.onsuccess && req.onsuccess();
                  }, 0);
                }),
                put: (value, key) => createRequest((req) => {
                  setTimeout(() => {
                    store.set(key, value);
                    req.onsuccess && req.onsuccess();
                  }, 0);
                }),
                clear: () => createRequest((req) => {
                  setTimeout(() => {
                    store.clear();
                    req.onsuccess && req.onsuccess();
                  }, 0);
                }),
              }),
            };
          },
        };
        request.result = db;
        request.onsuccess && request.onsuccess();
      }, 0);
      return request;
    },
  };
}

describe('ModelCache', () => {
  let fakeIndexedDB;
  let originalIndexedDB;
  let originalFetch;

  beforeEach(() => {
    fakeIndexedDB = createFakeIndexedDB();
    originalIndexedDB = global.indexedDB;
    originalFetch = global.fetch;
    global.indexedDB = fakeIndexedDB;
    global.fetch = jest.fn();
    modelCache.db = null;
  });

  afterEach(() => {
    global.indexedDB = originalIndexedDB;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const mockFetchOk = (bytes = 8) => {
    global.fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(bytes)),
    });
  };

  const mockFetchFail = () => {
    global.fetch.mockResolvedValue({ ok: false });
  };

  test('init opens the database and creates the models store', async () => {
    const db = await modelCache.init();

    expect(db).toBeDefined();
    expect(db.objectStoreNames.contains('models')).toBe(true);
  });

  test('init reuses an existing database connection', async () => {
    const first = await modelCache.init();
    const second = await modelCache.init();

    expect(second).toBe(first);
  });

  test('getModel fetches from the network and caches the model', async () => {
    mockFetchOk();

    const model = await modelCache.getModel('https://example.com/model.task');

    expect(model).toBeInstanceOf(Uint8Array);
    expect(model.byteLength).toBe(8);
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/model.task');
  });

  test('getModel serves a cached model without hitting the network again', async () => {
    mockFetchOk();

    const first = await modelCache.getModel('https://example.com/model.task');
    const second = await modelCache.getModel('https://example.com/model.task');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  test('getModel throws when the fetch response is not ok', async () => {
    mockFetchFail();

    await expect(modelCache.getModel('https://example.com/missing.task'))
      .rejects.toThrow('Failed to fetch model: https://example.com/missing.task');
  });

  test('clear removes all cached models', async () => {
    mockFetchOk();

    await modelCache.getModel('https://example.com/model.task');
    await modelCache.clear();

    global.fetch.mockClear();
    mockFetchOk();
    await modelCache.getModel('https://example.com/model.task');

    expect(global.fetch).toHaveBeenCalled();
  });
});
