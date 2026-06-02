import { log } from "../../utils/themeLog.js"
import utils from '../../utils/utils.js'
import { pluginUrl, cdnImport } from '../../otherThings.js'

type ChampData = {
    default_champion_name: string;
    first_default_filename: string;
    second_default_filename: string;
    default_icon_id: number | string;
    replace_name: string;
    replace_sub_name: string;
    image: string;
    image_preview: string;
    image_thumbnail: string;
    "css-left": string;
    lore: string;
}

const champUrl = (...parts: unknown[]) => pluginUrl("assets/champs", ...parts);
const cssChampUrl = (...parts: unknown[]) => utils.cssUrl(champUrl(...parts));

const list = (await cdnImport(pluginUrl("config/champsBgList.js"), "Can't import custom champion data")).default as ChampData[];
const registeredImageSrcReplacements = new Set<string>();

function normalizeChampName(name: string | null | undefined): string {
    return typeof name === "string"
        ? name.replace(/\s+/g, '').toLowerCase()
        : "";
}

const champByIconId = new Map<string, ChampData>();
const champByName = new Map<string, ChampData>();

for (const champ of list) {
    champByIconId.set(String(champ.default_icon_id), champ);

    [
        champ.default_champion_name,
        champ.replace_name,
        champ.first_default_filename,
        champ.second_default_filename
    ].forEach(name => {
        const normalizedName = normalizeChampName(name);
        if (normalizedName) champByName.set(normalizedName, champ);
    });
}

/** Replaces default champion select thumbnails with custom background images from a config list. */
export class CustomChampsBg {
    private observer: MutationObserver | null = null;
    private applyTimer: number | null = null;

    private findChampDataFromName(name: string | null | undefined): ChampData | null {
        const cleanName = normalizeChampName(name);
        return cleanName ? champByName.get(cleanName) || null : null;
    }

    private findChampDataFromIconUrl(iconUrlValue: string | null | undefined): ChampData | null {
        if (!iconUrlValue) return null;

        const iconId = iconUrlValue.match(/champion-icons\/(\d+)\.png/i)?.[1];
        return iconId ? champByIconId.get(iconId) || null : null;
    }

    private findChampDataFromCharacterUrl(imageUrlValue: string | null | undefined): ChampData | null {
        const characterName = imageUrlValue?.match(/Characters\/([^/]+)\//i)?.[1];
        return this.findChampDataFromName(characterName);
    }

    private findChampDataFromBaseSkinTileUrl(imageUrlValue: string | null | undefined): ChampData | null {
        if (!imageUrlValue || !imageUrlValue.includes("splash_tile_0")) return null;

        const characterName = imageUrlValue.match(/Characters\/([^/]+)\/Skins\/Base\/Images\//i)?.[1];
        return this.findChampDataFromName(characterName);
    }

    private getBackgroundImage(element: Element): string {
        if (!(element instanceof HTMLElement)) return "";
        return element.style.backgroundImage || getComputedStyle(element).backgroundImage;
    }

    private setBackgroundImage(element: Element, image: string): boolean {
        if (!(element instanceof HTMLElement)) return false;
        if (element.style.backgroundImage === image) return false;

        element.style.backgroundImage = image;
        return true;
    }

    private setText(element: Element | null | undefined, text: string): boolean {
        if (!element || element.textContent?.trim() === text) return false;

        element.textContent = text;
        return true;
    }

    private registerImageSrcReplacement(oldSrc: string, newSrc: string): void {
        if (registeredImageSrcReplacements.has(oldSrc)) return;

        registeredImageSrcReplacements.add(oldSrc);
        utils.updateImageSrc(oldSrc, newSrc);
    }

    private applyChampionIconImage(element: Element, attribute: "src" | "href" = "src"): boolean {
        const champData = this.findChampDataFromIconUrl(element.getAttribute(attribute));
        if (!champData) return false;

        const nextImage = champUrl(champData.image_thumbnail);
        if (element.getAttribute(attribute) === nextImage) return false;

        element.setAttribute(attribute, nextImage);
        return true;
    }

    private applyChampionIconBackground(element: Element): boolean {
        const champData = this.findChampDataFromIconUrl(this.getBackgroundImage(element));
        return champData ? this.setBackgroundImage(element, cssChampUrl(champData.image_thumbnail)) : false;
    }

    private applyCharacterBackground(element: Element): boolean {
        const champData = this.findChampDataFromCharacterUrl(this.getBackgroundImage(element));
        return champData ? this.setBackgroundImage(element, cssChampUrl(champData.image_thumbnail)) : false;
    }

    private applyCharacterSplashBackground(element: Element): boolean {
        const champData = this.findChampDataFromCharacterUrl(this.getBackgroundImage(element));
        return champData ? this.setBackgroundImage(element, cssChampUrl(champData.image)) : false;
    }

    private applyBaseSkinThumbnail(element: Element): boolean {
        const champData = this.findChampDataFromBaseSkinTileUrl(this.getBackgroundImage(element));
        return champData ? this.setBackgroundImage(element, cssChampUrl(champData.image_thumbnail)) : false;
    }

    private applyChampionName(element: Element): boolean {
        const champData = this.findChampDataFromName(element.textContent);
        return champData ? this.setText(element, champData.replace_name) : false;
    }

    private registerClientImageReplacements(): void {
        const baseURL = `/lol-game-data/assets/ASSETS/Characters`;

        for (const item of list) {
            const firstDefaultFilename = item.first_default_filename;
            const firstDefaultFilenameLower = firstDefaultFilename.toLowerCase();
            const secondDefaultFilename = item.second_default_filename;
            const secondDefaultFilenameLower = secondDefaultFilename.toLowerCase();
            const imagesBase = `${baseURL}/${firstDefaultFilename}/Skins/Base/Images`;
            const customImage = champUrl(item.image);
            const customPreviewImage = champUrl(item.image_preview);

            this.registerImageSrcReplacement(`/lol-game-data/assets/v1/champion-icons/${item.default_icon_id}.png`, champUrl(item.image_thumbnail));

            for (const charDir of [firstDefaultFilename, firstDefaultFilenameLower]) {
                for (const filename of ["LoadScreen", "Loadscreen"]) {
                    this.registerImageSrcReplacement(`${baseURL}/${charDir}/Skins/Base/${firstDefaultFilename}${filename}.jpg`, customPreviewImage);
                    this.registerImageSrcReplacement(`${baseURL}/${charDir}/Skins/Base/${firstDefaultFilename}${filename}_0.jpg`, customPreviewImage);
                    this.registerImageSrcReplacement(`${baseURL}/${charDir}/Skins/Base/${firstDefaultFilename}${filename}_0.${secondDefaultFilename}.jpg`, customPreviewImage);
                }
            }

            for (const name of [firstDefaultFilename, firstDefaultFilenameLower]) {
                for (const type of ["centered", "uncentered"]) {
                    this.registerImageSrcReplacement(`${imagesBase}/${name}_splash_${type}_0.jpg`, customImage);
                    this.registerImageSrcReplacement(`${imagesBase}/${name}_splash_${type}_0.${secondDefaultFilename}.jpg`, customImage);
                    this.registerImageSrcReplacement(`${imagesBase}/${name}_splash_${type}_0.${secondDefaultFilenameLower}.jpg`, customImage);
                }
            }
        }
    }

    private applyCollectionTab(): void {
        const nameContainers = document.getElementsByClassName("champion-name-container");

        for (const nameContainer of Array.from(nameContainers)) {
            const championNameElement = nameContainer.querySelector(".champion-name:not(#champion-name-replace)") as HTMLElement | null;
            if (!championNameElement) continue;

            const champData = this.findChampDataFromName(championNameElement.innerText);
            if (champData) {
                if (!nameContainer.querySelector("#champion-name-replace")) {
                    const newName = document.createElement("p");
                    newName.classList.add("champion-name");
                    newName.id = "champion-name-replace";
                    newName.innerText = champData.replace_name;

                    nameContainer.append(newName);
                    championNameElement.style.display = "none";

                    log(`Replaced ${champData.default_champion_name} with ${champData.replace_name}`);
                }
            } else {
                const replacedName = nameContainer.querySelector("#champion-name-replace");
                if (replacedName) {
                    championNameElement.style.removeProperty("display");
                    replacedName.remove();
                    log(`Restored ${championNameElement.innerText}`);
                }
            }
        }

        document
            .querySelectorAll(".name-progress-container .champion-name")
            .forEach(champName => this.applyChampionName(champName));
    }

    private applyProfileTab(): void {
        document
            .querySelectorAll(".style-profile-champion-icon-masked img, .profile-eternals-champion-icon")
            .forEach(icon => this.applyChampionIconImage(icon));

        document
            .querySelectorAll(".profile-lcm-tooltip-contents-title")
            .forEach(title => this.applyChampionName(title));
    }

    private applyChampionSelect(): void {
        document
            .querySelectorAll(".champion-grid-champion-thumbnail img")
            .forEach(icon => this.applyChampionIconImage(icon));

        document
            .querySelectorAll(".portrait-icon.fit-icon")
            .forEach(portraitIcon => this.applyChampionIconBackground(portraitIcon));

        document
            .querySelectorAll(".champion-select .skin-name-text, .skin-select .skin-name-text, .champion-select .champion-name")
            .forEach(champName => this.applyChampionName(champName));

        document
            .querySelectorAll(".champion-select .skin-selection-thumbnail, .skin-select .skin-selection-thumbnail")
            .forEach(thumbnail => this.applyBaseSkinThumbnail(thumbnail));
    }

    private applyLootTab(): void {
        document
            .querySelectorAll(".loot-item-visual-container .icon, .loot-item-tooltip-hero")
            .forEach(icon => this.applyCharacterBackground(icon));
    }

    private updateDefaultSkinThumbnails(selector: string, img: string): void {
        document.querySelectorAll(selector).forEach(element => {
            const defaultSkinThumbnail = element.querySelector("div");
            if (defaultSkinThumbnail && defaultSkinThumbnail.style.backgroundImage.includes("tile_0")) {
                defaultSkinThumbnail.style.backgroundImage = img;
            }
        });
    }

    private applyChampionDetailsPage(): void {
        document.querySelectorAll(".lockup-champion-name").forEach(championName => {
            const champData = this.findChampDataFromName(championName.textContent?.replace(/\n\s*/g, ''));
            if (!champData) return;

            this.setText(championName, champData.replace_name);
            this.setText(championName.parentElement?.querySelector(".lockup-champion-title"), champData.replace_sub_name);

            const bio = document.querySelector(".cdp-overview-short-bio");
            if (bio && champData.lore !== "" && bio.innerHTML !== champData.lore) {
                bio.innerHTML = champData.lore;
            }

            [
                "lol-uikit-section[section-id='cdp_overview'] .cdp-backdrop-img",
                "lol-uikit-section[section-id='cdp_mastery'] .cdp-backdrop-img",
                "lol-uikit-section[section-id='cdp_progression'] .cdp-backdrop-img"
            ].forEach(selector => {
                const backdrop = document.querySelector(selector) as HTMLElement | null;
                if (backdrop && backdrop.style.left !== champData["css-left"]) {
                    backdrop.style.left = champData["css-left"];
                }
            });

            if (document.querySelector(".cdp-skins-section.ember-view > lol-uikit-section-controller[selected-item='skin_0']")) {
                this.setText(document.querySelector(".champion-skin-name.skin-name"), champData.replace_name);
            }

            this.updateDefaultSkinThumbnails(".carousel-track-container .buffer-wrapper", cssChampUrl(champData.image_thumbnail));
            this.updateDefaultSkinThumbnails(".carousel-track-container .thumbnail-wrapper", cssChampUrl(champData.image_thumbnail));
        });
    }

    private applyMatchHistoryTab(): void {
        document
            .querySelectorAll(".player-history-champion-pic, .recent-champ-img, .map-champ-toggle-img, .team-avatar-img, .match-details-event-tooltip .event-tooltip-icon-champion .event-tooltip-icon-img, .match-details-map-event-tooltip .map-event-tooltip-icon .event-tooltip-icon-img, .match-details-map-event-tooltip .map-event-tooltip-icon .map-event-tooltip-icon-img")
            .forEach(icon => this.applyChampionIconImage(icon));

        document.querySelectorAll(".match-details-team-list .player-history-champion-pic").forEach((champIcon: any) => {
            champIcon.style.width = "128px";
        });

        document.querySelectorAll(".tick.team-blue, .tick.team-red").forEach(tick => {
            const avatar = tick.querySelector(".avatar");
            if (avatar) this.applyChampionIconImage(avatar, "href");
        });

        document.querySelectorAll(".runes-player-stats").forEach(stats => {
            const championPic = stats.querySelector(".champion-pic");
            if (championPic) this.applyChampionIconImage(championPic);
        });

        document.querySelectorAll("lol-uikit-champion-mastery-tooltip").forEach(champName => {
            const champData = this.findChampDataFromName(champName.getAttribute("name"));
            const nameElement = champName.shadowRoot?.querySelector(".name");
            if (champData && nameElement) this.setText(nameElement, champData.replace_name);
        });
    }

    private applyPostGame(): void {
        document
            .querySelectorAll(".scoreboard-row-skin-background, .postgame-champion-background, .postgame-background-image")
            .forEach(background => this.applyCharacterSplashBackground(background));

        document
            .querySelectorAll(".scoreboard-row-champ-name")
            .forEach(champName => this.applyChampionName(champName));
    }

    private applyCustomGameTeam(): void {
        document
            .querySelectorAll(".custom-member-bot-icon-img")
            .forEach(icon => this.applyChampionIconImage(icon));

        document
            .querySelectorAll(".custom-bot-champion-name")
            .forEach(name => this.applyChampionName(name));
    }

    private applyChampionSetRows(): void {
        document.querySelectorAll(".champion-set-row .champion-border").forEach(border => {
            const img = border.querySelector("img");
            if (img) this.applyChampionIconImage(img);
        });
    }

    private applyAllVisibleAreas = (): void => {
        this.applyChampionSelect();
        this.applyCollectionTab();
        this.applyProfileTab();
        this.applyLootTab();
        this.applyChampionDetailsPage();
        this.applyMatchHistoryTab();
        this.applyPostGame();
        this.applyCustomGameTeam();
        this.applyChampionSetRows();
    }

    private scheduleApply(delay = 50): void {
        if (this.applyTimer !== null) window.clearTimeout(this.applyTimer);
        this.applyTimer = window.setTimeout(() => {
            this.applyTimer = null;
            this.applyAllVisibleAreas();
        }, delay);
    }

    private startDomObserver(): void {
        if (this.observer) return;

        this.observer = new MutationObserver(() => this.scheduleApply());
        this.observer.observe(document, {
            attributes: true,
            attributeFilter: ["src", "href", "style", "class", "name"],
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    main = () => {
        this.registerClientImageReplacements();
        this.startDomObserver();

        this.applyAllVisibleAreas();
        [100, 500, 1500].forEach(delay => {
            window.setTimeout(this.applyAllVisibleAreas, delay);
        });
    }
}
