import { randomBytes } from 'node:crypto';
import { readFile, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILE, decodeServerConfig, parseServerConfig, type ServerConfig } from '../shared/config.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const packageRoot = resolve(moduleDirectory, import.meta.url.endsWith('.ts') ? '..' : '../..');

/** Only this file configures listeners and export destinations; no env/datastore overrides. */
export async function loadServerConfig(root = packageRoot, create = false): Promise<ServerConfig> {
    const path = resolve(root, CONFIG_FILE);
    try { return decodeServerConfig(await readFile(path, 'utf8')); }
    catch (reason) {
        if ((reason as NodeJS.ErrnoException).code !== 'ENOENT' || !create) throw reason;
    }
    const example = parseServerConfig(JSON.parse(await readFile(resolve(root, 'config.example.json'), 'utf8')), true);
    example.token = randomBytes(32).toString('hex');
    let handle;
    try { handle = await open(path, 'wx', 0o600); }
    catch (reason) {
        if ((reason as NodeJS.ErrnoException).code === 'EEXIST') return decodeServerConfig(await readFile(path, 'utf8'));
        throw reason;
    }
    try { await handle.writeFile(JSON.stringify(example, null, 2) + '\n'); }
    finally { await handle.close(); }
    return example;
}
