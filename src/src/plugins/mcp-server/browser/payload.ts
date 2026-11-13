import { byteLength, truncateUtf8 } from '../shared/buffer.ts';
import type { Payload } from '../shared/protocol.ts';

const sensitiveKey = /^(authorization|proxy-authorization|cookie|set-cookie|token|auth[-_]?token|access[-_]?token|password|secret)$/i;

export function redactText(text: string, secrets: string[] = []): string {
    let safe = text.replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '$1[redacted]')
        .replace(/(--(?:riotclient-)?auth-token=)[^\s"']+/gi, '$1[redacted]')
        .replace(/((?:https?|wss?):\/\/)[^\s/]+@/gi, '$1[redacted]@');
    for (const secret of secrets) if (secret) safe = safe.split(secret).join('[redacted]');
    return safe;
}

export function safeSerialize(value: unknown, maxBytes: number, secrets: string[] = [], payload = false): { text: string; truncated: boolean } {
    const seen = new WeakSet<object>();
    let visits = 0;
    let clipped = false;
    const maxChildren = payload ? maxBytes : 40;
    const maxVisits = payload ? maxBytes : 200;
    const simplify = (input: unknown, depth: number): unknown => {
        if (++visits > maxVisits) { clipped = true; return '[truncated]'; }
        if (typeof input === 'string') {
            const limited = truncateUtf8(redactText(input, secrets), maxBytes); clipped ||= limited.truncated; return limited.text;
        }
        if (typeof input === 'bigint') return input.toString() + 'n';
        if (typeof input === 'function') return '[function]';
        if (typeof input === 'symbol' || input === undefined) return String(input);
        if (!input || typeof input !== 'object') return input;
        if (seen.has(input)) return '[circular]';
        seen.add(input);
        if (input instanceof Error) return { name: input.name, message: redactText(input.message, secrets), stack: redactText(input.stack ?? '', secrets) };
        if (depth >= (payload ? 32 : 4)) { clipped = true; return '[object truncated]'; }
        if (Array.isArray(input)) { clipped ||= input.length > maxChildren; return input.slice(0, maxChildren).map(item => simplify(item, depth + 1)); }
        if (typeof (input as any).nodeType === 'number') return `[DOM ${(input as any).nodeName ?? 'node'}]`;
        const entries: Array<[string, unknown]> = [];
        const keys = Object.keys(input); clipped ||= keys.length > maxChildren;
        for (const key of keys.slice(0, maxChildren)) {
            if (visits > maxVisits) { clipped = true; break; }
            try { entries.push([key, sensitiveKey.test(key) ? '[redacted]' : simplify((input as any)[key], depth + 1)]); }
            catch { entries.push([key, '[unavailable]']); }
        }
        return Object.fromEntries(entries);
    };
    try {
        const result = typeof value === 'string' ? redactText(value, secrets) : JSON.stringify(simplify(value, 0));
        const limited = truncateUtf8(result, maxBytes);
        return { text: limited.text, truncated: limited.truncated || clipped };
    } catch { return { text: '[unserializable]', truncated: false }; }
}

export function cleanUrl(input: string, secrets: string[] = []): string {
    try {
        const url = new URL(input, window.location?.href ?? 'https://plugins/');
        if (url.username || url.password) { url.username = ''; url.password = ''; }
        for (const key of Array.from(url.searchParams.keys())) if (sensitiveKey.test(key)) url.searchParams.set(key, '[redacted]');
        return truncateUtf8(redactText(url.href, secrets), 4096).text;
    } catch { return truncateUtf8(redactText(input, secrets), 4096).text; }
}

export function cleanHeaders(headers: HeadersInit | undefined, maxBytes = 65536, secrets: string[] = []): Record<string, string> {
    const result: Record<string, string> = {};
    let remaining = Math.min(maxBytes, 65536);
    try {
        new Headers(headers).forEach((value, key) => {
            if (remaining < byteLength(key)) return;
            const safe = truncateUtf8(sensitiveKey.test(key) ? '[redacted]' : redactText(value, secrets), Math.max(0, remaining - byteLength(key)));
            result[key] = safe.text;
            remaining -= byteLength(key) + byteLength(safe.text);
        });
    } catch { result['capture-error'] = 'Headers unavailable'; }
    return result;
}

export const omitted = (reason: string, bytes?: number): Payload => ({ encoding: 'omitted', truncated: false, reason, ...(bytes === undefined ? {} : { bytes }) });

function fromBytes(bytes: Uint8Array, truncated: boolean, contentType: string, secrets: string[], maxBytes: number): Payload {
    const isText = !contentType || /text|json|javascript|xml|urlencoded|svg/i.test(contentType);
    if (isText) {
        const text = new TextDecoder().decode(bytes).replace(/\uFFFD$/, '');
        const limited = truncateUtf8(redactText(text, secrets), maxBytes);
        return { encoding: 'text', text: limited.text, bytes: bytes.length, truncated: truncated || limited.truncated };
    }
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 4096) binary += String.fromCharCode(...bytes.subarray(offset, offset + 4096));
    return { encoding: 'base64', text: btoa(binary), bytes: bytes.length, truncated };
}

/** Read a clone asynchronously with a hard byte limit and cancel on disable. */
export async function captureStream(stream: ReadableStream<Uint8Array> | null, maxBytes: number, contentType: string, signal: AbortSignal, secrets: string[]): Promise<Payload> {
    if (!stream) return { encoding: 'text', text: '', bytes: 0, truncated: false };
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    let truncated = false;
    let abort: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopped = new Promise<never>((_, reject) => {
        abort = () => reject(new Error('Capture stopped'));
        signal.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => reject(new Error('Payload capture timed out')), 2000);
    });
    try {
        if (signal.aborted) return omitted('Capture stopped');
        while (size <= maxBytes) {
            const chunk = await Promise.race([reader.read(), stopped]);
            if (chunk.done) break;
            const room = maxBytes - size;
            chunks.push(chunk.value.subarray(0, room));
            size += Math.min(room, chunk.value.length);
            if (chunk.value.length > room) { truncated = true; break; }
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return fromBytes(bytes, truncated, contentType, secrets, maxBytes);
    } catch (reason) { return omitted(reason instanceof Error ? reason.message : 'Payload unavailable'); }
    finally {
        clearTimeout(timer);
        if (abort) signal.removeEventListener('abort', abort);
        void reader.cancel().catch(() => {}); // Cancelling a response tee must not delay the original response.
    }
}

export async function captureBody(body: unknown, maxBytes: number, signal: AbortSignal, secrets: string[]): Promise<Payload> {
    if (body == null) return { encoding: 'text', text: '', bytes: 0, truncated: false };
    if (typeof body === 'string' || body instanceof URLSearchParams) {
        const value = redactText(String(body), secrets);
        const limited = truncateUtf8(value, maxBytes);
        return { encoding: 'text', ...limited, bytes: byteLength(value) };
    }
    if (body instanceof Blob) return captureStream(body.stream(), maxBytes, body.type || 'application/octet-stream', signal, secrets);
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        const bytes = body instanceof ArrayBuffer ? new Uint8Array(body) : new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
        return fromBytes(bytes.subarray(0, maxBytes), bytes.length > maxBytes, 'application/octet-stream', secrets, maxBytes);
    }
    if (body instanceof FormData) {
        const data: Record<string, unknown> = {};
        for (const [key, value] of body.entries()) data[key] = typeof value === 'string' ? value : { file: value.name, bytes: value.size, type: value.type };
        const serialized = safeSerialize(data, maxBytes, secrets, true);
        return { encoding: 'text', ...serialized };
    }
    if (body instanceof ReadableStream) return omitted('Request stream is not consumed by monitoring');
    return { encoding: 'text', ...safeSerialize(body, maxBytes, secrets, true) };
}
