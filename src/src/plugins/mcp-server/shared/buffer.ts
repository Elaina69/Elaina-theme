const encoder = new TextEncoder();
export const byteLength = (text: string) => encoder.encode(text).byteLength;

/** UTF-8 truncation never returns half a code point or allocates a growing buffer. */
export function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
    const bytes = encoder.encode(text);
    if (bytes.length <= maxBytes) return { text, truncated: false };
    return { text: new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, maxBytes)).replace(/\uFFFD$/, ''), truncated: true };
}

/** Count and byte limits apply to updates as well as new records. */
export class LogBuffer<T extends { id: number }> {
    private records = new Map<number, { value: T; bytes: number }>();
    private sequence = 0;
    private bytes = 0;
    dropped = 0;

    constructor(private maxEntries: number, readonly maxBytes: number) {}

    configure(maxEntries: number) { this.maxEntries = maxEntries; this.evict(); }

    add(value: Omit<T, 'id'>): number {
        const id = ++this.sequence;
        const record = { ...value, id } as T;
        const bytes = byteLength(JSON.stringify(record));
        if (bytes > this.maxBytes) { this.dropped++; return id; }
        this.records.set(id, { value: record, bytes });
        this.bytes += bytes;
        this.evict();
        return id;
    }

    update(id: number, patch: Partial<Omit<T, 'id'>>) {
        const old = this.records.get(id);
        if (!old) return; // An in-flight request cannot resurrect an evicted record.
        const value = { ...old.value, ...patch, id } as T;
        const bytes = byteLength(JSON.stringify(value));
        this.bytes += bytes - old.bytes;
        this.records.set(id, { value, bytes });
        this.evict();
    }

    get(id: number): T | undefined { return this.records.get(id)?.value; }

    list(cursor = 0, limit = 50, matches: (entry: T) => boolean = () => true) {
        const all = Array.from(this.records.values(), entry => entry.value).filter(entry => entry.id > cursor && matches(entry));
        const entries = all.slice(0, Math.min(100, Math.max(1, limit)));
        return {
            entries, nextCursor: entries.at(-1)?.id ?? cursor, hasMore: all.length > entries.length,
            oldestCursor: this.records.keys().next().value ?? this.sequence + 1, dropped: this.dropped,
        };
    }

    clear() { this.records.clear(); this.bytes = 0; this.dropped = 0; }

    private evict() {
        while (this.records.size > this.maxEntries || this.bytes > this.maxBytes) {
            const id = this.records.keys().next().value;
            if (id === undefined) break;
            this.bytes -= this.records.get(id)!.bytes;
            this.records.delete(id);
            this.dropped++;
        }
    }
}
