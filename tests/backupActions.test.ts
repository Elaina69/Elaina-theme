import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPengu, type PenguFlavour } from './fakes/pengu';
import defaults from '../src/src/config/datastoreDefault.js';

vi.mock('../src/src/plugins/settingsGroups/settingsUI.ts', () => ({ UI: {} }));
vi.mock('../src/src/utils/themeToast.ts', () => ({
    themeToast: { promise: vi.fn((promise: Promise<unknown>) => promise) },
}));

const FILE = 'data/ElainaData.json';
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const file = (contents: string, name = 'backup.json', type = '') => ({
    name, type, text: vi.fn(async () => contents),
}) as unknown as File;

async function boot(stored: Record<string, unknown> = {}, flavour: PenguFlavour = 'legacy') {
    const pengu = installPengu(flavour, { ElainaTheme: stored });
    vi.resetModules();
    const { ElainaData } = await import('../src/src/utils/themeDataStore');
    await ElainaData.init(pengu.context);
    const actions = await import('../src/src/plugins/settingsGroups/backupRestore/backupActions');
    return { ...pengu, ElainaData, ...actions };
}

function modernApi() {
    const api = {
        allowed: vi.fn(() => true),
        ensureCurrentSession: vi.fn(),
        login: vi.fn(),
        readBackup: vi.fn(async (): Promise<ThemeBackupResponse> => ({ success: true, data: {} })),
        writeBackup: vi.fn(async (): Promise<ThemeBackupResponse> => ({ success: true })),
        deleteBackup: vi.fn(async (): Promise<ThemeBackupResponse> => ({ success: true })),
    };
    vi.stubGlobal('elainathemeApi', api);
    return api;
}

function legacyApi() {
    const api = { baseUrl: () => 'https://backup.test/', login: vi.fn(), writeBackup: vi.fn(), deleteBackup: vi.fn() };
    vi.stubGlobal('elainathemeApi', api);
    return api;
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('getString', vi.fn(async (key: string) => key));
    vi.stubGlobal('restartClient', vi.fn());
    vi.stubGlobal('elainathemeApi', undefined);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request'); }));
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('local backups', () => {
    it('exports a detached snapshot offline, leaves defaults intact, and releases the download URL', async () => {
        const { backupActions, ElainaData } = await boot({
            'Theme-language': 'vi-VN', 'Summoner-ID': 123, 'ElainaTheme-Token': 'secret', 'last-backup-time': 'old',
        });
        const defaultLanguage = defaults['Theme-language'];
        const anchor = { click: vi.fn(), remove: vi.fn(), href: '', download: '', hidden: false };
        const appendChild = vi.fn();
        vi.stubGlobal('document', { body: { appendChild }, createElement: vi.fn(() => anchor) });
        const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup');
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        await backupActions.exportBackupFile();
        const payload = JSON.parse(await (create.mock.calls[0][0] as Blob).text());
        expect(payload['Theme-language']).toBe('vi-VN');
        expect(payload['ElainaTheme-Token']).toBeUndefined();
        expect(payload['Summoner-ID']).toBeUndefined();
        expect(payload['last-backup-time']).toBe(ElainaData.get('last-backup-time'));
        expect(defaults['Theme-language']).toBe(defaultLanguage);
        expect(anchor.download).toBe('ElainaTheme-123.json');
        expect(anchor.click).toHaveBeenCalledOnce();
        expect(anchor.remove).toHaveBeenCalledOnce();
        await vi.runAllTimersAsync();
        expect(revoke).toHaveBeenCalledWith('blob:backup');
        expect(fetch).not.toHaveBeenCalled();
    });

    for (const flavour of ['legacy', 'pluginfs'] as const) {
        it('reads once and restores in one batch, preserving live credentials (' + flavour + ')', async () => {
            const { backupActions, ElainaData, dataStore, fs } = await boot({
                'Theme-language': 'default', 'ElainaTheme-Token': 'current', 'Summoner-ID': 123, cache: { keep: true },
            }, flavour);
            const backup = file('{"Theme-language":"vi-VN","ElainaTheme-Token":"foreign","Summoner-ID":999,"__proto__":{"polluted":true}}');
            const before = dataStore.writes;
            await backupActions.restoreBackupFile(backup);
            expect(backup.text).toHaveBeenCalledOnce();
            expect(ElainaData.get('Theme-language')).toBe('vi-VN');
            expect(ElainaData.get('ElainaTheme-Token')).toBe('current');
            expect(ElainaData.get('Summoner-ID')).toBe(123);
            expect(ElainaData.get('cache')).toEqual({ keep: true });
            expect(Object.hasOwn(ElainaData.getAll(), '__proto__')).toBe(false);
            if (flavour === 'legacy') expect(dataStore.writes - before).toBe(1);
            else expect(JSON.parse(fs.files.get(FILE)!)['Theme-language']).toBe('vi-VN');
            expect(window.restartClient).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(2000);
            expect(window.restartClient).toHaveBeenCalledOnce();
            expect(fetch).not.toHaveBeenCalled();
        });
    }

    it.each(['{', 'null', '[]', '42', '"settings"', '{}', '{"unknown":1}', '{"ElainaTheme-Token":"foreign"}'])('rejects invalid backup %s before writing', async contents => {
        const { backupActions, InvalidBackupError, dataStore } = await boot({ 'Theme-language': 'vi-VN' });
        const before = dataStore.writes;
        await expect(backupActions.restoreBackupFile(file(contents))).rejects.toBeInstanceOf(InvalidBackupError);
        expect(dataStore.writes).toBe(before);
        expect(window.restartClient).not.toHaveBeenCalled();
    });

    it('does not restart or report success when PluginFS cannot persist', async () => {
        const { backupActions, fs } = await boot({}, 'pluginfs');
        fs.fail.write = true;
        await expect(backupActions.restoreBackupFile(file('{"Theme-language":"vi-VN"}'))).rejects.toThrow('persist');
        await vi.runAllTimersAsync();
        expect(window.restartClient).not.toHaveBeenCalled();
    });
});

describe('session-aware cloud API', () => {
    it('deduplicates simultaneous checks and leaves session management to the CDN', async () => {
        const { backupActions } = await boot({ 'backup-datastore': true, 'Summoner-ID': 123, 'ElainaTheme-Token': 'current' });
        const api = modernApi();
        const response = deferred<any>();
        api.readBackup.mockReturnValue(response.promise);
        const one = backupActions.readCloudBackup();
        const two = backupActions.readCloudBackup();
        expect(one).toBe(two);
        response.resolve({ success: true, data: '{"Theme-language":"vi-VN"}' });
        await expect(one).resolves.toEqual({ 'Theme-language': 'vi-VN' });
        expect(api.readBackup).toHaveBeenCalledOnce();
        expect(api.ensureCurrentSession).not.toHaveBeenCalled();
        expect(api.login).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([null, '', {}, '{}'])('treats an explicitly empty server backup as missing (%j)', async data => {
        const { backupActions } = await boot({ 'backup-datastore': true });
        const api = modernApi();
        api.readBackup.mockResolvedValue({ success: true, data });
        await expect(backupActions.readCloudBackup()).resolves.toBeNull();
        await expect(backupActions.restoreCloudBackup()).rejects.toThrow('check-backup-error');
        expect(window.restartClient).not.toHaveBeenCalled();
    });

    it('surfaces rejected or malformed responses rather than reporting no backup', async () => {
        const { backupActions } = await boot({ 'backup-datastore': true });
        const api = modernApi();
        api.readBackup.mockResolvedValueOnce({ success: false, error: 'Session expired' } as any);
        await expect(backupActions.readCloudBackup()).rejects.toThrow('Session expired');
        api.readBackup.mockResolvedValueOnce({ success: true, data: 'not JSON' });
        await expect(backupActions.readCloudBackup()).rejects.toThrow('Invalid');
        api.readBackup.mockRejectedValueOnce(new Error('Server unavailable'));
        await expect(backupActions.readCloudBackup()).rejects.toThrow('Server unavailable');
    });

    it('does not contact the cloud while disabled or denied by the consent gate', async () => {
        const { backupActions, ElainaData } = await boot({ 'backup-datastore': false });
        const api = modernApi();
        await expect(backupActions.readCloudBackup()).rejects.toThrow('cloud-disabled');
        await expect(backupActions.writeCloudBackup()).rejects.toThrow('cloud-disabled');
        ElainaData.set('backup-datastore', true);
        api.allowed.mockReturnValue(false);
        await expect(backupActions.readCloudBackup()).rejects.toThrow('cloud-permission-required');
        expect(api.readBackup).not.toHaveBeenCalled();
        expect(api.writeBackup).not.toHaveBeenCalled();
        // Explicit deletion is still allowed after opt-out.
        await backupActions.deleteCloudBackup();
        expect(api.deleteBackup).toHaveBeenCalledOnce();
    });

    it('awaits upload confirmation, coalesces uploads, and timestamps only successful backups', async () => {
        const { backupActions, ElainaData } = await boot({ 'backup-datastore': true, 'last-backup-time': 'old' });
        const api = modernApi();
        const response = deferred<any>();
        api.writeBackup.mockReturnValue(response.promise);
        const first = backupActions.writeCloudBackup();
        expect(backupActions.writeCloudBackup()).toBe(first);
        await vi.advanceTimersByTimeAsync(0);
        expect(api.writeBackup).toHaveBeenCalledOnce();
        expect(ElainaData.get('last-backup-time')).toBe('old');
        response.resolve({ success: true });
        await first;
        expect(ElainaData.get('last-backup-time')).not.toBe('old');
        const saved = ElainaData.get('last-backup-time');
        api.writeBackup.mockResolvedValueOnce({ success: false, error: 'quota reached' } as any);
        await expect(backupActions.writeCloudBackup()).rejects.toThrow('quota reached');
        expect(ElainaData.get('last-backup-time')).toBe(saved);
        expect(defaults['last-backup-time']).toBe('');
    });

    it('serializes write/delete so a pending upload cannot recreate a deleted backup', async () => {
        const { backupActions } = await boot({ 'backup-datastore': true });
        const api = modernApi();
        const response = deferred<any>();
        api.writeBackup.mockReturnValue(response.promise);
        const writing = backupActions.writeCloudBackup();
        const deleting = backupActions.deleteCloudBackup();
        await vi.advanceTimersByTimeAsync(0);
        expect(api.deleteBackup).not.toHaveBeenCalled();
        response.resolve({ success: true });
        await Promise.all([writing, deleting]);
        expect(api.deleteBackup).toHaveBeenCalledOnce();
    });

    it('restores and flushes cloud data before restart without backing it up again', async () => {
        const { backupActions, ElainaData } = await boot({ 'backup-datastore': true }, 'pluginfs');
        const api = modernApi();
        api.readBackup.mockResolvedValue({ success: true, data: { 'Theme-language': 'vi-VN' } });
        await backupActions.restoreCloudBackup();
        expect(ElainaData.get('Theme-language')).toBe('vi-VN');
        await backupActions.writeCloudBackup();
        expect(api.writeBackup).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(2000);
        expect(window.restartClient).toHaveBeenCalledOnce();
    });
});

describe('legacy CDN compatibility', () => {
    const player = { summonerId: 123, gameName: 'Witch', tagLine: 'NA1' };
    const signedIn = { 'backup-datastore': true, 'ElainaTheme-Token': 'access', 'ElainaTheme-Token-Owner': '123' };

    it('signs in once for concurrent actions and avoids legacy fire-and-forget methods', async () => {
        const { backupActions, ElainaData } = await boot({ 'backup-datastore': true });
        const api = legacyApi();
        const fetchMock = vi.fn(async (url: string) => {
            if (url === '/lol-summoner/v1/current-summoner') return json(player);
            if (url.endsWith('/login')) return json({ token: 'access', refreshToken: 'refresh' });
            if (url.endsWith('/data')) return json({ success: true, data: {} });
            throw new Error('Unexpected URL: ' + url);
        });
        vi.stubGlobal('fetch', fetchMock);
        await Promise.all([backupActions.readCloudBackup(), backupActions.writeCloudBackup()]);
        expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/login'))).toHaveLength(1);
        expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/register'))).toBe(false);
        expect(api.writeBackup).not.toHaveBeenCalled();
        expect(ElainaData.get('ElainaTheme-Token-Owner')).toBe('123');
        expect(ElainaData.get('ElainaTheme-Refresh-Token')).toBe('refresh');
    });

    it('registers an unknown user only after login rejects it', async () => {
        const { backupActions } = await boot({ 'backup-datastore': true });
        legacyApi();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(json(player))
            .mockResolvedValueOnce(json({ error: 'User not found' }, 401))
            .mockResolvedValueOnce(json({ success: true }))
            .mockResolvedValueOnce(json({ token: 'new-token', refreshToken: 'refresh' }))
            .mockResolvedValueOnce(json({ success: true, data: {} }));
        vi.stubGlobal('fetch', fetchMock);
        await backupActions.readCloudBackup();
        expect(fetchMock.mock.calls.map(([url]) => url.split('/').pop())).toEqual(['current-summoner', 'login', 'register', 'login', 'data']);
    });

    it('refreshes an expired owned token and retries authentication exactly once', async () => {
        const { backupActions } = await boot({ ...signedIn, 'ElainaTheme-Refresh-Token': 'refresh' });
        legacyApi();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(json(player))
            .mockResolvedValueOnce(json({ error: 'expired' }, 401))
            .mockResolvedValueOnce(json({ accessToken: 'fresh' }))
            .mockResolvedValueOnce(json({ success: true, data: { 'Theme-language': 'vi-VN' } }));
        vi.stubGlobal('fetch', fetchMock);
        await expect(backupActions.readCloudBackup()).resolves.toEqual({ 'Theme-language': 'vi-VN' });
        expect(fetchMock.mock.calls.map(([url]) => url.split('/').pop())).toEqual(['current-summoner', 'data', 'refresh-token', 'data']);
        expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('fresh');
    });

    it('does not reuse a different account token and clears its old refresh token', async () => {
        const { backupActions, ElainaData } = await boot({ ...signedIn, 'ElainaTheme-Token-Owner': '999', 'ElainaTheme-Refresh-Token': 'foreign-refresh' });
        legacyApi();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(json(player))
            .mockResolvedValueOnce(json({ token: 'current-account' }))
            .mockResolvedValueOnce(json({ success: true, data: {} }));
        vi.stubGlobal('fetch', fetchMock);
        await backupActions.readCloudBackup();
        expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('current-account');
        expect(ElainaData.has('ElainaTheme-Refresh-Token')).toBe(false);
    });

    it('waits for a real delete response rather than the old helper returning undefined', async () => {
        const { backupActions } = await boot(signedIn);
        const api = legacyApi();
        const response = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(player)).mockReturnValueOnce(response.promise));
        let finished = false;
        const deleting = backupActions.deleteCloudBackup().then(() => { finished = true; });
        await vi.advanceTimersByTimeAsync(0);
        expect(finished).toBe(false);
        response.resolve(json({ success: true }));
        await deleting;
        expect(finished).toBe(true);
        expect(api.deleteBackup).not.toHaveBeenCalled();
    });

    it('does not retry a failed write or advance the backup timestamp', async () => {
        const { backupActions, ElainaData } = await boot({ ...signedIn, 'last-backup-time': 'old' });
        legacyApi();
        const fetchMock = vi.fn().mockResolvedValueOnce(json(player)).mockResolvedValueOnce(json({ error: 'offline' }, 503));
        vi.stubGlobal('fetch', fetchMock);
        await expect(backupActions.writeCloudBackup()).rejects.toThrow('offline');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(ElainaData.get('last-backup-time')).toBe('old');
    });

    it('aborts a timed-out request and does not retry it', async () => {
        const { backupActions } = await boot(signedIn);
        legacyApi();
        const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => reject(new Error('Request timed out')));
        }));
        vi.stubGlobal('fetch', fetchMock);
        const result = backupActions.readCloudBackup();
        const check = expect(result).rejects.toThrow('timed out');
        await vi.advanceTimersByTimeAsync(10000);
        await check;
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
