import { describe, expect, it } from 'vitest';
import { FakeDataStore, FakePluginFS, installPengu } from './pengu';

describe('FakeDataStore', () => {
    it('counts writes and mirrors them to disk', () => {
        const store = new FakeDataStore({ a: 1 });
        store.set('b', 2);
        store.remove('a');
        store.remove('a');
        expect(store.writes).toBe(2);
        expect(JSON.parse(store.disk)).toEqual({ b: 2 });
    });

    it('comes back empty from a truncated file, like Pengu', () => {
        const store = new FakeDataStore({ a: 1 });
        store.reload(store.disk.slice(0, 3));
        expect(store.has('a')).toBe(false);
        expect(store.get('a', 'fallback')).toBe('fallback');
    });
});

describe('FakePluginFS', () => {
    it('reads, lists, stats and removes what was written', async () => {
        const fs = new FakePluginFS();
        await fs.mkdir('./assets/fonts');
        await fs.write('./assets/fonts/a.ttf', 'x');
        await fs.write('assets/fonts/a.ttf', 'y', { append: true });

        expect(await fs.read('./assets/fonts/a.ttf')).toBe('xy');
        expect(await fs.ls('./assets/fonts')).toEqual(['a.ttf']);
        expect(await fs.stat('./assets/fonts/a.ttf')).toEqual({ fileName: 'a.ttf', length: 2, isDir: false });
        expect(await fs.ls('./missing')).toBeUndefined();
        expect(await fs.rm('./assets/fonts')).toBe(2);
        expect(await fs.read('./assets/fonts/a.ttf')).toBeUndefined();
    });

    it('fails on demand', async () => {
        const fs = new FakePluginFS();
        await fs.mkdir('./data');
        await fs.write('./data/x.json', '{"a":1}');

        fs.fail.read = true;
        expect(await fs.read('./data/x.json')).toBeUndefined();
        fs.fail.ls = true;
        expect(await fs.ls('./data')).toBeUndefined();
        fs.fail.write = true;
        expect(await fs.write('./data/x.json', 'new')).toBe(false);
        fs.fail.writeThrows = true;
        await expect(fs.write('./data/x.json', 'new')).rejects.toThrow();

        fs.fail.read = false;
        fs.truncate('./data/x.json', 4);
        expect(await fs.read('./data/x.json')).toBe('{"a"');
    });
});

describe('installPengu', () => {
    it('gives context.fs only on the pluginfs flavour', () => {
        expect(installPengu('legacy').context.fs).toBeUndefined();
        expect(installPengu('pluginfs').context.fs).toBeInstanceOf(FakePluginFS);
    });
});
