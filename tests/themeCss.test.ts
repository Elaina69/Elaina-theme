import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { themeCssRevision, versionThemeCssImports } from '../scripts/theme-css.mjs';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe('theme stylesheet cache revisions', () => {
    it('changes the revision when an imported stylesheet changes', async () => {
        const root = await mkdtemp(join(tmpdir(), 'elaina-css-')); roots.push(root); await mkdir(join(root, 'themes'));
        await writeFile(join(root, 'main.css'), '@import url("./themes/settings.css");');
        await writeFile(join(root, 'themes/settings.css'), '.checkbox { margin-bottom: 14px; }');
        const before = await themeCssRevision(root); expect(await themeCssRevision(root)).toBe(before);
        await writeFile(join(root, 'themes/settings.css'), '.checkbox { margin-bottom: 16px; }');
        expect(await themeCssRevision(root)).not.toBe(before);
    });

    it('versions nested local imports and retains external URLs and media queries', async () => {
        const root = await mkdtemp(join(tmpdir(), 'elaina-css-')); roots.push(root);
        await writeFile(join(root, 'main.css'), `@import url("./settings.css");
@import './other.css' screen;
@import url("https://example.com/font.css");
@import url("./more.css?mode=dark");`);
        await versionThemeCssImports(root, '012345abcdef'); const css = await readFile(join(root, 'main.css'), 'utf8');
        expect(css).toContain('./settings.css?elaina=012345abcdef');
        expect(css).toContain("'./other.css?elaina=012345abcdef' screen;");
        expect(css).toContain('url("https://example.com/font.css")');
        expect(css).toContain('./more.css?mode=dark&elaina=012345abcdef');
    });
});
