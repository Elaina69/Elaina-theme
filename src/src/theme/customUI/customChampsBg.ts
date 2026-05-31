import * as upl from 'pengu-upl'
import { log } from "../../utils/themeLog.js"
import utils from '../../utils/utils.js'
import { pluginUrl, cdnImport } from '../../otherThings.js'

let bgInterval: number
const champUrl = (...parts: unknown[]) => pluginUrl("assets/champs", ...parts);
const cssChampUrl = (...parts: unknown[]) => utils.cssUrl(champUrl(...parts));

const list = (await cdnImport(pluginUrl("config/champsBgList.js"), "Can't import custom champion data")).default;

/** Replaces default champion select thumbnails with custom background images from a config list. */
export class CustomChampsBg {
    updateDefaultSkinThumbnails(selector, img) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            const defaultSkinThumbnail = element.querySelector("div");
            if (defaultSkinThumbnail && defaultSkinThumbnail.style.backgroundImage.includes("tile_0")) {
                defaultSkinThumbnail.style.backgroundImage = img;
            }
        });
    }

    customOnCollectionTab = () => {
        for (const item of list) {
            const firstDefaultFilename      : String = item.first_default_filename;
            const firstDefaultFilenameLower : String = firstDefaultFilename.toLowerCase();
            const secondDefaultFilename     : String = item.second_default_filename;
            const secondDefaultFilenameLower: String = secondDefaultFilename.toLowerCase();

            const baseURL    = `/lol-game-data/assets/ASSETS/Characters`;
            const imagesBase = `${baseURL}/${firstDefaultFilename}/Skins/Base/Images`;

            const customImage           = champUrl(item.image);
            const customPreviewImage    = champUrl(item.image_preview);
                
            for (const charDir of [firstDefaultFilename, firstDefaultFilenameLower]) {
                for (const filename of ["LoadScreen", "Loadscreen"]) {
                    utils.updateImageSrc(`${baseURL}/${charDir}/Skins/Base/${firstDefaultFilename}${filename}.jpg`, customPreviewImage);
                    utils.updateImageSrc(`${baseURL}/${charDir}/Skins/Base/${firstDefaultFilename}${filename}_0.jpg`, customPreviewImage);
                    utils.updateImageSrc(`${baseURL}/${charDir}/Skins/Base/${firstDefaultFilename}${filename}_0.${secondDefaultFilename}.jpg`, customPreviewImage);
                }
            }

            for (const name of [firstDefaultFilename, firstDefaultFilenameLower]) {
                for (const type of ["centered", "uncentered"]) {
                    utils.updateImageSrc(`${imagesBase}/${name}_splash_${type}_0.jpg`, customImage);
                    utils.updateImageSrc(`${imagesBase}/${name}_splash_${type}_0.${secondDefaultFilename}.jpg`, customImage);
                    utils.updateImageSrc(`${imagesBase}/${name}_splash_${type}_0.${secondDefaultFilenameLower}.jpg`, customImage);
                }
            }
        }
    }

    customOnCollectionTabLoop = () => {
        const thumbnails = document.getElementsByClassName("champion-thumbnail");
        const nameContainers = document.getElementsByClassName("champion-name-container");

        for (let i = 0; i < thumbnails.length; i++) {
            const nameContainer = nameContainers[i];
            if (!nameContainer) continue;
            const championNameElement = nameContainer.querySelector(".champion-name") as HTMLElement;
            if (!championNameElement) continue;

            const cleanName = championNameElement.innerText.replace(/\s+/g, '').toLowerCase();
            const champData = list.find(
                champ =>
                    cleanName === champ.default_champion_name.replace(/\s+/g, '').toLowerCase() ||
                    cleanName === champ.replace_name.replace(/\s+/g, '').toLowerCase()
            );

            if (champData) {
                if (!nameContainer.querySelector("#champion-name-replace")) {
                    let newName = document.createElement("p");
                    newName.classList.add("champion-name");
                    newName.id = "champion-name-replace";
                    newName.innerText = champData.replace_name;

                    nameContainer.append(newName);
                    championNameElement.style.display = "none";
                        
                    log(`Replaced ${champData.default_champion_name} with ${champData.replace_name}`);
                }
            } 
            else {
                const replacedName = nameContainer.querySelector("#champion-name-replace");
                if (replacedName) {
                    championNameElement.style.removeProperty("display");
                    replacedName.remove();
                    log(`Restored ${championNameElement.innerText}`);
                }
            }
        }

        const champNameWhenHoverInCollection = document.querySelectorAll(".name-progress-container .champion-name");
        champNameWhenHoverInCollection.forEach(champName => {
            const champData = list.find(champ =>
                champName.textContent?.replace(/\s+/g, '').toLowerCase() === champ.default_champion_name.replace(/\s+/g, '').toLowerCase() ||
                champName.textContent?.replace(/\s+/g, '').toLowerCase() === champ.replace_name.replace(/\s+/g, '').toLowerCase()
            );
            if (champData) {
                champName.textContent = champData.replace_name;
            }
        });
    }

    customOnProfileTabLoop = () => {
        const profileMasteryIcons = document.querySelectorAll(".style-profile-champion-icon-masked img");
        profileMasteryIcons.forEach(profileMasteryIcon => {
            const champData = list.find(champ =>
                profileMasteryIcon.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );
            if (champData) {
                profileMasteryIcon.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        });

        const profileMasteryChampTitles = document.querySelectorAll(".profile-lcm-tooltip-contents-title");
        profileMasteryChampTitles.forEach(profileMasteryChampTitle => {
            const champData = list.find(champ =>
                profileMasteryChampTitle.textContent?.replace(/\s+/g, '').toLowerCase() === champ.default_champion_name.replace(/\s+/g, '').toLowerCase() ||
                profileMasteryChampTitle.textContent?.replace(/\s+/g, '').toLowerCase() === champ.replace_name.replace(/\s+/g, '').toLowerCase()
            );
            if (champData) {
                profileMasteryChampTitle.textContent = champData.replace_name;
            }
        });

        const profileEternalsIcons = document.querySelectorAll(".profile-eternals-champion-icon");
        profileEternalsIcons.forEach(profileEternalIcon => {
            const champData = list.find(champ => 
                profileEternalIcon.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );
            if (champData) {
                profileEternalIcon.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        });
    }

    customOnChampionSelectLoop = () => {
        const champSelectList = document.querySelectorAll(".champion-grid-champion-thumbnail");
        champSelectList.forEach(thumbnail => {
            const img = thumbnail.querySelector("img");
            if (!img) return;
            const champData = list.find(champ =>
                img.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );
            if (champData) {
                img.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        });
    }

    customOnLootTab = () => {
        upl.observer.subscribeToElementCreation(".loot-item-visual-container", (element: any) => {
            for (let i = 0; i < list.length; i++) {
                let champIcon = element.querySelector(".icon").style.backgroundImage;
                if (
                    champIcon.match(/Characters\/([^\/]+)\//)?.[1].toLowerCase() == list[i]["default_champion_name"].toLowerCase() || 
                    champIcon.match(/Characters\/([^\/]+)\//)?.[1].toLowerCase() == list[i]["replace_name"].toLowerCase()
                ){
                    champIcon = cssChampUrl(list[i]["image_thumbnail"])
                }
            }
        })
    }

    customOnLootTabLoop = () => {
        const champWhenHoverInLootTab = document.querySelectorAll(".loot-item-tooltip-hero");
    }

    customChampionDetailsPage = () => {
        upl.observer.subscribeToElementCreation(".lockup-champion-name", (element: any) => {
            bgInterval = window.setInterval(() => {
                for(let j = 0; j < list.length; j++) {
                    if (element.textContent.replace(/\n\s*/g, '') == list[j]["default_champion_name"] || element.textContent.replace(/\n\s*/g, '') == list[j]["replace_name"]){
                        element.textContent = list[j]["replace_name"]
                        element.parentNode.querySelector(".lockup-champion-title").textContent = list[j]["replace_sub_name"]
        
                        // Overview tab
                        let overview: HTMLElement|null = document.querySelector("lol-uikit-section[section-id='cdp_overview'] .cdp-backdrop-img")
                        if (overview) {
                            let bio = document.querySelector(".cdp-overview-short-bio")
                            if (bio && list[j]["lore"] != "") {
                                bio.innerHTML = list[j]["lore"]
                            }
                            overview.style.cssText = `left: ${list[j]["css-left"]}`
                        }

                        // Mastery tab
                        let mastery: HTMLElement|null = document.querySelector("lol-uikit-section[section-id='cdp_mastery'] .cdp-backdrop-img")
                        if (mastery) {
                            mastery.style.cssText = `left: ${list[j]["css-left"]}`
                        }
                        
                        // Progression tab
                        let progression: HTMLElement|null = document.querySelector("lol-uikit-section[section-id='cdp_progression'] .cdp-backdrop-img")
                        if (progression) {
                            progression.style.cssText = `left: ${list[j]["css-left"]}`
                        }
        
                        // Skins tab
                        let skinName = document.querySelector(".champion-skin-name.skin-name")
                        if (document.querySelector(".cdp-skins-section.ember-view > lol-uikit-section-controller[selected-item='skin_0']")) {
                            if (skinName) skinName.textContent = list[j]["replace_name"]
                        }
        
                        this.updateDefaultSkinThumbnails(".carousel-track-container .buffer-wrapper", cssChampUrl(list[j]["image_thumbnail"]));
                        this.updateDefaultSkinThumbnails(".carousel-track-container .thumbnail-wrapper", cssChampUrl(list[j]["image_thumbnail"]));
                    }
                }
            }, 100)
        })
            
        upl.observer.subscribeToElementDeletion(".lockup-champion-name", (element: any) => {
            window.clearInterval(bgInterval)
            log("cleared Interval!")
        })
    }

    customOnMatchHistoryTab = () => {
        // Match list
        upl.observer.subscribeToElementCreation(".player-history-champion-pic", (element: any) => {
            const champData = list.find(champ => 
                element.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                element.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        })

        // Recent played champions
        upl.observer.subscribeToElementCreation(".recent-champ-img", (element: any) => {
            const champData = list.find(champ => 
                element.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                element.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        })

        // Match details
        upl.observer.subscribeToElementCreation(".match-details-team-list", (element: any) => {
            const champIcons = element.querySelectorAll(".player-history-champion-pic");
            champIcons.forEach((champIcon: any) => {
                champIcon.style.width = "128px";
            })
        })

        // Match details map chart
        upl.observer.subscribeToElementCreation(".map-champ-toggle-img", (element: any) => {
            const champData = list.find(champ =>
                element.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                element.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        })

        // Match details stats
        upl.observer.subscribeToElementCreation(".team-avatar-img", (element: any) => {
            const champData = list.find(champ =>
                element.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                element.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        })

        // Match details graph
        upl.observer.subscribeToElementCreation(".tick.team-blue", (element: any) => {
            const champData = list.find(champ =>
                element.querySelector(".avatar")?.getAttribute("href")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                element.querySelector(".avatar")?.setAttribute("href", champUrl(champData.image_thumbnail));
            }
        })

        upl.observer.subscribeToElementCreation(".tick.team-red", (element: any) => {
            const champData = list.find(champ =>
                element.querySelector(".avatar")?.getAttribute("href")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                element.querySelector(".avatar")?.setAttribute("href", champUrl(champData.image_thumbnail));
            }
        })

        // Match details runes
        upl.observer.subscribeToElementCreation(".runes-player-stats", (element: any) => {
            const champData = list.find(champ =>
                element.querySelector(".champion-pic")?.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                element.querySelector(".champion-pic")?.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        })
    }

    customOnMatchHistoryTabLoop = () => {
        const champNameWhenHoverInRecentPlayedChamps = document.querySelectorAll("lol-uikit-champion-mastery-tooltip");
        champNameWhenHoverInRecentPlayedChamps.forEach(champName => {
            const champData = list.find(champ =>
                champName.getAttribute("name")?.replace(/\s+/g, '').toLowerCase() === champ.default_champion_name.replace(/\s+/g, '').toLowerCase() ||
                champName.getAttribute("name")?.replace(/\s+/g, '').toLowerCase() === champ.replace_name.replace(/\s+/g, '').toLowerCase()
            );

            if (champData) {
                let nameElement = champName.shadowRoot
                if (nameElement) {
                    nameElement.querySelector(".name")!.textContent = champData.replace_name;
                }
            }
        });

        const champIconsWhenHoverInMatchEvent = document.querySelectorAll(".match-details-event-tooltip .event-tooltip-icon-champion .event-tooltip-icon-img");
        champIconsWhenHoverInMatchEvent.forEach(champIcon => {
            const champData = list.find(champ =>
                champIcon.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                champIcon.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        });

        const champIconsWhenHoverInMatchMapEvent = document.querySelectorAll(".match-details-map-event-tooltip .map-event-tooltip-icon .map-event-tooltip-icon-img");
        champIconsWhenHoverInMatchMapEvent.forEach(champIcon => {
            const champData = list.find(champ =>
                champIcon.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                champIcon.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        });
    }

    customOnCustomGameTeamLoop = () => {
        const botIcon = document.querySelectorAll(".custom-member-bot-icon-img");
        botIcon.forEach(thumbnail => {
            const champData = list.find(champ =>
                thumbnail.getAttribute("src")?.includes(champ.default_icon_id.toString())
            );

            if (champData) {
                thumbnail.setAttribute("src", champUrl(champData.image_thumbnail));
            }
        })

        const botName = document.querySelectorAll(".custom-bot-champion-name");
        botName.forEach(name => {
            const champData = list.find(champ =>
                name.textContent?.replace(/\s+/g, '').toLowerCase() === champ.default_champion_name.replace(/\s+/g, '').toLowerCase() ||
                name.textContent?.replace(/\s+/g, '').toLowerCase() === champ.replace_name.replace(/\s+/g, '').toLowerCase()
            );

            if (champData) {
                name.textContent = champData.replace_name;
            }
        });
    }

    main = () => {
        // Collection tab
        this.customOnCollectionTab();

        // Loot tab
        this.customOnLootTab();

        // Champion Details Page
        this.customChampionDetailsPage();

        // Match History tab
        this.customOnMatchHistoryTab();

        window.setInterval(() => {
            // Champion Select
            this.customOnChampionSelectLoop();

            // Collection tab
            this.customOnCollectionTabLoop();

            // Profile tab
            this.customOnProfileTabLoop();

            // Loot tab
            this.customOnLootTabLoop();

            // Match History tab
            this.customOnMatchHistoryTabLoop();

            // Custom game team
            this.customOnCustomGameTeamLoop();

            //
            const champSetRow = document.querySelectorAll(".champion-set-row .champion-border");
            champSetRow.forEach(border => {
                const img = border.querySelector("img");

                if (!img) return;
                const champData = list.find(champ => 
                    img.getAttribute("src")?.includes(champ.default_icon_id.toString())
                );

                if (champData) {
                    img.setAttribute("src", champUrl(champData.image_thumbnail));
                }
            });
        }, 100)
    }
}
