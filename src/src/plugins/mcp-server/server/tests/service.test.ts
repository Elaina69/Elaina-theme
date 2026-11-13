import { afterEach, describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocket } from 'ws';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { startService, validHost, validOrigin } from '../service.js';
import { packageRoot, loadServerConfig } from '../config.js';
import { exportedPluginSource, exportPlugin, screenshot } from '../platform.js';

const token = 'a'.repeat(64);
const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

async function service(timeout?: number) {
    const server = await startService({ schemaVersion: 1, port: 0, token, penguPluginsPath: '' }, undefined, timeout);
    cleanup.push(() => server.close());
    return server;
}

async function agent(port: number) {
    const client = new Client({ name: 'test-agent', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    cleanup.push(() => client.close());
    return client;
}

async function renderer(port: number, respond?: (request: any) => Promise<unknown>, origin = 'https://plugins') {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/bridge`, { origin });
    ws.on('error', () => {});
    cleanup.push(async () => { ws.terminate(); });
    await once(ws, 'open');
    const ack = once(ws, 'message');
    ws.send(JSON.stringify({ type: 'HELLO', version: 1, token }));
    expect(JSON.parse((await ack)[0].toString()).type).toBe('HELLO_ACK');
    if (respond) ws.on('message', raw => {
        const request = JSON.parse(raw.toString());
        void respond(request).then(data => ws.send(JSON.stringify({ requestId: request.requestId, data, success: true })));
    });
    return ws;
}

describe('MCP HTTP transport and bridge', () => {
    it.each(['https://127.0.0.1:53262', 'https://localhost:53262', 'https://[::1]:53262'])('authenticates a League renderer from %s while keeping HTTP MCP origins restricted', async origin => {
        const server = await service();
        expect(validOrigin(origin, server.port, true)).toBe(true);
        expect(validOrigin(origin, server.port)).toBe(false);
        await renderer(server.port, async request => ({ type: request.type, title: 'League loopback renderer' }), origin);
        expect(server.bridge.connected).toBe(true);
        const client = await agent(server.port);
        expect(JSON.stringify(await client.callTool({ name: 'get_lol_client_state' }))).toContain('League loopback renderer');
        expect((await fetch(`http://127.0.0.1:${server.port}/mcp`, {
            headers: { Authorization: `Bearer ${token}`, Origin: origin },
        })).status).toBe(403);
    });

    it('rejects remote, opaque and malformed renderer origins', async () => {
        const server = await service();
        for (const origin of ['null', 'https://evil.example', 'https://127.0.0.1.evil.example:53262',
            'http://127.0.0.1:53262', 'https://user:password@127.0.0.1:53262',
            'https://127.0.0.1:53262/path', 'https://127.0.0.1:53262?token=secret', 'https://127.0.0.1:53262#fragment',
            'https://127.0.0.1:53262/', 'not an origin']) {
            expect(validOrigin(origin, server.port, true), origin).toBe(false);
        }
        const ws = new WebSocket(`ws://127.0.0.1:${server.port}/bridge`, { origin: 'https://evil.example' });
        cleanup.push(async () => ws.terminate());
        await expect(once(ws, 'open')).rejects.toThrow('Unexpected server response: 403');
        expect(server.bridge.connected).toBe(false);
    });

    it('initializes multiple agents, discovers all 21 tools and routes calls to one renderer', async () => {
        const server = await service();
        await renderer(server.port, async request => ({ type: request.type, title: 'League test' }));
        const first = await agent(server.port), second = await agent(server.port);
        const tools = (await first.listTools()).tools.map(tool => tool.name);
        expect(tools).toHaveLength(21); expect(tools).toContain('get_lol_network_entry'); expect(tools).toContain('export_plugin_to_pengu');
        const result = await second.callTool({ name: 'get_lol_client_state' });
        expect(JSON.stringify(result)).toContain('League test'); expect(server.sessionCount()).toBe(2);
    });

    it('requires bearer auth and validates Host, Origin and initialization', async () => {
        const server = await service();
        const url = `http://127.0.0.1:${server.port}/mcp`;
        expect((await fetch(url)).status).toBe(401);
        expect((await fetch(url, { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
        expect((await fetch(url, { headers: { Authorization: `Bearer ${token}`, Origin: 'https://evil.example' } })).status).toBe(403);
        expect((await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(400);
        expect(validHost(`evil.example:${server.port}`, server.port)).toBe(false);
        expect(validHost(`127.0.0.1:${server.port}`, server.port)).toBe(true);
        expect(validOrigin('null', server.port, true)).toBe(false);
        expect(validOrigin('https://plugins', server.port, true)).toBe(true);
        const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{bad' });
        expect(response.status).toBe(400);
    });

    it('rejects unauthenticated renderer handshakes and commands fail without a bridge', async () => {
        const server = await service();
        const ws = new WebSocket(`ws://127.0.0.1:${server.port}/bridge`, { origin: 'https://127.0.0.1:53262' });
        await once(ws, 'open');
        const closed = once(ws, 'close'); ws.send(JSON.stringify({ type: 'HELLO', version: 1, token: 'b'.repeat(64) }));
        expect((await closed)[0]).toBe(1008); expect(server.bridge.connected).toBe(false);
        const client = await agent(server.port);
        const result = await client.callTool({ name: 'get_lol_dom_snapshot' });
        expect(result.isError).toBe(true); expect(JSON.stringify(result)).toContain('No League bridge');
    });

    it('rejects pending calls on disconnect and cleans up request timeouts', async () => {
        const server = await service(80);
        const ws = await renderer(server.port);
        const first = server.bridge.request('GET_DOM');
        await expect(first).rejects.toThrow('timed out'); expect(server.bridge.pendingCount).toBe(0);
        const second = server.bridge.request('QUERY_ELEMENT');
        const rejection = expect(second).rejects.toThrow('disconnected'); ws.close();
        await rejection; expect(server.bridge.pendingCount).toBe(0);
    });

    it('serializes mutations across agents and drops queued work after disconnect', async () => {
        const server = await service();
        let active = 0, max = 0;
        const ws = await renderer(server.port, async () => {
            max = Math.max(max, ++active); await new Promise(resolve => setTimeout(resolve, 30)); active--; return { clicked: true };
        });
        const first = await agent(server.port), second = await agent(server.port);
        await Promise.all([first.callTool({ name: 'click_lol_element', arguments: { selector: '#a' } }), second.callTool({ name: 'click_lol_element', arguments: { selector: '#b' } })]);
        expect(max).toBe(1);
        let release!: () => void;
        const running = server.bridge.serialize(() => new Promise<void>(resolve => { release = resolve; }));
        await new Promise(resolve => setTimeout(resolve, 0));
        const queued = server.bridge.serialize(async () => 'should not run');
        const rejected = expect(queued).rejects.toThrow('disconnected');
        const closed = once(ws, 'close'); ws.close(); await closed;
        release(); await running; await rejected;
    });

    it('fails clearly on a port conflict and does not switch ports', async () => {
        const first = await service();
        await expect(startService({ schemaVersion: 1, port: first.port, token, penguPluginsPath: '' })).rejects.toThrow('already in use');
    });

    it('validates element wait limits before dispatch', async () => {
        const server = await service(); const client = await agent(server.port);
        const result = await client.callTool({ name: 'wait_for_lol_element', arguments: { selector: '.page', timeout: 14000 } });
        expect(result.isError).toBe(true); expect(server.bridge.pendingCount).toBe(0);
    });
});

describe('MCP local files and platform behavior', () => {
    it('creates random config once and leaves existing files untouched', async () => {
        const root = await mkdtemp(join(tmpdir(), 'mcp-config-'));
        cleanup.push(() => rm(root, { recursive: true, force: true }));
        await writeFile(join(root, 'config.example.json'), JSON.stringify({ schemaVersion: 1, port: 8080, token: '', penguPluginsPath: '' }));
        const config = await loadServerConfig(root, true); expect(config.token).toMatch(/^[a-f0-9]{64}$/);
        expect(await loadServerConfig(root, true)).toEqual(config);
        await writeFile(join(root, 'config.local.json'), '{corrupt');
        await expect(loadServerConfig(root, true)).rejects.toThrow('Invalid MCP JSON');
        expect(await readFile(join(root, 'config.local.json'), 'utf8')).toBe('{corrupt');
    });

    it('exports a self-contained module within the configured directory', async () => {
        const root = await mkdtemp(join(tmpdir(), 'mcp-export-'));
        cleanup.push(() => rm(root, { recursive: true, force: true }));
        const path = await exportPlugin(root, 'test-preview', 'return () => {};', '#sample { color: red; }');
        const source = await readFile(path, 'utf8'); expect(source).toContain('export async function load()'); expect(source).toContain('test-preview');
        expect(exportedPluginSource('test', 'return () => {};', null)).toContain('controller.abort()');
        await expect(exportPlugin('', 'test', '', null)).rejects.toThrow('disabled');
        await expect(exportPlugin(root, 'test', '', null, '../escape')).rejects.toThrow('Invalid fileName');
    });

    it('returns an explicit unsupported screenshot error on macOS', async () => {
        await expect(screenshot(undefined, 'darwin')).rejects.toThrow('only supported on Windows');
    });

    it('connects a real stdio adapter without a second listener and forwards tools', async () => {
        const server = await service();
        await renderer(server.port, async request => ({ request: request.type, dom: '<main>stdio</main>' }));
        const root = await mkdtemp(join(packageRoot, '.adapter-test-'));
        cleanup.push(() => rm(root, { recursive: true, force: true }));
        await cp(join(packageRoot, 'dist'), join(root, 'dist'), { recursive: true });
        await writeFile(join(root, 'package.json'), '{"type":"module"}');
        await writeFile(join(root, 'config.local.json'), JSON.stringify({ schemaVersion: 1, port: server.port, token, penguPluginsPath: '' }));
        const client = new Client({ name: 'stdio-test', version: '1.0.0' });
        const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'dist/server/stdio.js')], stderr: 'pipe' });
        let stderr = ''; transport.stderr?.on('data', data => { stderr += data; });
        await client.connect(transport); cleanup.push(() => client.close());
        expect((await client.listTools()).tools).toHaveLength(21);
        expect(JSON.stringify(await client.callTool({ name: 'get_lol_dom_snapshot' }))).toContain('stdio');
        expect(stderr).not.toContain(token);
    });
});
