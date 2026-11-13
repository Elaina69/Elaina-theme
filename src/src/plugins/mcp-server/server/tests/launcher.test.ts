import { afterEach, describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { packageRoot } from '../config.js';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

async function launchFixture() {
    const root = await mkdtemp(join(tmpdir(), 'Elaina MCP launcher with spaces ')); roots.push(root);
    for (const file of ['launcher.mjs', 'start.bat', 'start.sh']) await copyFile(join(packageRoot, file), join(root, file));
    await mkdir(join(root, 'bin')); await mkdir(join(root, 'node_modules/typescript/bin'), { recursive: true });
    await writeFile(join(root, 'node_modules/typescript/bin/tsc'), 'fixture');
    await writeFile(join(root, 'package-lock.json'), '{"fixture":true}');
    const hash = createHash('sha256').update(await readFile(join(root, 'package-lock.json'))).digest('hex');
    await writeFile(join(root, '.dependencies.sha256'), hash);
    await writeFile(join(root, 'bin/npm.cmd'), '@echo off\r\necho %*>> "%MCP_TEST_CALLS%"\r\nif "%1"=="start" exit /b 7\r\nexit /b 0\r\n');
    await writeFile(join(root, 'bin/npm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$MCP_TEST_CALLS"\nif [ "$1" = start ]; then exit 7; fi\nexit 0\n', { mode: 0o755 });
    return root;
}

async function run(root: string, script?: string) {
    const windows = process.platform === 'win32';
    const command = script ? windows ? process.env.ComSpec ?? 'cmd.exe' : 'sh' : process.execPath;
    const args = script ? windows ? ['/d', '/c', `call "${join(root, 'start.bat')}"`] : [join(root, 'start.sh')] : [join(root, 'launcher.mjs')];
    const calls = join(root, 'calls.txt');
    let output = '';
    const code = await new Promise<number>((resolve, reject) => {
        const child = spawn(command, args, { cwd: tmpdir(), env: { ...process.env,
            PATH: join(root, 'bin') + (windows ? ';' : ':') + process.env.PATH, MCP_TEST_CALLS: calls }, windowsHide: true, windowsVerbatimArguments: windows && !!script });
        child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
        child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
    });
    return { code, output, calls: await readFile(calls, 'utf8').catch(() => '') };
}

describe('MCP launchers', () => {
    it('starts from its own directory, skips unchanged dependencies, and preserves server exit codes', async () => {
        const root = await launchFixture();
        const result = await run(root, 'launcher');
        expect(result.output).not.toContain('ENOENT'); expect(result.code, result.output).toBe(7);
        expect(result.calls.trim().split(/\r?\n/)).toEqual(['run build', 'start']);
    });

    it('installs on lockfile changes before building and starting', async () => {
        const root = await launchFixture();
        await writeFile(join(root, 'package-lock.json'), '{"fixture":"changed"}');
        const result = await run(root);
        expect(result.code).toBe(7); expect(result.calls.trim().split(/\r?\n/)).toEqual(['ci --no-audit --no-fund', 'run build', 'start']);
    });
});
