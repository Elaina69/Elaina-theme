import { UI } from "../settingsUI.ts"
import { log, warn } from "../../../utils/themeLog.ts"
import { backupActions } from "../../penguSettingsGroups/actions.ts"

const getSystemInfo = async () => {
    if (ElainaData.get("Dev-mode")) {
        let systemInfo: any = await ((await fetch("/performance/v1/system-info")).json())
        ElainaData.set("System-Info", systemInfo)
    }
}

async function CheckBackupFile() {
    const restoreButton = document.querySelector(".restore-data-button") as HTMLElement
    const deleteButton = document.querySelector(".delete-data-button") as HTMLElement
    const checkText = document.getElementById("datastore-cloud-checking") as HTMLElement
    const backupInfo = document.getElementById("backupInfo") as HTMLElement

    const lastbackup = document.querySelector("#backupSystemInfo > #systemInfo-LastBackup") as HTMLElement
    const os = document.querySelector("#backupSystemInfo > #systemInfo-Os") as HTMLElement
    const cpu = document.querySelector("#backupSystemInfo > #systemInfo-Cpu") as HTMLElement
    const core = document.querySelector("#backupSystemInfo > #systemInfo-Core") as HTMLElement
    const mem = document.querySelector("#backupSystemInfo > #systemInfo-Mem") as HTMLElement
    const gpu = document.querySelector("#backupSystemInfo > #systemInfo-Gpu") as HTMLElement
    const vram = document.querySelector("#backupSystemInfo > #systemInfo-Vram") as HTMLElement

    try {
        checkText.textContent = `${await getString("backup-restore.loading")}...`
        checkText.style.color = "#a09b8c"

        let checkFile: any = await window.elainathemeApi.readBackup(ElainaData.get("ElainaTheme-Token"), ElainaData.get("Summoner-ID"))
        if (checkFile.data != null && Object.keys(checkFile.data).length > 0 && checkFile.success) {
            log("You have backup file on cloud, ready to restore it.")
            restoreButton.style.visibility = "visible"
            deleteButton.style.visibility = "visible"
            checkText.style.color = "green"
            checkText.textContent = `${await getString("backup-restore.check-backup-success")}`
            backupInfo.style.visibility = "visible"

            let backupData = typeof checkFile.data === 'string' ? JSON.parse(checkFile.data) : checkFile.data
            lastbackup.textContent = `${await getString("backup-restore.last-backup")}: ${backupData["last-backup-time"]}`
            if (ElainaData.get("Dev-mode")) {
                try {
                    os.textContent = `${await getString("backup-restore.os")}: ${backupData["System-Info"]["OSVersion"]}`
                    cpu.textContent = `${await getString("backup-restore.cpu")}: ${backupData["System-Info"]["CPUName"]}`
                    core.textContent = `${await getString("backup-restore.core")}: ${backupData["System-Info"]["CoreCount"]}`
                    mem.textContent = `${await getString("backup-restore.ram")}: ${Math.round(backupData["System-Info"]["PhysicalMemory"] / (1024 ** 3))} GB`
                    gpu.textContent = `${await getString("backup-restore.gpu")}: ${backupData["System-Info"]["GPUName"]}`
                    vram.textContent = `${await getString("backup-restore.vram")}: ${Math.round(backupData["System-Info"]["GPUMemory"] / (1024 ** 3))} GB`
                }
                catch (err: any) {
                    warn("Error while getting system data:", err)
                }
            }
        }
        else {
            log("You don't have backup file on cloud yet.")
            restoreButton.style.visibility = "hidden"
            deleteButton.style.visibility = "hidden"
            checkText.style.color = "yellow"
            checkText.textContent = `${await getString("backup-restore.check-backup-error")}`
            backupInfo.style.visibility = "hidden"
        }
    }
    catch (err: any) { 
        log("Cloud server is sleep, try backup/restore later. Detail:", err)
        restoreButton.style.visibility = "hidden"
        deleteButton.style.visibility = "hidden"
        checkText.style.color = "red"
        checkText.textContent = `${await getString("backup-restore.check-backup-servererror")}`
        backupInfo.style.visibility = "hidden"
    }
}

export async function cloudBackupSection(): Promise<{ elements: HTMLElement[], postSetup: () => Promise<void> }> {
    await getSystemInfo()

    const elements: HTMLElement[] = [
        UI.createCheckBox(
            `${await getString("backup-restore.backup-datastore")}`,'bakdata', 'bakdatabox', async ()=>{
                if (ElainaData.get("backup-datastore")) {
                    await CheckBackupFile()
                }
            }, true, "backup-datastore"
        ),
        UI.createLabel(`${await getString("backup-restore.loading")}...`, "datastore-cloud-checking"),
        document.createElement('br'),
        UI.createRow("restoreAndDeleteData", [
            UI.createButton(`${await getString("backup-restore.restore-data")}`, "restore-data-button", () => {
                void backupActions.restoreCloudBackup().catch(() => log('Datastore file not found, avoid restoring'))
            }),
            UI.createButton(`${await getString("backup-restore.delete-data")}`, "delete-data-button",async () => {
                try {
                    await backupActions.deleteCloudBackup(false)
                    await new Promise((r) => setTimeout(r, 1000));
                }
                catch (err: any) { log('Error deleting datastore file from cloud:', err) }
                finally { await CheckBackupFile() }
            }),
        ], true),
        UI.createRow("backupInfo", [
            UI.createLabel(await getString("backup-restore.backupinfo"), ""),
            UI.createRow("backupSystemInfo", [
                UI.createLabel("", "systemInfo-LastBackup"),
                UI.createLabel("", "systemInfo-Os"),
                UI.createLabel("", "systemInfo-Cpu"),
                UI.createLabel("", "systemInfo-Core"),
                UI.createLabel("", "systemInfo-Mem"),
                UI.createLabel("", "systemInfo-Gpu"),
                UI.createLabel("", "systemInfo-Vram"),
            ])
        ]),
    ]

    return {
        elements,
        postSetup: () => CheckBackupFile(),
    }
}
