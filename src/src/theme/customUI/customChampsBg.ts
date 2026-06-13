import { log } from "../../utils/themeLog.js"
import utils from '../../utils/utils.js'
import { cdnImport } from '../../otherThings.js'

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
    skill_passive?: string;
    skill_q?: string;
    skill_w?: string;
    skill_e?: string;
    skill_r?: string;
    skill_passive_name?: string;
    skill_passive_desc?: string;
    skill_q_name?: string;
    skill_q_desc?: string;
    skill_w_name?: string;
    skill_w_desc?: string;
    skill_e_name?: string;
    skill_e_desc?: string;
    skill_r_name?: string;
    skill_r_desc?: string;
    "css-left": string;
    lore: string;
}

type ChampImageField = "image" | "image_preview" | "image_thumbnail" | "skill_passive" | "skill_q" | "skill_w" | "skill_e" | "skill_r";
type AbilitySlot = "passive" | "q" | "w" | "e" | "r";
type ChampTextField = keyof Pick<ChampData,
    "skill_passive_name" | "skill_passive_desc" |
    "skill_q_name" | "skill_q_desc" |
    "skill_w_name" | "skill_w_desc" |
    "skill_e_name" | "skill_e_desc" |
    "skill_r_name" | "skill_r_desc"
>;

const abilityFields: Record<AbilitySlot, { image: ChampImageField; name: ChampTextField; desc: ChampTextField }> = {
    passive: { image: "skill_passive", name: "skill_passive_name", desc: "skill_passive_desc" },
    q: { image: "skill_q", name: "skill_q_name", desc: "skill_q_desc" },
    w: { image: "skill_w", name: "skill_w_name", desc: "skill_w_desc" },
    e: { image: "skill_e", name: "skill_e_name", desc: "skill_e_desc" },
    r: { image: "skill_r", name: "skill_r_name", desc: "skill_r_desc" }
};

const champUrl = utils.assets.champ;
const cssChampUrl = utils.assets.cssChamp;

const list = (await cdnImport(utils.assets.url("config/champsBgList.js"), "Can't import custom champion data")).default as ChampData[];

function normalizeChampName(name: string | null | undefined): string {
    return typeof name === "string"
        ? name.replace(/\s+/g, '').toLowerCase()
        : "";
}

const champByIconId = new Map<string, ChampData>();
const champByName = new Map<string, ChampData>();

for (const champ of list) {
    if (String(champ.default_icon_id).trim()) {
        champByIconId.set(String(champ.default_icon_id), champ);
    }

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
    private lastCollectionAbilitySlot: AbilitySlot | null = null;
    private lastCollectionChampionName: string | null = null;

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

    private hasValue(value: unknown): value is string {
        return typeof value === "string" && value.trim().length > 0;
    }

    private getChampAssetUrl(champData: ChampData, field: ChampImageField): string | null {
        const filename = champData[field];
        return this.hasValue(filename) ? champUrl(filename) : null;
    }

    private getChampCssAssetUrl(champData: ChampData, field: ChampImageField): string | null {
        const filename = champData[field];
        return this.hasValue(filename) ? cssChampUrl(filename) : null;
    }

    private getChampText(champData: ChampData, field: ChampTextField): string | null {
        const text = champData[field];
        return this.hasValue(text) ? text : null;
    }

    private applyChampionIconImage(element: Element, attribute: "src" | "href" = "src"): boolean {
        const champData = this.findChampDataFromIconUrl(element.getAttribute(attribute));
        if (!champData) return false;

        const nextImage = this.getChampAssetUrl(champData, "image_thumbnail");
        if (!nextImage) return false;
        if (element.getAttribute(attribute) === nextImage) return false;

        element.setAttribute(attribute, nextImage);
        return true;
    }

    private applyChampionIconBackground(element: Element): boolean {
        const champData = this.findChampDataFromIconUrl(this.getBackgroundImage(element));
        const nextImage = champData ? this.getChampCssAssetUrl(champData, "image_thumbnail") : null;
        return nextImage ? this.setBackgroundImage(element, nextImage) : false;
    }

    private applyCharacterBackground(element: Element): boolean {
        const champData = this.findChampDataFromCharacterUrl(this.getBackgroundImage(element));
        const nextImage = champData ? this.getChampCssAssetUrl(champData, "image_thumbnail") : null;
        return nextImage ? this.setBackgroundImage(element, nextImage) : false;
    }

    private applyCharacterSplashBackground(element: Element): boolean {
        const champData = this.findChampDataFromCharacterUrl(this.getBackgroundImage(element));
        const nextImage = champData ? this.getChampCssAssetUrl(champData, "image") : null;
        return nextImage ? this.setBackgroundImage(element, nextImage) : false;
    }

    private applyBaseSkinThumbnail(element: Element): boolean {
        const champData = this.findChampDataFromBaseSkinTileUrl(this.getBackgroundImage(element));
        const nextImage = champData ? this.getChampCssAssetUrl(champData, "image_thumbnail") : null;
        return nextImage ? this.setBackgroundImage(element, nextImage) : false;
    }

    private applyChampionName(element: Element): boolean {
        const champData = this.findChampDataFromName(element.textContent);
        return champData && this.hasValue(champData.replace_name)
            ? this.setText(element, champData.replace_name)
            : false;
    }

    private findChampDataFromElementMetadata(element: Element): ChampData | null {
        return this.findChampDataFromName(element.getAttribute("data-elaina-champ"));
    }

    private getAbilitySlotFromKey(key: string | null | undefined): AbilitySlot | null {
        const normalizedKey = normalizeChampName(key);
        if (normalizedKey === "p" || normalizedKey === "passive") return "passive";
        if (normalizedKey === "q") return "q";
        if (normalizedKey === "w") return "w";
        if (normalizedKey === "e") return "e";
        if (normalizedKey === "r") return "r";
        return null;
    }

    private getAbilitySlotFromAbilityElement(element: Element | null): AbilitySlot | null {
        if (!element) return null;
        if (element.classList.contains("ability-passive")) return "passive";
        if (element.classList.contains("ability-q")) return "q";
        if (element.classList.contains("ability-w")) return "w";
        if (element.classList.contains("ability-e")) return "e";
        if (element.classList.contains("ability-r")) return "r";
        return this.getAbilitySlotFromKey(element.querySelector(".ability-key")?.textContent);
    }

    private getAbilitySlotFromIcon(element: Element): AbilitySlot | null {
        const ability = element.closest(".ability");
        const slotFromAbility = this.getAbilitySlotFromAbilityElement(ability);
        if (slotFromAbility) return slotFromAbility;

        const slotFromDataset = this.getAbilitySlotFromKey(element.getAttribute("data-elaina-ability-slot"));
        if (slotFromDataset) return slotFromDataset;

        const actionName = element.getAttribute("data-dd-action-name") || "";
        const slotFromAction = actionName.match(/ability-previews-([pqwer])$/i)?.[1];
        if (slotFromAction) return this.getAbilitySlotFromKey(slotFromAction);

        const src = element.getAttribute("src") || "";
        const filename = src.split("/").pop() || "";
        if (/passive/i.test(filename)) return "passive";
        if (/q\d*\.[a-z0-9]+$/i.test(filename)) return "q";
        if (/w\d*\.[a-z0-9]+$/i.test(filename)) return "w";
        if (/e\d*\.[a-z0-9]+$/i.test(filename)) return "e";
        if (/r\d*\.[a-z0-9]+$/i.test(filename)) return "r";

        return null;
    }

    private getAbilitySlotFromCollectionSection(section: Element): AbilitySlot | null {
        const sectionSlot = section.getAttribute("section-id")?.match(/^ability_([pqwer])$/i)?.[1];
        if (sectionSlot) return this.getAbilitySlotFromKey(sectionSlot);

        const video = section.querySelector("[class*='ability-video-']");
        const videoSlot = Array.from(video?.classList || [])
            .find(className => /^ability-video-[pqwer]$/i.test(className))
            ?.replace("ability-video-", "");

        return this.getAbilitySlotFromKey(videoSlot);
    }

    private markAbilityElement(element: Element, champData: ChampData, slot: AbilitySlot): void {
        element.setAttribute("data-elaina-champ", champData.default_champion_name);
        element.setAttribute("data-elaina-ability-slot", slot);
        const ability = element.closest(".ability");
        if (ability) {
            ability.setAttribute("data-elaina-champ", champData.default_champion_name);
            ability.setAttribute("data-elaina-ability-slot", slot);
        }
    }

    private applyAbilityIcon(element: Element): boolean {
        const champData = this.findChampDataFromCharacterUrl(element.getAttribute("src")) || this.findChampDataFromElementMetadata(element);
        const slot = this.getAbilitySlotFromIcon(element);
        if (!champData || !slot) return false;

        this.markAbilityElement(element, champData, slot);

        const nextImage = this.getChampAssetUrl(champData, abilityFields[slot].image);
        if (!nextImage || element.getAttribute("src") === nextImage) return false;

        element.setAttribute("src", nextImage);
        return true;
    }

    private applyAbilityText(champData: ChampData, slot: AbilitySlot, nameElement: Element | null | undefined, descElement: Element | null | undefined): boolean {
        let changed = false;
        const name = this.getChampText(champData, abilityFields[slot].name);
        const desc = this.getChampText(champData, abilityFields[slot].desc);

        if (name && nameElement) changed = this.setText(nameElement, name) || changed;
        if (desc && descElement) changed = this.setText(descElement, desc) || changed;

        return changed;
    }

    private uniqueValues(values: Array<string | number | null | undefined>): string[] {
        return Array.from(new Set(values
            .map(value => String(value ?? "").trim())
            .filter(value => value.length > 0)));
    }

    private getChampionCharacterDirs(item: ChampData): string[] {
        return this.uniqueValues([
            item.first_default_filename,
            String(item.first_default_filename || "").toLowerCase(),
            item.second_default_filename,
            String(item.second_default_filename || "").toLowerCase()
        ]);
    }

    private getChampionDefaultBaseNames(item: ChampData): string[] {
        return this.uniqueValues([
            item.first_default_filename,
            String(item.first_default_filename || "").toLowerCase(),
            item.second_default_filename,
            String(item.second_default_filename || "").toLowerCase()
        ]);
    }

    private getBaseSkinPathVariants(item: ChampData, kind: "loadscreen" | "splash" | "tile"): string[] {
        const baseURL = `/lol-game-data/assets/ASSETS/Characters`;
        const paths: string[] = [];
        const secondDefaultFilename = item.second_default_filename || "";
        const secondDefaultFilenameLower = secondDefaultFilename.toLowerCase();

        for (const charDir of this.getChampionCharacterDirs(item)) {
            for (const baseName of this.getChampionDefaultBaseNames(item)) {
                if (kind === "loadscreen") {
                    for (const filename of ["LoadScreen", "Loadscreen"]) {
                        paths.push(`${baseURL}/${charDir}/Skins/Base/${baseName}${filename}.jpg`);
                        paths.push(`${baseURL}/${charDir}/Skins/Base/${baseName}${filename}_0.jpg`);

                        if (this.hasValue(secondDefaultFilename)) {
                            paths.push(`${baseURL}/${charDir}/Skins/Base/${baseName}${filename}_0.${secondDefaultFilename}.jpg`);
                            paths.push(`${baseURL}/${charDir}/Skins/Base/${baseName}${filename}_0.${secondDefaultFilenameLower}.jpg`);
                        }
                    }
                    continue;
                }

                const imagesBase = `${baseURL}/${charDir}/Skins/Base/Images`;
                if (kind === "splash") {
                    for (const type of ["centered", "uncentered"]) {
                        paths.push(`${imagesBase}/${baseName}_splash_${type}_0.jpg`);
                        if (this.hasValue(secondDefaultFilename)) {
                            paths.push(`${imagesBase}/${baseName}_splash_${type}_0.${secondDefaultFilename}.jpg`);
                            paths.push(`${imagesBase}/${baseName}_splash_${type}_0.${secondDefaultFilenameLower}.jpg`);
                        }
                    }
                    continue;
                }

                paths.push(`${imagesBase}/${baseName}_splash_tile_0.jpg`);
                if (this.hasValue(secondDefaultFilename)) {
                    paths.push(`${imagesBase}/${baseName}_splash_tile_0.${secondDefaultFilename}.jpg`);
                    paths.push(`${imagesBase}/${baseName}_splash_tile_0.${secondDefaultFilenameLower}.jpg`);
                }
            }
        }

        return this.uniqueValues(paths);
    }

    private buildAbilityIconSelectors(item: ChampData, slot: AbilitySlot): string[] {
        const selectors: string[] = [];
        const slotKeys = slot === "passive"
            ? ["Passive", "passive"]
            : [slot.toUpperCase(), slot.toLowerCase()];

        for (const charDir of this.getChampionCharacterDirs(item)) {
            for (const baseName of this.getChampionDefaultBaseNames(item)) {
                for (const slotKey of slotKeys) {
                    const baseSelectors = [
                        `${baseName}${slotKey}`,
                        `${baseName}_${slotKey}`,
                        `Icon_${baseName}_${slotKey}`,
                        `Icon_${baseName}${slotKey}`
                    ];

                    for (const marker of baseSelectors) {
                        selectors.push(`img[src*="/Characters/${charDir}/"][src*="/HUD/Icons2D/"][src*="${marker}"]`);
                    }
                }
            }
        }

        return this.uniqueValues(selectors);
    }

    private buildClientImageReplacementCss(): string {
        const rules: string[] = [];

        for (const item of list) {
            const customThumbnail = this.getChampAssetUrl(item, "image_thumbnail");
            const iconId = String(item.default_icon_id ?? "").trim();
            if (customThumbnail && iconId) {
                const iconPath = `/lol-game-data/assets/v1/champion-icons/${iconId}.png`;
                rules.push(utils.assetReplacement.imageSrc(iconPath, customThumbnail, "img"));
                rules.push(utils.assetReplacement.imageHref(iconPath, customThumbnail));
                rules.push(utils.assetReplacement.styleBackground(iconPath, customThumbnail));
            }

            const customPreviewImage = this.getChampAssetUrl(item, "image_preview");
            if (customPreviewImage) {
                for (const oldPath of this.getBaseSkinPathVariants(item, "loadscreen")) {
                    rules.push(utils.assetReplacement.imageSrc(oldPath, customPreviewImage, "img"));
                    rules.push(utils.assetReplacement.styleBackground(oldPath, customPreviewImage));
                }
            }

            const customImage = this.getChampAssetUrl(item, "image");
            if (customImage) {
                for (const oldPath of this.getBaseSkinPathVariants(item, "splash")) {
                    rules.push(utils.assetReplacement.imageSrc(oldPath, customImage, "img"));
                    rules.push(utils.assetReplacement.styleBackground(oldPath, customImage));
                }
            }

            if (customThumbnail) {
                for (const oldPath of this.getBaseSkinPathVariants(item, "tile")) {
                    rules.push(utils.assetReplacement.imageSrc(oldPath, customThumbnail, "img"));
                    rules.push(utils.assetReplacement.styleBackground(oldPath, customThumbnail));
                }
            }

            for (const slot of Object.keys(abilityFields) as AbilitySlot[]) {
                const customAbilityIcon = this.getChampAssetUrl(item, abilityFields[slot].image);
                if (!customAbilityIcon) continue;

                for (const selector of this.buildAbilityIconSelectors(item, slot)) {
                    rules.push(utils.assetReplacement.imageReplacement(selector, customAbilityIcon));
                }
            }
        }

        return rules.join("\n");
    }

    private applyClientImageReplacementCss(): void {
        utils.styleEngine.apply("custom-champs-image-assets", this.buildClientImageReplacementCss(), {
            document: true,
            shadow: true
        });
    }

    private applyCollectionTab(): void {
        const nameContainers = document.getElementsByClassName("champion-name-container");

        for (const nameContainer of Array.from(nameContainers)) {
            const championNameElement = nameContainer.querySelector(".champion-name:not(#champion-name-replace)") as HTMLElement | null;
            if (!championNameElement) continue;

            const champData = this.findChampDataFromName(championNameElement.innerText);
            if (champData) {
                if (this.hasValue(champData.replace_name) && !nameContainer.querySelector("#champion-name-replace")) {
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

    private applyCollectionAbilities(): void {
        document
            .querySelectorAll(".spellbook .ability-icon")
            .forEach(icon => this.applyAbilityIcon(icon));

        const pageChampData = this.findChampDataFromName(document.querySelector(".lockup-champion-name")?.textContent);
        if (pageChampData && this.lastCollectionChampionName !== pageChampData.default_champion_name) {
            this.lastCollectionChampionName = pageChampData.default_champion_name;
            this.lastCollectionAbilitySlot = null;
        }

        if (pageChampData && this.applyCollectionAbilitySections(pageChampData)) return;

        const abilities = Array.from(document.querySelectorAll(".spellbook .ability"));
        const activeAbility = this.findCollectionActiveAbility(abilities);
        const activeIcon = activeAbility?.querySelector(".ability-icon");
        const champData = (activeIcon
            ? this.findChampDataFromCharacterUrl(activeIcon.getAttribute("src")) || this.findChampDataFromElementMetadata(activeIcon)
            : null)
            || (activeAbility ? this.findChampDataFromElementMetadata(activeAbility) : null)
            || pageChampData;
        const slot = this.lastCollectionAbilitySlot || this.getAbilitySlotFromAbilityElement(activeAbility);
        if (!champData || !slot) return;

        this.applyAbilityText(
            champData,
            slot,
            document.querySelector(".cdp-ability-description-wrapper .cdp-ability-name"),
            document.querySelector(".cdp-ability-description-wrapper .cdp-ability-dynamic-desc")
        );
    }

    private applyCollectionAbilitySections(champData: ChampData): boolean {
        let foundSection = false;

        document
            .querySelectorAll("lol-uikit-section[section-id^='ability_'], .cdp-ability-section-container[section-id^='ability_']")
            .forEach(section => {
                const slot = this.getAbilitySlotFromCollectionSection(section);
                if (!slot) return;

                foundSection = true;
                this.applyAbilityText(
                    champData,
                    slot,
                    section.querySelector(".cdp-ability-description-wrapper .cdp-ability-name"),
                    section.querySelector(".cdp-ability-description-wrapper .cdp-ability-dynamic-desc")
                );
            });

        return foundSection;
    }

    private findCollectionActiveAbility(abilities: Element[]): Element | null {
        if (this.lastCollectionAbilitySlot) {
            const clickedAbility = abilities.find(ability => this.getAbilitySlotFromAbilityElement(ability) === this.lastCollectionAbilitySlot);
            if (clickedAbility) return clickedAbility;
        }

        return abilities.find(ability => ability.classList.contains("selected"))
            || abilities.find(ability => ability.querySelector(".selected"))
            || abilities.find(ability => ability.querySelector(".ability-video-progress"))
            || abilities.find(ability => ability.classList.contains("active"))
            || abilities.find(ability => ability.classList.contains("section-visible"))
            || null;
    }

    private handleCollectionAbilityClick = (event: Event): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const ability = target.closest(".spellbook .ability");
        const slot = this.getAbilitySlotFromAbilityElement(ability);
        if (!slot) return;

        this.lastCollectionAbilitySlot = slot;
        this.scheduleApply(100);
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

        document
            .querySelectorAll(".champion-select .ability-icon, .skin-select .ability-icon")
            .forEach(icon => this.applyAbilityIcon(icon));

        document
            .querySelectorAll(".ability-previews-container")
            .forEach(container => this.applyChampionSelectAbilityPreview(container));
    }

    private applyChampionSelectAbilityPreview(container: Element): void {
        const selectedPreviewIcon = container.querySelector(".ability-icon-container.selected .ability-icon")
            || container.querySelector(".ability-icon");
        const slot = this.getAbilitySlotFromKey(container.querySelector(".ability-title-container .ability-key")?.textContent)
            || (selectedPreviewIcon ? this.getAbilitySlotFromIcon(selectedPreviewIcon) : null);
        if (!slot) return;

        const selectedIcon = container.querySelector(`.ability-icon[data-elaina-ability-slot="${slot}"]`)
            || selectedPreviewIcon;
        if (!selectedIcon) return;

        const champData = this.findChampDataFromCharacterUrl(selectedIcon.getAttribute("src")) || this.findChampDataFromElementMetadata(selectedIcon);
        if (!champData) return;

        this.applyAbilityText(
            champData,
            slot,
            container.querySelector(".ability-title-container .ability-name"),
            container.querySelector(".ability-description-container .ability-description")
        );
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

            if (this.hasValue(champData.replace_name)) this.setText(championName, champData.replace_name);
            if (this.hasValue(champData.replace_sub_name)) this.setText(championName.parentElement?.querySelector(".lockup-champion-title"), champData.replace_sub_name);

            const bio = document.querySelector(".cdp-overview-short-bio");
            if (bio && this.hasValue(champData.lore) && bio.innerHTML !== champData.lore) {
                bio.innerHTML = champData.lore;
            }

            [
                "lol-uikit-section[section-id='cdp_overview'] .cdp-backdrop-img",
                "lol-uikit-section[section-id='cdp_mastery'] .cdp-backdrop-img",
                "lol-uikit-section[section-id='cdp_progression'] .cdp-backdrop-img"
            ].forEach(selector => {
                const backdrop = document.querySelector(selector) as HTMLElement | null;
                if (backdrop && this.hasValue(champData["css-left"]) && backdrop.style.left !== champData["css-left"]) {
                    backdrop.style.left = champData["css-left"];
                }
            });

            if (this.hasValue(champData.replace_name) && document.querySelector(".cdp-skins-section.ember-view > lol-uikit-section-controller[selected-item='skin_0']")) {
                this.setText(document.querySelector(".champion-skin-name.skin-name"), champData.replace_name);
            }

            const thumbnail = this.getChampCssAssetUrl(champData, "image_thumbnail");
            if (thumbnail) {
                this.updateDefaultSkinThumbnails(".carousel-track-container .buffer-wrapper", thumbnail);
                this.updateDefaultSkinThumbnails(".carousel-track-container .thumbnail-wrapper", thumbnail);
            }

            this.applyCollectionAbilities();
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
        this.applyCollectionAbilities();
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
        this.applyClientImageReplacementCss();
        this.startDomObserver();
        document.addEventListener("click", this.handleCollectionAbilityClick, true);

        this.applyAllVisibleAreas();
        [100, 500, 1500].forEach(delay => {
            window.setTimeout(this.applyAllVisibleAreas, delay);
        });
    }
}
