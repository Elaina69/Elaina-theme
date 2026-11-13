import { spawn } from 'node:child_process';
import { readFile, writeFile, readdir, mkdir, copyFile, stat, lstat, chmod, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, relative, sep, isAbsolute } from 'node:path';

export const mcpSource = resolve('src/src/plugins/mcp-server');
const files = ['package.json', 'package-lock.json', 'tsconfig.json', 'config.example.json', 'README.md', 'LICENSE-RUMI.txt', 'launcher.mjs', 'start.bat', 'start.sh'];

function npm(root, args) {
    return new Promise((resolvePromise, reject) => {
        const windows = process.platform === 'win32';
        const child = spawn(windows ? process.env.ComSpec ?? 'cmd.exe' : 'npm', windows ? ['/d', '/c', 'npm', ...args] : args, { cwd: root, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error(`MCP ${args.join(' ')} failed (${code}).`)));
    });
}

/** Keep the nested package install separate from pnpm and never ship its local secrets. */
export async function buildMcpPackage(root = mcpSource) {
    const hash = createHash('sha256').update(await readFile(join(root, 'package-lock.json'))).digest('hex');
    const stamp = join(root, '.dependencies.sha256');
    const old = await readFile(stamp, 'utf8').catch(() => '');
    const installed = await stat(join(root, 'node_modules/typescript/bin/tsc')).then(() => true, () => false);
    if (!installed || old !== hash) { await npm(root, ['ci', '--no-audit', '--no-fund']); await writeFile(stamp, hash); }
    await npm(root, ['run', 'build']);
}

async function copyTree(source, destination) {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in MCP package: ${entry.name}`);
        if (entry.name === 'tests' || entry.name === 'node_modules') continue;
        const src = join(source, entry.name), dest = join(destination, entry.name);
        if (entry.isDirectory()) await copyTree(src, dest);
        else await copyFile(src, dest);
    }
}

export async function packageMcp(destination, root = mcpSource) {
    await mkdir(destination, { recursive: true });
    for (const name of files) await copyFile(join(root, name), join(destination, name));
    for (const name of ['server', 'shared', 'dist']) await copyTree(join(root, name), join(destination, name));
    await chmod(join(destination, 'start.sh'), 0o755);
}

/** Rebuilds preserve runtime state, but stale shipped code is still removed. */
export function preserveDeploymentEntry(relativePath) {
    const path = relativePath.replace(/\\/g, '/');
    return /(?:^|\/)\.(?:git|agents|codex)(?:\/|$)/.test(path) || !path.includes('/') && path.endsWith('.zip')
        || path === 'data' || path.startsWith('data/') || path === 'elaina-theme-data' || path.startsWith('elaina-theme-data/')
        || /^mcp-server\/(?:node_modules(?:\/|$)|config\.local\.json$|\.dependencies\.sha256$|\.npm-cache(?:\/|$))/.test(path);
}

/** A reusable mirror for build and dev deployment, confined to a checked destination. */
export async function syncDeployment(source, destination, onError = (_action, _path, _reason) => {}, subpath = '', base = resolve(destination)) {
    const target = resolve(destination);
    const child = relative(base, target);
    if (child.startsWith('..' + sep) || child === '..' || isAbsolute(child)) throw new Error('Deployment destination escaped its root.');
    await mkdir(target, { recursive: true });
    const names = (await readdir(source)).filter(name => !name.endsWith('.zip') && !['.git', '.agents', '.codex'].includes(name));
    let failures = 0;
    const fail = (action, path, reason) => { failures++; onError(action, path, reason); };
    for (const entry of await readdir(target, { withFileTypes: true })) {
        const path = subpath ? `${subpath}/${entry.name}` : entry.name;
        if (preserveDeploymentEntry(path) || names.includes(entry.name)) continue;
        if (entry.isSymbolicLink()) { fail('remove', join(target, entry.name), new Error('Symlink rejected')); continue; }
        const removal = resolve(target, entry.name);
        if (!relative(base, removal) || relative(base, removal).startsWith('..' + sep)) throw new Error('Unsafe deployment removal.');
        await rm(removal, { recursive: true }).catch(reason => fail('remove', removal, reason));
    }
    for (const name of names) {
        const path = subpath ? `${subpath}/${name}` : name;
        if (path.startsWith('mcp-server/') && preserveDeploymentEntry(path)) continue;
        const src = join(source, name), dest = join(target, name);
        const sourceStat = await stat(src);
        const destinationStat = await lstat(dest).catch(() => null);
        if (destinationStat?.isSymbolicLink()) { fail('update', dest, new Error('Symlink rejected')); continue; }
        if (sourceStat.isDirectory()) {
            failures += await syncDeployment(src, dest, onError, path, base).catch(reason => { fail('update', dest, reason); return 0; });
            continue;
        }
        if (destinationStat?.isFile() && destinationStat.size === sourceStat.size && (await readFile(src)).equals(await readFile(dest))) continue;
        await copyFile(src, dest).catch(reason => fail('update', dest, reason));
        if (name === 'start.sh') await chmod(dest, 0o755).catch(reason => fail('chmod', dest, reason));
    }
    return failures;
}
