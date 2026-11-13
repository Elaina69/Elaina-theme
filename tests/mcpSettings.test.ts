import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { installMcpBrowser } from './fakes/mcpBrowser';
import { installPengu } from './fakes/pengu';

const state = vi.hoisted(() => ({ runtime: null as any }));
vi.mock('../src/src/utils/utils.ts', () => ({ default: { assets: { icon: () => '' } } }));
vi.mock('../src/src/otherThings.ts', () => ({ pluginPath: (...parts: string[]) => '@scope/renamed-theme/' + parts.join('/') }));
vi.mock('../src/src/plugins/mcp-server/browser/runtime.ts', () => ({ getMcpRuntime: () => state.runtime }));

let env: ReturnType<typeof installMcpBrowser>;
let data: typeof import('../src/src/utils/themeDataStore').ElainaData;
let render: typeof import('../src/src/plugins/settingsGroups/pluginsSettings/_mcp').mcpSection;

beforeEach(async () => {
    vi.resetModules(); env = installMcpBrowser();
    const pengu = installPengu('legacy', { ElainaTheme: { 'Dev-mode': true, 'MCP-enabled': false } });
    data = (await import('../src/src/utils/themeDataStore')).ElainaData; await data.init(pengu.context);
    vi.stubGlobal('getString', async (key: string) => key);
    vi.stubGlobal('openPluginsFolder', vi.fn());
    state.runtime = { config: { writable: false, read: vi.fn(), save: vi.fn() }, subscribe: vi.fn(listener => { listener({ state: 'disabled' }); return vi.fn(); }), refresh: vi.fn(), reconnect: vi.fn(), clear: vi.fn() };
    render = (await import('../src/src/plugins/settingsGroups/pluginsSettings/_mcp')).mcpSection;
});
afterEach(async () => { document.body.innerHTML = ''; await env.dispose(); });

describe('MCP settings visibility and compatibility', () => {
    it('does not render for an unlocked developer button without Dev-mode', async () => {
        data.set('Dev-mode', false); data.set('Dev-button', true);
        expect(await render()).toBeNull(); expect(state.runtime.config.read).not.toHaveBeenCalled();
    });

    it('keeps legacy datastore controls and folder actions without editable JSON controls', async () => {
        const section = await render(); document.body.appendChild(section!);
        expect(document.querySelector('#MCP-enabled')).not.toBeNull(); expect(document.querySelector('#mcp-max-entries')).not.toBeNull();
        expect(document.querySelector('#plugins-settings-mcp-file')).toBeNull(); expect(state.runtime.config.read).not.toHaveBeenCalled();
        (document.querySelector('.mcp-open-folder') as HTMLElement).click(); expect(window.openPluginsFolder).toHaveBeenCalledWith('@scope/renamed-theme/mcp-server');
        (document.querySelector('#MCP-enabled-box') as HTMLElement).click(); expect(data.get('MCP-enabled')).toBe(true);
        expect(state.runtime.refresh).toHaveBeenCalled();
        data.set('Dev-mode', false); expect(document.querySelector('#plugins-settings-mcp')).toBeNull();
    });

    it('loads and saves PluginFS JSON controls without putting file settings into ElainaData', async () => {
        state.runtime.config.writable = true;
        state.runtime.config.read.mockResolvedValue({ schemaVersion: 1, port: 8080, token: 'a'.repeat(64), penguPluginsPath: '' });
        state.runtime.config.save.mockResolvedValue({});
        const section = await render(); document.body.appendChild(section!); await Promise.resolve();
        const port = document.querySelector<HTMLInputElement>('#mcp-port')!; expect(port.value).toBe('8080'); port.value = '9090';
        const save = document.querySelector<HTMLElement>('.mcp-save')!;
        await (save.onclick as any)();
        expect(state.runtime.config.save).toHaveBeenCalledWith({ schemaVersion: 1, port: 9090, token: 'a'.repeat(64), penguPluginsPath: '' });
        expect(data.getAll()).not.toHaveProperty('token'); expect(data.getAll()).not.toHaveProperty('port'); expect(state.runtime.reconnect).toHaveBeenCalled();
        expect(document.querySelector('#mcp-error')?.textContent).toContain('restart-server');
    });

    it('shows read and save failures without reconnecting or applying invalid fields', async () => {
        state.runtime.config.writable = true;
        state.runtime.config.read.mockRejectedValue(new Error('invalid JSON'));
        const section = await render(); document.body.appendChild(section!); await Promise.resolve();
        expect(document.querySelector('#mcp-error')?.textContent).toContain('invalid JSON');
        const save = document.querySelector<HTMLElement>('.mcp-save')!; await (save.onclick as any)();
        expect(state.runtime.config.save).not.toHaveBeenCalled(); expect(state.runtime.reconnect).not.toHaveBeenCalled();
    });
});
