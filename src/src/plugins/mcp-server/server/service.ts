import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../shared/config.js';
import { MAX_BRIDGE_MESSAGE_BYTES } from '../shared/protocol.js';
import { LeagueBridge, tokenMatches } from './bridge.js';
import { createToolServer } from './tools.js';

const loopback = (address?: string) => address === '127.0.0.1' || address === '::ffff:127.0.0.1' || address === '::1';

export function validHost(host: string | undefined, port: number) {
    return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

export function validOrigin(origin: string | undefined, port: number, bridge = false) {
    if (!origin) return true;
    if (origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`) return true;
    if (!bridge) return false;
    if (['https://plugins', 'http://plugins', 'https://riot', 'https://riot:443'].includes(origin)) return true;
    // Legacy League/Pengu uses https://127.0.0.1:<LCU port>, which changes
    // each launch and is independent of the MCP port. Only the authenticated
    // renderer bridge accepts these origins; HTTP MCP keeps its own allowlist.
    try {
        const url = new URL(origin);
        return url.protocol === 'https:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
            && origin === url.origin;
    } catch { return false; }
}

function reject(response: ServerResponse, status: number, message: string) {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) throw Object.assign(new Error('Content-Type must be application/json.'), { status: 415 });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) throw Object.assign(new Error('MCP request exceeds 2 MiB.'), { status: 413 });
        chunks.push(Buffer.from(chunk));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw Object.assign(new Error('Invalid JSON request.'), { status: 400 }); }
}

/** Start one loopback HTTP listener; HTTP sessions share the same authenticated renderer. */
export async function startService(config: ServerConfig, root?: string, requestTimeout?: number) {
    const bridge = new LeagueBridge(config.token, requestTimeout);
    const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer; touched: number }>();
    let port = config.port;
    let pendingInitializations = 0;
    const handler = async (request: IncomingMessage, response: ServerResponse) => {
        response.setHeader('Cache-Control', 'no-store');
        if (!loopback(request.socket.remoteAddress) || !validHost(request.headers.host, port) || !validOrigin(request.headers.origin, port)) {
            reject(response, 403, 'Only local MCP requests with a valid Host and Origin are allowed.'); return;
        }
        const bearer = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)?.[1];
        if (!tokenMatches(bearer, config.token)) {
            response.setHeader('WWW-Authenticate', 'Bearer'); reject(response, 401, 'MCP bearer token required.'); return;
        }
        if (request.url !== '/mcp') { reject(response, 404, 'MCP endpoint is /mcp.'); return; }
        if (!['POST', 'GET', 'DELETE'].includes(request.method ?? '')) { response.setHeader('Allow', 'POST, GET, DELETE'); reject(response, 405, 'Method not allowed.'); return; }
        try {
            const rawSession = request.headers['mcp-session-id'];
            if (Array.isArray(rawSession)) { reject(response, 400, 'Invalid MCP session ID.'); return; }
            if (rawSession) {
                const session = sessions.get(rawSession);
                if (!session) { reject(response, 404, 'MCP session expired. Initialize a new session.'); return; }
                session.touched = Date.now();
                const body = request.method === 'POST' ? await readJson(request) : undefined;
                await session.transport.handleRequest(request, response, body);
                return;
            }
            if (request.method !== 'POST') { reject(response, 400, 'Initialize an MCP session first.'); return; }
            const body = await readJson(request);
            if (!isInitializeRequest(body)) { reject(response, 400, 'Initialize an MCP session first.'); return; }
            if (sessions.size + pendingInitializations >= 32) { reject(response, 503, 'MCP session limit reached.'); return; }
            pendingInitializations++;
            const server = createToolServer(bridge, root, config);
            const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
                sessionIdGenerator: randomUUID, enableJsonResponse: true,
                onsessioninitialized: id => { sessions.set(id, { transport, server, touched: Date.now() }); },
            });
            transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); };
            try {
                await server.connect(transport);
                await transport.handleRequest(request, response, body);
                if (!transport.sessionId) await server.close();
            } catch (reason) { await server.close(); throw reason; }
            finally { pendingInitializations--; }
        } catch (reason) {
            if (!response.headersSent) reject(response, (reason as any).status ?? 500, (reason as any).status ? (reason as Error).message : 'MCP request failed.');
            else response.end();
        }
    };
    const http = createServer((request, response) => { void handler(request, response); });
    http.requestTimeout = 20000;
    http.headersTimeout = 10000;
    const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_BRIDGE_MESSAGE_BYTES, perMessageDeflate: false });
    http.on('upgrade', (request, socket, head) => {
        if (request.url !== '/bridge' || !loopback(request.socket.remoteAddress) || !validHost(request.headers.host, port) || !validOrigin(request.headers.origin, port, true)
            || sockets.clients.size >= 4) {
            socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
        }
        sockets.handleUpgrade(request, socket, head, client => bridge.attach(client));
    });
    await new Promise<void>((resolve, rejectPromise) => {
        http.once('error', rejectPromise);
        http.listen(port, '127.0.0.1', () => { http.removeListener('error', rejectPromise); resolve(); });
    }).catch(reason => {
        sockets.close();
        if ((reason as NodeJS.ErrnoException).code === 'EADDRINUSE') throw new Error(`MCP port ${port} is already in use. Stop the other service or edit config.local.json. The port was not changed.`);
        throw reason;
    });
    port = (http.address() as { port: number }).port;
    const reaper = setInterval(() => {
        for (const [id, session] of sessions) if (Date.now() - session.touched > 30 * 60 * 1000) {
            sessions.delete(id); void session.server.close().catch(() => {});
        }
    }, 60000);
    reaper.unref();
    return {
        port, bridge, sessionCount: () => sessions.size,
        async close() {
            clearInterval(reaper); bridge.close();
            await Promise.all(Array.from(sessions.values(), session => session.server.close().catch(() => {})));
            sessions.clear();
            for (const client of sockets.clients) client.terminate();
            await new Promise<void>(resolve => sockets.close(() => resolve()));
            http.closeAllConnections();
            await new Promise<void>((resolve, rejectPromise) => http.close(error => error ? rejectPromise(error) : resolve()));
        },
    };
}
