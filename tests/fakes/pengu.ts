/**
 * In-memory stand-ins for what Pengu Loader gives a plugin: `window.DataStore` and the
 * `init(context)` argument. Two flavours:
 *   - 'legacy':   official releases up to 1.1.6. No `context.fs`, settings live in DataStore.
 *   - 'pluginfs': builds with PluginFS. `context.fs` is scoped to the plugin folder.
 * Each fake has `fail` switches to simulate the ways the real thing goes wrong.
 */

export type PenguFlavour = 'legacy' | 'pluginfs';

/** Fake `window.DataStore`. `disk` is what Pengu would have written to its datastore file. */
export class FakeDataStore {
    private data = new Map<string, any>();
    /** Serialized store after the last save, like the file on disk. */
    disk = '{}';
    /** Number of `set`/`remove` calls that changed the store (each one is a full save). */
    writes = 0;

    constructor(initial: Record<string, any> = {}) {
        this.data = new Map(Object.entries(initial));
        this.disk = JSON.stringify(initial);
    }

    /**
     * Simulates a client start: reloads the store from `disk`. Like Pengu, a file that
     * doesn't parse (e.g. truncated by a kill mid-write) silently becomes an empty store.
     */
    reload(disk = this.disk): void {
        try {
            this.data = new Map(Object.entries(JSON.parse(disk)));
        } catch {
            this.data = new Map();
        }
    }

    private save(): void {
        this.writes++;
        this.disk = JSON.stringify(Object.fromEntries(this.data));
    }

    has = (key: string): boolean => this.data.has(String(key));

    get = (key: string, fallback?: any): any => (this.data.has(key) ? this.data.get(key) : fallback);

    set = (key: string, value: any): boolean => {
        if (typeof key !== 'string') return false;
        this.data.set(key, value);
        this.save();
        return true;
    };

    remove = (key: string): boolean => {
        const removed = this.data.delete(String(key));
        if (removed) this.save();
        return removed;
    };
}

const norm = (path: string) => path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

/** Fake `context.fs` (PluginFS). Paths are relative to the plugin folder. */
export class FakePluginFS {
    files = new Map<string, string>();
    dirs = new Set<string>(['']);
    /** Number of successful `write` calls. */
    writes = 0;

    /** Failure switches. Set one, run the code under test, assert what it did. */
    fail = {
        /** `read` resolves undefined even though the file exists (flaky read). */
        read: false,
        /** `write` resolves false and changes nothing. */
        write: false,
        /** `write` throws. */
        writeThrows: false,
        /** `ls` resolves undefined. */
        ls: false,
        /** `mkdir` throws. */
        mkdirThrows: false,
    };

    /** Cuts a file short, like a write interrupted by the client being killed. */
    truncate(path: string, length: number): void {
        const key = norm(path);
        this.files.set(key, (this.files.get(key) ?? '').slice(0, length));
    }

    read = async (path: string): Promise<string | undefined> =>
        this.fail.read ? undefined : this.files.get(norm(path));

    write = async (path: string, content: string, options?: { append?: boolean }): Promise<boolean> => {
        if (this.fail.writeThrows) throw new Error('FakePluginFS: write failed');
        if (this.fail.write) return false;
        const key = norm(path);
        this.files.set(key, options?.append ? (this.files.get(key) ?? '') + content : content);
        this.writes++;
        return true;
    };

    mkdir = async (path: string): Promise<boolean> => {
        if (this.fail.mkdirThrows) throw new Error('FakePluginFS: mkdir failed');
        this.dirs.add(norm(path));
        return true;
    };

    stat = async (path: string) => {
        const key = norm(path);
        const fileName = key.split('/').pop() ?? '';
        if (this.files.has(key)) return { fileName, length: this.files.get(key)!.length, isDir: false };
        if (this.dirs.has(key)) return { fileName, length: 0, isDir: true };
        return undefined;
    };

    ls = async (path: string): Promise<string[] | undefined> => {
        const key = norm(path);
        if (this.fail.ls || !this.dirs.has(key)) return undefined;
        const prefix = key ? key + '/' : '';
        const names = [...this.files.keys(), ...this.dirs]
            .filter((p) => p !== key && p.startsWith(prefix))
            .map((p) => p.slice(prefix.length).split('/')[0]);
        return [...new Set(names)];
    };

    rm = async (path: string): Promise<number> => {
        const key = norm(path);
        const doomed = [...this.files.keys()].filter((p) => p === key || p.startsWith(key + '/'));
        doomed.forEach((p) => this.files.delete(p));
        return doomed.length + (this.dirs.delete(key) ? 1 : 0);
    };
}

/**
 * Installs a fake Pengu on `window` and returns the pieces.
 * `context` is what the theme's `init(context)` receives.
 */
export function installPengu(flavour: PenguFlavour, stored: Record<string, any> = {}) {
    const dataStore = new FakeDataStore(stored);
    const fs = new FakePluginFS();
    const context: any = { rcp: {}, socket: {}, meta: { name: 'elaina-theme' } };
    if (flavour === 'pluginfs') context.fs = fs;

    (globalThis as any).window ??= globalThis;
    (globalThis as any).DataStore = dataStore;

    return { context, dataStore, fs };
}
