import { pluginUrl } from "../otherThings.ts";
import { log, error } from "../utils/themeLog.ts";
import { themeToast } from "../utils/themeToast.ts";

let cdnServer = (await import(pluginUrl("config/cdnServer.js"))).default

let initLink: string

export async function cdnImport(url: string, errorMsg: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.status === 200) {
            const serverModule = await import(url);
            return serverModule
        } else {
            throw new Error();
        }
    } 
    catch (err: any) {
        clearTimeout(timeoutId);
        error(errorMsg, err);
        themeToast.error(errorMsg, 'elaina-cdn-load');
    }
};

log(cdnServer["cdn-url"])

export async function initThemeDataCdn() {
    if (ElainaData.get("Dev-mode")) {
        initLink = pluginUrl("elaina-theme-data/cdninit.js");
        await cdnImport(pluginUrl("elaina-theme-data/index.js"), "Failed to load local data");
    }
    else {
        initLink = `${cdnServer["cdn-url"]}elaina-theme-data@${cdnServer["version"]}/cdninit.js`;
        await cdnImport(`${cdnServer["cdn-url"]}elaina-theme-data@${cdnServer["version"]}/index.js`, "Failed to load CDN data");
    }
}


// const { Cdninit } = await cdnImport(initLink, "Failed to load Init data")
// .then( res => {
//     if (res) return res 
//     else {
//         error("CDN respond {null}.")
//         return {}
//     } 
// })

// export { Cdninit }
