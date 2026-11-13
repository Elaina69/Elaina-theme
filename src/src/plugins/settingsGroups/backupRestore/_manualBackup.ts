import { UI } from "../settingsUI.ts"
import { backupActions } from "../../penguSettingsGroups/actions.ts"
import { themeToast } from "../../../utils/themeToast.ts"

export async function manualBackupSection(): Promise<HTMLElement[]> {
    return [
        UI.createLabel(await getString("backup-restore.manual-backup-restore"), ""),
        document.createElement('br'),
        UI.createRow("manualRestoreBackupSystemInfo", [
            UI.createRow("manualRestoreBackup", [
                UI.createButton(await getString("backup-restore.backup-data"), "ManualBackup", async () => {
                    await backupActions.exportBackupFile()
                }),
                document.createElement('br'),
                UI.createRow("RestoreRow", [
                    UI.createButton(await getString("backup-restore.restore-data"),"ManualRestore", () => {
                        document.getElementById("manualRestoreInput")?.click()
                    }),
                    UI.createLabel("", "restoreFileInfo")
                ]),
                UI.fileInput("manualRestoreInput", ".json", async (event: any) => {
                    const file = event.target.files[0]
                    let text: any = document.getElementById("restoreFileInfo")
                    
                    if (file && file.type === "application/json") {
                        const reader = new FileReader();
                    
                        reader.onload = async (e: any) => {
                            text.textContent = await getString("backup-restore.manual-restore-inprogress")
                            text.style.color = "#e4c2b3"
                            
                            try {
                                JSON.parse(e.target.result);
                                const restoreData = backupActions.restoreBackupFile(file)
                                themeToast.promise(restoreData, {
                                    loading: 'Restoring Datastore...',
                                    success: 'Restore complete!',
                                    error: 'Error while restoring data, check console for more info!'
                                }, 'elaina-manual-restore')
                                await restoreData
                            } 
                            catch {
                                text.textContent = await getString("backup-restore.invalid-json")
                                text.style.color = "red"
                            }
                        };
                    
                        reader.readAsText(file);
                    } 
                    else {
                        text.textContent = await getString("backup-restore.json-file-only")
                        text.style.color = "red"
                    }
                })
            ]),
            UI.createRow("currentSystemInfo", [
                UI.createLabel(ElainaData.get("Dev-mode") 
                    ?`${await getString("backup-restore.os")}: ${ElainaData.get("System-Info")["OSVersion"]}`
                    : "", "systemInfo-Os"),
                UI.createLabel(ElainaData.get("Dev-mode")
                    ? `${await getString("backup-restore.cpu")}: ${ElainaData.get("System-Info")["CPUName"]}`
                    : "", "systemInfo-Cpu"),
                UI.createLabel(ElainaData.get("Dev-mode")
                    ? `${await getString("backup-restore.core")}: ${ElainaData.get("System-Info")["CoreCount"]}`
                    : "", "systemInfo-Core"),
                UI.createLabel(ElainaData.get("Dev-mode")
                    ? `${await getString("backup-restore.ram")}: ${Math.round(ElainaData.get("System-Info")["PhysicalMemory"] / (1024 ** 3))} GB` 
                    : "", "systemInfo-Mem"),
                UI.createLabel(ElainaData.get("Dev-mode")
                    ? `${await getString("backup-restore.gpu")}: ${ElainaData.get("System-Info")["GPUName"]}`
                    : "", "systemInfo-Gpu"),
                UI.createLabel(ElainaData.get("Dev-mode")
                    ? `${await getString("backup-restore.vram")}: ${Math.round(ElainaData.get("System-Info")["GPUMemory"] / (1024 ** 3))} GB`
                    : "", "systemInfo-Vram"),
            ]),
        ]),
    ]
}
