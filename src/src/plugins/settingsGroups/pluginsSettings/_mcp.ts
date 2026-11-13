import { UI } from '../settingsUI.ts';
import { ElainaData } from '../../../utils/themeDataStore.ts';
import { pluginPath } from '../../../otherThings.ts';
import { getMcpRuntime, type McpStatus } from '../../mcp-server/browser/runtime.ts';
import { randomToken } from '../../mcp-server/browser/configStore.ts';
import { readCaptureSettings } from '../../mcp-server/shared/config.ts';

const text = (key: string) => getString('mcp.' + key);

/** File controls appear only where Pengu can persist the server's own JSON config. */
export async function mcpSection(): Promise<HTMLElement | null> {
    if (ElainaData.get('Dev-mode') !== true) return null;
    const runtime = getMcpRuntime();
    const status = UI.createLabel('', 'mcp-status');
    const error = UI.createLabel('', 'mcp-error');
    const children: HTMLElement[] = [];
    for (const [key, title] of [
        ['MCP-enabled', 'enabled'], ['MCP-console-capture', 'console-capture'], ['MCP-network-capture', 'network-capture'], ['MCP-payload-capture', 'payload-capture'],
    ]) {
        children.push(UI.createCheckBox(await text(title), key, key + '-box', () => runtime?.refresh(), true, key));
    }
    const settings = readCaptureSettings((key, fallback) => ElainaData.get(key, fallback));
    function field(label: string, id: string, value: string, type: string, change?: () => void) {
        const { origin, searchbox: input } = UI.createInputElement(id, 'width: 300px; margin: 4px 0 12px; box-sizing: border-box;', undefined);
        input.type = type; input.id = id; input.value = value;
        input.placeholder = '';
        if (change) input.onchange = change;
        return { input, row: UI.createRow(id + '-row', [UI.createLabel(label), origin]) };
    }
    const entries = field(await text('max-entries'), 'mcp-max-entries', String(settings.maxEntries), 'number');
    entries.input.min = '1'; entries.input.max = '500'; entries.input.step = '1';
    entries.input.onchange = () => {
        const value = Number(entries.input.value);
        if (!Number.isInteger(value) || value < 1 || value > 500) { entries.input.value = String(ElainaData.get('MCP-max-entries', 500)); return; }
        ElainaData.set('MCP-max-entries', value);
    };
    const payload = field(await text('max-payload'), 'mcp-max-payload', String(settings.maxPayloadBytes), 'number');
    payload.input.min = '256'; payload.input.max = '65536'; payload.input.step = '1';
    payload.input.onchange = () => {
        const value = Number(payload.input.value);
        if (!Number.isInteger(value) || value < 256 || value > 65536) { payload.input.value = String(ElainaData.get('MCP-max-payload-bytes', 65536)); return; }
        ElainaData.set('MCP-max-payload-bytes', value);
    };
    children.push(entries.row, payload.row, status, error,
        UI.createButton(await text('open-folder'), 'mcp-open-folder', () => {
            if (ElainaData.get('Dev-mode') === true) window.openPluginsFolder(pluginPath('mcp-server'));
        }),
        UI.createButton(await text('reconnect'), 'mcp-reconnect', () => runtime?.reconnect()),
        UI.createButton(await text('clear'), 'mcp-clear', () => runtime?.clear()),
        UI.createLabel(await text('start-note')),
    );
    const strings = Object.fromEntries(await Promise.all(['disabled', 'configuration', 'connecting', 'connected', 'reconnecting', 'error', 'restart-server', 'saved'].map(async key => [key, await text(key)])));
    if (runtime?.config.writable) {
        const port = field(await text('port'), 'mcp-port', '8080', 'number');
        port.input.min = '1'; port.input.max = '65535'; port.input.step = '1';
        const token = field(await text('token'), 'mcp-token', '', 'password');
        token.input.autocomplete = 'off'; token.input.spellcheck = false;
        const directory = field(await text('export-directory'), 'mcp-export-directory', '', 'text');
        let loaded = false;
        const load = async () => {
            try {
                const config = await runtime.config.read(true);
                port.input.value = String(config.port); token.input.value = config.token; directory.input.value = config.penguPluginsPath;
                loaded = true; error.textContent = '';
            } catch (reason) { error.textContent = reason instanceof Error ? reason.message : String(reason); }
        };
        const save = UI.createButton(await text('save'), 'mcp-save', async () => {
            if (!loaded || ElainaData.get('Dev-mode') !== true) return;
            save.setAttribute('disabled', 'true');
            try {
                await runtime.config.save({ schemaVersion: 1, port: Number(port.input.value), token: token.input.value, penguPluginsPath: directory.input.value });
                error.textContent = `${strings.saved} ${strings['restart-server']}`;
                runtime.reconnect();
            } catch (reason) { error.textContent = reason instanceof Error ? reason.message : String(reason); }
            finally { save.removeAttribute('disabled'); }
        });
        children.push(UI.createRow('plugins-settings-mcp-file', [
            port.row, token.row, directory.row,
            UI.createButton(await text('generate-token'), 'mcp-generate-token', () => { if (loaded) token.input.value = randomToken(); }),
            save, UI.createButton(await text('read-file'), 'mcp-read-file', load), UI.createLabel(strings['restart-server']),
        ]));
        void load();
    } else children.push(UI.createLabel(await text('legacy-note')));
    const section = UI.createSection('plugins-settings-mcp', await text('title'), children);
    const update = (current: McpStatus) => {
        status.textContent = `${strings[current.state] ?? current.state}${current.port ? ` · http://127.0.0.1:${current.port}/mcp` : ''}`;
        if (current.detail) status.textContent += ` · ${current.detail}`;
    };
    const unsubscribeStatus = runtime?.subscribe(update);
    let attached = false;
    const observer = new MutationObserver(() => {
        if (section.isConnected) attached = true;
        else if (attached) cleanup();
    });
    const unsubscribeData = ElainaData.subscribe(keys => {
        if (keys.includes('Dev-mode') && ElainaData.get('Dev-mode') !== true) { section.remove(); cleanup(); }
    });
    const cleanup = () => { observer.disconnect(); unsubscribeStatus?.(); unsubscribeData(); };
    observer.observe(document.body, { childList: true, subtree: true });
    return section;
}
