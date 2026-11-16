import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMcpBrowser } from './fakes/mcpBrowser';
import { installPengu } from './fakes/pengu';
import { NameSpoofer } from '../src/src/plugins/nameSpoofer';
let env: ReturnType<typeof installMcpBrowser>;
let plugin: NameSpoofer;
beforeEach(async () => {
    vi.resetModules(); env = installMcpBrowser();
    const pengu = installPengu('legacy', { ElainaTheme: { 'Name-Spoofer': false, 'Spoof-name': 'Custom name' } });
    const { ElainaData } = await import('../src/src/utils/themeDataStore'); await ElainaData.init(pengu.context);
    plugin = new NameSpoofer();
    document.body.innerHTML = '<div id="rcp-fe-viewport-root"><span class="chat-name">Real name</span><span class="system-message">System</span></div>';
});
afterEach(async () => { plugin.stop(); await env.dispose(); vi.restoreAllMocks(); });
describe('Name Spoofer lifecycle', () => {
    it('creates no DOM observer or polling interval while disabled', () => {
        const observe = vi.spyOn(MutationObserver.prototype, 'observe');
        const interval = vi.spyOn(window, 'setInterval'); plugin.main(); plugin.main();
        expect(observe).not.toHaveBeenCalled(); expect(interval).not.toHaveBeenCalled();
    });
    it('uses one observer when enabled, handles new content, and disconnects on disable', async () => {
        const observe = vi.spyOn(MutationObserver.prototype, 'observe');
        const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
        plugin.main(); ElainaData.set('Name-Spoofer', true); plugin.main();
        expect(observe).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.chat-name')?.textContent).toBe('Custom name');
        const element = document.createElement('span'); element.className = 'chat-name'; element.textContent = 'Another name';
        document.querySelector('#rcp-fe-viewport-root')!.append(element);
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(element.textContent).toBe('Custom name');
        ElainaData.set('Name-Spoofer', false); expect(disconnect).toHaveBeenCalled();
        element.textContent = 'Real name'; await new Promise(resolve => setTimeout(resolve, 10));
        expect(element.textContent).toBe('Real name');
    });
});
