import utils from "../utils/utils";
import { log, warn, error } from '../utils/themeLog';
import { customAvatar } from "../theme/customUI/customIcon";
import { fileSystem } from "../utils/fileSystem";

const icdata = (await import(utils.assets.url("config/icons.js"))).default;

const iconFolder = `${utils.assets.icon()}/`
const iconUrl = utils.assets.icon;

const syncIconsType = ["avatar", "border", "banner", "emblem", "hoverCardBackdrop", "rankIcon", "clashBanner"] as const;
type IconType = typeof syncIconsType[number];

const syncIconsDir = './data/icons';
const hashesFile = './data/icons/hashes.json';
const hashMetaFile = './data/icons/hash-meta.json';

const cacheTTLms = 30 * 24 * 60 * 60 * 1000;
const maxCacheKeys = 2500;
const onDemandCooldown = 2 * 60 * 1000;

/** Dual-mode storage: 'fs' caches icons locally, 'memory' uses in-memory blob URLs */
let storageMode: 'fs' | 'memory' = 'memory';
let hashCache: Record<string, string> = {};
let hashTouchedAt: Record<string, number> = {};

let friendIconList: FriendIconEntry[] = [];
let syncTargets: UserIconTarget[] = [];
const visibleUserNameTargets = new Map<string, UserIconTarget>();
const inFlightUserSync = new Map<string, Promise<void>>();
const failedUserSyncUntil: Record<string, number> = {};

function normalizeDisplayName(name: any): string {
    return typeof name === 'string'
        ? name.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
        : '';
}

/** Resolves a synced user target by normalized display name. */
function resolveSyncedUserTargetByDisplayName(name: string): UserIconTarget | null {
    return visibleUserNameTargets.get(normalizeDisplayName(name)) || null;
}

/** Handles custom icon upload, cache, and peer sync. */
class SyncUserIcons {
    getIconFolder() { return iconFolder; }
    getIconData() { return icdata; }

    private getOwnIconMap(): OwnIconEntry[] {
        const currentBanner = ElainaData.get("CurrentBanner");
        return [
            { url: iconUrl(icdata["Avatar"]), type: "avatar" },
            { url: iconUrl(icdata["Border"]), type: "border" },
            { url: iconUrl("Regalia-Banners", currentBanner), type: "banner" },
            { url: iconUrl(icdata["Hover-card"]), type: "hoverCardBackdrop" },
            { url: iconUrl(icdata["Honor"]), type: "emblem" },
            { url: iconUrl(icdata["Rank-icon"]), type: "rankIcon" },
            { url: iconUrl(icdata["Clash-banner"]), type: "clashBanner" }
        ];
    }

    private async computeFileHash(url: string): Promise<string | null> {
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const buf = await res.arrayBuffer();
            const hash = await crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (err: any) {
            error("Failed to compute file hash:", err);
            return null;
        }
    }

    private async runLimited(tasks: (() => Promise<void>)[], limit = 16): Promise<void> {
        let index = 0;
        const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
            while (index < tasks.length) {
                const task = tasks[index++];
                await task();
            }
        });
        await Promise.all(workers);
    }

    private async safeFetchJson<T = any>(url: string): Promise<T | null> {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }

    private addSyncTarget(targets: Map<string, UserIconTarget>, summonerId: any, puuid?: any): void {
        const numericSummonerId = Number(summonerId);
        if (!Number.isFinite(numericSummonerId) || numericSummonerId <= 0) return;

        const ownSummonerId = Number(ElainaData.get("Summoner-ID"));
        if (ownSummonerId && numericSummonerId === ownSummonerId) return;

        const key = String(numericSummonerId);
        const existing = targets.get(key);
        const normalizedPuuid = typeof puuid === 'string' ? puuid : '';

        if (!existing) {
            targets.set(key, { summonerId: numericSummonerId, puuid: normalizedPuuid });
        } else if (!existing.puuid && normalizedPuuid) {
            existing.puuid = normalizedPuuid;
        }
    }

    private getElementSyncTarget(element: Element | null): UserIconTarget | null {
        if (!element) return null;

        const summonerId = element.getAttribute("summoner-id");
        if (!summonerId) return null;

        const puuid = element.getAttribute("puuid") || element.getAttribute("voice-puuid") || "";
        const numericSummonerId = Number(summonerId);
        if (!Number.isFinite(numericSummonerId) || numericSummonerId <= 0) return null;

        return { summonerId: numericSummonerId, puuid };
    }

    private addVisibleUserNameTarget(friend: any): void {
        const summonerId = Number(friend?.summonerId);
        if (!Number.isFinite(summonerId) || summonerId <= 0) return;

        const target: UserIconTarget = {
            summonerId,
            puuid: typeof friend?.puuid === 'string' ? friend.puuid : ''
        };

        const candidateNames = [
            friend?.gameName,
            friend?.name,
            friend?.summonerName,
            friend?.displayName,
            friend?.nick,
            friend?.lol?.gameName
        ];

        for (const candidate of candidateNames) {
            const normalized = normalizeDisplayName(candidate);
            if (normalized) visibleUserNameTargets.set(normalized, target);
        }
    }

    private markCacheKey(key: string): void {
        hashTouchedAt[key] = Date.now();
    }

    private createEmptyIconMap(): Record<IconType, string | null> {
        const icons = {} as Record<IconType, string | null>;
        for (const type of syncIconsType) {
            icons[type] = null;
        }
        return icons;
    }

    private normalizeIconEntry(entry: any): FriendIconEntry | null {
        const summonerID = Number(entry?.summonerID);
        if (!Number.isFinite(summonerID) || summonerID <= 0) return null;

        const sourceIcons = entry?.icon || {};
        const icon = this.createEmptyIconMap();
        for (const type of syncIconsType) {
            icon[type] = typeof sourceIcons[type] === "string" && sourceIcons[type] ? sourceIcons[type] : null;
        }

        return {
            summonerID,
            puuid: typeof entry?.puuid === "string" ? entry.puuid : "",
            icon
        };
    }

    private normalizeIconEntries(entries: any[]): FriendIconEntry[] {
        if (!Array.isArray(entries)) return [];
        return entries
            .map(entry => this.normalizeIconEntry(entry))
            .filter((entry): entry is FriendIconEntry => Boolean(entry));
    }

    private mergeIconEntries(entries: FriendIconEntry[]): void {
        for (const entry of this.normalizeIconEntries(entries)) {
            const index = friendIconList.findIndex(current => String(current.summonerID) === String(entry.summonerID));
            if (index >= 0) friendIconList[index] = entry;
            else friendIconList.push(entry);
        }
    }

    private hasSyncedEntry(summonerId: number): boolean {
        return friendIconList.some(entry => String(entry.summonerID) === String(summonerId));
    }

    private isOnDemandSyncBlocked(summonerId: number): boolean {
        const blockedUntil = failedUserSyncUntil[String(summonerId)] || 0;
        return blockedUntil > Date.now();
    }

    private markOnDemandSyncFailed(targets: UserIconTarget[]): void {
        const retryAfter = Date.now() + onDemandCooldown;
        for (const target of targets) {
            failedUserSyncUntil[String(target.summonerId)] = retryAfter;
        }
    }

    private clearOnDemandSyncFailure(targets: UserIconTarget[]): void {
        for (const target of targets) {
            delete failedUserSyncUntil[String(target.summonerId)];
        }
    }

    private async saveHashes(): Promise<void> {
        if (storageMode !== 'fs') return;
        try {
            await fileSystem.write(hashesFile, JSON.stringify(hashCache, null, 2), false);
        } catch (err: any) {
            error('Failed to save icon hashes:', err);
        }
    }

    private async saveHashMeta(): Promise<void> {
        if (storageMode !== 'fs') return;
        try {
            await fileSystem.write(hashMetaFile, JSON.stringify(hashTouchedAt, null, 2), false);
        } catch (err: any) {
            error('Failed to save icon hash metadata:', err);
        }
    }

    private async cleanupIconCache(): Promise<boolean> {
        if (storageMode !== 'fs') return false;

        const now = Date.now();
        const keys = Object.keys(hashCache);
        const staleKeys = keys.filter(key => {
            const touchedAt = hashTouchedAt[key] || now;
            if (!hashTouchedAt[key]) hashTouchedAt[key] = now;
            return now - touchedAt > cacheTTLms;
        });

        const remainingKeys = keys
            .filter(key => !staleKeys.includes(key))
            .sort((a, b) => (hashTouchedAt[a] || now) - (hashTouchedAt[b] || now));
        const overflowKeys = remainingKeys.length > maxCacheKeys
            ? remainingKeys.slice(0, remainingKeys.length - maxCacheKeys)
            : [];
        const deleteKeys = [...new Set([...staleKeys, ...overflowKeys])];

        for (const key of deleteKeys) {
            const [summonerId, type] = key.split(':');
            delete hashCache[key];
            delete hashTouchedAt[key];
            if (summonerId && type) await this.deleteIconFromFs(Number(summonerId), type);
        }

        return deleteKeys.length > 0;
    }

    private async saveIconToFs(summonerId: number, type: string, dataUri: string): Promise<void> {
        if (storageMode !== 'fs') return;
        try {
            const dir = `${syncIconsDir}/${summonerId}`;
            await fileSystem.mkdir(dir);
            await fileSystem.write(`${dir}/${type}`, dataUri, false);
        } catch (err: any) {
            error(`Failed to save icon ${type} for ${summonerId}:`, err);
        }
    }

    private async loadIconFromFs(summonerId: number, type: string): Promise<string | null> {
        if (storageMode !== 'fs') return null;
        try {
            const content = await fileSystem.read(`${syncIconsDir}/${summonerId}/${type}`);
            return content || null;
        } catch { return null; }
    }

    private async deleteIconFromFs(summonerId: number, type: string): Promise<void> {
        if (storageMode !== 'fs') return;
        try {
            await fileSystem.rm(`${syncIconsDir}/${summonerId}/${type}`, { recursive: false });
        } catch { }
    }

    /** Initialize icon storage after FileSystem.init(context) has resolved window.isContextFSExist. */
    async init(): Promise<void> {
        if (window.isContextFSExist) {
            storageMode = 'fs';

            await fileSystem.mkdir(syncIconsDir);

            const raw = await fileSystem.read(hashesFile);
            if (raw && raw.trim().length > 0) {
                try { hashCache = JSON.parse(raw); }
                catch { hashCache = {}; }
            }
            const rawMeta = await fileSystem.read(hashMetaFile);
            if (rawMeta && rawMeta.trim().length > 0) {
                try { hashTouchedAt = JSON.parse(rawMeta); }
                catch { hashTouchedAt = {}; }
            }
            log('SyncUserIcons initialized in fs mode');
        } else {
            storageMode = 'memory';
            log('SyncUserIcons initialized in memory mode (filesystem unavailable)');
        }
    }

    async uploadIcon(icon: string, iconType: string): Promise<void> {
        const response = await fetch(icon);
        if (!response.ok) error(`Failed to fetch icon: ${icon}`);

        const blob = await response.blob();
        const mimeToExt: Record<string, string> = {
            "image/png": ".png", "image/jpeg": ".jpg",
            "image/webp": ".webp", "image/gif": ".gif"
        };
        log("Uploading " + icon);
        const ext = mimeToExt[blob.type] || ".png";
        const file = new File([blob], iconType + ext, { type: blob.type });

        try {
            await window.elainathemeApi.uploadImage(
                ElainaData.get("ElainaTheme-Token"),
                ElainaData.get("Summoner-ID"), iconType, file
            );
        } catch (err: any) {
            error(`Failed to upload icon of type ${iconType}: `, err);
        }
    }

    private async syncOwnIcons(summonerID: number): Promise<void> {
        const iconMap = this.getOwnIconMap();

        if (typeof window.elainathemeApi.getImageHashes !== 'function') {
            warn("getImageHashes not available, uploading own icons without hash check");
            await Promise.all(iconMap.map(({ url, type }) => this.uploadIcon(url, type)));
            return;
        }

        const [localHashes, serverHashes] = await Promise.all([
            Promise.all(iconMap.map(async ({ type, url }) => ({
                type,
                hash: await this.computeFileHash(url)
            }))),
            window.elainathemeApi.getImageHashes(summonerID, iconMap.map(icon => icon.type))
        ]);

        if (!serverHashes) {
            warn("getImageHashes failed, uploading own icons without hash check");
            await Promise.all(iconMap.map(({ url, type }) => this.uploadIcon(url, type)));
            return;
        }

        await Promise.all(iconMap.map(async ({ url, type }) => {
            const localHash = localHashes.find(item => item.type === type)?.hash || null;
            const serverHash = serverHashes[type] || null;

            if (!localHash || !serverHash || localHash !== serverHash) {
                log(`Icon "${type}" changed, uploading...`);
                await this.uploadIcon(url, type);
            } else {
                log(`Icon "${type}" unchanged, skipping upload`);
            }
        }));
    }

    async collectSyncTargets(): Promise<UserIconTarget[]> {
        const targets = new Map<string, UserIconTarget>();

        const friends = await this.safeFetchJson<any[]>('/lol-chat/v1/friends');
        if (Array.isArray(friends)) {
            for (const friend of friends) {
                this.addSyncTarget(targets, friend?.summonerId, friend?.puuid);
                this.addVisibleUserNameTarget(friend);
            }
        }

        const lobby = await this.safeFetchJson<any>('/lol-lobby/v2/lobby');
        const lobbyMembers = lobby?.members || lobby?.partyMembers || [];
        if (Array.isArray(lobbyMembers)) {
            for (const member of lobbyMembers) {
                this.addSyncTarget(targets, member?.summonerId, member?.puuid);
            }
        }

        const champSelect = await this.safeFetchJson<any>('/lol-champ-select/v1/session');
        const champSelectPlayers = [
            ...(Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : []),
            ...(Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : []),
            ...(Array.isArray(champSelect?.benchChampions) ? champSelect.benchChampions : [])
        ];
        for (const player of champSelectPlayers) {
            this.addSyncTarget(targets, player?.summonerId, player?.puuid);
        }

        document
            .querySelectorAll("[summoner-id], [puuid], [voice-puuid]")
            .forEach(element => {
                const target = this.getElementSyncTarget(element);
                if (target) this.addSyncTarget(targets, target.summonerId, target.puuid);
            });

        const conversationElements = Array.from(document.querySelectorAll(".conversation.chat"));
        await this.runLimited(conversationElements.map(element => async () => {
            const conversationId = element.getAttribute("data-id");
            if (!conversationId) return;

            const chatInfo = await this.safeFetchJson<any>(`/lol-chat/v1/conversations/${conversationId}`);
            if (!chatInfo?.gameName || !chatInfo?.gameTag) return;

            const encodedName = encodeURIComponent(`${chatInfo.gameName}#${chatInfo.gameTag}`);
            const summoner = await this.safeFetchJson<any>(`/lol-summoner/v1/summoners/?name=${encodedName}`);
            this.addSyncTarget(targets, summoner?.summonerId, summoner?.puuid || chatInfo?.puuid);
        }), 4);

        syncTargets = Array.from(targets.values());
        return syncTargets;
    }

    /** memory mode: batch endpoint, in-memory data URIs (old Pengu fallback) */
    private async syncUsersIconsMemory(targets: UserIconTarget[], replaceList = true): Promise<void> {
        let entries: FriendIconEntry[] = [];
        try {
            if (typeof window.elainathemeApi.getUsersImage === 'function') {
                entries = await window.elainathemeApi.getUsersImage(targets, [...syncIconsType]);
            } else {
                entries = await window.elainathemeApi.getFriendsImage(targets as { summonerId: number; puuid: string }[], [...syncIconsType]);
            }
        } catch (err: any) {
            warn(`getUsersImage failed: ${err.message}`);
        }

        const normalizedEntries = this.normalizeIconEntries(entries);
        if (replaceList) friendIconList = normalizedEntries;
        else this.mergeIconEntries(normalizedEntries);
    }

    /** fs mode: one batch diff request, then read unchanged icons from local cache */
    private async syncUsersIconsFs(targets: UserIconTarget[], replaceList = true): Promise<FriendIconSyncStats> {
        const stats: FriendIconSyncStats = {
            serverMs: 0,
            cacheMs: 0,
            saveMs: 0,
            patches: 0,
            cacheReads: 0,
            updatedIcons: 0,
            deletedIcons: 0
        };

        if (!window.elainathemeApi) {
            warn("elainathemeApi not available, skipping user icon sync");
            return stats;
        }

        if (typeof window.elainathemeApi.syncUsersIcons !== 'function' && typeof window.elainathemeApi.syncFriendsIcons !== 'function') {
            warn("syncUsersIcons not available, falling back to getUsersImage");
            const serverStart = performance.now();
            await this.syncUsersIconsMemory(targets, replaceList);
            stats.serverMs = Math.round(performance.now() - serverStart);
            return stats;
        }

        const serverStart = performance.now();
        let serverPatches: SyncFriendIconPatch[] | null = null;
        try {
            serverPatches = typeof window.elainathemeApi.syncUsersIcons === 'function'
                ? await window.elainathemeApi.syncUsersIcons(targets, hashCache, [...syncIconsType])
                : await window.elainathemeApi.syncFriendsIcons(targets as { summonerId: number; puuid: string }[], hashCache, [...syncIconsType]);
        } catch (err: any) {
            warn(`syncUsersIcons failed: ${err.message}`);
        }
        stats.serverMs = Math.round(performance.now() - serverStart);
        if (!serverPatches) {
            warn("syncUsersIcons failed, falling back to getUsersImage");
            const fallbackStart = performance.now();
            try {
                await this.syncUsersIconsMemory(targets, replaceList);
            } catch (err: any) {
                warn(`getUsersImage fallback failed: ${err.message}`);
            }
            stats.serverMs += Math.round(performance.now() - fallbackStart);
            return stats;
        }

        const patchBySummonerId = new Map<string, SyncFriendIconPatch>();
        for (const patch of serverPatches as SyncFriendIconPatch[]) {
            patchBySummonerId.set(String(patch.summonerID), patch);
        }
        stats.patches = patchBySummonerId.size;

        const syncedEntries: FriendIconEntry[] = [];
        let hashesChanged = await this.cleanupIconCache();
        let hashMetaChanged = hashesChanged;
        const cacheReadTasks: (() => Promise<void>)[] = [];
        const writeTasks: (() => Promise<void>)[] = [];

        for (const target of targets) {
            const icons = this.createEmptyIconMap();
            const patch = patchBySummonerId.get(String(target.summonerId));
            const changedIcons = patch?.icons || {};

            for (const type of syncIconsType) {
                const key = `${target.summonerId}:${type}`;

                if (Object.prototype.hasOwnProperty.call(changedIcons, type)) {
                    const update = changedIcons[type];

                    if (update?.data && update.hash) {
                        hashCache[key] = update.hash;
                        this.markCacheKey(key);
                        icons[type] = update.data;
                        stats.updatedIcons++;
                        writeTasks.push(() => this.saveIconToFs(target.summonerId, type, update.data));
                    } else {
                        delete hashCache[key];
                        delete hashTouchedAt[key];
                        icons[type] = null;
                        stats.deletedIcons++;
                        writeTasks.push(() => this.deleteIconFromFs(target.summonerId, type));
                    }

                    hashesChanged = true;
                    hashMetaChanged = true;
                    continue;
                }

                if (hashCache[key]) {
                    this.markCacheKey(key);
                    hashMetaChanged = true;
                    stats.cacheReads++;
                    cacheReadTasks.push(async () => {
                        const cached = await this.loadIconFromFs(target.summonerId, type);
                        if (cached) {
                            icons[type] = cached;
                        } else {
                            delete hashCache[key];
                            delete hashTouchedAt[key];
                            icons[type] = null;
                            hashesChanged = true;
                            hashMetaChanged = true;
                        }
                    });
                } else {
                    icons[type] = null;
                }
            }

            syncedEntries.push({
                summonerID: target.summonerId,
                puuid: target.puuid || "",
                icon: icons
            });
        }

        const cacheStart = performance.now();
        await this.runLimited(cacheReadTasks);
        stats.cacheMs = Math.round(performance.now() - cacheStart);

        const saveStart = performance.now();
        await this.runLimited(writeTasks, 8);
        if (hashesChanged) await this.saveHashes();
        if (hashMetaChanged) await this.saveHashMeta();
        stats.saveMs = Math.round(performance.now() - saveStart);

        if (replaceList) friendIconList = syncedEntries;
        else this.mergeIconEntries(syncedEntries);

        return stats;
    }

    async getFriendsIcons(): Promise<void> {
        const totalStart = performance.now();
        const targetListStart = performance.now();
        const targets = await this.collectSyncTargets();
        const targetListMs = Math.round(performance.now() - targetListStart);

        if (targets.length === 0) {
            log("No visible users found, skipping icon sync");
            return;
        }

        let stats: FriendIconSyncStats | null = null;

        if (storageMode === 'fs') {
            stats = await this.syncUsersIconsFs(targets);
        } else {
            await this.syncUsersIconsMemory(targets);
        }

        const totalMs = Math.round(performance.now() - totalStart);
        if (stats) {
            log(
                `User icon sync finished in ${totalMs}ms (${targets.length} visible users, ${storageMode} mode)\n` +
                `(targets=${targetListMs}ms, server=${stats.serverMs}ms, cache=${stats.cacheMs}ms, save=${stats.saveMs}ms, ` +
                `patches=${stats.patches}, reads=${stats.cacheReads}, updated=${stats.updatedIcons}, deleted=${stats.deletedIcons})`
            );
        } else {
            log(`User icon sync finished in ${totalMs}ms (${targets.length} visible users, ${storageMode} mode; targets=${targetListMs}ms)`);
        }

        if (ElainaData.get("Dev-mode")) log("Synced user icons: ", friendIconList);
    }

    async requestUserIconSync(targets: UserIconTarget[], reason = "visible-user"): Promise<void> {
        if (!ElainaData.get("sync-user-icons")) return;
        if (!window.elainathemeApi || !Array.isArray(targets) || targets.length === 0) return;

        const deduped = new Map<string, UserIconTarget>();
        for (const target of targets) {
            this.addSyncTarget(deduped, target?.summonerId, target?.puuid);
        }

        const requestTargets = Array.from(deduped.values())
            .filter(target => !this.hasSyncedEntry(target.summonerId))
            .filter(target => !this.isOnDemandSyncBlocked(target.summonerId));

        const existingSyncs = requestTargets
            .map(target => inFlightUserSync.get(String(target.summonerId)))
            .filter((promise): promise is Promise<void> => Boolean(promise));
        const newRequestTargets = requestTargets
            .filter(target => !inFlightUserSync.has(String(target.summonerId)));

        if (newRequestTargets.length === 0) {
            await Promise.allSettled(existingSyncs);
            return;
        }

        const syncPromise = (async () => {
            if (storageMode === 'fs') await this.syncUsersIconsFs(newRequestTargets, false);
            else await this.syncUsersIconsMemory(newRequestTargets, false);

            const missingEntries = newRequestTargets.filter(target => !this.hasSyncedEntry(target.summonerId));
            if (missingEntries.length > 0) {
                this.markOnDemandSyncFailed(missingEntries);
            } else {
                this.clearOnDemandSyncFailure(newRequestTargets);
            }
        })();

        for (const target of newRequestTargets) {
            inFlightUserSync.set(String(target.summonerId), syncPromise);
        }

        try {
            await Promise.allSettled([...existingSyncs, syncPromise]);
        } finally {
            for (const target of newRequestTargets) {
                inFlightUserSync.delete(String(target.summonerId));
            }
        }

        if (ElainaData.get("Dev-mode")) {
            log(`On-demand icon sync complete (${newRequestTargets.length} users, reason=${reason})`);
        }
    }

    async ensureUserIcons(target: UserIconTarget, reason = "visible-user"): Promise<void> {
        if (!target?.summonerId) return;
        if (this.hasSyncedEntry(target.summonerId)) return;
        if (this.isOnDemandSyncBlocked(target.summonerId)) return;
        await this.requestUserIconSync([target], reason);
    }

    /**
     * Download friend icons and upload own icons with hash comparison.
     */
    async syncIconsWithHashCheck(): Promise<void> {
        if (!ElainaData.get("sync-user-icons")) return;

        const summonerID = ElainaData.get("Summoner-ID");
        const token = ElainaData.get("ElainaTheme-Token");

        if (!summonerID || !token) {
            error("Missing summonerID or token, skipping icon sync");
            return;
        }

        // Sync visible users' icons
        await window.Toast.promise(this.getFriendsIcons(), {
            loading: 'Syncing user icons...',
            success: 'Sync complete!',
            error: 'Error while syncing user icons, check console for more info!'
        });

        await this.syncOwnIcons(summonerID);

        // Update avatar on conversations
        const conversationChat = document.querySelectorAll(".conversation.chat");
        for (let i = 0; i < conversationChat.length; i++) {
            customAvatar.changeConversationChatAvatar(conversationChat[i]);
        }

        const chatHeaders = document.querySelectorAll("header.chat-header");
        for (let i = 0; i < chatHeaders.length; i++) {
            customAvatar.applyChatHeaderAvatar(chatHeaders[i]);
        }

        const socialRosterMembers = document.querySelectorAll(".lol-social-roster-member");
        for (let i = 0; i < socialRosterMembers.length; i++) {
            customAvatar.applySocialRosterAvatar(socialRosterMembers[i]);
        }
    }

    async main(): Promise<void> {
        await this.syncIconsWithHashCheck();
    }
}

const syncUserIcons = new SyncUserIcons();
window.syncUserIcons = syncUserIcons;

export { friendIconList, resolveSyncedUserTargetByDisplayName, syncUserIcons }
