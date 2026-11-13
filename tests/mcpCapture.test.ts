import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { installMcpBrowser, FakeXhr, FakeWebSocket } from './fakes/mcpBrowser';
import { McpCapture } from '../src/src/plugins/mcp-server/browser/capture';
import { McpCommands } from '../src/src/plugins/mcp-server/browser/commands';
import { CAPTURE_DEFAULTS } from '../src/src/plugins/mcp-server/shared/config';

let env: ReturnType<typeof installMcpBrowser>;
let capture: McpCapture;
let enabled = true;
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setTimeout(resolve, 0)); };

beforeEach(() => {
    env = installMcpBrowser(); enabled = true;
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': 'secret' } })));
    capture = new McpCapture(() => enabled);
});
afterEach(async () => { capture.stop(); await env.dispose(); });

describe('MCP renderer capture', () => {
    it('captures safe console/errors while preserving the original logger', () => {
        const original = env.console.log;
        capture.start(CAPTURE_DEFAULTS);
        const object: any = { token: 'private', n: 1n }; object.self = object;
        console.log('hello', object); console.assert(true, 'do not capture');
        expect(original).toHaveBeenCalledTimes(1);
        const log = capture.consoleLogs({}).entries[0];
        expect(log.message).toContain('[circular]'); expect(log.message).not.toContain('private'); expect(log.message).toContain('1n');
        const event = new Event('unhandledrejection'); Object.assign(event, { reason: new Error('promise failed') }); window.dispatchEvent(event);
        expect(capture.consoleLogs({ level: 'unhandledrejection' }).entries[0].message).toContain('promise failed');
        capture.stop(); expect(console.log).toBe(original);
    });

    it('captures fetch payloads without consuming application responses and redacts credentials', async () => {
        capture.start(CAPTURE_DEFAULTS); capture.excludeServer(8080, 's'.repeat(64));
        const response = await fetch('/lol-test', { method: 'POST', headers: { Authorization: 'Bearer private' }, body: '{"request":true}' });
        expect(await response.json()).toEqual({ ok: true });
        await flush();
        const entry = capture.network.list().entries[0];
        expect(entry.method).toBe('POST'); expect(entry.requestHeaders?.authorization).toBe('[redacted]');
        expect(entry.responseHeaders?.['set-cookie']).toBe('[redacted]'); expect(entry.requestBody?.text).toContain('request'); expect(entry.responseBody?.text).toContain('ok');
        await fetch('http://127.0.0.1:8080/mcp'); await fetch('/@scope/theme/mcp-server/config.local.json');
        expect(capture.network.list().entries).toHaveLength(1);
    });

    it('delegates to existing fetch hooks and leaves later wrappers intact on disable', async () => {
        const existing = vi.fn(async () => new Response('existing hook'));
        vi.stubGlobal('fetch', existing); capture.start(CAPTURE_DEFAULTS);
        expect(await (await fetch('/a')).text()).toBe('existing hook'); expect(existing).toHaveBeenCalledTimes(1);
        const capturedFetch = window.fetch;
        const later = vi.fn((...args: Parameters<typeof fetch>) => capturedFetch(...args)); window.fetch = later;
        capture.stop(); expect(window.fetch).toBe(later);
        await fetch('/b'); expect(capture.network.list().entries).toHaveLength(0); expect(existing).toHaveBeenCalledTimes(2);
        capture.start(CAPTURE_DEFAULTS); await fetch('/c'); await flush();
        expect(capture.network.list().entries).toHaveLength(1);
        console.log('one record'); expect(capture.console.list().entries).toHaveLength(1);
    });

    it('captures Request objects before the original fetch consumes the request body', async () => {
        vi.stubGlobal('fetch', vi.fn(async (request: Request) => { const body = await request.text(); return new Response(body); }));
        capture.start(CAPTURE_DEFAULTS);
        const response = await fetch(new Request('https://riot/lol-request', { method: 'POST', body: 'request body' }));
        expect(await response.text()).toBe('request body'); await flush();
        expect(capture.network.list().entries[0].requestBody?.text).toBe('request body');
    });

    it('reports truncated large payloads and captures resource timing metadata', async () => {
        let emit: (list: any) => void = () => {};
        class Observer {
            constructor(callback: (list: any) => void) { emit = callback; }
            observe() {} disconnect() {}
        }
        vi.stubGlobal('PerformanceObserver', Observer);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(4096), { headers: { 'content-type': 'text/plain' } })));
        capture.start({ ...CAPTURE_DEFAULTS, maxPayloadBytes: 256 });
        await fetch('/large'); await flush();
        expect(capture.network.list().entries[0].responseBody?.truncated).toBe(true);
        emit({ getEntries: () => [{ name: 'https://riot/image.png', initiatorType: 'img', duration: 12, transferSize: 80 }] });
        expect(capture.network.list().entries[1].kind).toBe('resource');
        expect(capture.network.list().entries[1].responseBody?.reason).toContain('does not expose');
    });

    it('captures XHR success, network error and abort without replacing application listeners', async () => {
        capture.start(CAPTURE_DEFAULTS);
        const xhr = new XMLHttpRequest() as unknown as FakeXhr; const listener = vi.fn(); xhr.addEventListener('loadend', listener);
        xhr.open('POST', '/xhr'); xhr.setRequestHeader('Authorization', 'private'); xhr.send('body'); xhr.finish(200, '{"xhr":true}');
        const error = new XMLHttpRequest() as unknown as FakeXhr; error.open('GET', '/error'); error.send(); error.finish(0, '', 'error');
        const abort = new XMLHttpRequest() as unknown as FakeXhr; abort.open('GET', '/abort'); abort.send(); abort.finish(0, '', 'abort');
        await flush();
        expect(listener).toHaveBeenCalledTimes(1);
        const entries = capture.network.list().entries;
        expect(entries[0].responseBody?.text).toContain('xhr'); expect(entries[1].error).toBe('error'); expect(entries[2].error).toBe('abort');
    });

    it('captures WebSocket traffic and subscribes to LCU events with cleanup', async () => {
        const link = document.createElement('link'); link.setAttribute('rel', 'riot:plugins:websocket'); link.setAttribute('href', 'wss://riot/events'); document.head.append(link);
        capture.start(CAPTURE_DEFAULTS);
        const lcu = FakeWebSocket.instances[0]; lcu.open(); expect(lcu.sent[0]).toContain('OnJsonApiEvent');
        lcu.message(JSON.stringify([8, 'OnJsonApiEvent', { uri: '/lol-gameflow/v1/gameflow-phase', eventType: 'Update', data: 'Lobby' }]));
        const socket = new WebSocket('wss://example/messages') as unknown as FakeWebSocket; socket.open(); socket.send('outbound'); socket.message('inbound');
        await flush();
        const entries = capture.network.list().entries;
        expect(entries.some(entry => entry.kind === 'lcu' && entry.responseBody?.text === 'Lobby')).toBe(true);
        expect(entries.some(entry => entry.event === 'sent' && entry.requestBody?.text === 'outbound')).toBe(true);
        expect(entries.some(entry => entry.event === 'received' && entry.responseBody?.text === 'inbound')).toBe(true);
        capture.stop(); expect(lcu.readyState).toBe(3); expect(capture.network.list().entries).toHaveLength(0);
    });

    it('clears and aborts in-flight payload capture when disabled', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('partial')); } }))));
        capture.start(CAPTURE_DEFAULTS);
        await fetch('/slow'); enabled = false; capture.stop();
        await flush(); expect(capture.network.list().entries).toHaveLength(0);
    });

    it('marks payloads disabled and lists summaries separately from details', async () => {
        capture.start({ ...CAPTURE_DEFAULTS, payloads: false });
        await fetch('/metadata'); await flush();
        const summary = capture.networkLogs({}).entries[0];
        expect(summary).not.toHaveProperty('responseHeaders');
        expect(capture.network.get(summary.id)?.responseBody?.reason).toContain('disabled');
    });
});

describe('MCP DOM and preview behavior', () => {
    it('inspects and previews DOM then cleans styles/plugins and refuses disabled commands', async () => {
        capture.start(CAPTURE_DEFAULTS);
        const commands = new McpCommands(capture, () => enabled, () => ['private-token']); commands.activate();
        document.body.innerHTML = '<main id="sample">Hello<script>private-token</script><svg><path d="big"/></svg></main>';
        expect(await commands.execute('GET_DOM', {})).not.toContain('<script>');
        await commands.execute('INJECT_CSS', '#sample { color: red; }'); expect(document.getElementById('mcp-theme-injector')).not.toBeNull();
        await commands.execute('INJECT_PLUGIN', { name: 'preview', code: 'window.__preview = 1; return () => { window.__preview = 0; };', css: '#sample { opacity: 1; }' });
        expect((window as any).__preview).toBe(1);
        enabled = false; commands.stop(); expect((window as any).__preview).toBe(0); expect(document.getElementById('mcp-theme-injector')).toBeNull();
        await expect(commands.execute('GET_DOM', {})).rejects.toThrow('disabled');
    });

    it('cancels waits immediately and requires cleanup for persistent previews', async () => {
        const commands = new McpCommands(capture, () => enabled, () => []); commands.activate();
        const waiting = commands.execute('WAIT_FOR_ELEMENT', { selector: '#missing', timeout: 13000 });
        const rejected = expect(waiting).rejects.toThrow('disabled'); enabled = false; commands.stop(); await rejected;
        enabled = true; commands.activate();
        await expect(commands.execute('INJECT_PLUGIN', { name: 'invalid', code: 'return 1;', css: 'a{}' })).rejects.toThrow('cleanup');
        expect(document.getElementById('mcp-plugin-css-invalid')).toBeNull(); commands.stop();
    });
});
