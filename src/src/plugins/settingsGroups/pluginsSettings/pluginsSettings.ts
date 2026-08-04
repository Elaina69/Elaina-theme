import { UI } from "../settingsUI.ts"
import { error } from "../../../utils/themeLog.ts"
import { pluginsInfoSection } from "./_info.ts"
import { coreSection } from "./_core.ts"
// import { queueSection } from "./_queue.ts"
import { pluginsProfileSection } from "./_profile.ts"
import { developerSection } from "./_developer.ts"

async function pluginsSettings(panel: Element) {
    const loading = UI.createRow("loading", [
        UI.createLoading(await getString("common.settings-loading")),
    ])
    panel.appendChild(loading);

    try {
        panel.prepend(
            UI.createRow("plugins-settings-root", [
                ...await pluginsInfoSection(),
                await coreSection(),
                // await queueSection(),
                await pluginsProfileSection(),
                await developerSection(),
            ])
        )

        let hideButtons = document.querySelectorAll("#elaina-theme-settings-row-hide-button");
        hideButtons.forEach((button: any) => {
            button.click()
        });
    }
    catch (err: any) {
        error("Error loading theme settings:", err);
    } finally {
        loading.remove();
    }
}

export { pluginsSettings }
