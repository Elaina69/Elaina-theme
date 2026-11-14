import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMcpBrowser } from './fakes/mcpBrowser';
import { ClientPageObserver } from '../src/src/theme/customUI/clientPageObserver';
let env: ReturnType<typeof installMcpBrowser>;
let observer: ClientPageObserver;
let changes: ReturnType<typeof vi.fn>;
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
beforeEach(() => {
    env = installMcpBrowser();
    document.body.innerHTML = '<section class="rcp-fe-viewport-main"></section><section class="rcp-fe-viewport-persistent"><div class="screen-root" data-screen-name="rcp-fe-lol-activity-center"></div></section>';
    changes = vi.fn(); observer = new ClientPageObserver(changes);
});
afterEach(async () => { observer.stop(); await env.dispose(); });
describe('League page lifecycle', () => {
    it('detects leaving and returning to a reused homepage without observing its descendants', async () => {
        observer.start(); expect(changes).toHaveBeenCalledTimes(1);
        const home = document.querySelector<HTMLElement>('.screen-root')!;
        const page = document.createElement('div'); page.className = 'screen-root'; page.setAttribute('data-screen-name','rcp-fe-lol-collections');
        home.classList.add('hidden'); document.querySelector('.rcp-fe-viewport-main')!.append(page);
        await tick(); expect(changes).toHaveBeenLastCalledWith(page);
        home.classList.remove('hidden'); page.remove(); await tick();
        expect(changes).toHaveBeenLastCalledWith(home); expect(changes).toHaveBeenCalledTimes(3);
        home.append(document.createElement('div')); await tick(); expect(changes).toHaveBeenCalledTimes(3);
    });
    it('ignores sidebar roots and stops delivering events after cleanup', async () => {
        observer.start(); changes.mockClear();
        const social = document.createElement('div'); social.className = 'screen-root'; social.setAttribute('data-screen-name','social'); document.body.append(social);
        observer.observeScreen(social); await tick(); expect(changes).not.toHaveBeenCalled();
        observer.stop(); document.querySelector('.screen-root')!.setAttribute('data-screen-name','rcp-fe-lol-loot'); await tick();
        expect(changes).not.toHaveBeenCalled();
    });
});
