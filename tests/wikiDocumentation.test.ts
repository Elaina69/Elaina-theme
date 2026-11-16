import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('generated wiki matches current documentation sources', () => {
    it('uses real MCP labels and explicitly documented runtime defaults', () => {
        const generated = spawnSync(process.execPath, ['scripts/generate-wiki.mjs'], { encoding: 'utf8' });
        expect(generated.status, generated.stderr || generated.stdout).toBe(0);
        const customization = readFileSync(resolve('wiki/Theme-customization.md'), 'utf8');
        const mcpRow = customization.split('\n').find(line => line.startsWith('| `MCP-enabled` |'));
        expect(mcpRow).toContain('| Enable AI access through MCP |');
        const progressRow = customization.split('\n').find(line => line.startsWith('| `WallpaperAudio-timeUpdate` |'));
        expect(progressRow).toContain('| `3000` |');
        expect(progressRow).toContain('no longer schedules');
        expect(customization).toContain('Legacy settings without PluginFS');
        expect(customization).toContain('Pengu with usable PluginFS');
    });
});
