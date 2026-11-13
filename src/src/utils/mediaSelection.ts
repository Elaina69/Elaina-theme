/**
 * The selected wallpaper and audio file are stored as an index into the file list and as a
 * filename. The filename is what counts: when the list changes (file added, renamed, or a
 * folder listing that came back empty), the index is pointed back at that file.
 */

const kinds = {
    wallpaper: { index: 'wallpaper-index', list: 'Wallpaper-list', name: 'wallpaper-name' },
    audio: { index: 'audio-index', list: 'Audio-list', name: 'audio-name' },
};

type MediaKind = keyof typeof kinds;

/** Selects the file at `index` and remembers its name. */
export function select(kind: MediaKind, index: number): void {
    const keys = kinds[kind];
    ElainaData.set(keys.index, index);
    const name = ElainaData.get(keys.list)?.[index];
    if (name) ElainaData.set(keys.name, name);
}

/** Selects the next (`1`) or previous (`-1`) file, wrapping around at the ends. */
export function stepSelection(kind: MediaKind, delta: number): void {
    const keys = kinds[kind];
    const count = ElainaData.get(keys.list)?.length || 1;
    select(kind, (((ElainaData.get(keys.index) + delta) % count) + count) % count);
}

/**
 * Points the stored index back at the remembered file after the list changed. If the file
 * is not in the list, the name is kept so the selection returns once the file does.
 */
export function resyncSelection(kind: MediaKind): void {
    const keys = kinds[kind];
    const list: string[] = ElainaData.get(keys.list) ?? [];
    const index: number = ElainaData.get(keys.index);
    const name: string | null | undefined = ElainaData.get(keys.name);

    if (name == null) {
        // First run with this version: take over the file the index points at
        if (list[index]) ElainaData.set(keys.name, list[index]);
        return;
    }

    const found = list.indexOf(name);
    if (found >= 0 && found !== index) ElainaData.set(keys.index, found);
}
