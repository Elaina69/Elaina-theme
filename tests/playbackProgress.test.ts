import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackProgress } from '../src/src/theme/customUI/playbackProgress';

let values: Record<string, number>;
let progress: PlaybackProgress;
let commit: ReturnType<typeof vi.fn>;
let audio: HTMLMediaElement;
let video: HTMLMediaElement;
let controller: AbortController;

beforeEach(() => {
    vi.useFakeTimers();
    values = { 'Audio-currentTime': 12, 'Wallpaper-currentTime': 8 };
    commit = vi.fn(patch => { Object.assign(values, patch); return true; });
    progress = new PlaybackProgress({ get: key => values[key], setMany: commit });
    controller = new AbortController();
    const events = new EventTarget();
    vi.stubGlobal('addEventListener', events.addEventListener.bind(events));
    vi.stubGlobal('removeEventListener', events.removeEventListener.bind(events));
    vi.stubGlobal('dispatchEvent', events.dispatchEvent.bind(events));
    const media = (time: number) => Object.assign(new EventTarget(), { currentTime: time, readyState: 4, isConnected: true }) as unknown as HTMLMediaElement;
    audio = media(32.9); video = media(18.2);
    progress.track(audio, 'Audio-currentTime', controller.signal);
    progress.track(video, 'Wallpaper-currentTime', controller.signal);
});
afterEach(() => { controller.abort(); progress.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('playback persistence at navigation boundaries', () => {
    it('coalesces audio and video into one save per actual page change', () => {
        progress.pageChanged('rcp-fe-lol-activity-center');
        progress.pageChanged('social');
        progress.pageChanged('rcp-fe-lol-activity-center-main');
        expect(commit).not.toHaveBeenCalled();
        progress.pageChanged('rcp-fe-lol-collections');
        progress.pageChanged('rcp-fe-lol-collections');
        expect(commit).toHaveBeenCalledExactlyOnceWith({ 'Audio-currentTime': 32, 'Wallpaper-currentTime': 18 });
        expect(progress.stats()).toMatchObject({ pageChanges: 1, saves: 1, keyWrites: 2, lastReason: 'navigation' });
    });

    it('records twelve saves for twelve page transitions during five simulated minutes', () => {
        progress.pageChanged('rcp-fe-lol-activity-center');
        for (let second = 1; second <= 300; second++) {
            audio.currentTime += 1; video.currentTime += 1;
            vi.advanceTimersByTime(1000);
            if (second % 25 === 0) progress.pageChanged((second / 25) % 2 ? 'rcp-fe-lol-collections' : 'rcp-fe-lol-activity-center');
        }
        expect(commit).toHaveBeenCalledTimes(12);
        expect(progress.stats()).toMatchObject({ pageChanges: 12, saves: 12, audioWrites: 12, wallpaperWrites: 12, keyWrites: 24 });
    });

    it('does not write while media plays for five minutes on the same page', () => {
        progress.pageChanged('rcp-fe-lol-home-main');
        for (let i = 0; i < 300; i++) {
            audio.currentTime += 1; video.currentTime += 1;
            audio.dispatchEvent(new Event('timeupdate')); video.dispatchEvent(new Event('timeupdate'));
            vi.advanceTimersByTime(1000);
        }
        expect(commit).not.toHaveBeenCalled();
        expect(progress.stats().saves).toBe(0);
    });

    it('deduplicates unchanged positions on pause and pagehide', () => {
        audio.dispatchEvent(new Event('pause'));
        video.dispatchEvent(new Event('pause'));
        window.dispatchEvent(new Event('pagehide'));
        expect(commit).toHaveBeenCalledTimes(1);
        audio.currentTime = 48.5;
        window.dispatchEvent(new Event('pagehide'));
        expect(commit).toHaveBeenLastCalledWith({ 'Audio-currentTime': 48 });
    });

    it('never overwrites resume state with an unloaded, detached or invalid element', () => {
        Object.assign(audio, { readyState: 0, currentTime: 0 });
        Object.assign(video, { isConnected: false });
        expect(progress.save('navigation')).toBe(0);
        Object.assign(audio, { readyState: 4, currentTime: NaN });
        expect(progress.save('navigation')).toBe(0);
        expect(values['Audio-currentTime']).toBe(12);
    });

    it('restores after metadata is ready and ignores a later source replacement', () => {
        Object.assign(audio, { readyState: 0, currentTime: 0, src: 'song.opus', duration: 120 });
        progress.restore(audio, 'Audio-currentTime', controller.signal);
        audio.dispatchEvent(new Event('loadedmetadata')); expect(audio.currentTime).toBe(12);
        Object.assign(video, { readyState: 0, currentTime: 0, src: 'old.webm', duration: 120 });
        progress.restore(video, 'Wallpaper-currentTime', controller.signal);
        Object.assign(video, { src: 'new.webm' }); video.dispatchEvent(new Event('loadedmetadata'));
        expect(video.currentTime).toBe(0);
    });

    it('removes aborted media and counts successful saves only', () => {
        commit.mockReturnValue(false);
        expect(progress.save('pause')).toBe(0);
        expect(progress.stats().saves).toBe(0);
        controller.abort();
        audio.dispatchEvent(new Event('pause'));
        progress.save('navigation');
        expect(commit).toHaveBeenCalledTimes(1);
    });
});
