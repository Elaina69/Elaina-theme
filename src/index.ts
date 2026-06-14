/**
 * @name Elaina-Theme
 * @author Elaina Da Catto
 * @description Elaina theme for Pengu Loader
 * @link https://github.com/Elaina69
 * @Nyan Meow~~~
 */
// Import theme DataStore to use it instead pengu DataStore
import { ElainaData } from "./src/utils/themeDataStore.ts";

// Importing theme contents
import "./src/languages.ts";
import { log } from './src/utils/themeLog.ts';
import { initThemeName } from './src/otherThings.ts';

log('By %cElaina Da Catto', 'color: #e4c2b3');
log('%cMeow ~~~', 'color: #e4c2b3');
log('Importing theme contents');

// Import server-side backup/restore data service
import { restoreDefaultDataStore } from './src/services/backupAndRestoreDatastore';
import { initThemeDataCdn } from './src/theme/Cdn.ts';

// Import Init modules
import { Settings } from "./src/plugins/settings.ts";
import { transparentLobby } from "./src/theme/customUI/transparentLobby.ts";
import { AutoQueue } from "./src/plugins/autoQueue.ts";
import { skipHonor } from "./src/plugins/skipHonor.js";
import { fileSystem } from "./src/utils/fileSystem.ts";

// Import modules
import { CheckUpdate } from "./src/updates/checkUpdate.ts"
import { ApplyUI } from "./src/theme/loadCustomUi.ts";
import { Filters } from "./src/theme/loadCustomFilters.ts"
import { LoadCss } from "./src/theme/loadCustomCss.ts"
import { ThemePresetSettings } from "./src/plugins/themePresetSettingsTab.ts"

// Import plugins
import { CustomStatus } from "./src/plugins/customStatus.ts"
import { AutoAccept } from "./src/plugins/autoAccept.ts"
import { CustomBeRp } from "./src/plugins/customBeRp.ts"
import { CustomSummonerLv } from "./src/plugins/customSummonerLv.ts"
import { LootHelper } from "./src/plugins/lootHelper.ts"
import { NameSpoofer } from "./src/plugins/nameSpoofer.ts"
import { OfflineMode } from "./src/plugins/offlineMode.ts"
// import { Practice5vs5 } from "./src/plugins/practice5vs5.ts"
import { InviteAllFriends } from "./src/plugins/inviteAllFriends.ts"
// import { DodgeButton } from "./src/plugins/dodgeButton.ts"

// Import other plugins
import * as upl from "pengu-upl"
import { ForceJungLane } from "./src/plugins/forceJungleLane.ts"
import { syncUserIcons } from "./src/plugins/syncUserIcons.ts";
import { initDebug } from "./src/utils/debug.ts"

// Export Init
export async function init(context: any) {
    log('Resolving theme name');
    initThemeName(context);

    log('Initializing ElainaData storage');
    await ElainaData.init(context);
    await restoreDefaultDataStore();
    ElainaData.set("start-time", Date.now());

    log('Initializing file system for theme');
    await fileSystem.init(context);

    log('Initializing icon sync storage');
    await syncUserIcons.init();

    log('Initializing theme');
    await initThemeDataCdn();
    initDebug();

    // createHomePageTab(context);
    Settings(context);
    transparentLobby(context);
    AutoQueue(context);
    skipHonor(context);
    // Cdninit(context);
}

class ElainaTheme {
    async main() {
        // Check theme's version and available update
        const checkUpdate = new CheckUpdate()
        checkUpdate.main()

        // Apply theme custom UI
        const applyUI = new ApplyUI()
        await applyUI.main()

        // Add filter for wallpaper
        const filters = new Filters()
        filters.main()

        // Add theme's Css
        const loadCss = new LoadCss()
        loadCss.main()

        // Load plugins
        // Add theme's pre-settings
        const themePresetSettings = new ThemePresetSettings()
        themePresetSettings.main()

        // Custom BE, RP
        const customBeRp = new CustomBeRp()

        // Custom Summoner Level
        const customSummonerLv = new CustomSummonerLv()

        // Auto Accept
        const autoAccept = new AutoAccept()
        autoAccept.main(ElainaData.get("auto_accept_button"))

        // Custom status
        const customStatus = new CustomStatus()
        if (ElainaData.get("Custom-Status") && ElainaData.get("Custom-profile-hover")) customStatus.main()

        // Add dodge button
        // const dodgeButton = new DodgeButton()
        // dodgeButton.main()

        // Force jungle or lane
        const forceJungleLane = new ForceJungLane()
        forceJungleLane.main()

        // Add invite all friends buttons
        const inviteAllFriends = new InviteAllFriends()
        if (ElainaData.get("Enable-Invite-Fr")) inviteAllFriends.main()

        // Add loot helper
        const lootHelper = new LootHelper()
        if (ElainaData.get("loot-helper")) lootHelper.main()

        // Spoof name
        const nameSpoofer = new NameSpoofer()
        nameSpoofer.main()

        // Add practice 5vs5 room button
        // const practice5vs5 = new Practice5vs5()
        // if (!ElainaData.get("aram-only")) practice5vs5.main()

        // Offline mode
        const offlineMode = new OfflineMode()
        offlineMode.main()

        // This code will run for each 1s
        window.setInterval(() => {
            // Custom BE/RP
            if (ElainaData.get("custom-rp")) customBeRp.RP()
            if (ElainaData.get("custom-be")) customBeRp.BE()

            // Custom Summoner Level
            if (ElainaData.get("custom-summoner-lv")) customSummonerLv.main()

            // Check list change
            window.refreshLists()
        }, 1000);
    }
}

const elainaTheme = new ElainaTheme()
export async function load() {
    await elainaTheme.main()

    // For debug only
    if (ElainaData.get("Dev-mode")) window.upl = upl;
}
