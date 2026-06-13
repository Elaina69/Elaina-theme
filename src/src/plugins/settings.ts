import * as upl from "pengu-upl"
import { log, error } from "../utils/themeLog.ts";
import utils from "../utils/utils.ts"

import structure from "./settingsGroups/settingsStructure.ts"
import { settingsUtils } from "../utils/settingsUtils.ts"

import { themeSettings } from "./settingsGroups/themeSettings/themeSettings.ts"
import { pluginsSettings } from "./settingsGroups/pluginsSettings/pluginsSettings.ts"
import { backuprestoretab } from "./settingsGroups/backupRestore/backupRestore.ts"
import { aboutustab } from "./settingsGroups/aboutUs/aboutUs.ts"

const datapath = `${utils.assets.url()}/`

function getSettingsBackdrop(): HTMLElement | null {
    const settingsApp = document.querySelector(".rcp-fe-lol-settings") as HTMLElement | null
    const backdrop = settingsApp?.previousElementSibling as HTMLElement | null

    if (backdrop?.matches("lol-uikit-full-page-backdrop.backdrop")) return backdrop
    return null
}

function makeSettingsBackdropTransparent() {
    const backdrop = getSettingsBackdrop()
    if (!backdrop) return

    backdrop.style.setProperty("background", "transparent", "important")
    backdrop.setAttribute("data-elaina-settings-backdrop", "true")
}

function makeSettingsDraggable() {
    const frame = document.querySelector("lol-uikit-dialog-frame.lol-settings-container") as HTMLElement | null
    const handle = frame?.querySelector(".lol-settings-title-bar") as HTMLElement | null

    if (!frame || !handle) return
    if (frame.hasAttribute("data-elaina-settings-draggable")) {
        makeSettingsBackdropTransparent()
        return
    }

    let dragging = false
    let pointerId = 0
    let startX = 0
    let startY = 0
    let startLeft = 0
    let startTop = 0
    
    const getFrameRect = () => frame.getBoundingClientRect()

    const onPointerMove = (event: PointerEvent) => {
        if (!dragging || event.pointerId !== pointerId) return

        const rect = getFrameRect()
        const nextLeft = Math.min(Math.max(startLeft + event.clientX - startX, 0), window.innerWidth - rect.width)
        const nextTop = Math.min(Math.max(startTop + event.clientY - startY, 0), window.innerHeight - rect.height)

        frame.style.left = `${nextLeft}px`
        frame.style.top = `${nextTop}px`
    }

    const onPointerUp = (event: PointerEvent) => {
        if (!dragging || event.pointerId !== pointerId) return

        dragging = false
        handle.releasePointerCapture?.(pointerId)
        handle.style.cursor = "grab"
        document.removeEventListener("pointermove", onPointerMove)
        document.removeEventListener("pointerup", onPointerUp)
        document.removeEventListener("pointercancel", onPointerUp)
    }

    handle.addEventListener("pointerdown", (event: PointerEvent) => {
        if (event.button !== 0) return

        const target = event.target as HTMLElement | null
        if (target?.closest("button, input, textarea, select, lol-uikit-flat-button-secondary")) return

        const rect = getFrameRect()
        dragging = true
        pointerId = event.pointerId
        startX = event.clientX
        startY = event.clientY
        startLeft = rect.left
        startTop = rect.top

        frame.style.position = "fixed"
        frame.style.left = `${rect.left}px`
        frame.style.top = `${rect.top}px`
        frame.style.right = "auto"
        frame.style.bottom = "auto"
        frame.style.margin = "0"
        handle.style.cursor = "grabbing"
        handle.setPointerCapture?.(pointerId)

        document.addEventListener("pointermove", onPointerMove)
        document.addEventListener("pointerup", onPointerUp)
        document.addEventListener("pointercancel", onPointerUp)
        event.preventDefault()
    })

    handle.style.cursor = "grab"
    frame.setAttribute("data-elaina-settings-draggable", "true")
    makeSettingsBackdropTransparent()
}

/** Shows a restart prompt when settings are changed that require a client restart. */
async function restartAfterChange(el: string, data: string) {
    const element = document.getElementById(el);
    const lastdata = element?.getAttribute("lastdatastore");
    const currentData = JSON.stringify(ElainaData.get(data));
    const wasChanged = element?.getAttribute("restart-change-active") === "true";
    const isChanged = lastdata !== currentData;
    const settingsChangeNumber = ElainaData.get("settingsChangenumber") || 0;

    if (isChanged && !wasChanged) {
        ElainaData.set("settingsChangenumber", settingsChangeNumber + 1);
        element?.setAttribute("restart-change-active", "true");
    }
    else if (!isChanged && wasChanged) {
        ElainaData.set("settingsChangenumber", Math.max(settingsChangeNumber - 1, 0));
        element?.setAttribute("restart-change-active", "false");
    }

    if (!document.querySelector("#restartAfterChangeButton") && ElainaData.get("settingsChangenumber") > 0) {
        let target = document.querySelector(".lol-settings-footer.ember-view")
        let a = document.createElement("lol-uikit-flat-button-group")
        let b = document.createElement("lol-uikit-flat-button")

        a.setAttribute("type","window-popup")
        a.classList.add("lol-settings-close-container")
        a.style.cssText = "margin-left: 10px"
        a.id = "restartAfterChangeButton"

        b.classList.add("lol-settings-close-button")
        b.style.cssText = "width: 150px;"
        b.textContent = await getString("settings.restart-client")
        b.id = "restartAfterChange"

        b.addEventListener("click",() => {
            if (ElainaData.get("backup-datastore")) {
                try { writeBackupData() }
                catch (err: any) { error("Server is down rightnow", err)}
                window.setTimeout(()=>{
                    window.restartClient()
                }, 3000)
            }
            else window.restartClient()
        })

        target?.append(a)
        a.append(b)
    }
    else if (ElainaData.get("settingsChangenumber") == 0) {
        document.querySelector("#restartAfterChangeButton")?.remove()
    }
}

async function writeBackupData() {
    let datastore_list = (await import(`${datapath}config/datastoreDefault.js`)).default

    ElainaData.set("last-backup-time", new Date())

    let keys = Object.keys(datastore_list)
    let mirage = datastore_list
    keys.forEach(key => {
        mirage[key] = ElainaData.get(key)
    })
    await window.elainathemeApi.writeBackup(ElainaData.get("ElainaTheme-Token"), ElainaData.get("Summoner-ID"), mirage)
}
    
window.addEventListener('load', async () => {
    // Add a listener to the close button to write backup data if Dev mode is enabled
    upl.observer.subscribeToElementCreation(".app-controls-button.app-controls-close", (element) => {
        element.addEventListener("click", async () => {
            if (ElainaData.get("backup-datastore")) {
                await writeBackupData()
            }
        })
    })

    // Add a listener to the logo in plugins settings to enable developer mode
    upl.observer.subscribeToElementCreation(".plugins-settings-logo", (element) => {
        element.addEventListener("click", ()=> {
            ElainaData.set("Active-dev-button", ElainaData.get("Active-dev-button") + 1)
            if (ElainaData.get("Active-dev-button") == 20) {
                ElainaData.set("Dev-button", true)
                log("Developer mode button has appeared !")
            }
            else if (ElainaData.get("Active-dev-button") > 20) {
                ElainaData.set("Dev-button", true)
                log("You already become developer !")
            }
        })
    })

    const interval = setInterval(() => {
        const manager = document.getElementById('lol-uikit-layer-manager-wrapper')
        if (manager) {
            clearInterval(interval)
            makeSettingsDraggable()
            new MutationObserver((mutations) => {
                makeSettingsDraggable()

                const plugin = document.querySelector('lol-uikit-scrollable.plugins_settings')
                const theme = document.querySelector('lol-uikit-scrollable.theme_settings')
                const backupandrestore = document.querySelector('lol-uikit-scrollable.backup_restore_settings')
                const aboutus = document.querySelector('lol-uikit-scrollable.aboutus_settings')

                if (theme && mutations.some((record) => Array.from(record.addedNodes).includes(theme))) {
                    themeSettings(theme)
                }
                else if (plugin && mutations.some((record) => Array.from(record.addedNodes).includes(plugin))) {
                    pluginsSettings(plugin)
                }
                else if (backupandrestore && mutations.some((record) => Array.from(record.addedNodes).includes(backupandrestore))) {
                    backuprestoretab(backupandrestore)
                }
                else if (aboutus && mutations.some((record) => Array.from(record.addedNodes).includes(aboutus))) {
                    aboutustab(aboutus)
                }
            }).observe(manager, {
                childList: true,
                subtree: true
            })
        }
    },500)
})

export { datapath, restartAfterChange }
/**
 * @wiki Manages the Elaina Theme settings panel inside the League Client. Adds custom tabs (Theme Settings, Plugin Settings, Backup & Restore, About Us) to the client settings page and handles configuration persistence through the DataStore.
 * @author Elaina Da Catto
 */
export function Settings(context: any) {
    ElainaData.set("settingsChangenumber", 0)
    settingsUtils(context, structure)
}

window.writeBackupData = writeBackupData
