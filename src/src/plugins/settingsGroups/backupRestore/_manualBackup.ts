import { UI } from "../settingsUI.ts"
import utils from "../../../utils/utils.ts"
import { log } from "../../../utils/themeLog.ts"
import { setDefaultData } from "../../../services/backupAndRestoreDatastore.ts"

export async function manualBackupSection(): Promise<HTMLElement[]> {
    const summonerID = await utils.getSummonerID()

    return [
        UI.createLabel(await getString("backup-restore.manual-backup-restore"), ""),
        document.createElement('br'),
        UI.createRow("manualRestoreBackupSystemInfo", [
            UI.createRow("manualRestoreBackup", [
                UI.createButton(await getString("backup-restore.backup-data"), "ManualBackup", async () => {
                    let datastore_list = (await import(utils.assets.url("config/datastoreDefault.js"))).default

                    ElainaData.set("last-backup-time", new Date())

                    let sumID = await utils.getSummonerID()
                    let keys = Object.keys(datastore_list)
                    let mirage = datastore_list

                    keys.forEach(key => {
                        mirage[key] = ElainaData.get(key)
                    })

                    let blob = new Blob([JSON.stringify(mirage)], { type: 'application/json' })
                    let a: any = document.getElementById("downloadBackup")
                    
                    a.href = URL.createObjectURL(blob)
                    a.download = `ElainaTheme-${sumID}.json`
                    a.click()
                    a.href = ""
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
                                const json = JSON.parse(e.target.result);
                                let restoreData = new Promise<void>((resolve, reject) => {
                                    setTimeout(async () => {
                                        try { 
                                            await setDefaultData(json, true)
                                            resolve()
                                            window.setTimeout(()=>window.restartClient(),2000)
                                        }
                                        catch {
                                            reject()
                                            log(`Datastore file not found, avoid restoring`)
                                        }
                                    },5000)
                                })
                                
                                window.Toast.promise(restoreData, {
                                    loading: 'Restoring Datastore...',
                                    success: 'Restore complete!',
                                    error: 'Error while restoring data, check console for more info!'
                                })
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
                }),
                UI.createLink("", ``, ()=> {}, "downloadBackup")
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
