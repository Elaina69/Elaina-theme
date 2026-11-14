type ProgressKey = 'Audio-currentTime' | 'Wallpaper-currentTime';
type ProgressStore = Pick<elainaData, 'get' | 'setMany'>;

export const HOME_SCREENS = new Set(['rcp-fe-lol-home', 'rcp-fe-lol-home-main', 'rcp-fe-lol-activity-center', 'rcp-fe-lol-activity-center-main']);
export const CHROME_SCREENS = new Set(['window-controls', 'social', 'rcp-fe-lol-navigation-screen']);

/** Persist only at navigation, pause and unload boundaries, never on a playback timer. */
export class PlaybackProgress {
    private media = new Map<ProgressKey, HTMLMediaElement>();
    private currentPage: string | null = null;
    private lifecycle: AbortController | null = null;
    private counters = this.emptyStats();

    constructor(private store: ProgressStore) {}

    private emptyStats() {
        return { startedAt: Date.now(), pageChanges: 0, saves: 0, keyWrites: 0, audioWrites: 0, wallpaperWrites: 0, lastReason: null as string | null };
    }

    stats = () => ({ ...this.counters });
    resetStats = () => { this.counters = this.emptyStats(); };

    restore(element: HTMLMediaElement, key: ProgressKey, signal: AbortSignal): void {
        const saved = this.store.get(key);
        if (signal.aborted || typeof saved !== 'number' || !Number.isFinite(saved) || saved <= 0) return;
        const source = element.src;
        const seek = () => {
            if (element.src !== source || signal.aborted) return;
            // A replacement file may be shorter than the recording from a previous session.
            element.currentTime = Number.isFinite(element.duration) && saved >= element.duration ? 0 : saved;
        };
        if (element.readyState > 0) seek();
        else element.addEventListener('loadedmetadata', seek, { once: true, signal });
    }

    track(element: HTMLMediaElement, key: ProgressKey, signal: AbortSignal): void {
        if (signal.aborted) return;
        this.media.set(key, element);
        element.addEventListener('pause', () => this.save('pause'), { signal });
        signal.addEventListener('abort', () => {
            if (this.media.get(key) === element) this.media.delete(key);
        }, { once: true });
        if (!this.lifecycle) {
            this.lifecycle = new AbortController();
            window.addEventListener('pagehide', () => this.save('pagehide'), { signal: this.lifecycle.signal });
        }
    }

    pageChanged(name: string | null): boolean {
        if (!name || CHROME_SCREENS.has(name)) return false;
        const page = HOME_SCREENS.has(name) ? 'homepage' : name;
        if (page === this.currentPage) return false;
        const previous = this.currentPage;
        this.currentPage = page;
        // Establish the initial page without overwriting the stored resume positions.
        if (previous === null) return false;
        this.counters.pageChanges++;
        this.save('navigation');
        return true;
    }

    save(reason: string): number {
        const patch: Partial<Record<ProgressKey, number>> = {};
        for (const [key, element] of this.media) {
            if (!element.isConnected || element.readyState === 0 || !Number.isFinite(element.currentTime)) continue;
            const time = Math.max(0, Math.floor(element.currentTime));
            if (time !== this.store.get(key)) patch[key] = time;
        }
        const keys = Object.keys(patch) as ProgressKey[];
        if (!keys.length || !this.store.setMany(patch)) return 0;
        this.counters.saves++;
        this.counters.keyWrites += keys.length;
        this.counters.audioWrites += Number(keys.includes('Audio-currentTime'));
        this.counters.wallpaperWrites += Number(keys.includes('Wallpaper-currentTime'));
        this.counters.lastReason = reason;
        return keys.length;
    }

    stop(): void {
        this.lifecycle?.abort();
        this.lifecycle = null;
        this.media.clear();
        this.currentPage = null;
    }
}
