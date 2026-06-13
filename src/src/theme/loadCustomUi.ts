import * as upl from 'pengu-upl'

import { HomePage } from "./customUI/customHomepage.ts";
import { RemoveGamemode } from './customUI/removeGamemode.ts';
import { CustomProfile } from './customUI/customProfile.ts';
import { CustomRunesBackground } from './customUI/customRuneBg.ts';
import { CustomGameSearchCard } from './customUI/customGameSearchCard.ts';
import { CustomIcon } from './customUI/customIcon.ts';
import { HideFriendList } from './customUI/hideFriendList.ts';
import { CustomChampsBg } from "./customUI/customChampsBg.ts"

//upl.observer.subscribeToElementCreation(".summoner-xp-radial", (element: any)=> {element.remove()})
upl.observer.subscribeToElementCreation(".parallax-layer-container",(element: any) => element.style.backgroundImage = '' )
//upl.observer.subscribeToElementCreation("",(element: any)=>{})

/** Orchestrates initialization of all custom UI components for the theme. */
export class ApplyUI {
	main = async () => {
		// Add homepage
        const homePage = new HomePage()
        homePage.main()

		// Remove gamemodes
		const removeGamemode = new RemoveGamemode()
		removeGamemode.main()

		// Custom profile
		const customProfile = new CustomProfile()
		customProfile.customBagde()
		if (ElainaData.get("invisible_banner")) {
			customProfile.invisibleBanner()
		}
		if (ElainaData.get("Custom-profile-hover")) {
			if (ElainaData.get("Custom-mastery-score")) customProfile.customMasteryScore()
			if (ElainaData.get("Custom-challenge-crystal")) customProfile.customChallengeCrystal()
			if (ElainaData.get("Custom-rank")) {
				window.setTimeout(async ()=>{
					customProfile.customRank()
					window.customRank = customProfile.customRank
				}, 10000)
			}
		}
		if (ElainaData.get("custom-rank-name")) customProfile.CustomProfileRankName()

		// Custom runes background
		if (ElainaData.get("Runes-BG")) {
			const customRunesBackground = new CustomRunesBackground()

			customRunesBackground.removeOtherImage()
			customRunesBackground.changeRunesBackground()
		}

		// Custom gamesearch card
		if (ElainaData.get("new-gamesearch-queue")) {
			const customgameSearchCard = new CustomGameSearchCard()

			customgameSearchCard.restyleGamesearchCard()
		}

		// Custom icon
		if (ElainaData.get("Custom-Icon")) {
			const customIcon = new CustomIcon()
			customIcon.main()
		}

		// Hide friendlist button// Add hide friendslist button
        const hideFriendslist = new HideFriendList()
        hideFriendslist.main()

		// Custom champs background
		if (ElainaData.get("custom-champs-image")) {
			const customChampsBg = new CustomChampsBg()
			customChampsBg.main()
		}
	}
}
