import { describe, it, expect } from 'vitest';
import { LogBuffer, byteLength, truncateUtf8 } from '../src/src/plugins/mcp-server/shared/buffer';
import { decodeServerConfig, readCaptureSettings } from '../src/src/plugins/mcp-server/shared/config';

describe('MCP bounded capture', () => {
    it('evicts by count and keeps monotonic cursors across clears', () => {
        const buffer = new LogBuffer<{ id: number; text: string }>(2, 1024);
        buffer.add({ text: 'one' }); buffer.add({ text: 'two' }); buffer.add({ text: 'three' });
        const first = buffer.list(0, 1);
        expect(first.entries[0].text).toBe('two'); expect(first.hasMore).toBe(true); expect(first.dropped).toBe(1);
        expect(buffer.list(first.nextCursor).entries[0].text).toBe('three');
        buffer.clear();
        const id = buffer.add({ text: 'four' }); expect(id).toBe(4);
        expect(buffer.list(3).entries[0].text).toBe('four');
    });

    it('enforces the byte limit on updates and does not resurrect evicted requests', () => {
        const buffer = new LogBuffer<{ id: number; text: string }>(10, 100);
        const id = buffer.add({ text: 'request' });
        buffer.update(id, { text: 'x'.repeat(120) }); expect(buffer.get(id)).toBeUndefined();
        buffer.update(id, { text: 'late body' }); expect(buffer.list().entries).toHaveLength(0);
    });

    it('truncates UTF-8 without returning half a character', () => {
        const result = truncateUtf8('a🙂🙂', 7);
        expect(result.text).toBe('a🙂'); expect(byteLength(result.text)).toBeLessThanOrEqual(7); expect(result.truncated).toBe(true);
    });

    it('clamps imported limits and refuses malformed file settings', () => {
        const values: Record<string, unknown> = { 'MCP-max-entries': Infinity, 'MCP-max-payload-bytes': 1, 'MCP-console-capture': 'true' };
        const settings = readCaptureSettings((key, fallback) => values[key] ?? fallback);
        expect(settings.maxEntries).toBe(500); expect(settings.maxPayloadBytes).toBe(256); expect(settings.console).toBe(false);
        expect(() => decodeServerConfig('{')).toThrow('Invalid MCP JSON');
        expect(() => decodeServerConfig(JSON.stringify({ schemaVersion: 1, port: 0, token: 'a'.repeat(64), penguPluginsPath: '' }))).toThrow('port');
    });
});
