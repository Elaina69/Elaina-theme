import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { preserveDeploymentEntry, syncDeployment, packageMcp } from '../scripts/mcp-package.mjs';

describe('MCP packaging and deployment', () => {
    it('preserves only runtime-owned paths and updates shipped code on repeated deploys', async () => {
        const root = await mkdtemp(join(tmpdir(), 'elaina-mcp-deploy-'));
        const source = join(root, 'source'), destination = join(root, 'plugin');
        try {
            await mkdir(join(source, 'mcp-server/dist/server'), { recursive: true });
            await mkdir(join(destination, 'mcp-server/node_modules/example'), { recursive: true });
            await writeFile(join(source, 'mcp-server/dist/server/main.js'), 'new code');
            await writeFile(join(destination, 'mcp-server/config.local.json'), 'private config');
            await writeFile(join(destination, 'mcp-server/node_modules/example/index.js'), 'installed');
            await writeFile(join(destination, 'mcp-server/stale.js'), 'obsolete');
            await mkdir(join(source, 'elaina-theme-data'), { recursive: true });
            await mkdir(join(destination, 'elaina-theme-data'), { recursive: true });
            await writeFile(join(source, 'elaina-theme-data/index.js'), 'updated CDN');
            await writeFile(join(destination, 'elaina-theme-data/local.js'), 'local addition');
            expect(await syncDeployment(source, destination)).toBe(0);
            expect(await readFile(join(destination, 'mcp-server/config.local.json'), 'utf8')).toBe('private config');
            expect(await readFile(join(destination, 'mcp-server/node_modules/example/index.js'), 'utf8')).toBe('installed');
            expect(await readFile(join(destination, 'mcp-server/dist/server/main.js'), 'utf8')).toBe('new code');
            expect(await readdir(join(destination, 'mcp-server'))).not.toContain('stale.js');
            expect(await readFile(join(destination, 'elaina-theme-data/index.js'), 'utf8')).toBe('updated CDN');
            expect(await readFile(join(destination, 'elaina-theme-data/local.js'), 'utf8')).toBe('local addition');
            expect(await syncDeployment(source, destination)).toBe(0);
            expect(preserveDeploymentEntry('mcp-server/server/config.local.json')).toBe(false);
        } finally { await rm(root, { recursive: true, force: true }); }
    });

    it('packages launchers, sources and compiled entrypoints without local credentials or dependencies', async () => {
        const root = await mkdtemp(join(tmpdir(), 'elaina-mcp-package-'));
        try {
            await packageMcp(root);
            const names = await readdir(root);
            expect(names.filter(name => /\.(bat|sh)$/.test(name)).sort()).toEqual(['start.bat', 'start.sh']);
            expect(names).not.toContain('node_modules'); expect(names).not.toContain('config.local.json'); expect(names).not.toContain('.npm-cache');
            expect((await stat(join(root, 'dist/server/main.js'))).isFile()).toBe(true);
            expect((await stat(join(root, 'dist/server/stdio.js'))).isFile()).toBe(true);
            expect((await stat(join(root, 'package-lock.json'))).isFile()).toBe(true);
            const launcher = await readFile(join(root, 'launcher.mjs'), 'utf8'); expect(launcher).toContain("['ci'"); expect(launcher).toContain("['start']");
        } finally { await rm(root, { recursive: true, force: true }); }
    });
});
