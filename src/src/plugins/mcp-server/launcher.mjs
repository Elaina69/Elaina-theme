import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const stampPath = join(root, '.dependencies.sha256');

function npm(args) {
    return new Promise((resolve, reject) => {
        // Commands and arguments are fixed, with paths passed through cwd, not shell interpolation.
        const windows = process.platform === 'win32';
        const child = spawn(windows ? process.env.ComSpec ?? 'cmd.exe' : 'npm', windows ? ['/d', '/c', 'npm', ...args] : args, {
            cwd: root, stdio: 'inherit', windowsHide: false,
        });
        const interrupt = () => { /* The foreground child receives the terminal signal too. */ };
        process.on('SIGINT', interrupt);
        child.once('error', reason => { process.removeListener('SIGINT', interrupt); reject(reason); });
        child.once('exit', (code, signal) => { process.removeListener('SIGINT', interrupt); resolve(code ?? (signal === 'SIGINT' ? 130 : 1)); });
    });
}

try {
    if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Elainatheme MCP requires Node.js 20 or newer.');
    const hash = createHash('sha256').update(await readFile(join(root, 'package-lock.json'))).digest('hex');
    const installed = await access(join(root, 'node_modules/typescript/bin/tsc')).then(() => true, () => false);
    const previous = await readFile(stampPath, 'utf8').catch(() => '');
    if (!installed || previous !== hash) {
        const code = await npm(['ci', '--no-audit', '--no-fund']);
        if (code !== 0) process.exit(Number(code));
        await writeFile(stampPath, hash);
    }
    const build = await npm(['run', 'build']);
    if (build !== 0) process.exit(Number(build));
    process.exitCode = Number(await npm(['start']));
} catch (reason) {
    console.error(`[Elainatheme MCP launcher] ${reason.message}`);
    process.exitCode = 1;
}
