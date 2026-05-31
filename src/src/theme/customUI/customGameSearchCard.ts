import * as upl from 'pengu-upl';
import { pluginUrl } from "../../otherThings"
let filters = (await import(pluginUrl("config/filters.js"))).default;

/** Restyles the game search and queue card UI with custom layout and animations. */
export class CustomGameSearchCard {
	DisplayNone: any = (element: HTMLElement) => {
		element.style.display = 'none'
	}

	restyleGamesearchCard = () => {
		upl.observer.subscribeToElementCreation('.parties-game-info-panel-bg-container', (element: any) => 
			element.hidden = true
		)
	
		// lol-parties-game-search
		upl.observer.subscribeToElementCreation('.parties-game-search-status', (element: any) => 
			element.style.cssText = `
				border: 1px solid #8c8263; 
				border-radius: 10px; 
				margin-top: 1px
			`
		)
		upl.observer.subscribeToElementCreation('.parties-game-search-header', (element: any) => 
			element.style.cssText = `height: 28px;`
		)
		upl.observer.subscribeToElementCreation('.parties-game-search-divider', this.DisplayNone)
		upl.observer.subscribeToElementCreation('.parties-game-search-map', (element: any) => 
			element.style.cssText = `
				filter: ${filters["PartiesStatusCard"]};
			`
		)
	
		// lol-parties-status-card
		upl.observer.subscribeToElementCreation('.parties-status-card-bg-container', this.DisplayNone)
		upl.observer.subscribeToElementCreation('.parties-status-card', (element: any) => 
			element.style.background = 'transparent'
		)
		upl.observer.subscribeToElementCreation('.parties-status-card-header', (element: any) => 
			element.style.cssText = `
				visibility: hidden;
				height: 14px;
			`
		)
		upl.observer.subscribeToElementCreation('.parties-status-card-body', (element: any) => 
			element.style.cssText = `
				margin-top: -23px; 
				padding: 10px 5px 10px 10px; 
				border: 1px solid #8c8263; 
				border-radius: 10px
			`
		)
		upl.observer.subscribeToElementCreation('.parties-status-card-map', (element: any) => 
			element.style.cssText = `
				margin: -3px 10px 0 0;
				filter: ${filters["PartiesStatusCard"]};
			`
		)
		
		// lol-parties-game-invites
		upl.observer.subscribeToElementCreation('.parties-game-invite-heading-text', (element: any) => {
			element.hidden = true
		})
	}
}
