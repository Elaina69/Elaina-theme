import utils from "../../utils/utils.ts"
import * as upl from "pengu-upl"

const filters = (await import(utils.assets.url("config/filters.js"))).default;

/** Replaces rune page backgrounds with custom images and applies CSS filter overlays. */
export class CustomRunesBackground {
    removeOtherImage = () => {
        let remove = (element: any) => {element.remove()}

        upl.observer.subscribeToElementCreation('.aux', remove)
        upl.observer.subscribeToElementCreation('#splash', remove)
        upl.observer.subscribeToElementCreation('#construct', remove)
        upl.observer.subscribeToElementCreation('#keystone', remove)
    }

    changeRunesBackground = () => {
        utils.styleEngine.apply("custom-runes-background", /*css*/`
            .perks-construct-minspec {
                top: 0 !important;
                left: 0 !important;
                filter: ${filters["Runes"]} !important;
            }

            .perks-construct-minspec[primary="8000"] { background-image: var(--pri8000) !important; }
            .perks-construct-minspec[primary="8100"] { background-image: var(--pri8100) !important; }
            .perks-construct-minspec[primary="8200"] { background-image: var(--pri8200) !important; }
            .perks-construct-minspec[primary="8300"] { background-image: var(--pri8300) !important; }
            .perks-construct-minspec[primary="8400"] { background-image: var(--pri8400) !important; }
        `)
    }
}
