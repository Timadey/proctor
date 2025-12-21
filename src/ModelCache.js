/**
 * ModelCache - Utility for caching AI models in IndexedDB
 * Provides a "batteries-included" persistence layer for MediaPipe .task files.
 */
const DB_NAME = 'SDProctor_Cache';
const STORE_NAME = 'models';
const DB_VERSION = 1;

class ModelCache {
    constructor() {
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    /**
     * Get a model from cache or fetch and store it
     * @param {string} url - The URL of the model file
     * @returns {Promise<Uint8Array>}
     */
    async getModel(url) {
        await this.init();

        // 1. Try to get from Cache
        const cached = await this._getFromIDB(url);
        if (cached) {
            console.log(`[ModelCache] Loaded from local storage: ${url}`);
            return new Uint8Array(cached);
        }

        // 2. Fetch from Network if not cached
        console.log(`[ModelCache] Fetching from network: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch model: ${url}`);

        const buffer = await response.arrayBuffer();

        // 3. Store in Cache for next time
        await this._storeInIDB(url, buffer);

        return new Uint8Array(buffer);
    }

    _getFromIDB(url) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(url);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _storeInIDB(url, buffer) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(buffer, url);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all cached models
     */
    async clear() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const modelCache = new ModelCache();
