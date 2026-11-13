import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resyncSelection, select, stepSelection } from '../src/src/utils/mediaSelection';

/** Minimal ElainaData: the selection helpers only need get and set. */
function fakeElainaData(initial: Record<string, any>) {
    const data = { ...initial };
    (globalThis as any).ElainaData = {
        get: (key: string) => data[key],
        set: (key: string, value: any) => { data[key] = value; },
    };
    return data;
}

describe('wallpaper and audio selection', () => {
    let data: Record<string, any>;

    beforeEach(() => {
        data = fakeElainaData({
            'Wallpaper-list': ['a.webm', 'b.jpg', 'c.webm'],
            'wallpaper-index': 1,
            'Audio-list': ['x.flac', 'y.flac'],
            'audio-index': 0,
        });
    });

    it('remembers the selected file by name', () => {
        select('wallpaper', 2);
        expect(data['wallpaper-index']).toBe(2);
        expect(data['wallpaper-name']).toBe('c.webm');
    });

    it('steps forwards and backwards with wrap-around', () => {
        stepSelection('audio', 1);
        expect(data['audio-name']).toBe('y.flac');
        stepSelection('audio', 1);
        expect(data['audio-name']).toBe('x.flac');
        stepSelection('audio', -1);
        expect(data['audio-index']).toBe(1);
    });

    it('adopts the name of the current index on first run after an update', () => {
        resyncSelection('wallpaper');
        expect(data['wallpaper-name']).toBe('b.jpg');
        expect(data['wallpaper-index']).toBe(1);
    });

    it('follows the file when the list order changes', () => {
        select('wallpaper', 1);
        data['Wallpaper-list'] = ['0-new.webm', 'a.webm', 'b.jpg', 'c.webm'];
        resyncSelection('wallpaper');
        expect(data['wallpaper-index']).toBe(2);
    });

    it('comes back to the selected file after the list was empty for a moment', () => {
        select('wallpaper', 2);

        data['Wallpaper-list'] = [];
        resyncSelection('wallpaper');
        data['wallpaper-index'] = 0; // what the homepage does with an out-of-range index
        expect(data['wallpaper-name']).toBe('c.webm');

        data['Wallpaper-list'] = ['a.webm', 'b.jpg', 'c.webm'];
        resyncSelection('wallpaper');
        expect(data['wallpaper-index']).toBe(2);
    });

    it('does not write when nothing changed', () => {
        select('wallpaper', 1);
        const set = vi.spyOn((globalThis as any).ElainaData, 'set');
        resyncSelection('wallpaper');
        expect(set).not.toHaveBeenCalled();
    });
});
