import { cssUrl, escapeCssString } from './_sanitize.ts';

type ImageReplacementOptions = {
    position?: string;
    size?: string;
    repeat?: string;
};

type BackgroundReplacementOptions = ImageReplacementOptions & {
    important?: boolean;
};

function cssAttrValue(value: string): string {
    return `"${escapeCssString(value)}"`;
}

function attrContains(attr: string, value: string, selectorPrefix = ''): string {
    return `${selectorPrefix}[${attr}*=${cssAttrValue(value)}]`;
}

function imageReplacement(selector: string, newUrl: string, options: ImageReplacementOptions = {}): string {
    const position = options.position || '0 0';
    const size = options.size || '100% 100%';
    const repeat = options.repeat || 'no-repeat';

    return `${selector} {
        object-position: -9999px !important;
        background: ${cssUrl(newUrl)} ${position} / ${size} ${repeat} !important;
    }`;
}

function backgroundReplacement(selector: string, newUrl: string, options: BackgroundReplacementOptions = {}): string {
    const important = options.important === false ? '' : ' !important';
    const position = options.position || 'center';
    const size = options.size || 'cover';
    const repeat = options.repeat || 'no-repeat';

    return `${selector} {
        background-image: ${cssUrl(newUrl)}${important};
        background-position: ${position}${important};
        background-size: ${size}${important};
        background-repeat: ${repeat}${important};
    }`;
}

function imageSrc(oldSrcPart: string, newUrl: string, selectorPrefix = 'img'): string {
    return imageReplacement(attrContains('src', oldSrcPart, selectorPrefix), newUrl);
}

function imageHref(oldHrefPart: string, newUrl: string, selectorPrefix = ''): string {
    return imageReplacement(attrContains('href', oldHrefPart, selectorPrefix), newUrl);
}

function styleBackground(oldUrlPart: string, newUrl: string, selectorPrefix = ''): string {
    return backgroundReplacement(attrContains('style', oldUrlPart, selectorPrefix), newUrl);
}

export const assetReplacement = {
    attrContains,
    imageReplacement,
    backgroundReplacement,
    imageSrc,
    imageHref,
    styleBackground
};
