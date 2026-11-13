import { log, error } from './themeLog';

const DATA_FILE_PATH = './data/ElainaData.json';
/** Copy of the last data file that loaded fine. */
const BACKUP_FILE_PATH = './data/ElainaData.json.bak';
/** Pengu DataStore key that holds all theme settings. */
const STORE_KEY = 'ElainaTheme';
/** Pengu DataStore key that records which backend ran last: 'fs' or 'datastore'. */
const MODE_KEY = 'ElainaTheme-storage';
/** In fs mode, settings are copied to the Pengu DataStore at most this often (ms). */
const MIRROR_INTERVAL = 5 * 60 * 1000;

/** Mode of storage backend: 'fs' uses context.fs file, 'datastore' uses Pengu DataStore */
type StorageMode = 'fs' | 'datastore';

/** Parses a settings object; anything else (missing, damaged, not an object) gives null. */
function parseSettings(raw: string | undefined): Record<string, any> | null {
    if (!raw || raw.trim().length === 0) return null;
    try {
        const data = JSON.parse(raw);
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// FSDataMgr — file-system persistence helpers
// ---------------------------------------------------------------------------

class FSDataMgr {
    protected cache: Record<string, any> = {};
    protected fsContext: any = null;
    protected storageMode: StorageMode = 'datastore';
    /** True when the data file exists but could not be read: it must not be overwritten. */
    protected fileLocked = false;

    private pendingPersist: Promise<boolean> | null = null;
    private persistAgain = false;

    /**
     * Persist the in-memory cache to ./data/ElainaData.json via context.fs.
     * Writes synchronously (awaited) to guarantee data is saved.
     */
    async persistToFile(): Promise<boolean> {
        if (this.storageMode !== 'fs' || !this.fsContext || this.fileLocked) return false;
        try {
            const json = JSON.stringify(this.cache, null, 2);
            const success = await this.fsContext.fs.write(DATA_FILE_PATH, json, { append: false });
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
// ElainaData — unified API over both backends
// ---------------------------------------------------------------------------

class ElainaDataClass extends FSDataMgr {
    private initialized = false;
    private initPromiseResolve: (() => void) | null = null;

    /** True when the cache has changes that are not in the Pengu DataStore yet. */
    private dataStoreDirty = false;
    private mirrorTimer: ReturnType<typeof setTimeout> | null = null;

    /** A promise that resolves once ElainaData has been fully initialized. */
    readonly ready: Promise<void>;

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
        // Settings as the Pengu DataStore has them: the only copy on Pengu without PluginFS
        const stored: Record<string, any> = { ...window.DataStore.get(STORE_KEY, {}) };

        if (!context || !context.fs) {
            log('context.fs not available — using DataStore mode');
            this.useDataStoreMode(stored);
        } else {
            this.fsContext = context;
            try {
                const rewriteFile = await this.loadFromFile(context, stored);
                this.storageMode = 'fs';
                if (rewriteFile) await this.persistToFile();
                this.rememberMode('fs');
            } catch (err: any) {
                error('Failed to init ElainaData in fs mode, falling back to DataStore', err);
                this.useDataStoreMode(stored);
            }
        }

        this.initialized = true;
        // Last chance to save before the page goes away
        window.addEventListener('pagehide', () => this.saveToDataStore());
        this.initPromiseResolve?.();
    }

    /**
     * Fills the cache for fs mode.
     * @returns True when the data file has to be (re)written from the cache.
     */
    private async loadFromFile(context: any, stored: Record<string, any>): Promise<boolean> {
        await context.fs.mkdir('./data');

        const stat = await context.fs.stat(DATA_FILE_PATH);
        const raw: string | undefined = await context.fs.read(DATA_FILE_PATH);
        const fromFile = parseSettings(raw);

        // The client ran on a Pengu without PluginFS since the file was written, so the
        // DataStore copy is the newer one.
        if (window.DataStore.get(MODE_KEY) === 'datastore' && Object.keys(stored).length > 0) {
            this.cache = stored;
            log('ElainaData taken from DataStore, it was used last (fs mode)');
            return true;
        }

        if (fromFile) {
            this.cache = fromFile;
            log('ElainaData loaded from file (fs mode)');
            if (await context.fs.read(BACKUP_FILE_PATH) !== raw) {
                await context.fs.write(BACKUP_FILE_PATH, raw, { append: false });
            }
            return false;
        }

        const fileHasContent = (raw?.trim().length ?? 0) > 0 || (stat?.length ?? 0) > 0;
        if (!fileHasContent) {
            // No file yet — migrate from DataStore
            this.cache = stored;
            log(Object.keys(stored).length > 0
                ? 'Migrated ElainaData from DataStore to file (fs mode)'
                : 'Created new ElainaData file (fs mode)');
            return true;
        }

        // The file is there but unusable. Use the backup, then the DataStore copy.
        this.cache = parseSettings(await context.fs.read(BACKUP_FILE_PATH)) ?? stored;
        if (raw) {
            error('ElainaData.json is damaged, restored from backup or DataStore');
            return true;
        }
        // The read itself failed, so the file may be fine: leave it alone for this session.
        this.fileLocked = true;
        error('ElainaData.json could not be read. Changes in this session are not saved to it');
        return false;
    }

    private useDataStoreMode(stored: Record<string, any>): void {
        this.cache = stored;
        this.storageMode = 'datastore';
        this.rememberMode('datastore');
    }

    /** Records which backend is in use, so a later start knows which copy is newer. */
    private rememberMode(mode: StorageMode): void {
        if (window.DataStore.get(MODE_KEY) !== mode) window.DataStore.set(MODE_KEY, mode);
    }

    /** Called after every change to the cache. */
    private changed(): void {
        this.dataStoreDirty = true;

        if (this.storageMode === 'fs') {
            this.queuePersist();
            // Keep the DataStore copy roughly current for a switch back to a Pengu without
            // PluginFS. Rarely: every DataStore write rewrites all plugins' settings.
            this.mirrorTimer ??= setTimeout(() => this.saveToDataStore(), MIRROR_INTERVAL);
        } else {
            // One DataStore write for all changes made in the same tick.
            // ponytail: bursts spread over several ticks still write once per tick; use a
            // timer here if the 30 s write counter shows that matters.
            queueMicrotask(() => this.saveToDataStore());
        }
    }

    /** Writes the cache to the Pengu DataStore if it has unsaved changes. */
    private saveToDataStore(): void {
        if (this.mirrorTimer) clearTimeout(this.mirrorTimer);
        this.mirrorTimer = null;
        if (!this.dataStoreDirty) return;
        this.dataStoreDirty = false;
        window.DataStore.set(STORE_KEY, { ...this.cache });
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
        return this.cache.hasOwnProperty(key) ? this.cache[key] : fallback;
    }

    /**
     * Sets a value in the datastore.
     * Updates the in-memory cache right away; saving is batched.
     * @param key The key to set.
     * @param value The value to associate with the key.
     * @returns True if the key was set successfully, false otherwise.
     */
    set(key: string, value: any): boolean {
        if (!this.initialized) {
            error(`ElainaData.set("${key}") called before ElainaData.init()`);
            return false;
        }
        this.cache[key] = value;
        this.changed();
        return true;
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
        return this.cache.hasOwnProperty(key);
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
        if (!this.cache.hasOwnProperty(key)) return false;
        delete this.cache[key];
        this.changed();
        return true;
    }

    /**
     * Restores the default values of the theme in the datastore.
     */
    restoreDefaults(): void {
        this.setAll({});
        this.flush().finally(() => window.reloadClient());
    }

    /**
     * Returns the full data object (useful for backup/restore).
     */
    getAll(): Record<string, any> {
        return { ...this.cache };
    }

    /**
     * Replaces all data at once (useful for restore from backup).
     * @param data The full data object to set.
     */
    setAll(data: Record<string, any>): void {
        this.cache = { ...data };
        this.changed();
    }

    /** Returns the current storage mode. */
    getStorageMode(): StorageMode {
        return this.storageMode;
    }

    /** Saves all pending changes now: to the file in fs mode, to DataStore otherwise. */
    async flush(): Promise<void> {
        if (this.storageMode === 'fs') await this.queuePersist();
        else this.saveToDataStore();
    }
}

// ---------------------------------------------------------------------------
// Singleton instance & exports
// ---------------------------------------------------------------------------

const ElainaData = new ElainaDataClass();
const elainaDataReady = ElainaData.ready;

window.ElainaData = ElainaData;

export { ElainaData, elainaDataReady };
