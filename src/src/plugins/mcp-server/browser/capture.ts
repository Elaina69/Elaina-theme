import { CAPTURE_DEFAULTS, CONSOLE_MAX_BYTES, NETWORK_MAX_BYTES, type CaptureSettings } from '../shared/config.ts';
import { LogBuffer } from '../shared/buffer.ts';
import type { ConsoleEntry, NetworkEntry, LogQuery, Payload } from '../shared/protocol.ts';
import { captureBody, captureStream, cleanHeaders, cleanUrl, omitted, safeSerialize } from './payload.ts';

/** Passive renderer instrumentation. Wrappers delegate to the hooks present at install time. */
export class McpCapture {
    readonly console = new LogBuffer<ConsoleEntry>(500, CONSOLE_MAX_BYTES);
    readonly network = new LogBuffer<NetworkEntry>(500, NETWORK_MAX_BYTES);
    private settings = { ...CAPTURE_DEFAULTS };
    private stopHooks: Array<() => void> = [];
    private controller = new AbortController();
    private active = false;
    private secrets: string[] = [];
    private excluded = new Set<string>();
    private pendingBodies = 0;
    private hookEpoch = 0;
    private lcu?: WebSocket;
    private lcuRetry?: ReturnType<typeof setTimeout>;
    private nativeWebSocket?: typeof WebSocket;

    constructor(private enabled: () => boolean) {}

    configure(settings: CaptureSettings) {
        this.settings = settings;
        this.console.configure(settings.maxEntries);
        this.network.configure(settings.maxEntries);
        if (!settings.console) this.console.clear();
        if (!settings.network) { this.network.clear(); this.stopLcu(); }
        else if (this.active && !this.lcu && !this.lcuRetry) this.connectLcu();
    }

    excludeServer(port: number, token: string) {
        this.excluded.add(`http://127.0.0.1:${port}/`);
        this.excluded.add(`ws://127.0.0.1:${port}/`);
        if (token && !this.secrets.includes(token)) this.secrets.push(token);
    }

    private allowed(kind: 'console' | 'network') { return this.active && this.enabled() && this.settings[kind]; }

    private excludedUrl(url: string) {
        try {
            const parsed = new URL(url, window.location.href);
            return /\/mcp-server\/(?:config\.(?:local|example)\.json|dist\/)/i.test(parsed.pathname)
                || Array.from(this.excluded).some(base => parsed.href.startsWith(base));
        } catch { return true; }
    }

    start(settings: CaptureSettings) {
        this.configure(settings);
        if (this.active) return;
        this.active = true;
        this.hookEpoch++;
        this.controller = new AbortController();
        this.nativeWebSocket = window.WebSocket;
        this.installConsole();
        this.installFetch();
        this.installXhr();
        this.installWebSocket();
        this.installResources();
        if (settings.network) this.connectLcu();
    }

    stop() {
        this.active = false;
        this.hookEpoch++;
        this.controller.abort();
        this.stopLcu();
        for (const stop of this.stopHooks.splice(0).reverse()) { try { stop(); } catch { /* Cleanup must continue. */ } }
        this.console.clear();
        this.network.clear();
        this.secrets = [];
        this.excluded.clear();
    }

    clear() { this.console.clear(); this.network.clear(); }

    consoleLogs(query: LogQuery) {
        return this.console.list(query.cursor, query.limit, entry => (!query.level || entry.level === query.level)
            && (!query.search || entry.message.toLowerCase().includes(query.search.toLowerCase())));
    }

    networkLogs(query: LogQuery) {
        const result = this.network.list(query.cursor, query.limit, entry => (!query.kind || entry.kind === query.kind)
            && (!query.method || entry.method === query.method.toUpperCase()) && (query.status === undefined || entry.status === query.status)
            && (!query.search || `${entry.url} ${entry.error ?? ''}`.toLowerCase().includes(query.search.toLowerCase())));
        return { ...result, entries: result.entries.map(({ requestHeaders, responseHeaders, requestBody, responseBody, ...summary }) => ({
            ...summary, requestPayload: requestBody?.encoding, responsePayload: responseBody?.encoding,
            truncated: !!requestBody?.truncated || !!responseBody?.truncated,
        })) };
    }

    private recordConsole(level: string, values: unknown[]) {
        if (!this.allowed('console')) return;
        const message = safeSerialize(values, this.settings.maxPayloadBytes, this.secrets);
        this.console.add({ timestamp: new Date().toISOString(), level, message: message.text, truncated: message.truncated });
    }

    private installConsole() {
        const epoch = this.hookEpoch;
        for (const level of ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table', 'assert'] as const) {
            const original = window.console[level] as (...args: any[]) => any;
            const capture = this;
            let recording = false;
            const wrapper = function(this: Console, ...args: any[]) {
                if (epoch === capture.hookEpoch && !recording && !(level === 'assert' && args[0])) {
                    recording = true;
                    try { capture.recordConsole(level, level === 'assert' ? args.slice(1) : args); }
                    catch { /* Logging must still work if serialization fails. */ }
                    finally { recording = false; }
                }
                return Reflect.apply(original, this, args);
            };
            (window.console as any)[level] = wrapper;
            this.stopHooks.push(() => { if (window.console[level] === wrapper) (window.console as any)[level] = original; });
        }
        const error = (event: ErrorEvent) => this.recordConsole('error', [event.error ?? event.message, `${event.filename}:${event.lineno}:${event.colno}`]);
        const rejection = (event: PromiseRejectionEvent) => this.recordConsole('unhandledrejection', [event.reason]);
        window.addEventListener('error', error);
        window.addEventListener('unhandledrejection', rejection);
        this.stopHooks.push(() => { window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', rejection); });
    }

    private addNetwork(value: Omit<NetworkEntry, 'id' | 'timestamp'>) {
        if (!this.allowed('network') || this.excludedUrl(value.url)) return undefined;
        return this.network.add({ ...value, timestamp: new Date().toISOString(), url: cleanUrl(value.url, this.secrets) });
    }

    private updateBody(id: number, key: 'requestBody' | 'responseBody', work: (signal: AbortSignal) => Promise<Payload>) {
        if (!this.settings.payloads) { this.network.update(id, { [key]: omitted('Payload capture disabled') }); return; }
        if (this.pendingBodies >= 32) { this.network.update(id, { [key]: omitted('Concurrent payload capture limit reached') }); return; }
        const signal = this.controller.signal;
        this.pendingBodies++;
        let body: Promise<Payload>;
        try { body = work(signal); }
        catch { body = Promise.resolve(omitted('Payload unavailable')); }
        void body.then(payload => {
            if (!signal.aborted && this.allowed('network')) this.network.update(id, { [key]: this.settings.payloads ? payload : omitted('Payload capture disabled') });
        }, () => {
            if (!signal.aborted && this.allowed('network')) this.network.update(id, { [key]: omitted('Payload unavailable') });
        }).finally(() => { this.pendingBodies--; });
    }

    private installFetch() {
        const original = window.fetch;
        const capture = this;
        const epoch = this.hookEpoch;
        const wrapper: typeof fetch = function(this: Window, input, init) {
            if (epoch !== capture.hookEpoch || !capture.allowed('network')) return Reflect.apply(original, this, [input, init]);
            const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
            const url = request?.url ?? String(input);
            if (capture.excludedUrl(url)) return Reflect.apply(original, this, [input, init]);
            const start = performance.now();
            const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
            const id = capture.addNetwork({ kind: 'fetch', url, method,
                requestHeaders: cleanHeaders(init?.headers ?? request?.headers, capture.settings.maxPayloadBytes, capture.secrets) });
            if (id !== undefined) {
                if (init?.body != null) capture.updateBody(id, 'requestBody', signal => captureBody(init.body, capture.settings.maxPayloadBytes, signal, capture.secrets));
                else if (request?.body) {
                    try {
                        if (!capture.settings.payloads) capture.network.update(id, { requestBody: omitted('Payload capture disabled') });
                        else if (capture.pendingBodies >= 32) capture.network.update(id, { requestBody: omitted('Concurrent payload capture limit reached') });
                        else {
                            const clone = request.clone();
                            capture.updateBody(id, 'requestBody', signal => captureStream(clone.body, capture.settings.maxPayloadBytes,
                                request.headers.get('content-type') ?? '', signal, capture.secrets));
                        }
                    } catch { capture.network.update(id, { requestBody: omitted('Request body could not be cloned') }); }
                }
            }
            let promise: Promise<Response>;
            try { promise = Reflect.apply(original, this, [input, init]); }
            catch (reason) {
                if (id !== undefined) capture.network.update(id, { error: String(reason), durationMs: performance.now() - start });
                throw reason;
            }
            // Return the original response, without awaiting any body capture.
            return promise.then(response => {
                if (id !== undefined && epoch === capture.hookEpoch && capture.allowed('network')) {
                    capture.network.update(id, { status: response.status, durationMs: performance.now() - start,
                        responseHeaders: cleanHeaders(response.headers, capture.settings.maxPayloadBytes, capture.secrets) });
                    if (!capture.settings.payloads) capture.network.update(id, { responseBody: omitted('Payload capture disabled') });
                    else if (response.type === 'opaque') capture.network.update(id, { responseBody: omitted('Opaque response') });
                    else {
                        try {
                            capture.updateBody(id, 'responseBody', signal => captureStream(response.clone().body, capture.settings.maxPayloadBytes,
                                response.headers.get('content-type') ?? '', signal, capture.secrets));
                        } catch { capture.network.update(id, { responseBody: omitted('Response body could not be cloned') }); }
                    }
                }
                return response;
            }, reason => {
                if (id !== undefined && epoch === capture.hookEpoch && capture.allowed('network')) capture.network.update(id, {
                    error: safeSerialize(reason, capture.settings.maxPayloadBytes, capture.secrets).text, durationMs: performance.now() - start,
                });
                throw reason;
            });
        };
        window.fetch = wrapper;
        this.stopHooks.push(() => { if (window.fetch === wrapper) window.fetch = original; });
    }

    private installXhr() {
        if (typeof XMLHttpRequest === 'undefined') return;
        const proto = XMLHttpRequest.prototype;
        const open = proto.open, send = proto.send, setHeader = proto.setRequestHeader;
        const metadata = new WeakMap<XMLHttpRequest, { method: string; url: string; headers: Record<string, string> }>();
        const listeners = new Set<() => void>();
        const capture = this;
        const epoch = this.hookEpoch;
        const wrappedOpen = function(this: XMLHttpRequest, method: string, url: string | URL, ...args: any[]) {
            const result = Reflect.apply(open, this, [method, url, ...args]);
            if (epoch === capture.hookEpoch) metadata.set(this, { method: String(method).toUpperCase(), url: String(url), headers: {} });
            return result;
        };
        const wrappedHeader = function(this: XMLHttpRequest, name: string, value: string) {
            const result = Reflect.apply(setHeader, this, [name, value]);
            const meta = metadata.get(this);
            if (meta) meta.headers[name] = meta.headers[name] ? `${meta.headers[name]}, ${value}` : value;
            return result;
        };
        const wrappedSend = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
            const meta = metadata.get(this);
            if (epoch !== capture.hookEpoch || !capture.allowed('network') || !meta || capture.excludedUrl(meta.url)) return Reflect.apply(send, this, [body]);
            const start = performance.now();
            const id = capture.addNetwork({ kind: 'xhr', url: meta.url, method: meta.method,
                requestHeaders: cleanHeaders(meta.headers, capture.settings.maxPayloadBytes, capture.secrets) });
            if (id === undefined) return Reflect.apply(send, this, [body]);
            if (body != null) capture.updateBody(id, 'requestBody', signal => captureBody(body, capture.settings.maxPayloadBytes, signal, capture.secrets));
            let failure = '';
            const fail = (event: Event) => { failure = event.type; };
            const detach = () => {
                this.removeEventListener('loadend', finish);
                for (const type of ['error', 'abort', 'timeout']) this.removeEventListener(type, fail);
                listeners.delete(detach);
            };
            const finish = () => {
                detach();
                if (epoch !== capture.hookEpoch || !capture.allowed('network')) return;
                const headers: Record<string, string> = {};
                try { for (const line of this.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
                    const index = line.indexOf(':');
                    if (index > 0) headers[line.slice(0, index)] = line.slice(index + 1).trim();
                } } catch { /* Cross-origin response headers can be unavailable. */ }
                capture.network.update(id, { status: this.status, durationMs: performance.now() - start, ...(failure ? { error: failure } : {}),
                    responseHeaders: cleanHeaders(headers, capture.settings.maxPayloadBytes, capture.secrets) });
                try {
                    const value = !this.responseType || this.responseType === 'text' ? this.responseText : this.response;
                    capture.updateBody(id, 'responseBody', signal => captureBody(value, capture.settings.maxPayloadBytes, signal, capture.secrets));
                } catch { capture.network.update(id, { responseBody: omitted('XHR response unavailable') }); }
            };
            this.addEventListener('loadend', finish);
            for (const type of ['error', 'abort', 'timeout']) this.addEventListener(type, fail);
            listeners.add(detach);
            try { return Reflect.apply(send, this, [body]); }
            catch (reason) { detach(); capture.network.update(id, { error: String(reason), durationMs: performance.now() - start }); throw reason; }
        };
        proto.open = wrappedOpen as typeof proto.open;
        proto.setRequestHeader = wrappedHeader;
        proto.send = wrappedSend;
        this.stopHooks.push(() => {
            for (const detach of Array.from(listeners)) detach();
            if (proto.open === wrappedOpen) proto.open = open;
            if (proto.setRequestHeader === wrappedHeader) proto.setRequestHeader = setHeader;
            if (proto.send === wrappedSend) proto.send = send;
        });
    }

    private installWebSocket() {
        const Original = window.WebSocket;
        if (!Original) return;
        const capture = this;
        const epoch = this.hookEpoch;
        const listeners = new Set<() => void>();
        const send = Original.prototype.send;
        const record = (socket: WebSocket, direction: 'sent' | 'received', body: unknown) => {
            const id = capture.addNetwork({ kind: 'websocket', url: socket.url, event: direction });
            if (id !== undefined) capture.updateBody(id, direction === 'sent' ? 'requestBody' : 'responseBody',
                signal => captureBody(body, capture.settings.maxPayloadBytes, signal, capture.secrets));
        };
        const wrappedSend = function(this: WebSocket, body: string | ArrayBufferLike | Blob | ArrayBufferView) {
            const result = Reflect.apply(send, this, [body]);
            if (epoch === capture.hookEpoch && capture.allowed('network') && this !== capture.lcu) record(this, 'sent', body);
            return result;
        };
        const Wrapped = new Proxy(Original, {
            construct(target, args, newTarget) {
                const socket = Reflect.construct(target, args, newTarget) as WebSocket;
                if (epoch !== capture.hookEpoch || !capture.active || capture.excludedUrl(socket.url)) return socket;
                const message = (event: MessageEvent) => { if (capture.allowed('network')) record(socket, 'received', event.data); };
                const error = () => capture.addNetwork({ kind: 'websocket', url: socket.url, event: 'error', error: 'WebSocket error' });
                const close = () => {
                    capture.addNetwork({ kind: 'websocket', url: socket.url, event: 'closed' });
                    detach();
                };
                const detach = () => {
                    socket.removeEventListener('message', message); socket.removeEventListener('error', error); socket.removeEventListener('close', close);
                    listeners.delete(detach);
                };
                socket.addEventListener('message', message); socket.addEventListener('error', error); socket.addEventListener('close', close);
                listeners.add(detach);
                return socket;
            },
        });
        Original.prototype.send = wrappedSend;
        window.WebSocket = Wrapped;
        this.stopHooks.push(() => {
            for (const detach of Array.from(listeners)) detach();
            if (window.WebSocket === Wrapped) window.WebSocket = Original;
            if (Original.prototype.send === wrappedSend) Original.prototype.send = send;
        });
    }

    private installResources() {
        if (typeof PerformanceObserver === 'undefined') return;
        const observer = new PerformanceObserver(list => {
            for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
                if (['fetch', 'xmlhttprequest'].includes(entry.initiatorType)) continue;
                this.addNetwork({ kind: 'resource', url: entry.name, method: 'GET', durationMs: entry.duration, transferBytes: entry.transferSize,
                    responseBody: omitted('Resource timing does not expose asset response bodies') });
            }
        });
        try { observer.observe({ type: 'resource', buffered: false }); this.stopHooks.push(() => observer.disconnect()); }
        catch { observer.disconnect(); }
    }

    private connectLcu() {
        if (!this.allowed('network') || this.lcu || !this.nativeWebSocket) return;
        const uri = document.querySelector<HTMLLinkElement>('link[rel="riot:plugins:websocket"]')?.href;
        if (!uri) { this.scheduleLcu(); return; }
        try {
            const socket = new this.nativeWebSocket(uri, 'wamp');
            this.lcu = socket;
            socket.onopen = () => { if (this.allowed('network')) socket.send(JSON.stringify([5, 'OnJsonApiEvent'])); };
            socket.onmessage = event => {
                if (!this.allowed('network')) return;
                try {
                    const eventData = JSON.parse(event.data)[2];
                    if (!eventData?.uri) return;
                    const id = this.addNetwork({ kind: 'lcu', url: eventData.uri, event: eventData.eventType });
                    if (id !== undefined) this.updateBody(id, 'responseBody', signal => captureBody(eventData.data, this.settings.maxPayloadBytes, signal, this.secrets));
                } catch { /* WAMP control frames do not contain endpoint events. */ }
            };
            socket.onclose = () => { if (this.lcu === socket) { this.lcu = undefined; this.scheduleLcu(); } };
            socket.onerror = () => { /* A close event follows connection failures. */ };
        } catch { this.scheduleLcu(); }
    }

    private scheduleLcu() {
        if (this.allowed('network') && !this.lcuRetry) this.lcuRetry = setTimeout(() => {
            this.lcuRetry = undefined; this.connectLcu();
        }, 1000);
    }

    private stopLcu() {
        clearTimeout(this.lcuRetry); this.lcuRetry = undefined;
        const socket = this.lcu; this.lcu = undefined;
        if (socket) { socket.onclose = null; socket.onmessage = null; socket.onopen = null; socket.onerror = null; socket.close(); }
    }
}
