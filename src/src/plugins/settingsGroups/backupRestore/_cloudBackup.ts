import { UI } from "../settingsUI.ts"
import { log, warn } from "../../../utils/themeLog.ts"
import { backupActions, backupErrorMessage } from "./backupActions.ts"

export async function cloudBackupSection(): Promise<{ elements: HTMLElement[], postSetup: () => Promise<void> }> {
    const checkText = UI.createLabel("", "datastore-cloud-checking")
    const lastBackup = UI.createLabel("", "systemInfo-LastBackup")
    const fields = [
        ["os", "OSVersion", "Os"], ["cpu", "CPUName", "Cpu"], ["core", "CoreCount", "Core"],
        ["ram", "PhysicalMemory", "Mem"], ["gpu", "GPUName", "Gpu"], ["vram", "GPUMemory", "Vram"],
    ].map(([key, property, id]) => ({ key, property, label: UI.createLabel("", "systemInfo-" + id) }))
    const backupInfo = UI.createRow("backupInfo", [
        UI.createLabel(await getString("backup-restore.backupinfo")),
        UI.createRow("backupSystemInfo", [lastBackup, ...fields.map(field => field.label)]),
    ])
    let revision = 0
    let busy = false
    let hasBackup = false

    const restoreButton = UI.createButton(await getString("backup-restore.restore-data"), "restore-data-button", async () => {
        if (busy || !hasBackup) return
        busy = true
        updateButtons()
        try { await backupActions.restoreCloudBackup() }
        catch (reason) { warn("Could not restore cloud backup:", reason) }
        finally { busy = false; updateButtons() }
    })
    const deleteButton = UI.createButton(await getString("backup-restore.delete-data"), "delete-data-button", async () => {
        if (busy || !hasBackup) return
        busy = true
        updateButtons()
        try {
            await backupActions.deleteCloudBackup()
            // The server has confirmed deletion: no delay or extra GET is needed.
            const request = ++revision
            hasBackup = false
            backupInfo.style.visibility = "hidden"
            const enabled = ElainaData.get("backup-datastore") === true
            const message = await getString("backup-restore." + (enabled ? "check-backup-error" : "cloud-disabled"))
            if (request !== revision) return
            checkText.textContent = message
            checkText.style.color = enabled ? "yellow" : "#a09b8c"
        } catch (reason) { warn("Could not delete cloud backup:", reason) }
        finally { busy = false; updateButtons() }
    })

    function updateButtons() {
        restoreButton.style.visibility = hasBackup ? "visible" : "hidden"
        deleteButton.style.visibility = hasBackup ? "visible" : "hidden"
        for (const button of [restoreButton, deleteButton]) {
            if (busy) button.setAttribute("disabled", "true")
            else button.removeAttribute("disabled")
        }
    }

    async function checkBackupFile(): Promise<void> {
        const request = ++revision
        hasBackup = false
        updateButtons()
        backupInfo.style.visibility = "hidden"
        checkText.style.color = "#a09b8c"
        if (ElainaData.get("backup-datastore") !== true) {
            const message = await getString("backup-restore.cloud-disabled")
            if (request === revision) checkText.textContent = message
            return
        }
        const loading = await getString("backup-restore.loading")
        if (request !== revision) return
        checkText.textContent = loading + "..."
        try {
            const data = await backupActions.readCloudBackup()
            const message = await getString("backup-restore." + (data ? "check-backup-success" : "check-backup-error"))
            const lastBackupLabel = await getString("backup-restore.last-backup")
            const system = data?.["System-Info"] as Record<string, unknown> | undefined
            const systemLabels = await Promise.all(fields.map(async ({ key, property }) => {
                const value = system && typeof system === "object" ? system[property] : undefined
                if (!ElainaData.get("Dev-mode") || value == null) return ""
                const formatted = ["ram", "vram"].includes(key) && typeof value === "number"
                    ? Math.round(value / 1024 ** 3) + " GB" : String(value)
                return await getString("backup-restore." + key) + ": " + formatted
            }))
            // Use this section's elements and discard stale results after toggles;
            // never update another tab through global document selectors.
            if (request !== revision || ElainaData.get("backup-datastore") !== true) return
            hasBackup = data !== null
            checkText.textContent = message
            checkText.style.color = hasBackup ? "green" : "yellow"
            backupInfo.style.visibility = hasBackup ? "visible" : "hidden"
            lastBackup.textContent = lastBackupLabel + ": " + (data?.["last-backup-time"] || "—")
            fields.forEach((field, index) => { field.label.textContent = systemLabels[index] })
            updateButtons()
            log(message)
        } catch (reason) {
            const message = await getString("backup-restore.check-backup-servererror")
            if (request !== revision || ElainaData.get("backup-datastore") !== true) return
            checkText.style.color = "red"
            checkText.textContent = backupErrorMessage(reason, message)
            warn("Could not check cloud backup:", reason)
        }
    }

    updateButtons()
    backupInfo.style.visibility = "hidden"
    return {
        elements: [
            UI.createCheckBox(await getString("backup-restore.backup-datastore"), "bakdata", "bakdatabox",
                () => { void checkBackupFile().catch(reason => warn("Could not update cloud backup status:", reason)) },
                true, "backup-datastore"),
            checkText,
            document.createElement("br"),
            UI.createRow("restoreAndDeleteData", [restoreButton, deleteButton]),
            backupInfo,
        ],
        postSetup: checkBackupFile,
    }
}
