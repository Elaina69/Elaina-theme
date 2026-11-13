import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocket } from 'ws';
import { BRIDGE_VERSION, REQUEST_TIMEOUT_MS, type BridgeResponse } from '../shared/protocol.js';

export function tokenMatches(actual: unknown, expected: string) {
    if (typeof actual !== 'string' || actual.length > 256) return false;
    const actualBytes = Buffer.from(actual), expectedBytes = Buffer.from(expected);
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; socket: WebSocket };

/** A single authenticated League renderer, shared by all HTTP MCP sessions. */
export class LeagueBridge {
    private client?: WebSocket;
    private pending = new Map<string, Pending>();
    private mutations: Promise<unknown> = Promise.resolve();
    private generation = 0;

    constructor(private token: string, private timeout = REQUEST_TIMEOUT_MS) {}

    get connected() { return this.client?.readyState === WebSocket.OPEN; }
    get pendingCount() { return this.pending.size; }

    attach(socket: WebSocket) {
        let authenticated = false;
        const timer = setTimeout(() => socket.close(1008, 'Authentication required'), 5000);
        socket.on('error', () => { /* Close handler owns request cleanup. */ });
        socket.on('message', (raw, binary) => {
            try {
                if (binary) { socket.close(1003, 'Text messages required'); return; }
                const message = JSON.parse(raw.toString());
                if (!authenticated) {
                    if (message.type !== 'HELLO' || message.version !== BRIDGE_VERSION || !tokenMatches(message.token, this.token)) {
                        socket.close(1008, 'Authentication failed'); return;
                    }
                    authenticated = true; clearTimeout(timer);
                    const old = this.client;
                    if (old && old !== socket) { this.rejectFor(old, 'League bridge replaced'); old.close(1000, 'Replaced'); }
                    this.generation++;
                    this.client = socket;
                    socket.send(JSON.stringify({ type: 'HELLO_ACK', version: BRIDGE_VERSION }));
                    return;
                }
                if (socket !== this.client || typeof message.requestId !== 'string') return;
                const pending = this.pending.get(message.requestId);
                if (!pending || pending.socket !== socket) return;
                this.pending.delete(message.requestId); clearTimeout(pending.timer);
                const response = message as BridgeResponse;
                if (response.error || response.success === false) pending.reject(new Error(response.error || 'League bridge command failed.'));
                else pending.resolve(response.data);
            } catch { socket.close(1007, 'Invalid bridge JSON'); }
        });
        socket.on('close', () => {
            clearTimeout(timer);
            if (this.client === socket) { this.client = undefined; this.generation++; }
            this.rejectFor(socket, 'League bridge disconnected. Enable Dev-mode and MCP, then reconnect.');
        });
    }

    request(type: string, data?: unknown): Promise<unknown> {
        const socket = this.client;
        if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('No League bridge connected. Enable Dev-mode and MCP in Elainatheme Plugins Settings.'));
        if (this.pending.size >= 64) return Promise.reject(new Error('Too many pending League commands. Retry after current calls finish.'));
        return new Promise((resolve, reject) => {
            const requestId = randomUUID();
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`${type} timed out after ${this.timeout} ms.`));
            }, this.timeout);
            this.pending.set(requestId, { resolve, reject, timer, socket });
            socket.send(JSON.stringify({ requestId, type, data }), error => {
                if (!error) return;
                const pending = this.pending.get(requestId);
                if (pending) { clearTimeout(pending.timer); this.pending.delete(requestId); reject(error); }
            });
        });
    }

    serialize<T>(work: () => Promise<T>): Promise<T> {
        const generation = this.generation;
        const run = () => {
            if (!this.connected || generation !== this.generation) throw new Error('League bridge disconnected before the queued command could run.');
            return work();
        };
        const result = this.mutations.then(run, run);
        this.mutations = result.catch(() => {});
        return result;
    }

    close() {
        this.generation++;
        const client = this.client; this.client = undefined;
        if (client) { this.rejectFor(client, 'MCP server stopped.'); client.close(1001, 'Server stopped'); }
    }

    private rejectFor(socket: WebSocket, message: string) {
        for (const [id, pending] of this.pending) if (pending.socket === socket) {
            clearTimeout(pending.timer); this.pending.delete(id); pending.reject(new Error(message));
        }
    }
}
