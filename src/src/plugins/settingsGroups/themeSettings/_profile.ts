import { UI } from "../settingsUI.ts"
import { restartAfterChange } from "../../settings.ts"
import { customFontSection } from "./_customFont.ts"
import { addCss } from '../../../theme/loadCustomCss';

export async function profileSection(): Promise<HTMLElement> {
    const br = () => document.createElement("br")

    return UI.createSection("theme-settings-profile", await getString("theme-settings.settings-section-profile"), [
        UI.createRow("Custom-Curency", [
            UI.createRow("custom-rp", [
                UI.createCheckBox(
                    `${await getString("theme-settings.custom-rp")}`, 'cusrp', 'cusrpbox',
                    () => {
                        restartAfterChange('cusrp', "custom-rp")
                    }, true, "custom-rp"
                ),
                br(),
                UI.createSearchBox("RP-data")
            ]),
            UI.createRow("custom-be", [
                UI.createCheckBox(
                    `${await getString("theme-settings.custom-be")}`, 'cusbe', 'cusbebox',
                    () => {
                        restartAfterChange('cusbe', "custom-be")
                    }, true, "custom-be"
                ),
                br(),
                UI.createSearchBox("BE")
            ])
        ]),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.custom-summoner-lv")}`, 'cussumlv', 'cussumlvbox',
            () => {
                restartAfterChange('cussumlv', "custom-summoner-lv")
            }, true, "custom-summoner-lv"
        ),
        br(),
        UI.createSearchBox("custom-summoner-lv-number"),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.custom-rank-name")}`, 'cusrankname', 'cusranknamebox',
            () => {
                restartAfterChange('cusrankname', "custom-rank-name")
            }, true, "custom-rank-name"
        ),
        br(),
        UI.createSearchBox("Rank-line1"),
        UI.createSearchBox("Rank-line2"),
        br(),
        ...await customFontSection(),
        UI.createCheckBox(
            `${await getString("theme-settings.change-nickname-color")}`, 'nicknamecolor', 'nicknamecolorbox', () => {
                if (!ElainaData.get("change-nickname-color")) {
                    document.getElementById("nickname-color-css")?.remove()
                }
                else {
                    
                }
            }, true, "change-nickname-color"
        ),
        UI.createRowHideable("change-nickname-color-row", [
            br(),
            UI.createRow("nickname-color-with-text", [
                UI.colorPicker("nickname-color", "nickname-color", () => {
                    let input: any = document.getElementById("nickname-color")

                    ElainaData.set("nickname-color", input.value)
                    ElainaData.set("nickname-color-with-opacity", input.value + ElainaData.get("nickname-opacity"))

                    let color: any = document.getElementById("nickname-color-text")
                    color.textContent = ElainaData.get("nickname-color-with-opacity")

                    if (ElainaData.get("change-nickname-color")) {
                        document.getElementById("nickname-color-css")?.remove()

                        addCss.customNicknameColor()
                    }
                }),
                UI.createLabel(ElainaData.get("nickname-color-with-opacity"), "nickname-color-text"),
                UI.createLabel(`${await getString("theme-settings.preview")}: `, "nickname-color-preview-label"),
                UI.createLabel(
                    (document.querySelector(".rcp-fe-lol-social .player-name__force-locale-text-direction")?.textContent || ""),
                    "nickname-color-preview"
                )
            ]),
            UI.opacitySlider("change-nickname-opacity", await getString("theme-settings.opacity"), "nickname-opacity", async () => {
                let origin: any = document.getElementById("change-nickname-opacity")
                let title: any = document.getElementById("change-nickname-opacity-title")

                ElainaData.set("nickname-opacity", Math.round(origin.value / 100 * 255).toString(16).padStart(2, '0'))
                ElainaData.set("nickname-color-with-opacity", ElainaData.get("nickname-color") + ElainaData.get("nickname-opacity"))

                title.textContent = `${await getString("theme-settings.opacity")}: ${origin.value}%`

                let color: any = document.getElementById("nickname-color-text")
                color.textContent = ElainaData.get("nickname-color-with-opacity")

                if (ElainaData.get("change-nickname-color")) {
                    document.getElementById("nickname-color-css")?.remove()

                    addCss.customNicknameColor()
                }
            }),
        ]),
        UI.createCheckBox(
            `${await getString("theme-settings.hide-theme-usage-time")}`, 'hideusetime', 'hideusetimebox',
            () => { }, true, "hide-theme-usage-time"
        ),
    ])
}
