import { UI } from "../settingsUI.ts"
import { warn } from "../../../utils/themeLog.ts"
import { backupActions, backupErrorMessage, InvalidBackupError } from "./backupActions.ts"

export async function manualBackupSection(): Promise<HTMLElement[]> {
    const fileInfo = UI.createLabel("", "restoreFileInfo")
    let restoring = false
    const input = UI.fileInput("manualRestoreInput", ".json", async (event: Event) => {
        const target = event.target as HTMLInputElement
        const file = target.files?.[0]
        if (!file || restoring) return
        restoring = true
        try {
            if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
                fileInfo.textContent = await getString("backup-restore.json-file-only")
                fileInfo.style.color = "red"
                return
            }
            fileInfo.textContent = await getString("backup-restore.manual-restore-inprogress")
            fileInfo.style.color = "#e4c2b3"
            // One read/parse, with validation and the toast owned by backupActions.
            await backupActions.restoreBackupFile(file)
            fileInfo.textContent = await getString("backup-restore.restore-success")
            fileInfo.style.color = "green"
        } catch (reason) {
            const key = reason instanceof InvalidBackupError ? "invalid-json" : "restore-error"
            fileInfo.textContent = backupErrorMessage(reason, await getString("backup-restore." + key))
            fileInfo.style.color = "red"
            warn("Could not restore local backup:", reason)
        } finally {
            restoring = false
            target.value = "" // Allow choosing the same file again after an error.
        }
    })

    const fields = [
        ["os", "OSVersion", "Os"], ["cpu", "CPUName", "Cpu"], ["core", "CoreCount", "Core"],
        ["ram", "PhysicalMemory", "Mem"], ["gpu", "GPUName", "Gpu"], ["vram", "GPUMemory", "Vram"],
    ].map(([key, property, id]) => ({ key, property, label: UI.createLabel("", "systemInfo-" + id) }))

    async function updateSystemInfo() {
        if (!ElainaData.get("Dev-mode")) return
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 5000)
        try {
            const response = await fetch("/performance/v1/system-info", { signal: controller.signal })
            if (!response.ok) throw new Error("System information is unavailable.")
            const system = await response.json()
            if (!system || typeof system !== "object" || Array.isArray(system)) throw new Error("Invalid system information.")
            ElainaData.set("System-Info", system)
            await Promise.all(fields.map(async ({ key, property, label }) => {
                const value = system[property]
                if (value == null) return
                const formatted = ["ram", "vram"].includes(key) && typeof value === "number"
                    ? Math.round(value / 1024 ** 3) + " GB" : String(value)
                label.textContent = await getString("backup-restore." + key) + ": " + formatted
            }))
        } catch (reason) { warn("Could not load optional system information:", reason) }
        finally { window.clearTimeout(timeout) }
    }
    // Diagnostic data must not delay or break offline export/restore controls.
    void updateSystemInfo()

    return [
        UI.createLabel(await getString("backup-restore.manual-backup-restore")),
        document.createElement("br"),
        UI.createRow("manualRestoreBackupSystemInfo", [
            UI.createRow("manualRestoreBackup", [
                UI.createButton(await getString("backup-restore.backup-data"), "ManualBackup", async () => {
                    try { await backupActions.exportBackupFile() }
                    catch (reason) { warn("Could not export backup:", reason) }
                }),
                document.createElement("br"),
                UI.createRow("RestoreRow", [
                    UI.createButton(await getString("backup-restore.restore-data"), "ManualRestore", () => input.click()),
                    fileInfo,
                ]),
                input,
            ]),
            UI.createRow("currentSystemInfo", fields.map(field => field.label)),
        ]),
    ]
}
