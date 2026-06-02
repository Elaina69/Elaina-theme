import utils from '../../utils/utils.ts'
import * as upl from 'pengu-upl';
import { pluginUrl } from "../../otherThings"
import { log, warn, error } from '../../utils/themeLog.ts';
import { friendIconList, resolveSyncedUserTargetByDisplayName } from '../../plugins/syncUserIcons.ts';

const icdata = (await import(pluginUrl("config/icons.js"))).default;

const iconUrl = (...parts: unknown[]) => pluginUrl("assets/icon", ...parts);
const cssIconUrl = (...parts: unknown[]) => utils.cssUrl(iconUrl(...parts));

type SyncedIconType = "avatar" | "border" | "banner" | "emblem" | "hoverCardBackdrop" | "rankIcon" | "clashBanner";
type ApplyResult = boolean | Promise<boolean>;

const rankEmblemCssVars = [
	"--regalia-emblem-unranked",
	"--regalia-emblem-iron",
	"--regalia-emblem-bronze",
	"--regalia-emblem-silver",
	"--regalia-emblem-gold",
	"--regalia-emblem-platinum",
	"--regalia-emblem-diamond",
	"--regalia-emblem-master",
	"--regalia-emblem-grandmaster",
	"--regalia-emblem-challenger",
	"--regalia-emblem-emerald"
] as const;

const activeRegaliaWatchers = new WeakMap<Element, Set<string>>();
const activeSocialRosterWatchers = new WeakMap<Element, MutationObserver>();
const activeChatHeaderWatchers = new WeakMap<Element, MutationObserver>();
const activeIdentityTooltipWatchers = new WeakMap<Element, MutationObserver>();
const chatNameTargetCache = new Map<string, UserIconTarget | null>();
let lastIdentityTooltipTarget: UserIconTarget | null = null;
let lastIdentityTooltipTargetAt = 0;
let identityTooltipHoverListenerStarted = false;

function findSyncedUserIcon(summonerId: any, type: SyncedIconType): string | null {
	const entry = friendIconList.find(x => String(x.summonerID) === String(summonerId));
	return entry?.icon?.[type] || null;
}

async function ensureSyncedElementIcons(element: any, reason: string): Promise<void> {
	const summonerId = Number(element?.getAttribute("summoner-id"));
	if (!Number.isFinite(summonerId) || summonerId <= 0) return;
	if (String(summonerId) === String(ElainaData.get("Summoner-ID"))) return;
	if (friendIconList.some(x => String(x.summonerID) === String(summonerId))) return;

	await window.syncUserIcons?.ensureUserIcons({
		summonerId,
		puuid: element.getAttribute("puuid") || element.getAttribute("voice-puuid") || ""
	}, reason);
}

function findSyncedUserTargetFromElement(element: Element | null): UserIconTarget | null {
	if (!element) return null;

	const summonerId = Number(element.getAttribute("summoner-id"));
	if (Number.isFinite(summonerId) && summonerId > 0) {
		return {
			summonerId,
			puuid: element.getAttribute("puuid") || element.getAttribute("voice-puuid") || ""
		};
	}

	const puuid = element.getAttribute("puuid") || element.getAttribute("voice-puuid") || "";
	if (puuid) {
		const entry = friendIconList.find(item => item.puuid === puuid);
		if (entry?.summonerID) {
			return {
				summonerId: Number(entry.summonerID),
				puuid
			};
		}

		if (puuid === ElainaData.get("PUUID")) {
			const ownSummonerId = Number(ElainaData.get("Summoner-ID"));
			if (Number.isFinite(ownSummonerId) && ownSummonerId > 0) {
				return {
					summonerId: ownSummonerId,
					puuid
				};
			}
		}
	}

	return null;
}

function getOwnAvatarUrl(): string {
	return iconUrl(icdata["Avatar"]);
}

function getNestedShadowRoots(element: Element): ShadowRoot[] {
	const roots: ShadowRoot[] = [];

	const visitRoot = (root: ParentNode) => {
		const nodes = Array.from(root.querySelectorAll("*"));
		for (const node of nodes) {
			const shadowRoot = (node as HTMLElement).shadowRoot;
			if (shadowRoot && !roots.includes(shadowRoot)) {
				roots.push(shadowRoot);
				visitRoot(shadowRoot);
			}
		}
	};

	if ((element as HTMLElement).shadowRoot) {
		roots.push((element as HTMLElement).shadowRoot as ShadowRoot);
		visitRoot((element as HTMLElement).shadowRoot as ShadowRoot);
	}

	return roots;
}

function watchRegaliaElement(element: Element, key: string, apply: () => ApplyResult): void {
	if (!element) return;

	let activeKeys = activeRegaliaWatchers.get(element);
	if (!activeKeys) {
		activeKeys = new Set();
		activeRegaliaWatchers.set(element, activeKeys);
	}
	if (activeKeys.has(key)) return;
	activeKeys.add(key);

	const startedAt = Date.now();
	const observers: MutationObserver[] = [];
	const observedRoots = new Set<ShadowRoot>();
	let attempts = 0;
	let stopped = false;
	let debounceTimer: number | null = null;
	let quietTimer: number | null = null;

	const stop = () => {
		if (stopped) return;
		stopped = true;
		if (debounceTimer !== null) window.clearTimeout(debounceTimer);
		if (quietTimer !== null) window.clearTimeout(quietTimer);
		observers.forEach(observer => observer.disconnect());
		activeKeys?.delete(key);
	};

	const scheduleStopAfterQuiet = () => {
		if (quietTimer !== null) window.clearTimeout(quietTimer);
		const elapsed = Date.now() - startedAt;
		const waitMs = Math.max(700, 2500 - elapsed);
		quietTimer = window.setTimeout(stop, waitMs);
	};

	const observeRoots = () => {
		for (const root of getNestedShadowRoots(element)) {
			if (observedRoots.has(root)) continue;
			observedRoots.add(root);

			const observer = new MutationObserver(scheduleRun);
			observer.observe(root, { attributes: true, childList: true, subtree: true });
			observers.push(observer);
		}
	};

	const run = async () => {
		if (stopped || !element.isConnected) {
			stop();
			return;
		}

		attempts++;
		observeRoots();

		let applied = false;
		try {
			applied = await apply();
		} catch (err) {
			if (ElainaData.get("Dev-mode")) warn(`Regalia ${key} apply failed:`, err);
		}

		observeRoots();

		if (applied) scheduleStopAfterQuiet();
		if (Date.now() - startedAt >= 4000 || attempts >= 20) stop();
	};

	function scheduleRun() {
		if (stopped) return;
		if (quietTimer !== null) {
			window.clearTimeout(quietTimer);
			quietTimer = null;
		}
		if (debounceTimer !== null) window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(run, 50);
	}

	const hostObserver = new MutationObserver(scheduleRun);
	hostObserver.observe(element, { attributes: true, childList: true, subtree: false });
	observers.push(hostObserver);

	void run();
}

class CustomTickerIcon {
	tickerCss(element: any, defaults: Object) {
		Object.entries(defaults).forEach(([key, value]) => {
			element.shadowRoot.querySelector(key).style.cssText = value
		});
	}

	main = () => {
		upl.observer.subscribeToElementCreation("lol-uikit-flyout-frame",(element: any)=>{
			this.tickerCss(element,
				{
					".border": "display: none;",
					".sub-border": "display: none;",
					".caret": "display: none;",
					".lol-uikit-flyout-frame": "background-color: black; border-radius: 10px;"
				}
			)
		})
	}
}

class CustomAvatar {
	private startIdentityTooltipHoverTracking(): void {
		if (identityTooltipHoverListenerStarted) return;
		identityTooltipHoverListenerStarted = true;

		document.addEventListener("pointerover", (event: PointerEvent) => {
			const path = event.composedPath();
			for (const pathItem of path) {
				if (!(pathItem instanceof Element)) continue;

				const target = findSyncedUserTargetFromElement(pathItem);
				if (!target) continue;

				lastIdentityTooltipTarget = target;
				lastIdentityTooltipTargetAt = Date.now();
				return;
			}
		}, true);
	}

	private applyAvatarBackground(iconElement: HTMLElement | null, backgroundImage: string): boolean {
		if (!iconElement) return false;
		iconElement.style.backgroundImage = backgroundImage;
		utils.freezeProperties(iconElement.style, ['backgroundImage']);
		return true;
	}

	private getRegaliaSummonerIcon(element: any): HTMLElement | null {
		if (element?.shadowRoot?.querySelector(".lol-regalia-summoner-icon")) {
			return element.shadowRoot.querySelector(".lol-regalia-summoner-icon");
		}

		return element
			?.shadowRoot
			?.querySelector("lol-regalia-crest-v2-element")
			?.shadowRoot
			?.querySelector(".lol-regalia-summoner-icon") || null;
	}

	changeAvatar = (iconElement: HTMLImageElement): boolean => {
		return this.applyAvatarBackground(iconElement, "var(--Avatar)");
	}

	changeFriendAvatar = async (element: any, iconElement: HTMLImageElement): Promise<boolean> => {
		let summonerID = element.getAttribute("summoner-id")

		if (summonerID === null || summonerID === undefined || summonerID === "") {
			element.setAttribute("summoner-id", friendIconList.find(x => x.puuid == element.getAttribute("puuid"))?.summonerID || friendIconList.find(x => x.puuid == element.getAttribute("voice-puuid"))?.summonerID || null)
		}

		await ensureSyncedElementIcons(element, "avatar");
		const avatar = findSyncedUserIcon(element.getAttribute("summoner-id"), "avatar");
		if (avatar) {
			return this.applyAvatarBackground(iconElement, utils.cssUrl(avatar));
		}
		return false;
	}

	changeConversationChatAvatar = async (element: any) => {
		let chatDataID = element.getAttribute("data-id")
		let chatInfo = await (await fetch(`/lol-chat/v1/conversations/${chatDataID}`)).json()
		let summonerID = (await (await fetch(`/lol-summoner/v1/summoners/?name=${chatInfo.gameName}%23${chatInfo.gameTag}`)).json()).summonerId

		await window.syncUserIcons?.ensureUserIcons({ summonerId: Number(summonerID), puuid: "" }, "conversation-chat");
		const avatar = findSyncedUserIcon(summonerID, "avatar");
		if (avatar) {
			let icon = element.querySelector(".icon-image")
			icon.src = `${avatar}`
			utils.freezeProperties(icon, ['src'])
		}
	}

	private getChatHeaderNameTarget(headerElement: Element): { gameName: string; tagLine: string } | null {
		const playerName = headerElement.querySelector("lol-uikit-player-name[game-name][tag-line]") as HTMLElement | null;
		const gameName = playerName?.getAttribute("game-name") || "";
		const tagLine = playerName?.getAttribute("tag-line") || "";
		if (!gameName || !tagLine) return null;
		return { gameName, tagLine };
	}

	private async resolveChatHeaderTarget(headerElement: Element): Promise<UserIconTarget | null> {
		const nameTarget = this.getChatHeaderNameTarget(headerElement);
		if (!nameTarget) return null;

		const cacheKey = `${nameTarget.gameName}#${nameTarget.tagLine}`.toLocaleLowerCase();
		if (chatNameTargetCache.has(cacheKey)) return chatNameTargetCache.get(cacheKey) || null;

		try {
			const encodedName = encodeURIComponent(`${nameTarget.gameName}#${nameTarget.tagLine}`);
			const summoner = await fetch(`/lol-summoner/v1/summoners/?name=${encodedName}`).then(res => res.ok ? res.json() : null);
			const summonerId = Number(summoner?.summonerId);
			if (!Number.isFinite(summonerId) || summonerId <= 0) {
				chatNameTargetCache.set(cacheKey, null);
				return null;
			}

			const target = {
				summonerId,
				puuid: typeof summoner?.puuid === "string" ? summoner.puuid : ""
			};
			chatNameTargetCache.set(cacheKey, target);
			return target;
		} catch {
			return null;
		}
	}

	applyChatHeaderAvatar = async (headerElement: Element): Promise<boolean> => {
		const target = await this.resolveChatHeaderTarget(headerElement);
		if (!target) return false;

		await window.syncUserIcons?.ensureUserIcons(target, "chat-header");
		const avatar = findSyncedUserIcon(target.summonerId, "avatar");
		const icon = headerElement.querySelector("lol-social-avatar.avatar .icon-image") as HTMLImageElement | null;
		if (!avatar || !icon) return false;

		icon.src = avatar;
		return true;
	}

	watchChatHeaderAvatar = (headerElement: Element) => {
		if (!headerElement || activeChatHeaderWatchers.has(headerElement)) return;

		let debounceTimer: number | null = null;
		const apply = () => {
			if (debounceTimer !== null) window.clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(async () => {
				if (!headerElement.isConnected) {
					observer.disconnect();
					activeChatHeaderWatchers.delete(headerElement);
					return;
				}
				await this.applyChatHeaderAvatar(headerElement);
			}, 50);
		};

		const observer = new MutationObserver(apply);
		observer.observe(headerElement, {
			attributes: true,
			childList: true,
			characterData: true,
			subtree: true
		});
		activeChatHeaderWatchers.set(headerElement, observer);
		void this.applyChatHeaderAvatar(headerElement);
	}

	private getTooltipAvatarImage(tooltipRoot: Element): HTMLImageElement | null {
		const avatarIcon = tooltipRoot.querySelector(".icon-identity-tooltip-component lol-social-avatar-icon") as HTMLElement | null;
		return avatarIcon?.shadowRoot?.querySelector("img") as HTMLImageElement | null;
	}

	private getIdentityTooltipTarget(): UserIconTarget | null {
		if (!lastIdentityTooltipTarget || Date.now() - lastIdentityTooltipTargetAt > 5000) return null;
		return lastIdentityTooltipTarget;
	}

	applyIdentityTooltipAvatar = async (tooltipRoot: Element): Promise<boolean> => {
		const target = this.getIdentityTooltipTarget();
		if (!target) return false;

		const icon = this.getTooltipAvatarImage(tooltipRoot);
		if (!icon) return false;

		let avatar: string | null = null;
		if (String(target.summonerId) === String(ElainaData.get("Summoner-ID"))) {
			avatar = getOwnAvatarUrl();
		} else {
			await window.syncUserIcons?.ensureUserIcons(target, "identity-tooltip-avatar");
			avatar = findSyncedUserIcon(target.summonerId, "avatar");
		}

		if (!avatar) return false;

		icon.src = avatar;
		return true;
	}

	watchIdentityTooltipAvatar = (tooltipRoot: Element) => {
		if (!tooltipRoot || activeIdentityTooltipWatchers.has(tooltipRoot)) return;

		let debounceTimer: number | null = null;
		const apply = () => {
			if (debounceTimer !== null) window.clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(async () => {
				if (!tooltipRoot.isConnected) {
					observer.disconnect();
					activeIdentityTooltipWatchers.delete(tooltipRoot);
					return;
				}
				await this.applyIdentityTooltipAvatar(tooltipRoot);
			}, 40);
		};

		const observer = new MutationObserver(apply);
		observer.observe(tooltipRoot, {
			attributes: true,
			childList: true,
			characterData: true,
			subtree: true
		});
		activeIdentityTooltipWatchers.set(tooltipRoot, observer);
		apply();
	}

	applySocialRosterAvatar = async (memberElement: Element): Promise<boolean> => {
		const memberName = memberElement.querySelector(".member-name")?.textContent || "";
		const target = resolveSyncedUserTargetByDisplayName(memberName);
		if (!target) return false;

		await window.syncUserIcons?.ensureUserIcons(target, "social-roster-member");
		const avatar = findSyncedUserIcon(target.summonerId, "avatar");
		const icon = memberElement.querySelector(".lol-social-avatar .icon-image") as HTMLImageElement | null;
		if (!avatar || !icon) return false;

		icon.src = avatar;
		return true;
	}

	watchSocialRosterMember = (memberElement: Element) => {
		if (!memberElement || activeSocialRosterWatchers.has(memberElement)) return;

		let debounceTimer: number | null = null;
		const apply = () => {
			if (debounceTimer !== null) window.clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(async () => {
				if (!memberElement.isConnected) {
					observer.disconnect();
					activeSocialRosterWatchers.delete(memberElement);
					return;
				}
				await this.applySocialRosterAvatar(memberElement);
			}, 50);
		};

		const observer = new MutationObserver(apply);
		observer.observe(memberElement, {
			attributes: true,
			childList: true,
			characterData: true,
			subtree: true
		});
		activeSocialRosterWatchers.set(memberElement, observer);
		void this.applySocialRosterAvatar(memberElement);
	}

	applyCustomAvatar = async (parentElement: any): Promise<boolean> => {
		const iconElement = this.getRegaliaSummonerIcon(parentElement);
		if (!parentElement || !iconElement) return false;

		if (parentElement.getAttribute("summoner-id") == ElainaData.get("Summoner-ID") ||
			parentElement.getAttribute("puuid") == ElainaData.get("PUUID") ||
			parentElement.getAttribute("voice-puuid") == ElainaData.get("PUUID")) {
			return this.changeAvatar(iconElement as HTMLImageElement)
		}
		else {
			return await this.changeFriendAvatar(parentElement, iconElement as HTMLImageElement)
		}
	}

	watchCustomAvatar = (element: any) => {
		watchRegaliaElement(element, "avatar", () => this.applyCustomAvatar(element));
	}

	async main() {
		this.startIdentityTooltipHoverTracking();

		// Hover card avatar
		upl.observer.subscribeToElementCreation(".hover-card-info-container",(element: any)=>{
			element.style.background = "#1a1c21"
		})

		upl.observer.subscribeToElementCreation(`lol-regalia-hovercard-v2-element`, async (element: any)=>{
			this.watchCustomAvatar(element)
		})

		// Identity customizer avatar
		upl.observer.subscribeToElementCreation("lol-regalia-identity-customizer-element", async (element: any)=>{
			this.watchCustomAvatar(element)
		})

		// Parties avatar
		upl.observer.subscribeToElementCreation("lol-regalia-parties-v2-element", async (element: any)=>{
			this.watchCustomAvatar(element)
		})

		// Arena parties avatar
		upl.observer.subscribeToElementCreation(".player-slot__crest-wrapper > lol-regalia-crest-v2-element", async (element: any)=>{
			this.watchCustomAvatar(element)
		})

		// Profile avatar
		upl.observer.subscribeToElementCreation('lol-regalia-profile-v2-element', async (element: any) => {
			this.watchCustomAvatar(element)
		})

		// Conversation chat avatar
		upl.observer.subscribeToElementCreation('.conversation.chat', async (element: any) => {
			await this.changeConversationChatAvatar(element)
		})

		upl.observer.subscribeToElementCreation('header.chat-header', (element: any) => {
			this.watchChatHeaderAvatar(element)
		})

		upl.observer.subscribeToElementCreation("#lol-uikit-tooltip-root", (element: any) => {
			this.watchIdentityTooltipAvatar(element)
		})

		// Social sidebar roster avatar. These rows do not expose summoner-id/puuid,
		// so the friend name from /lol-chat/v1/friends is used as the fallback anchor.
		upl.observer.subscribeToElementCreation('.lol-social-roster-member', (element: any) => {
			this.watchSocialRosterMember(element)
		})

		// Conversation chat header avatar
		// utils.routineAddCallback(this.changeConversationChatHeaderAvatar, ['chat-header'])
	}
}
export const customAvatar = new CustomAvatar()

class CustomBorder {
	private getBorderTargets(element: any): any | null {
		let regaliaCrest = element.shadowRoot.querySelector("lol-regalia-crest-v2-element")
		if (!regaliaCrest?.shadowRoot) return null;

		let levelRing = regaliaCrest.shadowRoot.querySelector("lol-uikit-themed-level-ring-v2")
		let leverBorder = levelRing?.shadowRoot?.querySelector("div")
		let rankBorder = regaliaCrest.shadowRoot.querySelector(".lol-regalia-ranked-border-container")
		let rankNumber = regaliaCrest.shadowRoot.querySelector(".lol-regalia-rank-division-wrapper")
		let rankBorderAnimate = regaliaCrest.shadowRoot.querySelector("uikit-video")
		let rankBorderWingAnimate = regaliaCrest.shadowRoot.querySelector("lol-uikit-lottie[class='regalia-crest-wing']")

		if (!leverBorder || !rankBorder || !rankNumber || !rankBorderAnimate || !rankBorderWingAnimate) return null;
		return { leverBorder, rankBorder, rankNumber, rankBorderAnimate, rankBorderWingAnimate };
	}

	private applyBorderTargets(targets: any, backgroundImage: string): boolean {
		if (!targets) return false;

		targets.leverBorder.style.cssText = `
			background-image: ${backgroundImage};
			display: block;
		`
		utils.freezeProperties(targets.leverBorder.style, ['backgroundImage', 'display'])

		targets.rankBorder.style.display = "none"
		targets.rankNumber.style.display = "none"
		targets.rankBorderAnimate.style.display = "none"
		targets.rankBorderWingAnimate.style.display = "none"
		return true;
	}

	changeBorder = (element: any): boolean => {
		return this.applyBorderTargets(this.getBorderTargets(element), "var(--Border)");
	}

	changeFriendBorder = async (element: any): Promise<boolean> => {
		await ensureSyncedElementIcons(element, "border");
		const border = findSyncedUserIcon(element.getAttribute("summoner-id"), "border");
		if (border) {
			return this.applyBorderTargets(this.getBorderTargets(element), utils.cssUrl(border));
		}
		return false;
	}

	applyCustomBorder = async (element: any): Promise<boolean> => {
		if (element.getAttribute("summoner-id") == ElainaData.get("Summoner-ID")) {
			return this.changeBorder(element)
		}
		else {
			return await this.changeFriendBorder(element)
		}
	}

	watchCustomBorder = (element: any) => {
		watchRegaliaElement(element, "border", () => this.applyCustomBorder(element));
	}

	async main() {
		// Hover card border
		upl.observer.subscribeToElementCreation(`lol-regalia-hovercard-v2-element`, async (element: any)=>{
			this.watchCustomBorder(element)
		})

		// Parties border
		upl.observer.subscribeToElementCreation("lol-regalia-parties-v2-element", async (element: any)=>{
			this.watchCustomBorder(element)
		})

		// Profile border
		upl.observer.subscribeToElementCreation('lol-regalia-profile-v2-element', async (element: any) => {
			this.watchCustomBorder(element)
		})

		// Identity customizer border
		upl.observer.subscribeToElementCreation("lol-regalia-identity-customizer-element", async (element: any)=>{
			this.watchCustomBorder(element)
		})
	}
}

class CustomBanner {
	private getBannerImage(element: any): HTMLImageElement | null {
		return element
			?.shadowRoot
			?.querySelector("lol-regalia-banner-v2-element")
			?.shadowRoot
			?.querySelector(".regalia-banner-asset-static-image") || null;
	}

	changeBanner = (banner: HTMLImageElement | null): boolean => {
		if (!banner) return false;
		banner.src = iconUrl("Regalia-Banners", ElainaData.get("CurrentBanner"))
		utils.freezeProperties(banner,["src"])
		return true;
	}

	changeFriendBanner = async (element: any, banner: HTMLImageElement | null): Promise<boolean> => {
		if (!banner) return false;
		await ensureSyncedElementIcons(element, "banner");
		const syncedBanner = findSyncedUserIcon(element.getAttribute("summoner-id"), "banner");
		if (syncedBanner) {
			banner.src = `${syncedBanner}`
			utils.freezeProperties(banner,["src"])
			return true;
		}
		return false;
	}
	applyCustomBanner = async (element: any): Promise<boolean> => {
		let banner = this.getBannerImage(element)
		if (element.getAttribute("summoner-id") == ElainaData.get("Summoner-ID")) {
			return this.changeBanner(banner)
		}
		else {
			return await this.changeFriendBanner(element, banner)
		}
	}

	watchCustomBanner = (element: any) => {
		watchRegaliaElement(element, "banner", () => this.applyCustomBanner(element));
	}

	async main() {
		// Parties banner
		upl.observer.subscribeToElementCreation("lol-regalia-parties-v2-element", async (element: any)=>{
			this.watchCustomBanner(element)
		})

		// Identity customizer banner
		upl.observer.subscribeToElementCreation("lol-regalia-identity-customizer-element", async (element: any)=>{
			this.watchCustomBanner(element)
		})

		// Profile banner
		upl.observer.subscribeToElementCreation("lol-regalia-profile-v2-element", async (element: any)=>{
			this.watchCustomBanner(element)
		})
	}
}

class CustomHoverCardBackdrop {
	changeHoverCardBackdrop = (): boolean => {
		let hoverCardBackdrop = document.querySelector("#hover-card-backdrop") as HTMLElement;
		if (hoverCardBackdrop) {
			hoverCardBackdrop.style.backgroundImage = "var(--Hover-card-backdrop)";
			return true;
		}
		return false;
	}

	changeFriendHoverCardBackdrop = async (hovercard: any): Promise<boolean> => {
		if (!hovercard) return false;
		await ensureSyncedElementIcons(hovercard, "hover-card-backdrop");
		const backdrop = findSyncedUserIcon(hovercard.getAttribute("summoner-id"), "hoverCardBackdrop");
		if (backdrop) {
			let hoverCardBackdrop = document.querySelector("#hover-card-backdrop") as HTMLElement;
			if (hoverCardBackdrop) {
				hoverCardBackdrop.style.backgroundImage = utils.cssUrl(backdrop);
				return true;
			}
		}
		return false;
	}

	changeFriendProfileBackground = async (element: any): Promise<boolean> => {
		await ensureSyncedElementIcons(element, "profile-background");
		const backdrop = findSyncedUserIcon(element.getAttribute("summoner-id"), "hoverCardBackdrop");
		if (backdrop) {
			let profileBackground = document.querySelectorAll(".style-profile-masked-image .lol-uikit-background-switcher-image")
			if (profileBackground.length === 0) return false;
			profileBackground.forEach((bg: any) => {
				bg.src = `${backdrop}`
				bg.style.height = "100%";
				utils.freezeProperties(bg, ["src", "style.height"])
			})
			return true;
		}
		return false;
	}

	applyCustomHoverCardBackdrop = async (element: any): Promise<boolean> => {
		let hovercard = element.querySelector("lol-regalia-hovercard-v2-element");
		if (!hovercard) return false;
		
		if (hovercard.getAttribute("summoner-id") == ElainaData.get("Summoner-ID")) {
			return this.changeHoverCardBackdrop()
		}
		else {
			return await this.changeFriendHoverCardBackdrop(hovercard)
		}
	}

	applyCustomBackgroundFriendProfile = async (element: any): Promise<boolean> => {
		if (element.getAttribute("summoner-id") != ElainaData.get("Summoner-ID")) {
			return await this.changeFriendProfileBackground(element)
		}
		return false;
	}

	watchCustomHoverCardBackdrop = (element: any) => {
		watchRegaliaElement(element, "hover-card-backdrop", () => this.applyCustomHoverCardBackdrop(element));
	}

	watchCustomBackgroundFriendProfile = (element: any) => {
		watchRegaliaElement(element, "profile-background", () => this.applyCustomBackgroundFriendProfile(element));
	}

	async main() {
		// Hover card
		upl.observer.subscribeToElementCreation("#lol-uikit-tooltip-root", async (element: any)=>{
			this.watchCustomHoverCardBackdrop(element)
		})

		// Profile background
		upl.observer.subscribeToElementCreation("lol-regalia-profile-v2-element", async (element: any)=>{
			this.watchCustomBackgroundFriendProfile(element)
		})
	}
}

class CustomProfileRankClashIcon {
	private getProfileElement(): Element | null {
		return document.querySelector("lol-regalia-profile-v2-element");
	}

	private getRankElement(): HTMLElement | null {
		return document.querySelector(".style-profile-ranked-crest-ranked > lol-regalia-emblem-element");
	}

	private getClashBannerElement(): HTMLElement | null {
		return document.querySelector(".style-profile-clash-banner-empty");
	}

	private isOwnProfile(profileElement: Element | null, target: UserIconTarget | null): boolean {
		if (!profileElement) return false;

		if (target && String(target.summonerId) === String(ElainaData.get("Summoner-ID"))) {
			return true;
		}

		const puuid = profileElement.getAttribute("puuid") || profileElement.getAttribute("voice-puuid") || "";
		return Boolean(puuid && puuid === ElainaData.get("PUUID"));
	}

	private async resolveProfileIcon(type: SyncedIconType, localIcon: string, settingKey: string, reason: string): Promise<string | null> {
		const profileElement = this.getProfileElement();
		const target = findSyncedUserTargetFromElement(profileElement);

		if (this.isOwnProfile(profileElement, target)) {
			return ElainaData.get(settingKey) ? localIcon : null;
		}

		if (!target || !ElainaData.get(settingKey)) return null;

		await window.syncUserIcons?.ensureUserIcons(target, reason);
		const syncedIcon = findSyncedUserIcon(target.summonerId, type);
		return syncedIcon ? utils.cssUrl(syncedIcon) : null;
	}

	private clearRankIcon(element: HTMLElement): void {
		element.removeAttribute("elaina-rank-icon");
		for (const property of rankEmblemCssVars) {
			element.style.removeProperty(property);
		}
	}

	private applyRankIcon = async (): Promise<boolean> => {
		const element = this.getRankElement();
		if (!element) return false;

		const icon = await this.resolveProfileIcon("rankIcon", cssIconUrl(icdata["Rank-icon"]), "Custom-Rank-Icon", "profile-rank-icon");
		if (!icon) {
			this.clearRankIcon(element);
			return false;
		}

		element.setAttribute("elaina-rank-icon", "true");
		for (const property of rankEmblemCssVars) {
			element.style.setProperty(property, icon);
		}
		return true;
	}

	private applyClashBanner = async (): Promise<boolean> => {
		const element = this.getClashBannerElement();
		if (!element) return false;

		const icon = await this.resolveProfileIcon("clashBanner", cssIconUrl(icdata["Clash-banner"]), "Custom-Clash-banner", "profile-clash-banner");
		if (!icon) {
			element.removeAttribute("elaina-clash-banner");
			element.style.removeProperty("background-image");
			return false;
		}

		element.setAttribute("elaina-clash-banner", "true");
		element.style.backgroundImage = icon;
		return true;
	}

	private applyProfileIcons = async (): Promise<boolean> => {
		const [rankApplied, clashApplied] = await Promise.all([
			this.applyRankIcon(),
			this.applyClashBanner()
		]);

		return rankApplied || clashApplied;
	}

	private scheduleApplyProfileIcons = (): void => {
		for (const delay of [0, 300, 1000]) {
			window.setTimeout(() => void this.applyProfileIcons(), delay);
		}
	}

	private watchProfileElement = (element: Element): void => {
		watchRegaliaElement(element, "profile-rank-clash-icons", () => this.applyProfileIcons());
		this.scheduleApplyProfileIcons();
	}

	main = (): void => {
		upl.observer.subscribeToElementCreation("lol-regalia-profile-v2-element", this.watchProfileElement);
		upl.observer.subscribeToElementCreation(".style-profile-ranked-crest-ranked > lol-regalia-emblem-element", () => this.scheduleApplyProfileIcons());
		upl.observer.subscribeToElementCreation(".style-profile-clash-banner-empty", () => this.scheduleApplyProfileIcons());
		this.scheduleApplyProfileIcons();
	}
}

class CustomGamemodeIcon {
	gameModeIcon_active(obj: any, name: any) {
		try {
			let a: any = document.querySelector(`${obj} lol-uikit-video-state[state='active'] lol-uikit-video`)
			a.setAttribute("src", iconUrl("gamemodes", name))
			a.querySelector("video").setAttribute("src", iconUrl("gamemodes", name))
		}
		catch { 
			//warn("Can't find the target") 
		}
	}

	main = () => {
		upl.observer.subscribeToElementCreation("lol-uikit-video-group", (element: any)=>{
			this.gameModeIcon_active("div[data-game-mode='CLASSIC']",icdata["classic_video"])
			this.gameModeIcon_active("div[data-game-mode='TFT']", icdata["tft_video"])
			this.gameModeIcon_active("div[data-game-mode='ARAM']", icdata["aram_video"])
			this.gameModeIcon_active("div[data-game-mode='CHERRY']",icdata["cherry_video"])
			this.gameModeIcon_active("div[data-game-mode='BRAWL']",icdata["brawl_video"])
			this.gameModeIcon_active('div[data-map-id="11"]',icdata["classic_video"])
			this.gameModeIcon_active('div[data-map-id="12"]',icdata["aram_video"])
			this.gameModeIcon_active("div[data-game-mode='PRACTICETOOL']",icdata["classic_video"])
		})
	}
}

class CustomEmblemIcon {
	changeEmblemIcon = (element: any) => {
		element.setAttribute("src", iconUrl(icdata["Honor"]))
		element.style.visibility = "visible"
		utils.freezeProperties(element, ["src"])
	}

	main = () => {
		upl.observer.subscribeToElementCreation(".style-profile-honor-icon-v3", (element: any) => {
			this.changeEmblemIcon(element)
		})
	}
}

class CustomLoadingIcon {
	private storeInterval: number | null = null

	storeLoadingIcon = () => {
		upl.observer.subscribeToElementCreation("#rcp-fe-lol-store-iframe", (element: any) => {
			log("Store page.")
			
			if (this.storeInterval !== null) {
				window.clearInterval(this.storeInterval)
				this.storeInterval = null
			}

			this.storeInterval = window.setInterval(() => {
				let storeIframe: any = element.querySelector("iframe")
				if (storeIframe) {
					let storeDoc: any = storeIframe.contentDocument || storeIframe.contentWindow.document
					let loadingIcon: any = storeDoc.querySelector(".store-app-wrapper > .loading-spinner")
					if (loadingIcon) {
						loadingIcon.style.cssText = `
							width: 190px;
							height: 190px;
							background-image: unset;
							background-size: unset;
							content: ${cssIconUrl(icdata["Loading"])};
							-webkit-animation-iteration-count: unset;
							-webkit-animation-duration: unset;
							-webkit-animation-timing-function: unset;
							animation-iteration-count: unset;
							animation-duration: unset;
							animation-timing-function: unset;
						`
						// log("Store loading icon changed.")
					}
				}
			}, 300)
		})

		upl.observer.subscribeToElementDeletion("#rcp-fe-lol-store-iframe", () => {
			log("Store page deleted.")
			if (this.storeInterval !== null) {
				window.clearInterval(this.storeInterval)
				this.storeInterval = null
			}
		})
	}

	main() {
		this.storeLoadingIcon()
	}
}

/** Orchestrates custom avatar, border, banner, and ticker icon replacements. */
export class CustomIcon {
	main() {
		const customTickerIcon = new CustomTickerIcon()
		customTickerIcon.main()

		if (ElainaData.get("Custom-Avatar")) {
			customAvatar.main()
		}

		if (ElainaData.get("Custom-Border")) {
			const customBorder = new CustomBorder()
			customBorder.main()
		}

		if (ElainaData.get("Custom-Regalia-Banner")) {
			const customBanner = new CustomBanner()
			customBanner.main()
		}

		if (ElainaData.get("Custom-Hover-card-backdrop")) {
			const customHoverCardBackdrop = new CustomHoverCardBackdrop()
			customHoverCardBackdrop.main()
		}

		if (ElainaData.get("Custom-Rank-Icon") || ElainaData.get("Custom-Clash-banner")) {
			const customProfileRankClashIcon = new CustomProfileRankClashIcon()
			customProfileRankClashIcon.main()
		}

		if (ElainaData.get('Custom-Gamemode-Icon')) {
			const customGamemodeIcon = new CustomGamemodeIcon()
			customGamemodeIcon.main()
		}

		if (ElainaData.get("Custom-Loading-Icon")) {
			const customLoadingIcon = new CustomLoadingIcon()
			customLoadingIcon.main()
		}
		if (ElainaData.get("Custom-Emblem")) {
			const customEmblemIcon = new CustomEmblemIcon()
			customEmblemIcon.main()
		}
	}
}
