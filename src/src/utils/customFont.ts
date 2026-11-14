import { styleEngine } from './_styleEngine.ts';
import { assets } from './_assets.ts';
import { escapeCssString, getSafeGoogleFont } from './_sanitize.ts';

/** Replace both the face and its font variables through the same owned stylesheet. */
export function applyCustomFont(): void {
    // Older versions created this node directly, outside the style engine.
    document.getElementById('Custom-font')?.remove();
    if (!ElainaData.get('Custom-Font')) {
        styleEngine.remove('Custom-font');
        return;
    }

    let face: string;
    let family = 'Custom';
    if (ElainaData.get('Custom-Font-Google')) {
        const font = getSafeGoogleFont(ElainaData.get('Google-Font-Url'));
        if (!font) {
            styleEngine.remove('Custom-font');
            return;
        }
        family = font.family;
        face = `@import url("${escapeCssString(font.url.toString())}");`;
    } else {
        const filename = ElainaData.get('CurrentFont');
        if (typeof filename !== 'string' || !filename.trim()) {
            styleEngine.remove('Custom-font');
            return;
        }
        face = `@font-face { font-family: 'Custom'; src: ${assets.cssUrl('assets/fonts', filename)}; font-display: swap; }`;
    }

    styleEngine.apply('Custom-font', `${face}
        :root {
            --font-display: "${escapeCssString(family)}", 'LoL Display', 'Elaina', 'Times New Roman', Times, Baskerville, Georgia, serif !important;
            --font-body: "${escapeCssString(family)}", 'LoL Body', 'Elaina', Arial, 'Helvetica Neue', Helvetica, sans-serif !important;
        }
    `);
}
