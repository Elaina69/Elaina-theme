import utils from './utils';

/**
 * Adds a font to the document
 * @param {string} folder - The font file path
 * @param {string} font_id - The ID for the style element
 * @param {string} font_family - The font family name
 */
export function addFont(folder: string, font_id: string, font_family: string) {
    const fontStyle = document.createElement('style');
    fontStyle.id = font_id;
    fontStyle.appendChild(document.createTextNode(
        `@font-face {font-family: "${utils.escapeCssString(font_family)}"; src: ${utils.cssUrl(folder)}}`
    ));
    document.body.appendChild(fontStyle);
}
