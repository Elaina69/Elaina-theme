import defaults from "../../../config/datastoreDefault.js"
import { UI } from "../settingsUI.ts"
import { error, log } from "../../../utils/themeLog.ts"
import { themeToast } from "../../../utils/themeToast.ts"
import { manualBackupSection } from "./_manualBackup.ts"
import { cloudBackupSection } from "./_cloudBackup.ts"

type BackupData = Record<string, unknown>
type CloudOperation = "GET" | "BACKUP" | "DELETE"

const backupKeys = Object.keys(defaults)
const pending = new Map<string, Promise<unknown>>()
let cloudQueue: Promise<unknown> = Promise.resolve()
let restoring = false

/** Invalid files must never partially overwrite the current settings. */
export class InvalidBackupError extends Error {
    constructor() { super("Invalid or empty Elaina theme backup.") }
}

class CloudRequestError extends Error {
    constructor(message: string, readonly status: number) { super(message) }
}

const text = (key: string) => getString("backup-restore." + key)

export function backupErrorMessage(reason: unknown, fallback: string): string {
    const detail = reason instanceof Error ? reason.message : ""
    return detail && detail !== fallback ? fallback + " " + detail : fallback
}

function once<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = pending.get(key)
    if (existing) return existing as Promise<T>
    const promise = Promise.resolve().then(work).finally(() => pending.delete(key))
    pending.set(key, promise)
    return promise
}

function queueCloud<T>(work: () => Promise<T>): Promise<T> {
    const result = cloudQueue.then(work)
    cloudQueue = result.catch(() => {})
    return result
}

async function notify<T>(key: string, work: () => Promise<T>): Promise<T> {
    const [loading, success, failure] = await Promise.all([
        text(key + "-loading"), text(key + "-success"), text(key + "-error"),
    ])
    return themeToast.promise(work(), {
        loading, success,
        error: reason => backupErrorMessage(reason, failure),
    }, "elaina-" + key)
}

function parseBackup(value: unknown): BackupData {
    let data = value
    if (typeof data === "string") {
        try { data = JSON.parse(data) }
        catch { throw new InvalidBackupError() }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new InvalidBackupError()

    // Only theme settings are portable: never import credentials, identity, caches,
    // or prototype keys from an arbitrary JSON file (including old full-store dumps).
    const settings = Object.fromEntries(backupKeys
        .filter(key => Object.hasOwn(data, key))
        .map(key => [key, (data as BackupData)[key]]))
    if (!Object.keys(settings).length) throw new InvalidBackupError()
    return settings
}

function createSnapshot(): BackupData {
    const data = Object.fromEntries(backupKeys.map(key => [key,
        ElainaData.get(key, (defaults as BackupData)[key]),
    ]))
    data["last-backup-time"] = new Date().toISOString()
    // Detach nested arrays/objects as well; never mutate the defaults module or
    // allow settings changed during an upload to change its pending payload.
    return JSON.parse(JSON.stringify(data))
}

async function applyBackup(data: BackupData): Promise<void> {
    ElainaData.setAll({ ...ElainaData.getAll(), ...data })
    await ElainaData.flush({ throwOnError: true })
    window.setTimeout(() => window.restartClient(), 2000)
}

async function requireCloudBackup(api: elainathemeApi, operation: CloudOperation): Promise<void> {
    // Explicit deletion remains available after automatic cloud backups are off.
    if (operation === "DELETE") return
    if (ElainaData.get("backup-datastore") !== true) throw new Error(await text("cloud-disabled"))
    if (api.allowed && !api.allowed("backup-datastore")) throw new Error(await text("cloud-permission-required"))
}

async function requestJson(url: string, body?: BackupData, token?: string): Promise<BackupData> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    try {
        const response = await fetch(url, {
            method: body ? "POST" : "GET",
            headers: body ? { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result || typeof result !== "object" || Array.isArray(result) || result.success === false) {
            const detail = result?.error || result?.message
            throw new CloudRequestError(typeof detail === "string" ? detail :
                "Cloud service returned an invalid response (" + response.status + ").", response.status)
        }
        return result
    } finally { window.clearTimeout(timeout) }
}

function saveSession(result: BackupData, player: ThemeApiPlayer, refresh = false): string {
    const token = result.token || result.accessToken
    if (typeof token !== "string" || !token.trim()) throw new CloudRequestError("Sign-in did not return an access token.", 401)
    const data = { ...ElainaData.getAll(),
        "Summoner-ID": player.summonerId,
        "ElainaTheme-Token": token,
        "ElainaTheme-Token-Owner": String(player.summonerId),
    }
    if (typeof result.refreshToken === "string" && result.refreshToken) data["ElainaTheme-Refresh-Token"] = result.refreshToken
    else if (!refresh) delete data["ElainaTheme-Refresh-Token"]
    ElainaData.setAll(data)
    return token
}

async function login(baseUrl: string, player: ThemeApiPlayer): Promise<string> {
    const name = player.gameName || player.displayName
    if (!name) throw new CloudRequestError("Current summoner is not ready. Try again after signing in.", 401)
    const body = { summonerID: String(player.summonerId), summonerName: name + (player.tagLine ? "#" + player.tagLine : "") }
    let result: BackupData
    try { result = await requestJson(baseUrl + "login", body) }
    catch (reason) {
        if (!(reason instanceof CloudRequestError) || reason.status !== 401) throw reason
        // Register only an unknown account, rather than on every backup/check.
        try { await requestJson(baseUrl + "register", body) }
        catch (reason) { if (!(reason instanceof CloudRequestError) || reason.status !== 409) throw reason }
        result = await requestJson(baseUrl + "login", body)
    }
    return saveSession(result, player)
}

async function renewSession(baseUrl: string, player: ThemeApiPlayer): Promise<string> {
    const refreshToken = ElainaData.get("ElainaTheme-Refresh-Token")
    if (ElainaData.get("ElainaTheme-Token-Owner") === String(player.summonerId) && typeof refreshToken === "string" && refreshToken) {
        try { return saveSession(await requestJson(baseUrl + "refresh-token", { refreshToken }), player, true) }
        catch (reason) {
            if (!(reason instanceof CloudRequestError) || ![400, 401, 403, 404].includes(reason.status)) throw reason
        }
    }
    return login(baseUrl, player)
}

async function legacyCloudRequest(api: elainathemeApi, operation: CloudOperation, data?: BackupData): Promise<BackupData> {
    if (!api.baseUrl) throw new Error(await text("cloud-unavailable"))
    const player = await requestJson("/lol-summoner/v1/current-summoner") as unknown as ThemeApiPlayer
    if (!/^[1-9][0-9]{0,19}$/.test(String(player.summonerId))) throw new CloudRequestError("Current summoner is not ready.", 401)
    const baseUrl = api.baseUrl().replace(/\/?$/, "/") + "api/elainatheme/"
    let token = ElainaData.get("ElainaTheme-Token")
    if (typeof token !== "string" || !token || ElainaData.get("ElainaTheme-Token-Owner") !== String(player.summonerId)) {
        token = await login(baseUrl, player)
    }
    const body = { summonerID: String(player.summonerId), type: operation, ...(data ? { data } : {}) }
    await requireCloudBackup(api, operation)
    try { return await requestJson(baseUrl + "data", body, token) }
    catch (reason) {
        if (!(reason instanceof CloudRequestError) || ![401, 403].includes(reason.status)) throw reason
        // Exactly one authentication retry; never repeat a timed-out/failed write.
        token = await renewSession(baseUrl, player)
        await requireCloudBackup(api, operation)
        return requestJson(baseUrl + "data", body, token)
    }
}

async function cloudRequest(operation: CloudOperation, data?: BackupData): Promise<ThemeBackupResponse> {
    const api = window.elainathemeApi
    if (!api) throw new Error(await text("cloud-unavailable"))
    await requireCloudBackup(api, operation)
    let result: ThemeBackupResponse | BackupData
    if (typeof api.ensureCurrentSession === "function") {
        // New CDN helpers own session refresh and consent enforcement. Do not log
        // in a second time or bypass those gates with a separate transport.
        const token = ElainaData.get("ElainaTheme-Token", "")
        const userId = ElainaData.get("Summoner-ID", 0)
        result = operation === "GET" ? await api.readBackup(token, userId)
            : operation === "DELETE" ? await api.deleteBackup(token, userId)
            : await api.writeBackup(token, userId, data!)
    } else {
        // Published legacy helpers fire-and-forget writes/deletes and show their
        // own toasts. Use their configured server with a real awaited response.
        result = await legacyCloudRequest(api, operation, data)
    }
    if (!result || result.success !== true) {
        const detail = result?.error || result?.message
        throw new Error(typeof detail === "string" ? detail : await text("cloud-invalid-response"))
    }
    return result as ThemeBackupResponse
}

function restore(work: () => Promise<BackupData>): Promise<void> {
    return once("restore", async () => {
        restoring = true
        try { await notify("restore", async () => applyBackup(await work())) }
        catch (reason) { restoring = false; throw reason }
        // Keep automatic exit backups suppressed until the scheduled restart.
    })
}

export const backupActions = {
    exportBackupFile(): Promise<void> {
        return once("export", () => notify("export", async () => {
            const snapshot = createSnapshot()
            const id = String(ElainaData.get("Summoner-ID", "local"))
            const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: "application/json" }))
            const anchor = document.createElement("a")
            try {
                anchor.href = url
                anchor.download = "ElainaTheme-" + (/^[1-9][0-9]*$/.test(id) ? id : "local") + ".json"
                anchor.hidden = true
                document.body.appendChild(anchor)
                anchor.click()
                ElainaData.set("last-backup-time", snapshot["last-backup-time"])
                await ElainaData.flush()
            } finally {
                anchor.remove()
                window.setTimeout(() => URL.revokeObjectURL(url), 0)
            }
        }))
    },

    restoreBackupFile(file: File): Promise<void> {
        return restore(async () => {
            if (!file || (!/\.json$/i.test(file.name) && file.type !== "application/json")) throw new InvalidBackupError()
            return parseBackup(await file.text())
        })
    },

    readCloudBackup(): Promise<BackupData | null> {
        return once("read", () => queueCloud(async () => {
            const result = await cloudRequest("GET")
            let data = result.data
            if (data == null || data === "") return null
            if (typeof data === "string") {
                try { data = JSON.parse(data) }
                catch { throw new InvalidBackupError() }
            }
            if (data && typeof data === "object" && !Array.isArray(data) && !Object.keys(data).length) return null
            return parseBackup(data)
        }))
    },

    writeCloudBackup(): Promise<void> {
        if (restoring) return Promise.resolve()
        return once("write", () => queueCloud(() => notify("cloud-backup", async () => {
            if (restoring) return
            const snapshot = createSnapshot()
            await cloudRequest("BACKUP", snapshot)
            ElainaData.set("last-backup-time", snapshot["last-backup-time"])
            await ElainaData.flush()
            log("Theme settings backed up to cloud.")
        })))
    },

    restoreCloudBackup(): Promise<void> {
        return restore(async () => {
            const data = await backupActions.readCloudBackup()
            if (!data) throw new Error(await text("check-backup-error"))
            return data
        })
    },

    deleteCloudBackup(): Promise<void> {
        return once("delete", () => queueCloud(() => notify("cloud-delete", async () => {
            await cloudRequest("DELETE")
            log("Theme backup deleted from cloud.")
        })))
    },
}

/** Builds the backup tab here so there is no second backupRestore entry module. */
export async function backuprestoretab(panel: Element): Promise<void> {
    const loading = UI.createRow("loading", [UI.createLoading(await getString("common.settings-loading"))])
    panel.appendChild(loading)
    try {
        const manual = await manualBackupSection()
        const content = UI.createRow("", manual)
        panel.prepend(content)
        const cloud = await cloudBackupSection()
        content.append(...cloud.elements)
        await cloud.postSetup()
    } catch (reason) {
        error("Error loading backup/restore settings:", reason)
    } finally { loading.remove() }
}
