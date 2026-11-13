import { afterEach, describe, it, expect, vi } from 'vitest';
import { Window } from 'happy-dom';
import { WebSocket } from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpCapture } from '../../browser/capture.ts';
import { McpCommands } from '../../browser/commands.ts';
import { CAPTURE_DEFAULTS } from '../../shared/config.js';
import { startService } from '../service.js';

const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const stop of cleanup.splice(0).reverse()) await stop(); vi.unstubAllGlobals(); });

describe('HTTP MCP to renderer development workflow', () => {
    it('inspects DOM/logs, previews changes and verifies cleanup through real transports', async () => {
        const dom = new Window({ url: 'https://plugins/elaina-theme/index.js' });
        cleanup.push(() => dom.happyDOM.close());
        vi.stubGlobal('window', globalThis);
        for (const key of ['document', 'Node', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'InputEvent'] as const) vi.stubGlobal(key, dom[key]);
        vi.stubGlobal('location', dom.location); vi.stubGlobal('getComputedStyle', dom.getComputedStyle.bind(dom));
        vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 720);
        const events = new EventTarget(); vi.stubGlobal('addEventListener', events.addEventListener.bind(events)); vi.stubGlobal('removeEventListener', events.removeEventListener.bind(events));
        vi.stubGlobal('WebSocket', undefined); vi.stubGlobal('XMLHttpRequest', undefined); vi.stubGlobal('PerformanceObserver', undefined);
        const originalFetch = globalThis.fetch;
        const token = 'a'.repeat(64);
        const service = await startService({ schemaVersion: 1, port: 0, token, penguPluginsPath: '' });
        cleanup.push(() => service.close());
        let enabled = true;
        const capture = new McpCapture(() => enabled); capture.excludeServer(service.port, token); capture.start(CAPTURE_DEFAULTS);
        cleanup.push(async () => capture.stop());
        const commands = new McpCommands(capture, () => enabled, () => [token]); commands.activate(); cleanup.push(async () => commands.stop());
        document.body.innerHTML = '<main id="sample">League test page</main>';
        const socket = new WebSocket(`ws://127.0.0.1:${service.port}/bridge`, { origin: 'https://plugins' });
        cleanup.push(async () => socket.terminate());
        await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        const authenticated = new Promise<void>(resolve => socket.once('message', () => resolve()));
        socket.send(JSON.stringify({ type: 'HELLO', version: 1, token })); await authenticated;
        socket.on('message', raw => {
            const request = JSON.parse(raw.toString());
            void commands.execute(request.type, request.data).then(data => socket.send(JSON.stringify({ requestId: request.requestId, success: true, data })),
                reason => socket.send(JSON.stringify({ requestId: request.requestId, success: false, error: reason.message })));
        });
        const client = new Client({ name: 'renderer-test-agent', version: '1.0.0' });
        await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${service.port}/mcp`), {
            fetch: originalFetch, requestInit: { headers: { Authorization: `Bearer ${token}` } },
        })); cleanup.push(() => client.close());
        const domResult = await client.callTool({ name: 'get_lol_dom_snapshot' }); expect(JSON.stringify(domResult)).toContain('League test page');
        await client.callTool({ name: 'inject_lol_css', arguments: { css: '#sample { color: rgb(255, 0, 0); }' } });
        expect(document.getElementById('mcp-theme-injector')?.textContent).toContain('255');
        await client.callTool({ name: 'inject_lol_plugin', arguments: { name: 'workflow', code: 'const el = document.getElementById("sample"); el.textContent = "Preview applied"; console.log("workflow preview"); return () => { el.textContent = "League test page"; };' } });
        const query = await client.callTool({ name: 'query_lol_element', arguments: { selector: '#sample' } }); expect(JSON.stringify(query)).toContain('Preview applied');
        const logs = await client.callTool({ name: 'get_lol_console_logs', arguments: { search: 'workflow preview' } }); expect(JSON.stringify(logs)).toContain('workflow preview');
        await client.callTool({ name: 'remove_lol_plugin', arguments: { name: 'workflow' } }); expect(document.getElementById('sample')?.textContent).toBe('League test page');
        enabled = false; commands.stop(); capture.stop(); socket.close();
        expect(document.getElementById('mcp-theme-injector')).toBeNull();
        expect(capture.console.list().entries).toHaveLength(0);
    });
});
