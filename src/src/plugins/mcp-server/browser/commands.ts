// DOM and preview behavior adapted from rumi-chan/league-client-mcp (MIT).
import { WAIT_ELEMENT_MAX_MS } from '../shared/protocol.ts';
import type { McpCapture } from './capture.ts';
import { safeSerialize, redactText } from './payload.ts';

const STYLE_ID = 'mcp-theme-injector';
type Preview = { code: string; css?: string; cleanup: () => unknown };

/** Owns previews and cancellable waits for one activation of the MCP bridge. */
export class McpCommands {
    private previews = new Map<string, Preview>();
    private controller = new AbortController();
    private epoch = 0;
    private timers = new Set<ReturnType<typeof setTimeout>>();

    constructor(private capture: McpCapture, private enabled: () => boolean, private secrets: () => string[]) {}

    activate() { this.controller = new AbortController(); this.epoch++; }

    stop() {
        this.epoch++;
        this.controller.abort();
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        for (const preview of this.previews.values()) { try { void Promise.resolve(preview.cleanup()).catch(() => {}); } catch { /* Continue cleanup. */ } }
        this.previews.clear();
        document.getElementById(STYLE_ID)?.remove();
    }

    private gate() {
        if (!this.enabled() || this.controller.signal.aborted) throw new Error('Elainatheme MCP is disabled. Enable Dev-mode and MCP in Plugins Settings.');
    }

    private element(selector: string, index = 0): HTMLElement {
        const elements = document.querySelectorAll<HTMLElement>(selector);
        if (!elements[index]) throw new Error(`No element at index ${index} matching: ${selector}`);
        return elements[index];
    }

    private elementInfo(el: HTMLElement, attributes: string[] = []) {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        return {
            tag: el.tagName.toLowerCase(), id: el.id, classes: Array.from(el.classList), text: el.textContent?.trim().slice(0, 500),
            innerHTML: redactText(el.innerHTML.slice(0, 1000), this.secrets()),
            attributes: Object.fromEntries(attributes.map(key => [key, /token|password|secret/i.test(key) ? '[redacted]' : redactText(el.getAttribute(key) ?? '', this.secrets())])),
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            computed: { color: styles.color, backgroundColor: styles.backgroundColor, display: styles.display,
                visibility: styles.visibility, opacity: styles.opacity, fontSize: styles.fontSize, fontFamily: styles.fontFamily },
        };
    }

    private snapshot(): string {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, noscript, #plugins-settings-mcp-file').forEach(el => el.remove());
        for (const el of Array.from(clone.querySelectorAll('*'))) {
            for (const attr of Array.from(el.attributes)) {
                const key = attr.name.toLowerCase();
                if (key === 'd' || key === 'points' || key.startsWith('data-') || key.startsWith('on') || /token|password|secret/i.test(key)) el.removeAttribute(attr.name);
                else if (['src', 'href', 'style'].includes(key) && attr.value.length > 200) el.setAttribute(attr.name, attr.value.slice(0, 80) + '...[truncated]');
                else el.setAttribute(attr.name, redactText(attr.value, this.secrets()));
            }
            if (el.tagName.toLowerCase() === 'svg') el.innerHTML = '<!-- svg content stripped -->';
            if (el instanceof HTMLInputElement && el.type === 'password') el.removeAttribute('value');
        }
        return redactText(clone.outerHTML, this.secrets());
    }

    private async preview(name: string, code: string, css?: string) {
        this.gate();
        const epoch = this.epoch;
        const previous = this.previews.get(name);
        const source = previous ? { code: previous.code, css: previous.css } : undefined;
        if (previous) { await previous.cleanup(); if (this.previews.get(name) === previous) this.previews.delete(name); }
        this.gate();
        if (epoch !== this.epoch) throw new Error('MCP activation changed while replacing a preview.');
        const style = css === undefined ? undefined : document.createElement('style');
        if (style) { style.id = `mcp-plugin-css-${name}`; style.textContent = css!; document.head.appendChild(style); }
        try {
            const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
            const cleanup = await new AsyncFunction('signal', code)(this.controller.signal);
            if (typeof cleanup !== 'function') throw new Error('Persistent MCP previews must return a cleanup function.');
            let removed = false;
            const remove = async () => { if (removed) return; removed = true; try { await cleanup(); } finally { style?.remove(); } };
            if (!this.enabled() || epoch !== this.epoch) { await remove(); throw new Error('MCP was disabled while the preview was starting.'); }
            this.previews.set(name, { code, css, cleanup: remove });
            return { name, injected: true };
        } catch (reason) {
            style?.remove();
            if (source && this.enabled() && epoch === this.epoch) this.previews.set(name, { ...source, cleanup: () => {} });
            throw reason;
        }
    }

    private wait(selector: string, timeout: number, visible: boolean): Promise<unknown> {
        const signal = this.controller.signal;
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + Math.min(timeout, WAIT_ELEMENT_MAX_MS);
            let timer: ReturnType<typeof setTimeout> | undefined;
            const finish = (result?: unknown, error?: Error) => {
                if (timer) { clearTimeout(timer); this.timers.delete(timer); }
                signal.removeEventListener('abort', abort);
                error ? reject(error) : resolve(result);
            };
            const abort = () => finish(undefined, new Error('MCP disabled while waiting for an element.'));
            const check = () => {
                if (timer) this.timers.delete(timer);
                try {
                    this.gate();
                    const element = document.querySelector<HTMLElement>(selector);
                    if (element && (!visible || element.offsetWidth > 0 && element.offsetHeight > 0)) return finish(this.elementInfo(element));
                    if (Date.now() >= deadline) return finish(undefined, new Error(`Timed out waiting for: ${selector}`));
                    timer = setTimeout(check, 100); this.timers.add(timer);
                } catch (reason) { finish(undefined, reason as Error); }
            };
            signal.addEventListener('abort', abort, { once: true });
            check();
        });
    }

    async execute(type: string, value: unknown): Promise<unknown> {
        this.gate();
        const data = (value ?? {}) as any;
        switch (type) {
            case 'GET_DOM': return this.snapshot();
            case 'INJECT_CSS': {
                let style = document.getElementById(STYLE_ID);
                if (!style) { style = document.createElement('style'); style.id = STYLE_ID; document.head.appendChild(style); }
                style.textContent = typeof value === 'string' ? value : data.css;
                return { injected: true };
            }
            case 'EXECUTE_JS': {
                const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
                const result = await new AsyncFunction('signal', data.code)(this.controller.signal);
                return result === undefined ? 'undefined' : safeSerialize(result, 1024 * 1024, this.secrets()).text;
            }
            case 'LCU_REQUEST': {
                if (typeof data.endpoint !== 'string' || !data.endpoint.startsWith('/') || data.endpoint.startsWith('//') || data.endpoint.includes('\\')) throw new Error('LCU endpoint must be a relative path starting with one /.');
                const response = await fetch(data.endpoint, {
                    method: data.method ?? 'GET', headers: { 'Content-Type': 'application/json' }, signal: this.controller.signal,
                    body: data.body === undefined || ['GET', 'HEAD'].includes(data.method ?? 'GET') ? undefined : JSON.stringify(data.body),
                });
                const text = await response.text();
                let body: unknown = text;
                if (text && response.headers.get('content-type')?.includes('json')) { try { body = JSON.parse(text); } catch { /* Return invalid JSON as text. */ } }
                return { status: response.status, data: body };
            }
            case 'INJECT_PLUGIN': return this.preview(data.name, data.code, data.css);
            case 'REMOVE_PLUGIN': {
                const plugin = this.previews.get(data.name);
                if (plugin) { await plugin.cleanup(); if (this.previews.get(data.name) === plugin) this.previews.delete(data.name); }
                return { name: data.name, removed: !!plugin };
            }
            case 'GET_PLUGIN': {
                const plugin = this.previews.get(data.name);
                if (!plugin) throw new Error(`Plugin "${data.name}" not found.`);
                return { name: data.name, code: plugin.code, css: plugin.css ?? null };
            }
            case 'RELOAD_PLUGIN': {
                const plugin = this.previews.get(data.name);
                if (!plugin) throw new Error(`Plugin "${data.name}" not found.`);
                return this.preview(data.name, plugin.code, plugin.css);
            }
            case 'GET_CLIENT_STATE': return { url: window.location.href, title: document.title,
                viewport: { width: window.innerWidth, height: window.innerHeight }, plugins: Array.from(this.previews.keys()), pluginCount: this.previews.size };
            case 'CLICK_ELEMENT': {
                const element = this.element(data.selector, data.index);
                element.click(); return { selector: data.selector, tag: element.tagName.toLowerCase(), text: element.textContent?.trim().slice(0, 100) };
            }
            case 'TYPE_INTO_ELEMENT': {
                const element = this.element(data.selector) as HTMLInputElement | HTMLTextAreaElement;
                if (!['INPUT', 'TEXTAREA'].includes(element.tagName)) throw new Error('Selector must target an input or textarea.');
                element.focus();
                const text = (data.clear ? '' : element.value) + data.text;
                const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (setter) setter.call(element, text); else element.value = text;
                element.dispatchEvent(new InputEvent('input', { bubbles: true, data: data.text }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return { selector: data.selector, value: element.type === 'password' ? '[redacted]' : redactText(element.value, this.secrets()) };
            }
            case 'QUERY_ELEMENT': return { ...this.elementInfo(this.element(data.selector, data.index), data.attributes), count: document.querySelectorAll(data.selector).length };
            case 'WAIT_FOR_ELEMENT': return this.wait(data.selector, data.timeout ?? 10000, data.visible ?? false);
            case 'GET_PERFORMANCE_METRICS': {
                const memory = (performance as any).memory;
                const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
                return {
                    memory: memory ? { usedJSHeapSizeMB: memory.usedJSHeapSize / 1048576, totalJSHeapSizeMB: memory.totalJSHeapSize / 1048576,
                        jsHeapSizeLimitMB: memory.jsHeapSizeLimit / 1048576 } : null,
                    timing: nav ? { domContentLoadedMs: nav.domContentLoadedEventEnd, loadEventMs: nav.loadEventEnd, domInteractiveMs: nav.domInteractive } : null,
                    paint: performance.getEntriesByType('paint').map(entry => ({ name: entry.name, startTimeMs: entry.startTime })),
                    domNodeCount: document.querySelectorAll('*').length, styleSheetCount: document.styleSheets.length, injectedPlugins: this.previews.size, now: performance.now(),
                };
            }
            case 'RELOAD_CLIENT': {
                const timer = setTimeout(() => {
                    this.timers.delete(timer);
                    if (this.enabled()) window.reloadClient ? window.reloadClient() : window.location.reload();
                }, 200);
                this.timers.add(timer);
                return { reloading: true };
            }
            case 'GET_CONSOLE_LOGS': return this.capture.consoleLogs(data);
            case 'CLEAR_CONSOLE_LOGS': this.capture.console.clear(); return { cleared: true };
            case 'GET_NETWORK_LOGS': return this.capture.networkLogs(data);
            case 'GET_NETWORK_ENTRY': {
                const entry = this.capture.network.get(data.id);
                if (!entry) throw new Error(`Network entry ${data.id} is unavailable or has been evicted.`);
                return entry;
            }
            case 'CLEAR_NETWORK_LOGS': this.capture.network.clear(); return { cleared: true };
            default: throw new Error(`Unknown MCP bridge command: ${type}`);
        }
    }
}
