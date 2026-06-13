import { UI } from "../settingsUI.ts"
import { restartAfterChange } from "../../settings.ts"
import {
    hideShowNavBar,
    changeHomePageStyle,
} from "../../../theme/customUI/customHomepage.ts"
import { inspectTool } from "../../inspectTool.ts"
import utils from "../../../utils/utils.ts"
import { addCss } from "../../../theme/loadCustomCss.ts"

export async function interfaceSection(): Promise<HTMLElement> {
    const br = () => document.createElement("br")

    return UI.createSection("theme-settings-interface", await getString("theme-settings.settings-section-interface"), [
        UI.createCheckBox(
            `${await getString("theme-settings.hide-homepage-navbar")}`, 'homenav', 'homenavbox', () => {
                hideShowNavBar()
                changeHomePageStyle()
            }, true, "hide-homepage-navbar"
        ),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.enable-hide-top-navbar-friendlist-button")}`, 'hidetopnavfriend', 'hidetopnavfriendbox',
            () => {
                restartAfterChange("hidetopnavfriend", "enable-hide-top-navbar-friendlist-button")
            }, true, "enable-hide-top-navbar-friendlist-button"
        ),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.change-sidebar-color")}`, 'sbt', 'sbtbox',
            () => {
                if (ElainaData.get("change-sidebar-color")) addCss.customSidebarColor()
                else utils.styleEngine.remove("sidebar-color-css")
            }, true, "change-sidebar-color"
        ),
        UI.createRowHideable("change-sidebar-color-row", [
            br(),
            UI.createRow("sidebar-color-with-text", [
                UI.colorPicker("sidebar-color", "sidebar-color", () => {
                    let input: any = document.getElementById("sidebar-color")

                    ElainaData.set("sidebar-color", input.value)
                    ElainaData.set("sidebar-color-with-opacity", input.value + ElainaData.get("sidebar-opacity"))

                    let color: any = document.getElementById("sidebar-color-text")
                    color.textContent = ElainaData.get("sidebar-color-with-opacity")

                    if (ElainaData.get("change-sidebar-color")) addCss.customSidebarColor()
                }),
                UI.createLabel(ElainaData.get("sidebar-color-with-opacity"), "sidebar-color-text"),
            ]),
            UI.opacitySlider("change-sidebar-opacity", await getString("theme-settings.opacity"), "sidebar-opacity", async () => {
                let origin: any = document.getElementById("change-sidebar-opacity")
                let title: any = document.getElementById("change-sidebar-opacity-title")

                ElainaData.set("sidebar-opacity", Math.round(origin.value / 100 * 255).toString(16).padStart(2, '0'))
                ElainaData.set("sidebar-color-with-opacity", ElainaData.get("sidebar-color") + ElainaData.get("sidebar-opacity"))

                title.textContent = `${await getString("theme-settings.opacity")}: ${origin.value}%`

                let color: any = document.getElementById("sidebar-color-text")
                color.textContent = ElainaData.get("sidebar-color-with-opacity")

                if (ElainaData.get("change-sidebar-color")) addCss.customSidebarColor()
            }),
        ]),
        UI.createCheckBox(
            `${await getString("theme-settings.lobby-transparent-filter")}`, 'ltf', 'ltfbox',
            () => {
                restartAfterChange("ltf", "lobby-transparent-filter")
            }, true, "lobby-transparent-filter"
        ),
        br(),
        UI.createCheckBox(await getString("theme-settings.hide-profile-background"), "hideprfbg", "hideprfbgbox",
            () => {
                restartAfterChange("hideprfbg", "hide-profile-background")
            }, true, "hide-profile-background"
        ),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.hide-champions-splash-art")}`, 'hidechampart', 'hidechampartbox',
            () => {
                restartAfterChange('hidechampart', "hide-champions-splash-art")
            }, true, "hide-champions-splash-art"
        ),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.hide-vertical-lines")}`, "hidevl", "hidevlbox",
            () => {
                restartAfterChange("hidevl", "hide-vertical-lines")
            }, true, "hide-vertical-lines"
        ),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.inspect-tool")}`, "inspecttool", "inspecttoolbox",
            () => {
                inspectTool.toggle(ElainaData.get("inspect-tool"))
            }, true, "inspect-tool"
        ),
    ])
}
