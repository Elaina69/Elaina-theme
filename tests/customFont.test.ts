import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ css: new Map<string, string>() }));
vi.mock('../src/src/utils/_styleEngine.ts', () => ({ styleEngine: {
    apply: vi.fn((id: string, css: string) => state.css.set(id, css)),
    remove: vi.fn((id: string) => state.css.delete(id)),
} }));
vi.mock('../src/src/utils/_assets.ts', () => ({ assets: { cssUrl: (...parts: string[]) => 'url("//plugins/@scope/theme/' + parts.join('/') + '")' } }));
let applyCustomFont: typeof import('../src/src/utils/customFont').applyCustomFont;
let values: Record<string, any>;
beforeEach(async () => {
    state.css.clear();
    values = { 'Custom-Font': true, 'Custom-Font-Google': true, 'Google-Font-Url': 'https://fonts.googleapis.com/css2?family=Roboto&display=swap', CurrentFont: 'local.ttf' };
    vi.stubGlobal('ElainaData', { get: (key: string) => values[key] });
    vi.stubGlobal('document', { getElementById: () => null, createElement: () => ({}) });
    ({ applyCustomFont } = await import('../src/src/utils/customFont'));
});
afterEach(() => vi.unstubAllGlobals());
describe('custom font mode changes', () => {
    it('replaces the Google import and variables immediately when switching to local', () => {
        applyCustomFont(); expect(state.css.get('Custom-font')).toContain('--font-display: "Roboto"');
        values['Custom-Font-Google'] = false;
        applyCustomFont();
        const css = state.css.get('Custom-font');
        expect(css).toContain('@font-face'); expect(css).toContain('local.ttf');
        expect(css).toContain('--font-display: "Custom"'); expect(css).toContain('--font-body: "Custom"');
        expect(css).not.toContain('googleapis');
    });
    it('removes every owned override on disable and recreates it on enable', () => {
        applyCustomFont(); values['Custom-Font'] = false; applyCustomFont();
        expect(state.css.size).toBe(0);
        values['Custom-Font'] = true; values['Custom-Font-Google'] = false; applyCustomFont();
        expect(state.css.get('Custom-font')).toContain('local.ttf');
    });
    it('removes a stale import when the Google URL is invalid', () => {
        applyCustomFont(); values['Google-Font-Url'] = 'https://example.com/malicious.css'; applyCustomFont();
        expect(state.css.size).toBe(0);
    });
});
