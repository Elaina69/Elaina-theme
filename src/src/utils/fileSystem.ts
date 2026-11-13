import { log, error } from './themeLog';
import { fileRegex } from './fileRegex';
import { resyncSelection } from './mediaSelection';
import { del_webm_buttons, create_webm_buttons } from '../theme/customUI/customHomepage';

class FileSystem {
    isContextFSExist = true;
    private context: any = null;
    private currentWallpaperList: string[] = [];
    private currentAudioList: string[] = []
    private currentBannerList: string[] = [];
    private currentFontList: string[] = [];

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
    }

    refreshLists = async () => {
        // A failed listing gives undefined. That is not an empty folder: keep the stored list.
        const dataLists: Record<string, string[] | undefined> = {
            Wallpaper: await this.ls('./assets/backgrounds/wallpapers'),
            Audio: await this.ls('./assets/backgrounds/audio'),
            Banner: await this.ls('./assets/icon/regalia-banners'),
            Font: await this.ls('./assets/fonts'),
        };

        const filteredLists = Object.keys(fileRegex).reduce((acc, key) => {
            const files = dataLists[key];
            if (files) acc[key] = files.filter(file => fileRegex[key].test(file));
            return acc;
        }, {} as Record<string, string[]>);

        Object.entries(filteredLists).forEach(([key, list]) => {
            const prevList = key === 'Wallpaper' ? this.currentWallpaperList
                : key === 'Audio' ? this.currentAudioList
                    : key === 'Banner' ? this.currentBannerList
                        : key === 'Font' ? this.currentFontList
                            : [];

            if (ElainaData && JSON.stringify(prevList) !== JSON.stringify(list)) {
                log(`List changed for ${key}`);
                ElainaData.set(`${key}-list`, list);
                if (key === 'Wallpaper') resyncSelection('wallpaper');
                if (key === 'Audio') resyncSelection('audio');
                del_webm_buttons();
                create_webm_buttons();
            }

            if (key === 'Audio') this.currentAudioList = list;
            else if (key === 'Wallpaper') this.currentWallpaperList = list;
            else if (key === 'Banner') this.currentBannerList = list;
            else if (key === 'Font') this.currentFontList = list;
        });
    }
}

export const fileSystem = new FileSystem();
