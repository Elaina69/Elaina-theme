import { log, error } from './themeLog';

const elainaDataPath = './data/ElainaData.json';

/** Mode of storage backend: 'fs' uses context.fs file, 'datastore' uses Pengu DataStore */
type StorageMode = 'fs' | 'datastore';

// ---------------------------------------------------------------------------
// FSDataMgr — file-system persistence helpers
// ---------------------------------------------------------------------------

class FSDataMgr {
    protected cache: Record<string, any> = {};
    protected fsContext: any = null;
    protected storageMode: StorageMode = 'datastore';

    private pendingPersist: Promise<boolean> | null = null;
    private persistAgain = false;

    /**
     * Persist the in-memory cache to ./data/ElainaData.json via context.fs.
     * Writes synchronously (awaited) to guarantee data is saved.
     */
    async persistToFile(): Promise<boolean> {
        if (this.storageMode !== 'fs' || !this.fsContext) return false;
        try {
            const json = JSON.stringify(this.cache, null, 2);
            const success = await this.fsContext.fs.write(elainaDataPath, json, { append: false });
            if (!success) {
                error('context.fs.write returned false — data may not be persisted');
            }
            return success;
        } catch (err: any) {
            error('Failed to persist ElainaData to file', err);
            return false;
        }
    }

    /**
     * Queue a persist operation; coalesces multiple rapid writes into one.
     */
    queuePersist(): Promise<boolean> {
        if (this.pendingPersist) {
            this.persistAgain = true;
            return this.pendingPersist;
        }

        this.pendingPersist = (async () => {
            let success = true;
            do {
                this.persistAgain = false;
                success = await this.persistToFile();
            } while (this.persistAgain);
            return success;
        })().finally(() => {
            this.pendingPersist = null;
        });

        return this.pendingPersist;
    }
}

// ---------------------------------------------------------------------------
// DatastoreMgr — Pengu DataStore helpers (legacy fallback)
// ---------------------------------------------------------------------------

class DatastoreMgr {
    /**
     * Gets a value from the Pengu DataStore.
     */
    get(key: string, fallback: any = null): any {
        const data: Record<string, any> = window.DataStore.get("ElainaTheme", {});
        return data.hasOwnProperty(key) ? data[key] : fallback;
    }

    /**
     * Sets a value in the Pengu DataStore.
     */
    set(key: string, value: any): boolean {
        const data: Record<string, any> = window.DataStore.get("ElainaTheme", {});
        data[key] = value;
        window.DataStore.set("ElainaTheme", data);
        return data.hasOwnProperty(key);
    }

    /**
     * Checks if a key exists in the Pengu DataStore.
     */
    has(key: string): boolean {
        const data: Record<string, any> = window.DataStore.get("ElainaTheme", {});
        return data.hasOwnProperty(key);
    }

    /**
     * Removes a key from the Pengu DataStore.
     */
    remove(key: string): boolean {
        const data: Record<string, any> = window.DataStore.get("ElainaTheme", {});
        if (data.hasOwnProperty(key)) {
            delete data[key];
            window.DataStore.set("ElainaTheme", data);
            return true;
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// ElainaData — unified API, extends FSDataMgr & DatastoreMgr
// ---------------------------------------------------------------------------

// TypeScript does not support `extends` from two classes natively.
// We use a mixin approach: ElainaData extends FSDataMgr and mixes in DatastoreMgr.

interface ElainaDataClass extends FSDataMgr, DatastoreMgr {}

class ElainaDataClass extends FSDataMgr {
    private initialized = false;
    private initPromiseResolve: (() => void) | null = null;

    /** A promise that resolves once ElainaData has been fully initialized. */
    readonly ready: Promise<void>;

    private readonly datastoreMgr = new DatastoreMgr();

    constructor() {
        super();
        this.ready = new Promise<void>((resolve) => {
            this.initPromiseResolve = resolve;
        });
    }

    /**
     * Initialize ElainaData.
     * If context.fs is available, migrate or load data from ./data/ElainaData.json.
     * Otherwise fall back to Pengu DataStore.
     *
     * **Must be called (and awaited) before any other code uses ElainaData.**
     */
    async init(context: any): Promise<void> {
        // Check if context.fs is available
        if (!context || !context.fs) {
            log('context.fs not available — using DataStore mode');
            this.storageMode = 'datastore';
            this.initialized = true;
            this.initPromiseResolve?.();
            return;
        }

        this.fsContext = context;

        try {
            // Ensure ./data/ directory exists
            await context.fs.mkdir('./data');

            // Try to read existing file
            const raw = await context.fs.read(elainaDataPath);

            if (raw && raw.trim().length > 0) {
                // File exists and has content — parse and use as cache
                try {
                    this.cache = JSON.parse(raw);
                    log('ElainaData loaded from file (fs mode)');
                } catch (parseErr: any) {
                    error('Failed to parse ElainaData.json, migrating from DataStore', parseErr);
                    // File is corrupted — re-migrate from DataStore
                    this.cache = { ...window.DataStore.get("ElainaTheme", {}) };
                }
            } else {
                // File does not exist — migrate from DataStore
                const datastoreData: Record<string, any> = window.DataStore.get("ElainaTheme", {});

                if (Object.keys(datastoreData).length > 0) {
                    this.cache = { ...datastoreData };
                    log('Migrated ElainaData from DataStore to file (fs mode)');
                } else {
                    this.cache = {};
                    log('Created new ElainaData file (fs mode)');
                }
            }

            this.storageMode = 'fs';
            this.initialized = true;

            // Persist immediately to ensure file is up-to-date
            await this.persistToFile();

        } catch (err: any) {
            error('Failed to init ElainaData in fs mode, falling back to DataStore', err);
            this.storageMode = 'datastore';
            this.initialized = true;
        }

        this.initPromiseResolve?.();
    }

    /**
     * Gets a value from the datastore.
     * @param key The key to retrieve.
     * @param fallback The fallback value if the key doesn't exist.
     * @returns The value associated with the key or the fallback.
     */
    get(key: string, fallback: any = null): any {
        if (!this.initialized) {
            error(`ElainaData.get("${key}") called before ElainaData.init()`);
            return fallback;
        }

        if (this.storageMode === 'fs') {
            return this.cache.hasOwnProperty(key) ? this.cache[key] : fallback;
        }
        return this.datastoreMgr.get(key, fallback);
    }

    /**
     * Sets a value in the datastore.
     * In fs mode, updates in-memory cache and persists to file immediately.
     * @param key The key to set.
     * @param value The value to associate with the key.
     * @returns True if the key was set successfully, false otherwise.
     */
    set(key: string, value: any): boolean {
        if (!this.initialized) {
            error(`ElainaData.set("${key}") called before ElainaData.init()`);
            return false;
        }

        if (this.storageMode === 'fs') {
            this.cache[key] = value;
            this.queuePersist();
            return true;
        }
        return this.datastoreMgr.set(key, value);
    }

    /**
     * Checks if a key exists in the datastore.
     * @param key The key to check for existence.
     * @returns True if the key exists, false otherwise.
     */
    has(key: string): boolean {
        if (!this.initialized) {
            error(`ElainaData.has("${key}") called before ElainaData.init()`);
            return false;
        }

        if (this.storageMode === 'fs') {
            return this.cache.hasOwnProperty(key);
        }
        return this.datastoreMgr.has(key);
    }

    /**
     * Removes a key from the datastore.
     * @param key The key to remove.
     * @returns True if the key was removed, false otherwise.
     */
    remove(key: string): boolean {
        if (!this.initialized) {
            error(`ElainaData.remove("${key}") called before ElainaData.init()`);
            return false;
        }

        if (this.storageMode === 'fs') {
            if (this.cache.hasOwnProperty(key)) {
                delete this.cache[key];
                this.queuePersist();
                return true;
            }
            return false;
        }
        return this.datastoreMgr.remove(key);
    }

    /**
     * Restores the default values of the theme in the datastore.
     */
    restoreDefaults(): void {
        if (this.storageMode === 'fs') {
            this.cache = {};
            this.queuePersist();
        } else {
            window.DataStore.set("ElainaTheme", {});
        }
        window.reloadClient();
    }

    /**
     * Returns the full data object (useful for backup/restore).
     */
    getAll(): Record<string, any> {
        if (this.storageMode === 'fs') {
            return { ...this.cache };
        }
        return window.DataStore.get("ElainaTheme", {});
    }

    /**
     * Replaces all data at once (useful for restore from backup).
     * @param data The full data object to set.
     */
    setAll(data: Record<string, any>): void {
        if (this.storageMode === 'fs') {
            this.cache = { ...data };
            this.queuePersist();
        } else {
            window.DataStore.set("ElainaTheme", data);
        }
    }

    /** Returns the current storage mode. */
    getStorageMode(): StorageMode {
        return this.storageMode;
    }

    /** Force an immediate flush of cache to file (fs mode only). */
    async flush(): Promise<void> {
        await this.queuePersist();
    }
}

// ---------------------------------------------------------------------------
// Singleton instance & exports
// ---------------------------------------------------------------------------

const ElainaData = new ElainaDataClass();
const elainaDataReady = ElainaData.ready;

window.ElainaData = ElainaData;

export { ElainaData, elainaDataReady };
