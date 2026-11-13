/** Configuration shared by the renderer and the independent Node package. */
export interface ServerConfig {
    schemaVersion: 1;
    port: number;
    token: string;
    penguPluginsPath: string;
}

export const CONFIG_FILE = 'config.local.json';
export const CONFIG_VERSION = 1;

export function parseServerConfig(value: unknown, allowEmptyToken = false): ServerConfig {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('MCP configuration must be a JSON object.');
    const config = value as Record<string, unknown>;
    if (config.schemaVersion !== CONFIG_VERSION) throw new Error('Unsupported MCP configuration version. Expected schemaVersion 1.');
    if (!Number.isInteger(config.port) || Number(config.port) < 1 || Number(config.port) > 65535) {
        throw new Error('MCP port must be an integer between 1 and 65535.');
    }
    if (typeof config.token !== 'string' || !(allowEmptyToken && config.token === '') && !/^[A-Za-z0-9_-]{32,256}$/.test(config.token)) {
        throw new Error('MCP token must contain 32–256 letters, numbers, underscores, or hyphens.');
    }
    if (typeof config.penguPluginsPath !== 'string' || config.penguPluginsPath.length > 4096 || /[\u0000-\u001f]/.test(config.penguPluginsPath)) {
        throw new Error('MCP export directory must be a path string, or empty to disable export.');
    }
    return { schemaVersion: 1, port: Number(config.port), token: config.token, penguPluginsPath: config.penguPluginsPath };
}

export function decodeServerConfig(text: string): ServerConfig {
    let value: unknown;
    try { value = JSON.parse(text); }
    catch { throw new Error('Invalid MCP JSON configuration. Fix config.local.json before reconnecting.'); }
    return parseServerConfig(value);
}

export interface CaptureSettings {
    console: boolean;
    network: boolean;
    payloads: boolean;
    maxEntries: number;
    maxPayloadBytes: number;
}

export const CAPTURE_DEFAULTS: CaptureSettings = {
    console: true, network: true, payloads: true, maxEntries: 500, maxPayloadBytes: 64 * 1024,
};
export const CONSOLE_MAX_BYTES = 2 * 1024 * 1024;
export const NETWORK_MAX_BYTES = 16 * 1024 * 1024;

/** Clamp imported datastore values too; UI validation alone cannot bound capture. */
export function readCaptureSettings(get: (key: string, fallback?: unknown) => unknown): CaptureSettings {
    const integer = (key: string, fallback: number, min: number, max: number) => {
        const value = get(key, fallback);
        return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
    };
    return {
        console: get('MCP-console-capture', true) === true,
        network: get('MCP-network-capture', true) === true,
        payloads: get('MCP-payload-capture', true) === true,
        maxEntries: integer('MCP-max-entries', 500, 1, 500),
        maxPayloadBytes: integer('MCP-max-payload-bytes', 65536, 256, 65536),
    };
}
