import { loadServerConfig, packageRoot } from './config.js';
import { startService } from './service.js';

async function main() {
    const config = await loadServerConfig(packageRoot, true);
    const service = await startService(config, packageRoot);
    console.error(`[Elainatheme MCP] Listening at http://127.0.0.1:${service.port}/mcp`);
    console.error('[Elainatheme MCP] Enable Dev-mode and MCP in Plugins Settings. The bearer token is in config.local.json.');
    let stopping = false;
    const stop = async () => {
        if (stopping) return; stopping = true;
        await service.close();
    };
    process.once('SIGINT', () => { void stop().catch(reason => { console.error(reason.message); process.exitCode = 1; }); });
    process.once('SIGTERM', () => { void stop().catch(reason => { console.error(reason.message); process.exitCode = 1; }); });
}
main().catch(reason => { console.error(`[Elainatheme MCP] ${reason.message}`); process.exitCode = 1; });
