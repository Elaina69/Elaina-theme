import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPengu } from './fakes/pengu';
const controls = vi.hoisted(() => ({ remove: vi.fn(), create: vi.fn() }));
vi.mock('../src/src/theme/customUI/customHomepage', () => ({ del_webm_buttons: controls.remove, create_webm_buttons: controls.create }));
let fileSystem: import('../src/src/utils/fileSystem').FileSystem;
let data: typeof import('../src/src/utils/themeDataStore').ElainaData;
let pengu: ReturnType<typeof installPengu>;
const folders = ['./assets/backgrounds/wallpapers', './assets/backgrounds/audio', './assets/icon/regalia-banners', './assets/fonts'];
beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks();
    pengu = installPengu('pluginfs', { ElainaTheme: { 'Wallpaper-list': ['b.webm', 'a.jpg'], 'Audio-list': ['music.opus'], 'Banner-list': ['banner.png'], 'Font-list': ['font.ttf'] } });
    data = (await import('../src/src/utils/themeDataStore')).ElainaData; await data.init(pengu.context);
    folders.forEach(folder => pengu.fs.dirs.add(folder.replace(/^\.\//, '')));
    for (const file of ['assets/backgrounds/wallpapers/a.jpg', 'assets/backgrounds/wallpapers/b.webm', 'assets/backgrounds/audio/music.opus', 'assets/icon/regalia-banners/banner.png', 'assets/fonts/font.ttf']) pengu.fs.files.set(file, '');
    vi.stubGlobal('document', { querySelector: vi.fn(() => null) });
    const { FileSystem } = await import('../src/src/utils/fileSystem'); fileSystem = new FileSystem();
});
afterEach(() => vi.unstubAllGlobals());
describe('on-demand asset directory scans', () => {
    it('scans once at startup, coalesces simultaneous requests and preserves selection order', async () => {
        const ls = vi.spyOn(pengu.fs, 'ls'); await fileSystem.init(pengu.context); expect(ls).toHaveBeenCalledTimes(4);
        expect(data.get('Wallpaper-list')).toEqual(['b.webm', 'a.jpg']);
        ls.mockClear(); await Promise.all([fileSystem.refreshLists(), fileSystem.refreshLists(), fileSystem.refreshLists()]);
        expect(ls).toHaveBeenCalledTimes(4); expect(controls.create).not.toHaveBeenCalled();
    });
    it('keeps working lists when PluginFS listing is unavailable', async () => {
        await fileSystem.init(pengu.context); pengu.fs.fail.ls = true; await fileSystem.refreshLists();
        expect(data.get('Wallpaper-list')).toEqual(['b.webm', 'a.jpg']);
    });
    it('rebuilds visible media controls once only for changed media lists', async () => {
        await fileSystem.init(pengu.context);
        vi.mocked(document.querySelector).mockReturnValue({} as Element);
        pengu.fs.files.set('assets/backgrounds/audio/new.opus', ''); pengu.fs.files.set('assets/backgrounds/wallpapers/c.webm', '');
        await fileSystem.refreshLists();
        expect(controls.create).toHaveBeenCalledTimes(1); expect(controls.remove).toHaveBeenCalledTimes(1);
        expect(data.get('Wallpaper-list')).toEqual(['b.webm', 'a.jpg', 'c.webm']);
    });
    it('does not scan or write lists on legacy Pengu', async () => {
        const legacy = installPengu('legacy'); await fileSystem.init(legacy.context); await fileSystem.refreshLists();
        expect(window.isContextFSExist).toBe(false); expect(legacy.dataStore.writes).toBe(0);
    });
});
