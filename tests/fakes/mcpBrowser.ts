import { vi } from 'vitest';
import { Window } from '../../src/src/plugins/mcp-server/node_modules/happy-dom/lib/index.js';

/** A real DOM with deterministic browser-network stand-ins, used without opening League. */
export class FakeWebSocket extends EventTarget {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    static instances: FakeWebSocket[] = [];
    readyState = 0;
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    sent: string[] = [];
    constructor(readonly url: string, readonly protocols?: string | string[]) { super(); FakeWebSocket.instances.push(this); }
    send(value: any) { this.sent.push(String(value)); }
    open() { this.readyState = 1; const event = new Event('open'); this.onopen?.(event); this.dispatchEvent(event); }
    message(value: any) { const event = new MessageEvent('message', { data: value }); this.onmessage?.(event); this.dispatchEvent(event); }
    close() { this.readyState = 3; const event = new Event('close'); this.onclose?.(event); this.dispatchEvent(event); }
}

export class FakeXhr extends EventTarget {
    status = 0; responseType = ''; responseText = ''; response: unknown;
    method = ''; url = ''; headers: Record<string, string> = {};
    open(method: string, url: string) { this.method = method; this.url = url; }
    send(_body?: unknown) {}
    setRequestHeader(key: string, value: string) { this.headers[key] = value; }
    getAllResponseHeaders() { return 'content-type: application/json\r\nset-cookie: private=1'; }
    finish(status: number, body: string, failure?: string) {
        this.status = status; this.responseText = body;
        if (failure) this.dispatchEvent(new Event(failure));
        this.dispatchEvent(new Event('loadend'));
    }
}

export function installMcpBrowser() {
    FakeWebSocket.instances = [];
    const browser = new Window({ url: 'https://plugins/@scope/theme/index.js' });
    for (const key of ['document', 'Node', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'InputEvent', 'MutationObserver'] as const) vi.stubGlobal(key, browser[key]);
    vi.stubGlobal('location', browser.location);
    vi.stubGlobal('getComputedStyle', browser.getComputedStyle.bind(browser));
    vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 720);
    vi.stubGlobal('WebSocket', FakeWebSocket); vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.stubGlobal('PerformanceObserver', undefined);
    const events = new EventTarget();
    vi.stubGlobal('addEventListener', events.addEventListener.bind(events));
    vi.stubGlobal('removeEventListener', events.removeEventListener.bind(events));
    vi.stubGlobal('dispatchEvent', events.dispatchEvent.bind(events));
    const console = { ...globalThis.console, log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), dir: vi.fn(), table: vi.fn(), assert: vi.fn() };
    vi.stubGlobal('console', console);
    return { browser, console, document: browser.document, async dispose() { await browser.happyDOM.close(); vi.unstubAllGlobals(); } };
}
