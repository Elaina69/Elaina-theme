import { cdnImport } from "./theme/Cdn.ts"

var cachedThemeName: string | null = null;

function safeDecodeUrlSegment(segment: string): string {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

function splitPluginPath(path: unknown): string[] {
    return String(path ?? '')
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean);
}

function encodeUrlPathSegment(segment: unknown): string {
    const rawSegment = String(segment ?? '');
    if (!rawSegment || rawSegment === '.' || rawSegment === '..' || /[\u0000-\u001f\u007f]/.test(rawSegment)) {
        return '';
    }

    return encodeURIComponent(rawSegment)
        .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
        .replace(/%40/g, '@');
}

/**
 * Extract the theme folder name from the call stack.
 */
function getThemeNameFromStack(): string | null {
    const error = new Error();
    const stackTrace = error.stack;
    const scriptPath = stackTrace
        ?.match(/(?:http|https):\/\/plugins\/.*?\.js/g)
        ?.find((url) => !url.includes('/@/'));

    if (!scriptPath) return null;

    try {
        const url = new URL(scriptPath);
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length < 2) return null;

        segments.pop();
        return segments.map(safeDecodeUrlSegment).join('/');
    } catch {
        return null;
    }
}

/**
 * Initialize the theme name using Pengu context APIs.
 */
export function initThemeName(context: any): void {
    if (cachedThemeName) return;

    const folderName: string | undefined = context?.meta?.name;

    // New Pengu: resolve scope from Pengu.plugins list
    if (folderName && typeof Pengu !== 'undefined' && Array.isArray(Pengu.plugins)) {
        // Pengu.plugins entries look like "@Scope\\folder\\index.js" or "folder\\index.js"
        // Normalize backslashes to forward slashes for matching
        const normalized = Pengu.plugins.map((p: string) => p.replace(/\\/g, '/'));

        const match = normalized.find((entry: string) => {
            // Match entries where the second-to-last segment is the folder name
            // e.g. "@Elaina-Plugins/elaina-theme/index.js" → "elaina-theme"
            const segments = entry.split('/');
            // For scoped:  ["@Scope", "folder", "index.js"] → segments[-2] = "folder"
            // For unscoped: ["folder", "index.js"]          → segments[-2] = "folder"
            const pluginFolder = segments.length >= 2 ? segments[segments.length - 2] : null;
            return pluginFolder !== null && safeDecodeUrlSegment(pluginFolder) === safeDecodeUrlSegment(folderName);
        });

        if (match) {
            // Remove the trailing "/index.js" (or similar entry file) to get the plugin path
            const lastSlash = match.lastIndexOf('/');
            const pluginPath = lastSlash > 0 ? match.substring(0, lastSlash) : folderName;
            const segments = splitPluginPath(pluginPath).map(safeDecodeUrlSegment);
            if (segments.length > 0) segments[segments.length - 1] = folderName;
            cachedThemeName = segments.join('/');
            return;
        }
    }

    // Fallback: stack-trace regex (works for old Pengu without @scope)
    cachedThemeName = getThemeNameFromStack();
}

/** Get this theme folder's name (may include @scope, e.g. "@Elaina-Plugins/elaina-theme") */
export function getThemeName(): string | null {
    if (cachedThemeName) return cachedThemeName;

    // If initThemeName was never called (old Pengu path), try stack trace
    cachedThemeName = getThemeNameFromStack();
    return cachedThemeName;
}

/** Build a URL-safe local plugin URL without double-encoding existing theme paths. */
export function pluginUrl(...pathParts: unknown[]): string {
    const themeName = getThemeName();
    const themeSegments = splitPluginPath(themeName);
    const extraSegments = pathParts.flatMap(splitPluginPath);
    const encodedSegments = [...themeSegments, ...extraSegments]
        .map(encodeUrlPathSegment)
        .filter(Boolean);

    return `//plugins/${encodedSegments.join('/')}`;
}

/** Build a raw plugin subpath for Pengu filesystem helpers such as openPluginsFolder. */
export function pluginPath(...pathParts: unknown[]): string {
    const themeSegments = splitPluginPath(getThemeName());
    const extraSegments = pathParts.flatMap(splitPluginPath);

    return [...themeSegments, ...extraSegments]
        .filter((segment) => segment !== '.' && segment !== '..')
        .join('/');
}

export { cdnImport }

window.getThemeName = getThemeName
window.cdnImport = cdnImport
