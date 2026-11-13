// Screenshot and generated Pengu module adapted from rumi-chan/league-client-mcp (MIT).
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, stat, realpath, lstat, rename, unlink } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

export function validateFileName(name: string) {
    if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}$/.test(name) || name.includes('..') || name.endsWith('.')
        || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name) || basename(name) !== name) {
        throw new Error('Invalid fileName. Use a simple filename without paths, reserved names, or .. sequences.');
    }
    return name;
}

export async function screenshot(fileName?: string, platform = process.platform): Promise<{ path: string; data: string }> {
    if (platform !== 'win32') throw new Error('get_lol_screenshot is only supported on Windows; macOS screenshots are unavailable.');
    const name = validateFileName(fileName ?? `lol-client-${Date.now()}-${randomUUID().slice(0, 8)}.png`);
    if (!name.endsWith('.png')) throw new Error('Screenshot fileName must end with .png.');
    const path = join(tmpdir(), name);
    const escapedPath = path.replace(/'/g, "''");
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public static class McpWin32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hDC, uint flags);
}
"@
$leagueProcess = Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $leagueProcess) { throw 'League Client window was not found.' }
if ([McpWin32]::IsIconic($leagueProcess.MainWindowHandle)) { throw 'League Client is minimized. Restore it and retry.' }
$rect = New-Object RECT
if (-not [McpWin32]::GetWindowRect($leagueProcess.MainWindowHandle, [ref]$rect)) { throw 'Could not read League window bounds.' }
$width = [Math]::Max(1, $rect.Right - $rect.Left)
$height = [Math]::Max(1, $rect.Bottom - $rect.Top)
if ($width -gt 8192 -or $height -gt 8192) { throw 'League window is too large to capture.' }
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $hdc = $graphics.GetHdc()
  try { $ok = [McpWin32]::PrintWindow($leagueProcess.MainWindowHandle, $hdc, 2) }
  finally { $graphics.ReleaseHdc($hdc) }
  if (-not $ok) { throw 'PrintWindow failed for League Client.' }
  $bitmap.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $bitmap.Dispose() }
`;
    await new Promise<void>((resolvePromise, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
        { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 }, (error, _stdout, stderr) => {
            if (error) reject(new Error(error.killed ? 'League screenshot timed out after 10 seconds.' : stderr.trim() || error.message));
            else resolvePromise();
        }));
    if ((await stat(path)).size > 8 * 1024 * 1024) throw new Error('Screenshot exceeds the 8 MiB result limit.');
    return { path, data: (await readFile(path)).toString('base64') };
}

export function exportedPluginSource(name: string, code: string, css: string | null): string {
    return `// Pengu Loader Plugin: ${name}
// Exported by Elainatheme MCP, based on rumi-chan/league-client-mcp (MIT).
const styleId = ${JSON.stringify(`pengu-plugin-${name}-style`)};
const css = ${JSON.stringify(css)};
export function init(_context) {}
export async function load() {
    const controller = new AbortController();
    let style;
    const injectStyle = () => {
        if (css === null) return;
        style = document.getElementById(styleId);
        if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
        style.textContent = css;
    };
    injectStyle();
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    let cleanup;
    try { cleanup = await new AsyncFunction('signal', ${JSON.stringify(code)})(controller.signal); }
    catch (reason) { controller.abort(); style?.remove(); throw reason; }
    const observer = new MutationObserver(() => { if (css !== null && !document.getElementById(styleId)) injectStyle(); });
    observer.observe(document.head, { childList: true });
    const stop = () => {
        observer.disconnect(); controller.abort(); style?.remove();
        if (typeof cleanup === 'function') { try { Promise.resolve(cleanup()).catch(console.error); } catch (reason) { console.error(reason); } }
    };
    window.addEventListener('pagehide', stop, { once: true });
    return stop;
}
`;
}

export async function exportPlugin(directory: string, name: string, code: string, css: string | null, fileName?: string): Promise<string> {
    if (!directory) throw new Error('Plugin export is disabled. Set penguPluginsPath in config.local.json or the Pengu 1.2+ MCP settings.');
    if (!isAbsolute(directory)) throw new Error('penguPluginsPath must be an absolute directory path.');
    const root = await realpath(directory);
    if (!(await stat(root)).isDirectory()) throw new Error('Configured Pengu export path is not a directory.');
    const safeName = validateFileName(fileName ?? name.replace(/[^A-Za-z0-9_-]/g, '_'));
    const output = resolve(root, `${safeName}.js`);
    const child = relative(root, output);
    if (!child || child.startsWith('..' + sep) || isAbsolute(child)) throw new Error('Export path is outside the configured directory.');
    const existing = await lstat(output).catch((reason: NodeJS.ErrnoException) => {
        if (reason.code !== 'ENOENT') throw reason;
        return undefined;
    });
    if (existing?.isSymbolicLink() || existing && !existing.isFile()) throw new Error('Export target must be a regular file.');
    const temporary = join(root, `.${safeName}-${randomUUID()}.tmp`);
    try {
        await writeFile(temporary, exportedPluginSource(safeName, code, css), { encoding: 'utf8', flag: 'wx' });
        await rename(temporary, output);
    } finally { await unlink(temporary).catch(() => {}); }
    return output;
}
