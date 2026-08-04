import utils from '../../utils/utils.ts'
import * as upl from 'pengu-upl';
import { rankList } from '../../utils/rankList.ts';

async function requestChallengeCrystal() {
    const rank = await rankList()

    return {
        "lol": {
            "challengePoints"       : `${ElainaData.get("Challenge-Points")}`,
            "challengeCrystalLevel" : `${rank["Ranked Tier ID"][ElainaData.get("challengeCrystalLevel")]["Option"]}`
        }
    }
}

async function requestRank() {
    const rank = await rankList()

    return {
        "lol": {
            "rankedLeagueQueue"           : rank["Ranked Queue ID"][ElainaData.get("Ranked Queue ID")]["Option"],
            "rankedLeagueTier"            : rank["Ranked Tier ID"][ElainaData.get("Ranked Tier ID")]["Option"],
            "rankedLeagueDivision"        : rank["Ranked Division ID"][ElainaData.get("Ranked Division ID")]["name"],
            
            "classicRankedLeagueTier"     : rank["Ranked Tier ID"][ElainaData.get("classic-ranked-tier-id")]["Option"],
            "classicRankedLeagueDivision" : rank["Ranked Division ID"][ElainaData.get("classic-ranked-division-id")]["name"]
        }
    }
}

function requestMasteryScore() {
    return {
        "lol": {
            "masteryScore":`${ElainaData.get("Mastery-Score")}`
        }
    }
}



/** Customizes the player profile with user-defined badges, banners, and mastery scores. */
export class CustomProfile {
    async request(method: string, endpoint: string, { headers = {}, body = {} }: { headers?: Record<string, string>; body?: Record<string, any> } = {}): Promise<Response> {
        const requestOptions: RequestInit = {
            method: method,
            headers: {
                ...headers,
                "accept": "application/json",
                "content-type": "application/json"
            },
        }
        if (method !== "GET" && method !== "HEAD") {
            requestOptions.body = JSON.stringify(body)
        }
        return await fetch(endpoint, requestOptions)
    }

    async getPlayerPreferences(): Promise<PlayerPreferences> {
        const endpoint: string = "/lol-challenges/v1/summary-player-data/local-player"
        const response = await this.request("GET", endpoint)
        const responseData: { topChallenges: BadgeChallenge[]; title: Title; bannerId?: string} = await response.json()
        const playerPreferences: PlayerPreferences = { challengeIds: [] }
      
        playerPreferences.challengeIds = responseData.topChallenges.map((badgeChallenge) => badgeChallenge.id)

        if (responseData.title.itemId !== -1) { 
            playerPreferences.title = `${responseData.title.itemId}`
        }
        if (responseData.bannerId) { 
            playerPreferences.bannerAccent = responseData.bannerId 
        }
        
        return playerPreferences
    }

    async updatePlayerPreferences(playerPreferences: PlayerPreferences): Promise<Response> {
        const endpoint = "/lol-challenges/v1/update-player-preferences"
        return await this.request("POST", endpoint, { body: playerPreferences })
    }
      
    async setupInvisibleBanner() {
        const bannerContainer = document.querySelector("div > lol-regalia-profile-v2-element")?.shadowRoot?.querySelector("div > lol-regalia-banner-v2-element")?.shadowRoot?.querySelector("div")
        if (!bannerContainer || bannerContainer.hasAttribute("invisible-banner-setup")) { return }
      
        bannerContainer.setAttribute("invisible-banner-setup", "true")
        bannerContainer.addEventListener("mouseenter", () => { bannerContainer.style.opacity = "0.5" })
        bannerContainer.addEventListener("mouseleave", () => { bannerContainer.style.opacity = "1" })
        bannerContainer.addEventListener("click", async () => {
            const playerPreferences = await this.getPlayerPreferences()
            playerPreferences.bannerAccent = playerPreferences.bannerAccent === "2" ? "1" : "2"
            await this.updatePlayerPreferences(playerPreferences)
        })
    }
      
    async setupBadgesFunctions(): Promise<void> {
        const badgesContainer: HTMLElement | null = document.querySelector("div > div.challenge-banner-token-container")
        if (!badgesContainer || badgesContainer.hasAttribute("copy-badges-setup")) { return }
      
        badgesContainer.setAttribute("copy-badges-setup", "true")
        badgesContainer.addEventListener("mouseenter", () => { badgesContainer.style.opacity = "0.5" })
        badgesContainer.addEventListener("mouseleave", () => { badgesContainer.style.opacity = "1" })
        badgesContainer.addEventListener("click", async () => {
            const playerPreferences = await this.getPlayerPreferences()
      
            if (!playerPreferences.challengeIds.length) {
                console.debug(`The player does not have a defined badge.`)
                return
            }
      
            const firstBadge = playerPreferences.challengeIds[0]
            playerPreferences.challengeIds = Array(3).fill(firstBadge)
            await this.updatePlayerPreferences(playerPreferences)
        })
        badgesContainer.addEventListener("contextmenu", async () => {
            const playerPreferences = await this.getPlayerPreferences()
      
            if (!playerPreferences.challengeIds.length) {
                console.debug(`The player badges are already empty.`)
                return
            }
      
            playerPreferences.challengeIds = []
            await this.updatePlayerPreferences(playerPreferences)
        })
    }

    customMasteryScore = () => {
        upl.observer.subscribeToElementCreation("#lol-uikit-tooltip-root",async (element: any)=>{
            try{
                let checkID = element.querySelector(`lol-regalia-hovercard-v2-element`)?.getAttribute("summoner-id")
                if (checkID == ElainaData.get("Summoner-ID")) {
                    let GetMStext: any = document.querySelector("#hover-card-header > div.hover-card-header-left > span.hover-card-mastery-score")
                    let MStext = GetMStext.innerText
                    let checkMS = MStext.includes(`${ElainaData.get("Mastery-Score")}`)
                    if (!checkMS && ElainaData.get("Custom-mastery-score")) {
                        await this.request("PUT","/lol-chat/v1/me",{body: requestMasteryScore()})
                    }
                }
            }
            catch {}
        })

        upl.observer.subscribeToElementCreation(".collection-totals",(element: any)=>{
            let a: HTMLElement | null = element.querySelector(".total-owned.total-count.ember-view")
            if (a) {
                a.innerText = `${ElainaData.get("Mastery-Score")}`
                utils.freezeProperties(a,["innerText"])
            }
        })

        upl.observer.subscribeToElementCreation(".style-profile-champion-mastery-score",(element: any)=>{
            element.innerText = `${ElainaData.get("Mastery-Score")}`
            utils.freezeProperties(element,["innerText"])
        })

        window.setTimeout(async ()=>{
            if (ElainaData.get("Custom-rank")) {
                await this.request("PUT","/lol-chat/v1/me",{body: await requestRank()})
            }
        }, 10000)
    }

    customChallengeCrystal = () => {
        upl.observer.subscribeToElementCreation("#lol-uikit-tooltip-root",async (element: any)=>{
            try{
                let checkID = element.querySelector(`lol-regalia-hovercard-v2-element`)?.getAttribute("summoner-id")
                if (checkID == ElainaData.get("Summoner-ID")) {
                    let fix = window.setInterval(async ()=>{
                        let getCPtext: HTMLElement | null = element.querySelector(".hover-card-challenge-crystal")
                        let CPtext = getCPtext?.innerText
                        let checkCP = CPtext?.includes(`${ElainaData.get("Challenge-Points")}`)
                        if (!checkCP && ElainaData.get("Custom-challenge-crystal")) {
                            await this.request("PUT","/lol-chat/v1/me",{body: await requestChallengeCrystal()})
                        }
                    },100)
                    window.setTimeout(()=>{
                        window.clearInterval(fix)
                    },3000)
                }
            }
            catch {}
        })

        upl.observer.subscribeToElementCreation(".crystal-wrapper",async (element: any)=>{
            const rank = await rankList()

            let a: HTMLElement | null = element.querySelector(".contents > div:nth-child(1)")
            let b: HTMLElement | null = element.querySelector(".total-points")
            let level: HTMLElement | null = element.querySelector(".level")

            a?.setAttribute("class", `crystal-image ${rank["Ranked Tier ID"][ElainaData.get("Ranked Tier ID")]["Option"]}`)

            if (b) b.innerText = `${ElainaData.get("Challenge-Points")}`
            if (level) level.innerText = rank["Ranked Tier ID"][ElainaData.get("Ranked Tier ID")]["Option"].toLowerCase()
        })

        window.setTimeout(async ()=>{
            if (ElainaData.get("Custom-challenge-crystal")) {
                await this.request("PUT","/lol-chat/v1/me",{body: await requestChallengeCrystal()})
            }
        }, 10000)
    }

    customRank = async () => {
        await this.request("PUT","/lol-chat/v1/me",{body: await requestRank()})
    }

    CustomProfileRankName = () => {
        upl.observer.subscribeToElementCreation(".style-profile-ranked-component.ember-view .style-profile-emblem-header-title", (element: any) => 
            element.textContent = ElainaData.get("Rank-line1") 
        )
        upl.observer.subscribeToElementCreation(".style-profile-emblem-subheader-ranked > div", (element: any) => 
            element.textContent = ElainaData.get("Rank-line2") 
        )
    }

    customBagde = () => {
        utils.routineAddCallback(() => this.setupBadgesFunctions(), [".rcp-fe-lol-profiles-main"])
    }

    invisibleBanner = () => {
        utils.routineAddCallback(() => this.setupInvisibleBanner(), [".rcp-fe-lol-profiles-main"])
    }
}