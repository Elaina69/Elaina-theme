import { pluginUrl } from '../../../otherThings.ts';
import { CONFIG_FILE, decodeServerConfig, parseServerConfig, type ServerConfig } from '../shared/config.ts';

/** File settings deliberately never use ElainaData, even on legacy Pengu. */
export class McpConfigStore {
    private fs?: PluginFS;
    private pending?: Promise<ServerConfig>;

    constructor(context: { fs?: PluginFS }, version = window.Pengu?.version) {
        const match = version?.match(/^(\d+)\.(\d+)/);
        const modern = !match || Number(match[1]) > 1 || Number(match[1]) === 1 && Number(match[2]) >= 2;
        if (modern && context.fs && ['read', 'write', 'mkdir', 'stat'].every(key => typeof (context.fs as any)[key] === 'function')) {
            this.fs = context.fs;
        }
    }

    get writable() { return !!this.fs; }

    async read(create = false): Promise<ServerConfig> {
        if (this.pending) return this.pending;
        this.pending = this.readFile(create).finally(() => { this.pending = undefined; });
        return this.pending;
    }

    private async readFile(create: boolean): Promise<ServerConfig> {
        const path = `mcp-server/${CONFIG_FILE}`;
        if (this.fs) {
            const raw = await this.fs.read(path);
            if (raw !== undefined) return decodeServerConfig(raw);
            // A rejected read of an existing file must never overwrite that file.
            if (await this.fs.stat(path)) throw new Error('Could not read MCP configuration.');
            if (create) {
                const example = await this.fs.read('mcp-server/config.example.json');
                if (!example) throw new Error('Missing MCP configuration example. Rebuild or reinstall the theme.');
                const config = parseServerConfig(JSON.parse(example), true);
                config.token = randomToken();
                await this.save(config);
                return config;
            }
        } else {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            try {
                const response = await fetch(pluginUrl('mcp-server', CONFIG_FILE), { cache: 'no-store', signal: controller.signal });
                if (response.ok) return decodeServerConfig(await response.text());
                if (response.status !== 404) throw new Error(`Could not read MCP configuration (${response.status}).`);
            } finally { clearTimeout(timeout); }
        }
        throw new Error('MCP configuration is missing. Open the server folder and run start.bat or start.sh.');
    }

    async save(value: unknown): Promise<ServerConfig> {
        if (!this.fs) throw new Error('Editing MCP file settings requires Pengu 1.2+ with PluginFS.');
        const config = parseServerConfig(value);
        if (!await this.fs.mkdir('mcp-server')) throw new Error('Could not open the MCP server directory.');
        if (!await this.fs.write(`mcp-server/${CONFIG_FILE}`, JSON.stringify(config, null, 2) + '\n', { append: false })) {
            throw new Error('Could not save MCP configuration. No new configuration was applied.');
        }
        return config;
    }
}

export function randomToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
