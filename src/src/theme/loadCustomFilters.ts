import utils from "../utils/utils.ts"
import { cdnImport } from "../otherThings.ts"
import { log } from "../utils/themeLog.ts";

let filtersData: string[] = (await cdnImport(utils.assets.url("config/filters.js"), "Can't import filters data")).default;

/** Applies CSS filter overlays to different client pages based on a configurable filter map. */
export class Filters {
	private filtersDataMap = {
		"rcp-fe-lol-yourshop": "Yourshop",
		"rcp-fe-lol-home-main": "Homepage",
		"rcp-fe-lol-activity-center-main": "Homepage",
		"rcp-fe-lol-champ-select": "Champ-select",
		"rcp-fe-lol-store": "Store",
		"rcp-fe-lol-collections": "Collections",
		"rcp-fe-lol-profiles-main": "Profiles",
		"rcp-fe-lol-parties": "Parties",
		"rcp-fe-lol-loot": "Loot",
		"rcp-fe-lol-clash-full": "Clash",
		"rcp-fe-lol-postgame": "Postgame",
		"rcp-fe-lol-event-hub": "EventShop",
		"rcp-fe-lol-tft": "TFT"
	};

	addFilterCss = () => {
		utils.addStyleNode(/*css*/`
			:root {
				--play-button-filter: ${filtersData["PlayButton"]};
				--find-match-button: ${filtersData["find-match-button"]};
				--PartiesStatusCard: ${filtersData["PartiesStatusCard"]};
			}
		`)
	}

	addBackgroundFilter = async (node: HTMLElement) => {
		let pagename: string = ""
		let previous_page: string = ""

		const elainaBg = document.getElementById("elaina-bg") as HTMLElement;
		const elainaStaticBg = document.getElementById("elaina-static-bg") as HTMLElement;
	
		const brightness_modifiers = Object.keys(this.filtersDataMap);
	
		pagename = node?.getAttribute("data-screen-name") as string;
		log(`%c${pagename}`, "color: #e4c2b3");
	
		if (elainaBg && elainaStaticBg) {
			// If the page is in the filtersDataMap
			if (this.filtersDataMap[pagename]) {
				elainaBg.style.filter = filtersData[this.filtersDataMap[pagename]];
				elainaStaticBg.style.filter = filtersData[this.filtersDataMap[pagename]];
			} 
			else if (brightness_modifiers.indexOf(previous_page) !== -1) {
				elainaBg.style.filter = filtersData["Homepage"];
				elainaStaticBg.style.filter = filtersData["Homepage"];
			}
			if (previous_page !== pagename) {
				previous_page = pagename;
			}
		}
		else { log(`Cannot set the filter`) }
	}

	main = () => {
		this.addFilterCss()
		
		utils.mutationObserverAddCallback(this.addBackgroundFilter, ["screen-root"])

		utils.subscribe_endpoint('/lol-gameflow/v1/gameflow-phase', (message: any) => {
			let phase = JSON.parse(message["data"])[2]["data"]
			if (phase == "GameStart" || phase == "InProgress") {
				const elainaBg = document.getElementById("elaina-bg") as HTMLElement
				elainaBg.style.filter = filtersData["Gamestart"]
			}
		})
	}
}
