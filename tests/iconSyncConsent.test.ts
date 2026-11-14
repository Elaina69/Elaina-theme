import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPengu } from './fakes/pengu';
vi.mock('../src/src/utils/utils', () => ({ default: { assets: {
    url: () => 'data:text/javascript,export default '+encodeURIComponent(JSON.stringify({Avatar:'avatar.png', Border:'border.png', 'Hover-card':'hover.png', Honor:'honor.png', 'Rank-icon':'rank.png', 'Clash-banner':'clash.png'})),
    icon: (...parts: string[]) => '//plugins/theme/assets/icon/'+parts.join('/'),
} } }));
vi.mock('../src/src/theme/customUI/customIcon', () => ({ customAvatar: {} }));
vi.mock('../src/src/utils/fileSystem', () => ({ fileSystem: {} }));
vi.mock('../src/src/utils/themeToast', () => ({ themeToast: { promise: (promise: Promise<any>) => promise } }));
let sync: import('../src/src/plugins/syncUserIcons').SyncUserIcons;
let allowed: Record<string, boolean>;
let api: any;
beforeEach(async () => {
    vi.resetModules(); allowed = { 'sync-user-icons': true, 'upload-user-icons': false };
    const pengu = installPengu('legacy', { ElainaTheme: { 'Summoner-ID': 123, 'ElainaTheme-Token': 'test-token', CurrentBanner: 'test.png' } });
    const { ElainaData } = await import('../src/src/utils/themeDataStore'); await ElainaData.init(pengu.context);
    api = { allowed: vi.fn(feature => allowed[feature]), uploadImage: vi.fn().mockResolvedValue(undefined), getImageHashes: vi.fn().mockResolvedValue({}) };
    vi.stubGlobal('elainathemeApi', api); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['image'], {type:'image/png'}))));
    vi.stubGlobal('document', { querySelectorAll: () => [] });
    const { SyncUserIcons } = await import('../src/src/plugins/syncUserIcons'); sync = new SyncUserIcons();
});
afterEach(() => vi.unstubAllGlobals());
describe('independent icon upload and download consent', () => {
    it('does not fetch or upload a banner when upload consent is disabled', async () => {
        await sync.uploadIcon('/banner.png', 'banner'); expect(fetch).not.toHaveBeenCalled(); expect(api.uploadImage).not.toHaveBeenCalled();
    });
    it('downloads only when sharing is off', async () => {
        const downloads = vi.spyOn(sync, 'getFriendsIcons').mockResolvedValue();
        await sync.main(); expect(downloads).toHaveBeenCalledTimes(1); expect(api.getImageHashes).not.toHaveBeenCalled();
    });
    it('uploads without requiring icon downloads to be enabled', async () => {
        allowed['sync-user-icons'] = false; allowed['upload-user-icons'] = true;
        const own = vi.spyOn(sync as any, 'syncOwnIcons').mockResolvedValue(undefined);
        const downloads = vi.spyOn(sync, 'getFriendsIcons').mockResolvedValue();
        await sync.main(); expect(own).toHaveBeenCalledWith(123); expect(downloads).not.toHaveBeenCalled();
    });
    it('rechecks consent after reading the image and does not upload on revocation', async () => {
        allowed['upload-user-icons'] = true;
        vi.mocked(fetch).mockImplementation(async () => { allowed['upload-user-icons'] = false; return new Response(new Blob(['image'], {type:'image/png'})); });
        await sync.uploadIcon('/banner.png', 'banner'); expect(api.uploadImage).not.toHaveBeenCalled();
    });
    it('uploads a PNG banner with the correct identity and MIME type when consent is enabled', async () => {
        allowed['upload-user-icons'] = true;
        await sync.uploadIcon('/banner.png','banner');
        expect(api.uploadImage).toHaveBeenCalledTimes(1);
        const [token,id,type,file] = api.uploadImage.mock.calls[0];
        expect(token).toBe('test-token'); expect(id).toBe(123); expect(type).toBe('banner');
        expect(file.name).toBe('banner.png'); expect(file.type).toBe('image/png'); expect(file.size).toBe(5);
    });

    it('stops at a local file error before uploading an error page as an icon', async () => {
        allowed['upload-user-icons'] = true; vi.mocked(fetch).mockResolvedValue(new Response('missing', {status:404}));
        await sync.uploadIcon('/banner.png', 'banner'); expect(api.uploadImage).not.toHaveBeenCalled();
    });
    it('uses the shipped lowercase banner directory', () => {
        expect((sync as any).getOwnIconMap().find((entry: any) => entry.type === 'banner').url).toContain('/regalia-banners/test.png');
    });
});
