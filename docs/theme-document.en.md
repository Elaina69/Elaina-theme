# Elaina Theme Document

> This file consolidates the non-wiki project documentation for Elaina Theme.
> It intentionally excludes GitHub Wiki page content and wiki metadata such as
> `docs/wiki-content.json` and `docs/settings-meta.json`.

---

## 1. Purpose

This document consolidates the non-wiki documentation for maintaining and extending Elaina Theme.

## 2. Project Overview

Elaina Theme is a Pengu Loader theme/plugin that runs inside the League of Legends Client. The project has 3 main parts:

| Component | Responsibility | Technology |
|---|---|---|
| `Elainatheme-typescript` | Frontend theme inside League Client | TypeScript, Vite, pengu-upl, nano-jsx |
| `elaina-theme-data` | CDN data and helper modules | JavaScript, jsDelivr/CDN |
| `Elainatheme-backend` | Backend API for backup and custom icons | Node.js, Express |

High-level flow:

1. Pengu Loader loads the theme from the plugin folder.
2. Frontend runs `init(context)`.
3. The theme initializes `ElainaData`, PluginFS/FileSystem, settings, UI, CSS, and plugins.
4. The CDN package provides `window.elainathemeApi` and helper modules.
5. The backend supports cloud backups and custom images.
6. The theme uses both LoL Client local APIs (`/lol-*`) and backend APIs.

## 3. Frontend: Elainatheme-typescript

### 3.1 Entry Point and Lifecycle

The main entry point is `src/index.ts`.

Important initialization order:

1. Pengu calls `init(context)`.
2. `initThemeName(context)` resolves the theme folder name.
3. `await ElainaData.init(context)` initializes storage.
4. `restoreDefaultDataStore()` ensures default settings exist.
5. `fileSystem.init(context)` initializes the PluginFS/FileSystem wrapper.
6. `syncUserIcons.init()` selects the icon sync storage mode.
7. `initThemeDataCdn()` loads CDN data.
8. Settings, lobby transparency, auto queue, and skip honor are initialized.
9. `load()` runs the main theme: update check, UI, filters, CSS, preset settings, and plugins.

Never read or write `ElainaData` before `ElainaData.init(context)` has completed.

### 3.2 Important Paths

| Path | Responsibility |
|---|---|
| `src/index.ts` | Pengu entry point and init/load lifecycle |
| `src/types.d.ts` | Global type declarations |
| `src/src/languages.ts` | i18n runtime, exposes `window.getString()` |
| `src/src/locales/` | Locale files: default, ru-RU, vi-VN, zh-CN |
| `src/src/config/datastoreDefault.js` | Default values for settings |
| `src/src/utils/themeDataStore.ts` | `ElainaData` wrapper |
| `src/src/utils/fileSystem.ts` | PluginFS/FileSystem abstraction |
| `src/src/plugins/settings.ts` | Settings panel integration |
| `src/src/plugins/syncUserIcons.ts` | Custom icon sync between Elaina users |
| `src/src/theme/customUI/customIcon.ts` | Avatar, border, banner, hover card, tooltip icon |
| `src/src/theme/customUI/customHomepage.ts` | Wallpaper, audio, navbar, homepage customization |
| `src/elaina-theme-data/` | CDN data package copied during build |

### 3.3 Settings and Datastore

The theme uses `ElainaData` instead of directly accessing `window.DataStore`.

Rules:

- All runtime settings go through `ElainaData.get/set/has/remove`.
- Do not call `ElainaData.*` at module top level.
- Only use `ElainaData.*` after `await ElainaData.init(context)`.
- PluginFS mode uses `context.fs`; legacy mode falls back to Pengu `DataStore`.
- Do not merge legacy `window.DataStore` into PluginFS on every startup. Migrate only when the PluginFS file does not exist or is empty.
- PluginFS writes must use the current API shape:
  `context.fs.write(path, content, { append: false })`.
- `context.fs.ls(path)` may return `undefined`; use `await fs.ls(path) ?? []`.

### 3.4 Locale/i18n

Locale files live under `src/src/locales/`.

Translation keys use namespaced keys:

```js
"common.home": "Home",
"auto-accept.auto-accept": "Auto Accept",
"theme-settings.sync-user-icons": "Sync users' custom icons",
"plugins-settings.loot-helper": "Loot helper",
```

Runtime usage:

```ts
await getString("theme-settings.sync-user-icons")
```

## 4. Plugin and UI Patterns

### 4.1 Plugin Pattern

Plugins usually expose a class with a `main()` method:

```ts
class SomePlugin {
  main() {
    // subscribe API, observe DOM, inject UI, etc.
  }
}
```

Plugins usually check settings before running:

```ts
if (ElainaData.get("loot-helper")) lootHelper.main()
```

### 4.2 DOM and Shadow DOM

League Client uses many Web Components and Shadow DOM. The theme often needs:

- `pengu-upl` observers to detect newly created elements.
- `MutationObserver` for components that League re-renders.
- Shadow DOM traversal for avatar, border, banner, rank icon, Clash banner, and tooltip icon replacement.
- Event-driven observers instead of long-running intervals whenever possible.

### 4.3 Custom Icon Rendering

`customIcon.ts` handles:

- Own avatar.
- Synced visible user avatar.
- Border.
- Regalia banner.
- Hover card backdrop.
- Social roster avatar.
- Chat header avatar.
- Conversation avatar.
- Identity tooltip avatar while hovering icons.
- Loading icon, game mode icon, honor emblem, profile rank icon, and profile Clash banner.

Principles:

- Prefer `summonerID` lookup.
- Use `puuid` only for DOM matching when available.
- Do not freeze `src` for elements reused by League across multiple users, such as tooltips.
- Non-Elaina users should keep the default League UI.
- Avoid repeated logs/errors when a user has no custom icon.

## 5. Custom User Icon Sync

### 5.1 Current Model

Icon sync now works with visible users/peers:

- Friends from `/lol-chat/v1/friends`.
- Lobby members from `/lol-lobby/v2/lobby`.
- Champ select members from `/lol-champ-select/v1/session`.
- DOM elements with `summoner-id`, `puuid`, or `voice-puuid`.
- Conversation chat resolved from conversation data to summoner data.
- On-demand sync through `window.syncUserIcons.ensureUserIcons()`.

The `friendIconList` export name remains for compatibility, but it now represents synced visible users.
Synced icon payloads currently cover `avatar`, `border`, `banner`, `emblem`, `hoverCardBackdrop`, `rankIcon`, and `clashBanner`; clients that only understand the older five-icon payload can keep using the same endpoints.
The CDN icon config keeps `Class-banner` as a legacy alias for `Clash-banner` so older theme builds can still resolve the same asset.
New clients send their supported `types`; if omitted, the backend returns only the legacy five-icon payload.

### 5.2 Cache and Compatibility

Pengu Loader 1.2.0+:

- Uses PluginFS cache under `./data/icons`.
- Uses `hashes.json` and hash diff sync.
- Does not delete cache only because a user is no longer a friend.
- Cleans up by TTL/size limit.

Pengu Loader 1.1.6:

- No `context.fs`.
- Uses memory mode.
- Backend returns full data URI payloads through batch endpoints.

### 5.3 Backend Endpoints

New neutral endpoints:

- `POST /api/elainatheme/image/getUsersImage`
- `POST /api/elainatheme/image/syncUsersIcons`

Old endpoints remain aliases for older clients:

- `POST /api/elainatheme/image/getFriendsImage`
- `POST /api/elainatheme/image/syncFriendsIcons`

Request shape:

```json
{
  "usersList": [
    { "summonerId": 123456789, "puuid": "optional-puuid" }
  ],
  "types": ["avatar", "border", "banner", "emblem", "hoverCardBackdrop", "rankIcon", "clashBanner"],
  "localHashes": {
    "123456789:avatar": "sha256"
  }
}
```

## 6. CDN Data Package

`src/elaina-theme-data/index.js` runs after window load.

Main responsibilities:

- Import helper modules: watermark, donate, holiday messages, command bar, key combines, preload image.
- Check backend availability.
- Login to the backend for cloud backup/custom image features when needed.
- Expose `window.elainathemeApi`.
- Run `window.syncUserIcons.main()`.

`apiWrapper.js` is the backend client layer, including:

- Register/login.
- Cloud backup read/write/delete.
- Image upload/get/delete/hash.
- Batch user icon sync.

## 7. Backend: Elainatheme

Elaina Theme backend features:

- User register/login.
- Protected backup API.
- Total user count.
- Image upload/get/hash/delete.
- Batch icon sync.

Image storage:

- Stored by `summonerID`.
- Types include `avatar`, `border`, `banner`, `emblem`, `hoverCardBackdrop`, `rankIcon`, `clashBanner`.
- Backend sanitizes filenames/paths.
- Upload requires a valid token.
- Read/sync endpoints do not require a friendship relation.

## 8. Build and Validation

Frontend build:

```bash
pnpm run build
```

Wiki consistency check, only when touching docs/wiki metadata:

```bash
pnpm run wiki:check
```

Recommended checks:

- TypeScript/JS changes: `pnpm run build`.
- Docs/wiki metadata changes: `pnpm run wiki:check`.
- Custom icon/sync changes: test friend, non-friend, lobby, champ select, chat, hover card.
- PluginFS/datastore changes: test Pengu 1.1.6 and 1.2.0+ when possible.

## 9. Rules for AI/Coding Agents

Most important rule:

> Do not call `ElainaData.get/set/has/remove` during module import.

Before editing PluginFS/datastore code, read `docs/PLUGINFS_DATASTORE_RULES.md`.

When editing code:

- Do not revert changes you did not make.
- Prefer existing project patterns.
- Do not rename datastore keys when only changing UI label/locale.
- Do not add intervals when observer/event-driven logic is enough.
- Do not manually edit generated wiki pages.
- For icon sync, keep compatibility with old endpoints while older clients/backends may still exist.
