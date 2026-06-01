import { UI } from "../settingsUI.ts"
import { restartAfterChange } from "../../settings.ts"

export async function pluginsInfoSection(): Promise<HTMLElement[]> {
    return [
        UI.createRow("Info", [
            UI.createRow("Info-div", [
                UI.createLink(
                    'ElainaV4',
                    'https://github.com/Elaina69/Elaina-V4',
                    () => {},
                    "theme-link"
                ),
                UI.createLabel(
                    `*${await getString("settings.note")}: ${await getString("settings.note-1")}`, ""
                ),
            ]),
            UI.createImage(true, "logo.webp", "plugins-settings-logo")
        ]),
        UI.createLabel(
            `${await getString("plugins-settings.plugins-settings")}`, "", "theme-settings-section-title"
        ),
    ]
}
