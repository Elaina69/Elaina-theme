import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMcpBrowser } from './fakes/mcpBrowser';
import { installPengu } from './fakes/pengu';
vi.mock('../src/src/utils/utils.ts', () => ({ default: {
    assets: { url: () => 'data:text/javascript,export default {}', icon: (...parts: string[]) => '/assets/icon/'+parts.join('/'), background: (...parts: string[]) => '/assets/backgrounds/'+parts.join('/') },
    escapeHtml: (value: string) => value, freezeProperties: () => {}, subscribe_endpoint: () => {},
} }));
vi.mock('../src/src/otherThings.ts', () => ({ pluginPath: () => '@scope/theme' }));
vi.mock('../src/src/services/backupAndRestoreDatastore.ts', () => ({ setDefaultData: () => {} }));
vi.mock('pengu-upl', () => ({ observer: { subscribeToElementCreation: vi.fn() } }));
let env: ReturnType<typeof installMcpBrowser>;
let homepage: typeof import('../src/src/theme/customUI/customHomepage');
beforeEach(async () => {
    vi.resetModules(); env = installMcpBrowser(); vi.useFakeTimers();
    const pengu = installPengu('legacy', { ElainaTheme: {
        'hide-homepage-navbar': true, 'Wallpaper-list':['test.webm'], 'Audio-list':['song.opus'], 'wallpaper-index':0, 'audio-index':0,
        'audio-volume':0.1, 'mute-audio':false, 'pause-audio':0, 'pause-wallpaper':0, 'audio-loop':false,
    } });
    const { ElainaData } = await import('../src/src/utils/themeDataStore'); await ElainaData.init(pengu.context);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    document.body.innerHTML = '<video id="elaina-bg"></video><audio id="bg-audio"></audio><div id="activity-center"><main></main></div>';
    homepage = await import('../src/src/theme/customUI/customHomepage');
});
afterEach(async () => { homepage.del_webm_buttons(); vi.clearAllTimers(); vi.useRealTimers(); await env.dispose(); });
const root = (page: string) => { const node = document.createElement('div'); node.setAttribute('data-screen-name',page); return node; };
describe('homepage media controller intro and cleanup', () => {
    it('retries an ambience request after a transport failure and coalesces the committed state', async () => {
        const pages = new homepage.AddHomePage();
        vi.mocked(fetch).mockRejectedValueOnce(new TypeError('LCU connection interrupted'));
        await expect(pages.setActivityCenterMusicStatus(false)).rejects.toThrow('LCU connection interrupted');
        await pages.setActivityCenterMusicStatus(false);
        expect(fetch).toHaveBeenCalledTimes(2);
        await pages.setActivityCenterMusicStatus(false);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('keeps the positioning class so hide/show applies immediately after returning home', async () => {
        const pages = new homepage.AddHomePage();
        await pages.pageListenner(root('rcp-fe-lol-activity-center'));
        const audio = document.querySelector<HTMLElement>('.webm-bottom-buttons-container')!;
        expect(audio.classList.contains('webm-bottom-buttons-container-hovered')).toBe(true);
        expect(audio.style.transform).toBe('translateX(0px)');
        ElainaData.set('hide-homepage-navbar',false); homepage.hideShowNavBar(); homepage.changeHomePageStyle();
        expect(audio.style.transform).toBe('translateX(212px)');
        ElainaData.set('hide-homepage-navbar',true); homepage.changeHomePageStyle();
        expect(audio.style.transform).toBe('translateX(0px)');
    });
    it('cancels old intro timers and audio listeners when controllers are removed', async () => {
        const pages = new homepage.AddHomePage();
        await pages.pageListenner(root('rcp-fe-lol-activity-center'));
        const audio = document.getElementById('bg-audio') as HTMLAudioElement;
        const progress = document.querySelector<HTMLElement>('.progress-status')!;
        Object.defineProperty(audio,'duration',{value:100}); audio.currentTime = 10;
        audio.dispatchEvent(new env.browser.Event('timeupdate') as unknown as Event); const width = progress.style.width;
        await pages.pageListenner(root('rcp-fe-lol-collections'));
        expect(document.querySelector('.webm-bottom-buttons-container')).toBeNull();
        audio.currentTime = 25; audio.dispatchEvent(new env.browser.Event('timeupdate') as unknown as Event);
        expect(progress.style.width).toBe(width);
        expect(vi.getTimerCount()).toBeLessThan(3);
    });
});
