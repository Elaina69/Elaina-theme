import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPengu } from './fakes/pengu';

// The homepage module needs the real client; refreshLists only calls these two.
vi.mock('../src/src/theme/customUI/customHomepage', () => ({
    del_webm_buttons: vi.fn(),
    create_webm_buttons: vi.fn(),
}));

const WALLPAPERS = 'assets/backgrounds/wallpapers';
const AUDIO = 'assets/backgrounds/audio';

async function boot() {
    const pengu = installPengu('pluginfs');
    for (const dir of [WALLPAPERS, AUDIO, 'assets/icon/regalia-banners', 'assets/fonts']) pengu.fs.dirs.add(dir);
    pengu.fs.files.set(`${WALLPAPERS}/a.webm`, '');
    pengu.fs.files.set(`${WALLPAPERS}/b.jpg`, '');
    pengu.fs.files.set(`${AUDIO}/x.flac`, '');

    vi.resetModules();
    const { ElainaData } = await import('../src/src/utils/themeDataStore');
    const { fileSystem } = await import('../src/src/utils/fileSystem');
    await ElainaData.init(pengu.context);
    await fileSystem.init(pengu.context);
    return { ...pengu, ElainaData, fileSystem };
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('refreshLists', () => {
    it('stores the media files found in the asset folders', async () => {
        const { ElainaData, fileSystem } = await boot();
        await fileSystem.refreshLists();
        expect(ElainaData.get('Wallpaper-list')).toEqual(['a.webm', 'b.jpg']);
        expect(ElainaData.get('Audio-list')).toEqual(['x.flac']);
    });

    it('keeps the stored lists when the folder listing fails', async () => {
        const { ElainaData, fileSystem, fs } = await boot();
        await fileSystem.refreshLists();

        fs.fail.ls = true;
        await fileSystem.refreshLists();

        expect(ElainaData.get('Wallpaper-list')).toEqual(['a.webm', 'b.jpg']);
        expect(ElainaData.get('Audio-list')).toEqual(['x.flac']);
    });

    it('keeps the selected wallpaper when a file before it is removed', async () => {
        const { ElainaData, fileSystem, fs } = await boot();
        await fileSystem.refreshLists();
        ElainaData.set('wallpaper-index', 1);
        ElainaData.set('wallpaper-name', 'b.jpg');

        fs.files.delete(`${WALLPAPERS}/a.webm`);
        await fileSystem.refreshLists();

        const list = ElainaData.get('Wallpaper-list');
        expect(list[ElainaData.get('wallpaper-index')]).toBe('b.jpg');
    });
});
