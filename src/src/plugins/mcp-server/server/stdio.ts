import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadServerConfig } from './config.js';

/** A protocol adapter, not a second League bridge or HTTP listener. */
async function main() {
    const config = await loadServerConfig();
    const remote = new Client({ name: 'elainatheme-stdio-adapter', version: '1.0.0' });
    try {
        await remote.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${config.port}/mcp`), {
            requestInit: { headers: { Authorization: `Bearer ${config.token}` } },
        }));
    } catch (reason) { await remote.close(); throw reason; }
    const local = new Server({ name: 'elainatheme-league-client-mcp', version: '1.0.0' }, { capabilities: { tools: {} },
        instructions: 'Live League tools. Use workspace coding tools for permanent Elainatheme edits and builds.' });
    local.setRequestHandler(ListToolsRequestSchema, request => remote.listTools(request.params));
    local.setRequestHandler(CallToolRequestSchema, request => remote.callTool(request.params) as any);
    const transport = new StdioServerTransport();
    await local.connect(transport);
    let stopping = false;
    const stop = async () => {
        if (stopping) return; stopping = true;
        await remote.close(); await local.close();
    };
    const stopSafely = () => { void stop().catch(reason => { console.error(`[Elainatheme MCP adapter] ${reason.message}`); process.exitCode = 1; }); };
    local.onclose = stopSafely;
    process.stdin.once('end', stopSafely);
    process.once('SIGINT', stopSafely);
    process.once('SIGTERM', stopSafely);
}
main().catch(reason => {
    console.error(`[Elainatheme MCP adapter] ${reason.message}. Start the shared server with start.bat, start.sh, or npm start.`);
    process.exitCode = 1;
});
