/**
 * @author ReformedDoge
 * @description shadow-manager - A part of Snooze-CSS
 * @link https://github.com/ReformedDoge || https://github.com/ReformedDoge/Snooze-CSS
 * @modified by Elaina Da Catto, for Elaina Theme
 */

type StyleEngineOptions = {
    document?: boolean;
    shadow?: boolean;
    iframe?: boolean;
};

type RegisteredStyle = {
    css: string;
    options: Required<StyleEngineOptions>;
};

type SplitCss = {
    documentCss: string;
    embeddedCss: string;
};

const STYLE_PREFIX = 'elaina-style-engine';
const SHADOW_STYLE_ID = `${STYLE_PREFIX}-shadow`;
const IFRAME_STYLE_ID = `${STYLE_PREFIX}-iframe`;
const styles = new Map<string, RegisteredStyle>();
const shadowRoots = new Set<ShadowRoot>();
const iframeElements = new Set<HTMLIFrameElement>();

let initialized = false;
let originalAttachShadow: typeof Element.prototype.attachShadow | null = null;
let sharedShadowSheet: CSSStyleSheet | null = null;
let canUseConstructedSheet = true;
let iframeObserver: MutationObserver | null = null;

function normalizeOptions(options: StyleEngineOptions = {}): Required<StyleEngineOptions> {
    return {
        document: options.document !== false,
        shadow: options.shadow === true,
        iframe: options.iframe === true
    };
}

function getStyleElementId(id: string): string {
    return `${STYLE_PREFIX}-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function splitCss(css: string): SplitCss {
    let documentOnlyCss = '';
    const embeddedCss = css.replace(/@import\s+(?:url\([^)]+\)|["'][^"']+["'])[^;]*;|@font-face\s*\{[\s\S]*?\}/gi, (match) => {
        documentOnlyCss += `${match}\n`;
        return '';
    });

    return {
        documentCss: `${documentOnlyCss}${embeddedCss}`,
        embeddedCss
    };
}

function getHead(targetDocument: Document): HTMLElement {
    return targetDocument.head || targetDocument.documentElement;
}

function syncDocumentStyle(id: string, registeredStyle: RegisteredStyle): void {
    const styleElementId = getStyleElementId(id);
    const existing = document.getElementById(styleElementId);

    if (!registeredStyle.options.document) {
        existing?.remove();
        return;
    }

    const styleElement = (existing as HTMLStyleElement | null) || document.createElement('style');
    styleElement.id = styleElementId;
    styleElement.textContent = splitCss(registeredStyle.css).documentCss;

    if (!styleElement.parentElement) {
        getHead(document).appendChild(styleElement);
    }
}

function getCombinedEmbeddedCss(target: 'shadow' | 'iframe'): string {
    return Array.from(styles.values())
        .filter(item => item.options[target])
        .map(item => splitCss(item.css).embeddedCss)
        .filter(Boolean)
        .join('\n');
}

function removeDisconnectedShadowRoots(): void {
    for (const root of Array.from(shadowRoots)) {
        if (!root.host?.isConnected) shadowRoots.delete(root);
    }
}

function useConstructedSheet(css: string): boolean {
    if (!canUseConstructedSheet || !('CSSStyleSheet' in window)) return false;

    try {
        if (!sharedShadowSheet) sharedShadowSheet = new CSSStyleSheet();
        sharedShadowSheet.replaceSync(css);
        return true;
    } catch {
        canUseConstructedSheet = false;
        sharedShadowSheet = null;
        return false;
    }
}

function syncShadowRoot(root: ShadowRoot, css = getCombinedEmbeddedCss('shadow')): void {
    if (!css) {
        if (sharedShadowSheet && 'adoptedStyleSheets' in root && root.adoptedStyleSheets.includes(sharedShadowSheet)) {
            root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sheet => sheet !== sharedShadowSheet);
        }
        root.querySelector<HTMLStyleElement>(`style#${SHADOW_STYLE_ID}`)?.remove();
        return;
    }

    if (sharedShadowSheet && canUseConstructedSheet && 'adoptedStyleSheets' in root) {
        if (!root.adoptedStyleSheets.includes(sharedShadowSheet)) {
            root.adoptedStyleSheets = [...root.adoptedStyleSheets, sharedShadowSheet];
        }
        root.querySelector<HTMLStyleElement>(`style#${SHADOW_STYLE_ID}`)?.remove();
        return;
    }

    const styleElement = root.querySelector<HTMLStyleElement>(`style#${SHADOW_STYLE_ID}`) || document.createElement('style');
    styleElement.id = SHADOW_STYLE_ID;
    styleElement.textContent = css;

    if (!styleElement.parentElement) root.appendChild(styleElement);
}

function syncShadowRoots(): void {
    removeDisconnectedShadowRoots();

    const css = getCombinedEmbeddedCss('shadow');
    if (!css) {
        for (const root of shadowRoots) syncShadowRoot(root, css);
        sharedShadowSheet = null;
        return;
    }

    useConstructedSheet(css);

    for (const root of shadowRoots) {
        syncShadowRoot(root, css);
    }
}

function registerShadowRoot(root: ShadowRoot | null | undefined): void {
    if (!root || shadowRoots.has(root)) return;

    shadowRoots.add(root);
    scanShadowRoots(root);
    scanIframes(root);
    syncShadowRoot(root);
}

function scanShadowRoots(rootNode: ParentNode = document): void {
    const nodes = Array.from(rootNode.querySelectorAll('*'));
    for (const node of nodes) {
        const shadowRoot = (node as HTMLElement).shadowRoot;
        if (shadowRoot) registerShadowRoot(shadowRoot);
    }
}

function syncIframe(iframe: HTMLIFrameElement, css = getCombinedEmbeddedCss('iframe')): void {
    try {
        const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDocument) return;

        const existing = iframeDocument.getElementById(IFRAME_STYLE_ID);
        if (!css) {
            existing?.remove();
            return;
        }

        const styleElement = (existing as HTMLStyleElement | null) || iframeDocument.createElement('style');
        styleElement.id = IFRAME_STYLE_ID;
        styleElement.textContent = css;

        if (!styleElement.parentElement) {
            getHead(iframeDocument).appendChild(styleElement);
        }
    } catch {
        iframeElements.delete(iframe);
    }
}

function syncIframes(): void {
    const css = getCombinedEmbeddedCss('iframe');
    for (const iframe of Array.from(iframeElements)) {
        if (!iframe.isConnected) {
            iframeElements.delete(iframe);
            continue;
        }

        syncIframe(iframe, css);
    }
}

function registerIframe(iframe: HTMLIFrameElement): void {
    if (iframeElements.has(iframe)) return;

    iframeElements.add(iframe);
    iframe.addEventListener('load', () => syncIframe(iframe), { passive: true });
    syncIframe(iframe);
}

function scanIframes(rootNode: ParentNode = document): void {
    rootNode.querySelectorAll('iframe').forEach(iframe => registerIframe(iframe as HTMLIFrameElement));
}

function ensureIframeObserver(): void {
    if (iframeObserver) return;

    iframeObserver = new MutationObserver(() => {
        scanIframes();
        for (const root of shadowRoots) scanIframes(root);
        syncIframes();
    });
    iframeObserver.observe(document, { childList: true, subtree: true });
}

function init(): void {
    if (initialized) return;
    initialized = true;

    originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function attachShadowWithElainaStyleEngine(initOptions: ShadowRootInit) {
        const root = originalAttachShadow!.call(this, initOptions);
        registerShadowRoot(root);
        return root;
    };

    scanShadowRoots();
    scanIframes();
}

function apply(id: string, css: string, options: StyleEngineOptions = {}): boolean {
    if (!id) return false;

    init();
    styles.set(id, {
        css: String(css || ''),
        options: normalizeOptions(options)
    });

    const registeredStyle = styles.get(id)!;
    syncDocumentStyle(id, registeredStyle);
    if (registeredStyle.options.shadow) syncShadowRoots();
    if (registeredStyle.options.iframe) {
        ensureIframeObserver();
        scanIframes();
        syncIframes();
    }

    return true;
}

function remove(id: string): void {
    styles.delete(id);
    document.getElementById(getStyleElementId(id))?.remove();
    syncShadowRoots();
    syncIframes();
}

function refresh(): void {
    init();
    scanShadowRoots();
    scanIframes();

    for (const [id, registeredStyle] of styles.entries()) {
        syncDocumentStyle(id, registeredStyle);
    }

    syncShadowRoots();
    syncIframes();
}

export const styleEngine = {
    apply,
    remove,
    refresh
};
