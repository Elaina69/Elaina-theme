import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

async function cssFiles(root, prefix = '') {
    const entries = await readdir(root, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) result.push(...await cssFiles(join(root, entry.name), path));
        else if (entry.name.endsWith('.css')) result.push(path);
    }
    return result.sort();
}

/** Hash the whole CSS tree so a nested import change invalidates its parents as well. */
export async function themeCssRevision(root) {
    const hash = createHash('sha256');
    for (const path of await cssFiles(root)) {
        hash.update(path).update('\0').update(await readFile(join(root, path))).update('\0');
    }
    return hash.digest('hex').slice(0, 12);
}

/** Version local imports only, preserving stylesheet filenames and external URLs. */
export async function versionThemeCssImports(root, revision) {
    if (!/^[a-f0-9]{12}$/.test(revision)) throw new Error('Invalid theme CSS revision.');
    for (const path of await cssFiles(root)) {
        const file = join(root, path);
        const css = await readFile(file, 'utf8');
        const versioned = css.replace(/(@import\s+(?:url\(\s*)?["']?)([^"'\s)]+)(["']?\s*\)?[^;]*;)/g, (match, before, url, after) => {
            if (/^(?:[a-z]+:|\/\/|\/)/i.test(url) || !url.split(/[?#]/)[0].endsWith('.css')) return match;
            const separator = url.includes('?') ? '&' : '?';
            return `${before}${url}${separator}elaina=${revision}${after}`;
        });
        if (versioned !== css) await writeFile(file, versioned);
    }
}
