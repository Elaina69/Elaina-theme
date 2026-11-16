import { UI } from "../settingsUI.ts"
import { error } from "../../../utils/themeLog.ts"
import { setWindowEffectsSettingsVisibility } from "../../../theme/customUI/customHomepage.ts"

import { infoSection } from "./_info.ts"
import { assetLibrarySection } from "./_assetLibrary.ts"
import { wallpaperSection } from "./_wallpaper.ts"
import { audioSection } from "./_audio.ts"
import { updatesSection } from "./_updates.ts"
import { customAssetsSection } from "./_customAssets.ts"
import { interfaceSection } from "./_interface.ts"
import { profileSection } from "./_profile.ts"
import { gameTabsSection } from "./_gameTabs.ts"
import { nsfwSection } from "./_nsfw.ts"

async function themeSettings(panel: Element) {
    const loading = UI.createRow("loading", [
        UI.createLoading(await getString("common.settings-loading")),
    ])
    panel.appendChild(loading);

    try {
        await window.refreshLists?.();
        panel.prepend(
            UI.createRow("theme-settings-root", [
                ...await infoSection(),
                await assetLibrarySection(),
                await wallpaperSection(),
                await audioSection(),
                await updatesSection(),
                await customAssetsSection(),
                await interfaceSection(),
                await profileSection(),
                await gameTabsSection(),
                await nsfwSection(),
            ])
        )

        let hideButtons = document.querySelectorAll("#elaina-theme-settings-row-hide-button");
        hideButtons.forEach((button: any) => {
            button.click()
        });
        setWindowEffectsSettingsVisibility();
    }
    catch (err: any) {
        error("Error loading theme settings:", err);
    } finally {
        loading.remove();
    }
}

export { themeSettings }
