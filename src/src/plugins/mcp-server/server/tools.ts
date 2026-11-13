import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { WAIT_ELEMENT_MAX_MS } from '../shared/protocol.js';
import type { LeagueBridge } from './bridge.js';
import type { ServerConfig } from '../shared/config.js';
import { loadServerConfig } from './config.js';
import { exportPlugin, screenshot } from './platform.js';

const textResult = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2) }] });
const code = z.string().min(1).max(1024 * 1024);
const name = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const selector = z.string().min(1).max(4096);
const index = z.number().int().min(0).max(100000).optional();
const logQuery = {
    cursor: z.number().int().min(0).optional().describe('Last returned nextCursor; defaults to zero.'),
    limit: z.number().int().min(1).max(100).optional().describe('Page size, default 50.'),
    search: z.string().max(1024).optional().describe('Case-insensitive substring filter.'),
};

/** One tool catalog backs both HTTP sessions and the stdio adapter. */
export function createToolServer(bridge: LeagueBridge, root?: string, initialConfig?: ServerConfig): McpServer {
    const server = new McpServer({ name: 'elainatheme-league-client-mcp', version: '1.0.0' }, {
        instructions: 'Inspect the League DOM and logs before making changes. MCP previews are temporary. Edit Elainatheme source with your workspace tools, build it, reload_lol_client, then verify. Dev-mode and MCP must both be enabled.',
    });
    function register(tool: string, command: string, description: string, schema: z.ZodRawShape = {}, readOnly = false, transform?: (data: any) => unknown) {
        server.registerTool(tool, { description, inputSchema: schema, annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: !readOnly } },
            async data => {
                try {
                    const work = () => bridge.request(command, transform ? transform(data) : data);
                    return textResult(await (readOnly ? work() : bridge.serialize(work)));
                } catch (reason) { return { ...textResult(reason instanceof Error ? reason.message : String(reason)), isError: true }; }
            });
    }
    register('get_lol_dom_snapshot', 'GET_DOM', 'Get a sanitized HTML snapshot of the current League client page.', {}, true);
    register('inject_lol_css', 'INJECT_CSS', 'Replace the shared live preview stylesheet. Use !important for League overrides.', { css: z.string().max(1024 * 1024) }, false, data => data.css);
    register('execute_lol_javascript', 'EXECUTE_JS', 'Run async JavaScript in League. Use an explicit return to return a value. A signal parameter is aborted when MCP is disabled.', { code });
    register('lcu_request', 'LCU_REQUEST', 'Call a relative LCU API endpoint through the League renderer.', {
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'), endpoint: selector.refine(value => value.startsWith('/') && !value.startsWith('//') && !value.includes('\\'), 'Use a relative LCU path.'), body: z.unknown().optional(),
    });
    register('inject_lol_plugin', 'INJECT_PLUGIN', 'Inject a named persistent JavaScript/CSS preview. Code must return a cleanup function; reusing a name replaces it.', { name, code, css: z.string().max(1024 * 1024).optional() });
    register('remove_lol_plugin', 'REMOVE_PLUGIN', 'Clean up and remove a named injected preview.', { name });
    register('reload_lol_plugin', 'RELOAD_PLUGIN', 'Clean up and rerun a named injected preview.', { name });
    register('get_lol_client_state', 'GET_CLIENT_STATE', 'Read page URL, title, viewport and injected preview names.', {}, true);
    register('click_lol_element', 'CLICK_ELEMENT', 'Click a selector match. Inspect DOM before choosing selectors.', { selector, index });
    register('type_into_lol_element', 'TYPE_INTO_ELEMENT', 'Type into an input or textarea and dispatch native input/change events.', { selector, text: z.string().max(65536), clear: z.boolean().optional() });
    register('query_lol_element', 'QUERY_ELEMENT', 'Read element text, bounds, computed styles and requested attributes.', { selector, index, attributes: z.array(z.string().max(128)).max(32).optional() }, true);
    register('wait_for_lol_element', 'WAIT_FOR_ELEMENT', 'Wait for a selector after navigation; maximum wait is 13 seconds.', {
        selector, timeout: z.number().int().min(100).max(WAIT_ELEMENT_MAX_MS).optional(), visible: z.boolean().optional(),
    }, true);
    register('get_lol_performance_metrics', 'GET_PERFORMANCE_METRICS', 'Read heap, DOM, stylesheet, navigation and paint metrics.', {}, true);
    register('reload_lol_client', 'RELOAD_CLIENT', 'Reload the League client after building/deploying source changes.');
    register('get_lol_console_logs', 'GET_CONSOLE_LOGS', 'Read captured console/errors with cursor pagination and filters.', { ...logQuery, level: z.enum(['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table', 'assert', 'unhandledrejection']).optional() }, true);
    register('clear_lol_console_logs', 'CLEAR_CONSOLE_LOGS', 'Clear captured console data.');
    register('get_lol_network_logs', 'GET_NETWORK_LOGS', 'List request/message summaries. Use get_lol_network_entry to read payloads.', {
        ...logQuery, kind: z.enum(['fetch', 'xhr', 'websocket', 'lcu', 'resource']).optional(), method: z.string().max(32).optional(), status: z.number().int().min(0).max(599).optional(),
    }, true);
    register('get_lol_network_entry', 'GET_NETWORK_ENTRY', 'Read a captured network entry with headers, bounded payloads, timings, and errors.', { id: z.number().int().min(1) }, true);
    register('clear_lol_network_logs', 'CLEAR_NETWORK_LOGS', 'Clear captured network data.');
    server.registerTool('get_lol_screenshot', { description: 'Capture the running League window on Windows; return PNG and its temporary path. Unsupported on macOS.',
        inputSchema: { fileName: z.string().max(128).optional() }, annotations: { readOnlyHint: true } }, async ({ fileName }) => {
        try {
            await bridge.request('GET_CLIENT_STATE'); // File/platform tools must also respect the renderer activation gate.
            const result = await screenshot(fileName);
            return { content: [{ type: 'image', data: result.data, mimeType: 'image/png' }, { type: 'text', text: `Screenshot: ${result.path}` }] };
        } catch (reason) { return { ...textResult(reason instanceof Error ? reason.message : String(reason)), isError: true }; }
    });
    server.registerTool('export_plugin_to_pengu', { description: 'Export a currently injected preview as a standalone Pengu module. Destination is read only from config.local.json.',
        inputSchema: { name, fileName: z.string().max(128).optional() }, annotations: { destructiveHint: true } }, async ({ name: pluginName, fileName }) => {
        try {
            return await bridge.serialize(async () => {
                const plugin = await bridge.request('GET_PLUGIN', { name: pluginName }) as { code: string; css: string | null };
                const config = root ? await loadServerConfig(root) : initialConfig;
                if (!config) throw new Error('MCP export configuration is unavailable.');
                const path = await exportPlugin(config.penguPluginsPath, pluginName, plugin.code, plugin.css, fileName);
                return textResult(`Exported ${path}. Reload the League client to load it permanently.`);
            });
        } catch (reason) { return { ...textResult(reason instanceof Error ? reason.message : String(reason)), isError: true }; }
    });
    return server;
}
