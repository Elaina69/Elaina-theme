import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { FakePluginFS } from './fakes/pengu';

vi.mock('../src/src/otherThings.ts', () => ({ pluginUrl: (...parts: string[]) => '//plugins/@scope/theme/' + parts.join('/') }));
import { McpConfigStore } from '../src/src/plugins/mcp-server/browser/configStore';

const config = { schemaVersion: 1, port: 8080, token: 'a'.repeat(64), penguPluginsPath: '' };

beforeEach(() => { vi.stubGlobal('Pengu', { version: '1.2.0' }); });
afterEach(() => vi.unstubAllGlobals());

describe('MCP file configuration compatibility', () => {
    it('reads legacy configuration from the local plugin URL and never writes through PluginFS', async () => {
        const fs = new FakePluginFS();
        const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(config)));
        vi.stubGlobal('fetch', fetch);
        const store = new McpConfigStore({ fs }, '1.1.6');
        expect(store.writable).toBe(false); expect(await store.read(true)).toEqual(config);
        expect(fetch.mock.calls[0][0]).toBe('//plugins/@scope/theme/mcp-server/config.local.json');
        expect(fs.writes).toBe(0); await expect(store.save(config)).rejects.toThrow('requires Pengu');
    });

    it('rereads legacy configuration after the launcher creates it', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response(JSON.stringify(config))));
        const store = new McpConfigStore({}, '1.1.6');
        await expect(store.read()).rejects.toThrow('missing');
        await expect(store.read()).resolves.toEqual(config);
    });

    it('initializes one random token from the example, then preserves the file', async () => {
        const fs = new FakePluginFS(); fs.files.set('mcp-server/config.example.json', JSON.stringify({ ...config, token: '' }));
        const store = new McpConfigStore({ fs }, '1.2.0');
        const [first, second] = await Promise.all([store.read(true), store.read(true)]);
        expect(first).toEqual(second); expect(first.token).toMatch(/^[a-f0-9]{64}$/); expect(fs.writes).toBe(1);
        expect((await store.read(true)).token).toBe(first.token); expect(fs.writes).toBe(1);
    });

    it('rejects corrupt existing JSON without overwriting it', async () => {
        const fs = new FakePluginFS(); fs.files.set('mcp-server/config.local.json', '{broken');
        const store = new McpConfigStore({ fs }, '1.2.1');
        await expect(store.read(true)).rejects.toThrow('Invalid MCP JSON');
        expect(fs.writes).toBe(0); expect(fs.files.get('mcp-server/config.local.json')).toBe('{broken');
    });

    it('reports failed saves and read rejections without partially applying values', async () => {
        const fs = new FakePluginFS(); fs.files.set('mcp-server/config.local.json', JSON.stringify(config));
        const store = new McpConfigStore({ fs }, '1.2.0');
        fs.fail.write = true;
        await expect(store.save({ ...config, port: 9000 })).rejects.toThrow('Could not save');
        expect(await store.read()).toEqual(config);
        fs.fail.read = true;
        await expect(store.read(true)).rejects.toThrow('Could not read'); expect(fs.writes).toBe(0);
    });

    it('falls back to legacy reading when file capability is unavailable', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(config))));
        const store = new McpConfigStore({}, '1.2.0'); expect(store.writable).toBe(false);
        await expect(store.read()).resolves.toEqual(config);
    });
});
