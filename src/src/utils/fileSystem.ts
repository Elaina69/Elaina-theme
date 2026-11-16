import { log, error } from './themeLog';
import { fileRegex } from './fileRegex';
import { del_webm_buttons, create_webm_buttons } from '../theme/customUI/customHomepage';

/** Access PluginFS and refresh asset lists only at startup or on user demand. */
export class FileSystem {
    isContextFSExist = true;
    private context: any = null;
    private pendingRefresh: Promise<void> | null = null;

    read = async (path: string): Promise<string | undefined> => {
        return await this.context?.fs.read(path);
    }

    write = async (path: string, content: string, enableAppendMode = false): Promise<boolean> => {
        return await this.context?.fs.write(path, content, { append: enableAppendMode }) ?? false;
    }

    mkdir = async (path: string): Promise<boolean> => {
        return await this.context?.fs.mkdir(path) ?? false;
    }

    stat = async (path: string): Promise<FileStat | undefined> => {
        return await this.context?.fs.stat(path);
    }

    ls = async (path: string): Promise<string[] | undefined> => {
        return await this.context?.fs.ls(path);
    }

    rm = async (path: string, options?: { recursive?: boolean }): Promise<number> => {
        return await this.context?.fs.rm(path, options) ?? 0;
    }

    init = async (context: any) => {
        if (!context.fs) {
            error('context.fs is missing')
            this.isContextFSExist = false;
            this.context = null;
            window.refreshLists = async () => { }
            window.isContextFSExist = this.isContextFSExist;
            return
        }

        this.isContextFSExist = true;
        this.context = context;
        await this.mkdir('./data')

        // For debugging purposes only
        const readFile = (path: string) => this.read(path);
        // @ts-ignore
        window.elainaReadFile = readFile;

        const writeFile = (path: string, content: string, enableAppendMode: boolean) => this.write(path, content, enableAppendMode);
        // @ts-ignore
        window.elainaWriteFile = writeFile;

        const mkdir = (path: string) => this.mkdir(path);
        // @ts-ignore
        window.elainaMkdir = mkdir;

        const stat = (path: string) => this.stat(path);
        // @ts-ignore
        window.elainaStat = stat;

        const ls = (path: string) => this.ls(path);
        // @ts-ignore
        window.elainaLs = ls;

        const rm = (path: string, options?: { recursive?: boolean }) => this.rm(path, options);
        // @ts-ignore
        window.elainaRm = rm;

        const globalRefreshLists = () => this.refreshLists();
        window.refreshLists = globalRefreshLists;

        window.isContextFSExist = this.isContextFSExist;
        await this.refreshLists();
    }

    /** Refresh on startup or user demand; concurrent requests share one directory scan. */
    refreshLists = (): Promise<void> => {
        if (!this.context?.fs) return Promise.resolve();
        if (this.pendingRefresh) return this.pendingRefresh;
        this.pendingRefresh = this.scanLists().catch(reason => error('Could not refresh asset lists:', reason))
            .finally(() => { this.pendingRefresh = null; });
        return this.pendingRefresh;
    }

    private async scanLists(): Promise<void> {
        const folders = { Wallpaper: './assets/backgrounds/wallpapers', Audio: './assets/backgrounds/audio', Banner: './assets/icon/regalia-banners', Font: './assets/fonts' };
        const results = await Promise.all(Object.entries(folders).map(async ([key, path]) => [key, await this.ls(path)] as const));
        const patch: Record<string, string[]> = {};
        for (const [key, files] of results) {
            // A failed listing must not erase a working list or its selected media.
            if (!Array.isArray(files)) continue;
            const list = files.filter(file => fileRegex[key].test(file)).sort();
            const previous: string[] = ElainaData.get(`${key}-list`, []);
            if (JSON.stringify([...previous].sort()) === JSON.stringify(list)) continue;
            // Preserve existing indices when the directory order changes or a file is added.
            patch[`${key}-list`] = [...previous.filter(file => list.includes(file)), ...list.filter(file => !previous.includes(file))];
            log(`List changed for ${key}`);
        }
        if (!Object.keys(patch).length) return;
        ElainaData.setMany(patch);
        if ((patch['Wallpaper-list'] || patch['Audio-list']) && document.querySelector('.webm-bottom-buttons-container, .webm-bottom-buttons-container-hovered')) {
            del_webm_buttons();
            create_webm_buttons();
        }
    }
}

export const fileSystem = new FileSystem();
