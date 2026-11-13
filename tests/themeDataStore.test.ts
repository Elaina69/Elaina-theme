import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPengu, type PenguFlavour } from './fakes/pengu';

const FILE = 'data/ElainaData.json';

/** Fresh fake Pengu plus a fresh ElainaData singleton (the module keeps state). */
async function boot(flavour: PenguFlavour, stored: Record<string, any> = {}) {
    const pengu = installPengu(flavour, stored);
    vi.resetModules();
    const { ElainaData } = await import('../src/src/utils/themeDataStore');
    return { ...pengu, ElainaData };
}

const fileJson = (fs: { files: Map<string, string> }) => JSON.parse(fs.files.get(FILE)!);

beforeEach(() => {
    // The theme logs through console; keep test output readable.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
    it('notifies committed changes and can unsubscribe without extra datastore writes', async () => {
        const { ElainaData, context, dataStore } = await boot('legacy', { ElainaTheme: { 'Dev-mode': true } });
        await ElainaData.init(context);
        const changes = vi.fn(); const stop = ElainaData.subscribe(changes);
        ElainaData.set('MCP-enabled', true); ElainaData.setAll({ 'MCP-enabled': false });
        expect(changes.mock.calls[1][0]).toContain('Dev-mode'); expect(dataStore.writes).toBe(2);
        stop(); ElainaData.set('MCP-enabled', true); expect(changes).toHaveBeenCalledTimes(2);
    });
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

        expect(JSON.parse(dataStore.disk)).toEqual({
            ElainaTheme: { 'Dev-mode': true },
            OtherPlugin: { keep: true },
        });
    });

    it('getAll and setAll cover the whole store', async () => {
        const { ElainaData, context } = await boot('legacy', { ElainaTheme: { a: 1 } });
        await ElainaData.init(context);
        expect(ElainaData.getAll()).toEqual({ a: 1 });
        ElainaData.setAll({ b: 2 });
        expect(ElainaData.getAll()).toEqual({ b: 2 });
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

        ElainaData.set('a', 1);
        ElainaData.set('b', 2);
        ElainaData.remove('a');
        await ElainaData.flush();

        expect(fileJson(fs)).toEqual({ b: 2 });
        expect(dataStore.writes).toBe(0);
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
});
