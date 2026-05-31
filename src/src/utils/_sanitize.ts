const _escDiv = document.createElement('div')

function escapeHtml(unsafe: unknown): string {
    if (unsafe === null || unsafe === undefined) return ''
    _escDiv.textContent = String(unsafe)
    return _escDiv.innerHTML
}

function sanitizeColor(value: unknown): string {
    const str = String(value ?? '')
    if (/^#?[0-9a-fA-F]{3,8}$/.test(str)) return str
    return ''
}

function sanitizeFileName(value: unknown): string {
    return String(value ?? '').replace(/[<>"'&\\\/]/g, '')
}

function escapeCssString (value: string): string {
    return String(value).replace(/["\\\n\r\f]/g, "\\$&")
}

function cssUrl(value: string): string {
    return `url("${escapeCssString(value)}")`
}

function getSafeGoogleFont (value: unknown): { url: URL, family: string } | null {
	const rawValue = String(value ?? "").trim();
	if (!rawValue || rawValue.length > 2048) return null;

	try {
		const url = new URL(rawValue);
		if (url.protocol !== "https:") return null;
		if (url.hostname !== "fonts.googleapis.com") return null;
		if (url.pathname !== "/css" && url.pathname !== "/css2") return null;
		if (url.username || url.password || url.hash) return null;
		if (!url.searchParams.has("family")) return null;

		const family = url.searchParams.get("family")?.split(":")[0].trim();
		if (!family || !/^[\w\s-]{1,80}$/.test(family)) return null;

		return { url, family };
	} catch {
		return null;
	}
};

export { 
    escapeHtml, 
    sanitizeColor, 
    sanitizeFileName, 
    escapeCssString, 
    cssUrl,
    getSafeGoogleFont 
}
