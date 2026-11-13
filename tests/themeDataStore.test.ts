import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPengu, type PenguFlavour } from './fakes/pengu';

const FILE = 'data/ElainaData.json';
const BACKUP = 'data/ElainaData.json.bak';

type Pengu = ReturnType<typeof installPengu>;

/** A client start on the given Pengu: fresh ElainaData singleton (the module keeps state). */
async function start(pengu: Pengu, flavour: PenguFlavour) {
    const context = { ...pengu.context, fs: flavour === 'pluginfs' ? pengu.fs : undefined };
    vi.resetModules();
    const { ElainaData } = await import('../src/src/utils/themeDataStore');
    return { ...pengu, context, ElainaData };
}

/** Fresh fake Pengu plus a fresh ElainaData. */
const boot = (flavour: PenguFlavour, stored: Record<string, any> = {}) => start(installPengu(flavour, stored), flavour);

const fileJson = (fs: { files: Map<string, string> }) => JSON.parse(fs.files.get(FILE)!);
const closeClient = () => window.dispatchEvent(new Event('pagehide'));

beforeEach(() => {
    // The theme logs through console; keep test output readable.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ElainaData before init', () => {
    it('refuses reads and writes', async () => {
        const { ElainaData, dataStore } = await boot('legacy', { ElainaTheme: { a: 1 } });
        expect(ElainaData.get('a', 'fallback')).toBe('fallback');
        expect(ElainaData.set('a', 2)).toBe(false);
        expect(dataStore.writes).toBe(0);
    });
});

describe('ElainaData on Pengu without PluginFS (datastore mode)', () => {
    it('uses DataStore when context.fs is missing', async () => {
        const { ElainaData, context } = await boot('legacy');
        await ElainaData.init(context);
        expect(ElainaData.getStorageMode()).toBe('datastore');
        await expect(ElainaData.ready).resolves.toBeUndefined();
    });

    it('reads and writes under the ElainaTheme key', async () => {
        const { ElainaData, context, dataStore } = await boot('legacy', {
            ElainaTheme: { CurrentFont: 'Elaina.ttf' },
            OtherPlugin: { keep: true },
        });
        await ElainaData.init(context);

        expect(ElainaData.get('CurrentFont')).toBe('Elaina.ttf');
        expect(ElainaData.get('missing', 'fallback')).toBe('fallback');
        expect(ElainaData.has('CurrentFont')).toBe(true);

        expect(ElainaData.set('Dev-mode', true)).toBe(true);
        expect(ElainaData.remove('CurrentFont')).toBe(true);
        expect(ElainaData.remove('CurrentFont')).toBe(false);
        await ElainaData.flush();

        expect(JSON.parse(dataStore.disk)).toMatchObject({
            ElainaTheme: { 'Dev-mode': true },
            OtherPlugin: { keep: true },
        });
        expect(JSON.parse(dataStore.disk).ElainaTheme).not.toHaveProperty('CurrentFont');
    });

    it('getAll and setAll cover the whole store', async () => {
        const { ElainaData, context } = await boot('legacy', { ElainaTheme: { a: 1 } });
        await ElainaData.init(context);
        expect(ElainaData.getAll()).toEqual({ a: 1 });
        ElainaData.setAll({ b: 2 });
        expect(ElainaData.getAll()).toEqual({ b: 2 });
    });

    it('saves a burst of sets with one DataStore write', async () => {
        const { ElainaData, context, dataStore } = await boot('legacy');
        await ElainaData.init(context);
        const before = dataStore.writes;

        for (let i = 0; i < 50; i++) ElainaData.set(`key-${i}`, i);
        await ElainaData.flush();

        expect(dataStore.writes - before).toBe(1);
        expect(Object.keys(JSON.parse(dataStore.disk).ElainaTheme)).toHaveLength(50);
    });

    it('saves without an explicit flush', async () => {
        const { ElainaData, context, dataStore } = await boot('legacy');
        await ElainaData.init(context);
        ElainaData.set('a', 1);
        await Promise.resolve();
        expect(JSON.parse(dataStore.disk).ElainaTheme).toEqual({ a: 1 });
    });
});

describe('ElainaData on Pengu with PluginFS (fs mode)', () => {
    it('migrates DataStore settings into the data file on first run', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs', { ElainaTheme: { CurrentFont: 'Elaina.ttf' } });
        await ElainaData.init(context);

        expect(ElainaData.getStorageMode()).toBe('fs');
        expect(ElainaData.get('CurrentFont')).toBe('Elaina.ttf');
        expect(fileJson(fs)).toEqual({ CurrentFont: 'Elaina.ttf' });
    });

    it('starts empty when there is nothing to migrate', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs');
        await ElainaData.init(context);
        expect(ElainaData.getAll()).toEqual({});
        expect(fileJson(fs)).toEqual({});
    });

    it('prefers an existing data file over DataStore', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs', { ElainaTheme: { CurrentFont: 'old.ttf' } });
        fs.files.set(FILE, JSON.stringify({ CurrentFont: 'new.ttf' }));
        await ElainaData.init(context);
        expect(ElainaData.get('CurrentFont')).toBe('new.ttf');
    });

    it('persists set and remove to the file, not to DataStore', async () => {
        const { ElainaData, context, fs, dataStore } = await boot('pluginfs');
        await ElainaData.init(context);
        const before = dataStore.writes;

        ElainaData.set('a', 1);
        ElainaData.set('b', 2);
        ElainaData.remove('a');
        await ElainaData.flush();

        expect(fileJson(fs)).toEqual({ b: 2 });
        expect(dataStore.writes).toBe(before);
    });

    it('coalesces a burst of sets into a few file writes', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs');
        await ElainaData.init(context);
        const before = fs.writes;

        for (let i = 0; i < 50; i++) ElainaData.set('counter', i);
        await ElainaData.flush();

        expect(fileJson(fs)).toEqual({ counter: 49 });
        expect(fs.writes - before).toBeLessThanOrEqual(2);
    });

    it('keeps the value in memory when a write fails', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs');
        await ElainaData.init(context);

        fs.fail.write = true;
        ElainaData.set('a', 1);
        await ElainaData.flush();
        expect(ElainaData.get('a')).toBe(1);

        fs.fail.write = false;
        fs.fail.writeThrows = true;
        ElainaData.set('b', 2);
        await ElainaData.flush();
        expect(ElainaData.get('b')).toBe(2);
    });

    it('falls back to DataStore mode when fs init throws', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs', { ElainaTheme: { a: 1 } });
        fs.fail.mkdirThrows = true;
        await ElainaData.init(context);
        expect(ElainaData.getStorageMode()).toBe('datastore');
        expect(ElainaData.get('a')).toBe(1);
    });

    it('still boots on a truncated data file', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs', { ElainaTheme: { a: 'from-datastore' } });
        fs.files.set(FILE, JSON.stringify({ a: 'from-file', b: 2 }));
        fs.truncate(FILE, 10);
        await ElainaData.init(context);
        expect(ElainaData.getStorageMode()).toBe('fs');
        expect(ElainaData.get('a')).toBe('from-datastore');
    });

    it('does not rewrite a data file it loaded fine', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs');
        const saved = JSON.stringify({ a: 1 });
        fs.files.set(FILE, saved);
        await ElainaData.init(context);
        expect(fs.files.get(FILE)).toBe(saved);
    });

    it('keeps a backup of the last data file that loaded fine', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs');
        fs.files.set(FILE, JSON.stringify({ a: 1 }));
        await ElainaData.init(context);
        expect(JSON.parse(fs.files.get(BACKUP)!)).toEqual({ a: 1 });
    });

    it('recovers a truncated data file from the backup', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs', { ElainaTheme: { a: 'stale' } });
        fs.files.set(BACKUP, JSON.stringify({ a: 'backup' }));
        fs.files.set(FILE, JSON.stringify({ a: 'latest' }));
        fs.truncate(FILE, 5);
        await ElainaData.init(context);

        expect(ElainaData.get('a')).toBe('backup');
        expect(fileJson(fs)).toEqual({ a: 'backup' });
    });

    it('never overwrites a data file it failed to read', async () => {
        const { ElainaData, context, fs } = await boot('pluginfs', { ElainaTheme: { a: 'stale' } });
        const saved = JSON.stringify({ a: 'good', b: 2 });
        fs.files.set(FILE, saved);
        fs.fail.read = true;
        await ElainaData.init(context);

        ElainaData.set('c', 3);
        await ElainaData.flush();
        fs.fail.read = false;

        expect(ElainaData.getStorageMode()).toBe('fs');
        expect(ElainaData.get('c')).toBe(3);
        expect(fs.files.get(FILE)).toBe(saved);
    });
});

describe('switching between Pengu with and without PluginFS', () => {
    it('copies fs-mode settings to DataStore only once in a while', async () => {
        vi.useFakeTimers();
        const { ElainaData, context, dataStore } = await boot('pluginfs');
        await ElainaData.init(context);
        const before = dataStore.writes;

        for (let i = 0; i < 20; i++) ElainaData.set('counter', i);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(dataStore.writes).toBe(before);

        await vi.advanceTimersByTimeAsync(5 * 60_000);
        expect(dataStore.writes).toBe(before + 1);
        expect(JSON.parse(dataStore.disk).ElainaTheme).toEqual({ counter: 19 });
    });

    it('copies fs-mode settings to DataStore when the client closes', async () => {
        const { ElainaData, context, dataStore } = await boot('pluginfs');
        await ElainaData.init(context);
        ElainaData.set('a', 1);
        closeClient();
        expect(JSON.parse(dataStore.disk).ElainaTheme).toEqual({ a: 1 });
    });

    it('keeps settings across new to old to new', async () => {
        const pengu = installPengu('pluginfs');

        const first = await start(pengu, 'pluginfs');
        await first.ElainaData.init(first.context);
        first.ElainaData.set('CurrentFont', 'set-on-new.ttf');
        await first.ElainaData.flush();
        closeClient();

        const downgraded = await start(pengu, 'legacy');
        await downgraded.ElainaData.init(downgraded.context);
        expect(downgraded.ElainaData.get('CurrentFont')).toBe('set-on-new.ttf');
        downgraded.ElainaData.set('CurrentFont', 'set-on-old.ttf');
        await downgraded.ElainaData.flush();

        const upgraded = await start(pengu, 'pluginfs');
        await upgraded.ElainaData.init(upgraded.context);
        expect(upgraded.ElainaData.get('CurrentFont')).toBe('set-on-old.ttf');
        expect(fileJson(pengu.fs)).toEqual({ CurrentFont: 'set-on-old.ttf' });
    });

    it('does not let an emptied DataStore replace the data file', async () => {
        const pengu = installPengu('pluginfs', { 'ElainaTheme-storage': 'datastore' });
        pengu.fs.files.set(FILE, JSON.stringify({ a: 1 }));
        const { ElainaData, context } = await start(pengu, 'pluginfs');
        await ElainaData.init(context);
        expect(ElainaData.get('a')).toBe(1);
    });
});
