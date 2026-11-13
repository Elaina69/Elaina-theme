import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { installMcpBrowser, FakeWebSocket } from './fakes/mcpBrowser';
import { installPengu } from './fakes/pengu';

vi.mock('../src/src/otherThings.ts', () => ({ pluginUrl: (...parts: string[]) => '//plugins/@scope/theme/' + parts.join('/') }));
let env: ReturnType<typeof installMcpBrowser>;
let runtime: import('../src/src/plugins/mcp-server/browser/runtime').McpRuntime;
let data: typeof import('../src/src/utils/themeDataStore').ElainaData;
const token = 'a'.repeat(64);
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

beforeEach(async () => {
    vi.resetModules(); env = installMcpBrowser();
    const pengu = installPengu('legacy', { ElainaTheme: { 'Dev-mode': true, 'MCP-enabled': true } });
    data = (await import('../src/src/utils/themeDataStore')).ElainaData; await data.init(pengu.context);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, port: 8080, token, penguPluginsPath: '' }))));
    const { McpRuntime } = await import('../src/src/plugins/mcp-server/browser/runtime'); runtime = new McpRuntime({});
});
afterEach(async () => { runtime.dispose(); vi.useRealTimers(); await env.dispose(); });

describe('MCP renderer activation and reconnect', () => {
    it('authenticates the socket and disables immediately through datastore changes', async () => {
        runtime.init(); await vi.waitFor(() => expect(FakeWebSocket.instances.some(socket => socket.url.includes('/bridge'))).toBe(true));
        const socket = FakeWebSocket.instances.find(socket => socket.url.includes('/bridge'))!;
        socket.open(); expect(JSON.parse(socket.sent[0]).token).toBe(token);
        socket.message(JSON.stringify({ type: 'HELLO_ACK', version: 1 }));
        const states: string[] = []; runtime.subscribe(status => states.push(status.state));
        expect(states[0]).toBe('connected');
        console.log('captured'); expect(runtime.capture.console.list().entries).toHaveLength(1);
        data.set('Dev-mode', false); expect(socket.readyState).toBe(3); expect(runtime.capture.console.list().entries).toHaveLength(0);
        expect(states.at(-1)).toBe('disabled');
    });

    it('does not install hooks or connect with either gate off', async () => {
        data.set('MCP-enabled', false); const original = window.fetch; runtime.init(); await flush();
        expect(window.fetch).toBe(original); expect(FakeWebSocket.instances).toHaveLength(0);
        data.set('Dev-mode', false); data.set('MCP-enabled', true); await flush(); expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it('rereads file config on retry and cancels retry when disabled', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1, port: 9090, token, penguPluginsPath: '' }))));
        runtime.init(); await flush(); expect(FakeWebSocket.instances).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(1000); await flush();
        const socket = FakeWebSocket.instances[0]; expect(socket.url).toBe('ws://127.0.0.1:9090/bridge');
        socket.close(); data.set('MCP-enabled', false); const count = FakeWebSocket.instances.length;
        await vi.advanceTimersByTimeAsync(30000); expect(FakeWebSocket.instances).toHaveLength(count);
    });
});
