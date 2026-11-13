import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeElement, findElement } from './fakes/settingsUI';

vi.mock('../src/src/plugins/settingsGroups/settingsUI.ts', async () => ({ UI: (await import('./fakes/settingsUI')).fakeUI }));
vi.mock('../src/src/utils/themeToast.ts', () => ({ themeToast: { promise: vi.fn((promise: Promise<unknown>) => promise) } }));
vi.mock('../src/src/utils/themeLog.ts', () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }));

let store: Record<string, unknown>;
let api: ReturnType<typeof apiMock>;
const apiMock = () => ({
    ensureCurrentSession: vi.fn(), allowed: vi.fn(() => true),
    readBackup: vi.fn(async (): Promise<ThemeBackupResponse> => ({ success: true, data: {} })),
    writeBackup: vi.fn(async (): Promise<ThemeBackupResponse> => ({ success: true })),
    deleteBackup: vi.fn(async (): Promise<ThemeBackupResponse> => ({ success: true })),
});
const elementsOf = (elements: HTMLElement[]) => elements as unknown as FakeElement[];
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};

beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    store = { 'backup-datastore': true, 'Theme-language': 'default' };
    vi.stubGlobal('ElainaData', {
        get: (key: string, fallback: unknown) => Object.hasOwn(store, key) ? store[key] : fallback,
        set: (key: string, value: unknown) => { store[key] = value; return true; },
        has: (key: string) => Object.hasOwn(store, key),
        getAll: () => ({ ...store }),
        setAll: vi.fn((data: Record<string, unknown>) => { store = { ...data }; }),
        flush: vi.fn(async () => {}),
    });
    vi.stubGlobal('document', { createElement: (tag: string) => new FakeElement(tag) });
    vi.stubGlobal('getString', vi.fn(async (key: string) => key));
    vi.stubGlobal('restartClient', vi.fn());
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Unavailable'))));
    api = apiMock(); vi.stubGlobal('elainathemeApi', api);
});

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('backup settings UI', () => {
    it('loads the merged tab entry with both sections and removes its spinner', async () => {
        store['backup-datastore'] = false;
        const { backuprestoretab } = await import('../src/src/plugins/settingsGroups/backupRestore/backupActions');
        const panel = new FakeElement();
        await backuprestoretab(panel as unknown as Element);
        expect(findElement(panel.children, 'ManualBackup')).toBeDefined();
        expect(findElement(panel.children, 'bakdata')).toBeDefined();
        expect(findElement(panel.children, 'loading')).toBeUndefined();
        expect(api.readBackup).not.toHaveBeenCalled();
    });

    it('does not check the cloud merely by opening the tab with cloud backup disabled', async () => {
        store['backup-datastore'] = false;
        const { cloudBackupSection } = await import('../src/src/plugins/settingsGroups/backupRestore/_cloudBackup');
        const section = await cloudBackupSection();
        await section.postSetup();
        expect(api.readBackup).not.toHaveBeenCalled();
        expect(findElement(elementsOf(section.elements), 'datastore-cloud-checking')!.textContent).toContain('cloud-disabled');
        expect(findElement(elementsOf(section.elements), 'restore-data-button')!.style.visibility).toBe('hidden');
    });

    it('discards an old read after cloud backup is switched off', async () => {
        const { cloudBackupSection } = await import('../src/src/plugins/settingsGroups/backupRestore/_cloudBackup');
        const response = deferred<ThemeBackupResponse>();
        api.readBackup.mockReturnValueOnce(response.promise);
        const section = await cloudBackupSection();
        const elements = elementsOf(section.elements);
        const checking = section.postSetup();
        await vi.advanceTimersByTimeAsync(0);
        findElement(elements, 'bakdata')!.toggle!();
        await vi.advanceTimersByTimeAsync(0);
        response.resolve({ success: true, data: { 'Theme-language': 'vi-VN' } });
        await checking;
        expect(findElement(elements, 'datastore-cloud-checking')!.textContent).toContain('cloud-disabled');
        expect(findElement(elements, 'restore-data-button')!.style.visibility).toBe('hidden');
        expect(findElement(elements, 'backupInfo')!.style.visibility).toBe('hidden');
    });

    it('shows failures as errors rather than a missing backup', async () => {
        const { cloudBackupSection } = await import('../src/src/plugins/settingsGroups/backupRestore/_cloudBackup');
        api.readBackup.mockRejectedValueOnce(new Error('Sign-in required'));
        const section = await cloudBackupSection();
        await section.postSetup();
        const label = findElement(elementsOf(section.elements), 'datastore-cloud-checking')!;
        expect(label.style.color).toBe('red');
        expect(label.textContent).toContain('Sign-in required');
        expect(label.textContent).not.toContain('check-backup-error');
    });

    it('hides confirmed deletion without polling again and ignores duplicate clicks', async () => {
        const { cloudBackupSection } = await import('../src/src/plugins/settingsGroups/backupRestore/_cloudBackup');
        api.readBackup.mockResolvedValue({ success: true, data: { 'Theme-language': 'vi-VN' } });
        const response = deferred<ThemeBackupResponse>();
        api.deleteBackup.mockReturnValue(response.promise);
        const section = await cloudBackupSection();
        await section.postSetup();
        const elements = elementsOf(section.elements);
        const button = findElement(elements, 'delete-data-button')!;
        expect(button.style.visibility).toBe('visible');
        const first = button.click(); const second = button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(api.deleteBackup).toHaveBeenCalledOnce();
        expect(button.getAttribute('disabled')).toBe('true');
        response.resolve({ success: true });
        await Promise.all([first, second]);
        expect(api.readBackup).toHaveBeenCalledOnce();
        expect(button.style.visibility).toBe('hidden');
        expect(findElement(elements, 'backupInfo')!.style.visibility).toBe('hidden');
    });

    it('keeps restore/delete available when deletion fails', async () => {
        const { cloudBackupSection } = await import('../src/src/plugins/settingsGroups/backupRestore/_cloudBackup');
        api.readBackup.mockResolvedValue({ success: true, data: { 'Theme-language': 'vi-VN' } });
        api.deleteBackup.mockRejectedValueOnce(new Error('Offline'));
        const section = await cloudBackupSection(); await section.postSetup();
        const button = findElement(elementsOf(section.elements), 'delete-data-button')!;
        await button.click();
        expect(button.style.visibility).toBe('visible');
        expect(button.getAttribute('disabled')).toBeNull();
    });

    it('keeps local controls usable when optional developer system information fails', async () => {
        store['Dev-mode'] = true;
        const { manualBackupSection } = await import('../src/src/plugins/settingsGroups/backupRestore/_manualBackup');
        const elements = elementsOf(await manualBackupSection());
        await vi.advanceTimersByTimeAsync(0);
        expect(findElement(elements, 'ManualRestore')).toBeDefined();
        expect(findElement(elements, 'systemInfo-Os')!.textContent).toBe('');
    });

    it('accepts JSON files with an empty MIME type, reads once, and resets the picker', async () => {
        const { manualBackupSection } = await import('../src/src/plugins/settingsGroups/backupRestore/_manualBackup');
        const elements = elementsOf(await manualBackupSection());
        const input = findElement(elements, 'manualRestoreInput')!;
        const backup = { name: 'backup.JSON', type: '', text: vi.fn(async () => '{"Theme-language":"vi-VN"}') } as unknown as File;
        input.value = 'backup.JSON'; input.files = [backup];
        await input.onchange!({ target: input });
        expect(backup.text).toHaveBeenCalledOnce();
        expect(input.value).toBe('');
        expect(store['Theme-language']).toBe('vi-VN');
        expect(findElement(elements, 'restoreFileInfo')!.textContent).toContain('restore-success');
        const { themeToast } = await import('../src/src/utils/themeToast');
        expect(themeToast.promise).toHaveBeenCalledOnce();
    });

    it('reports disk failures separately from invalid JSON', async () => {
        vi.mocked(ElainaData.flush).mockRejectedValueOnce(new Error('Disk full'));
        const { manualBackupSection } = await import('../src/src/plugins/settingsGroups/backupRestore/_manualBackup');
        const elements = elementsOf(await manualBackupSection());
        const input = findElement(elements, 'manualRestoreInput')!;
        input.files = [{ name: 'backup.json', type: '', text: async () => '{"Theme-language":"vi-VN"}' } as File];
        await input.onchange!({ target: input });
        const info = findElement(elements, 'restoreFileInfo')!;
        expect(info.textContent).toContain('restore-error');
        expect(info.textContent).toContain('Disk full');
        expect(info.textContent).not.toContain('invalid-json');
        expect(window.restartClient).not.toHaveBeenCalled();
    });
});
