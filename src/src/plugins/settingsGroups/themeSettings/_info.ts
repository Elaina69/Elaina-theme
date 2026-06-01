import { UI } from "../settingsUI.ts"
import { restartAfterChange } from "../../settings.ts"

export async function infoSection(): Promise<HTMLElement[]> {
    const themeLanguageOptions = [
        { label: await getString("theme-settings.theme-language-client"), value: "client" },
        { label: "English", value: "default" },
        { label: "Tiếng Việt", value: "vi-VN" },
        { label: "Русский", value: "ru-RU" },
        { label: "中文", value: "zh-CN" },
    ]

    return [
        UI.createRow("Info", [
            UI.createRow("Info-div", [
                UI.createLink(
                    'ElainaV4',
                    'https://github.com/Elaina69/Elaina-V4',
                    () => { },
                    "theme-link"
                ),
                UI.createLabel(
                    `*${await getString("settings.note")}: ${await getString("settings.note-1")}`, ""
                ),
            ]),
            UI.createImage(true, "logo.webp", "theme-settings-logo")
        ]),
        UI.createCheckBox(
            `${await getString("theme-settings.allowtrackingdata")}`, 'trackData', 'trackDatabox', () => {
                restartAfterChange('trackData', "AllowTrackingData")
            }, true, "AllowTrackingData"
        ),
        UI.createDropdown(
            themeLanguageOptions,
            ElainaData.get("Theme-language"),
            {
                title: await getString("theme-settings.theme-language"),
                id: "theme-language-dropdown",
                datastoreKey: "Theme-language",
                onChange: () => {
                    restartAfterChange("theme-language-dropdown", "Theme-language")
                }
            }
        ),
    ]
}
