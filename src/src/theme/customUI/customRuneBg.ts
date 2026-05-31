import * as upl from 'pengu-upl';
import { pluginUrl } from "../../otherThings"

const filters = (await import(pluginUrl("config/filters.js"))).default;

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
        upl.observer.subscribeToElementCreation('.perks-construct-minspec', (element: any) => {
            window.setInterval(()=>{
                element.style.cssText = `
                    top: 0px; 
                    left: 0px; 
                    filter: ${filters["Runes"]}; 
                    background-image: var(--pri${element.getAttribute('primary')})
                `
            },100)
        })
    }
}
