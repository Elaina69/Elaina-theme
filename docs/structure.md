# Elaina Theme structure

This map describes the source checkout and installed plugin layout checked on **2026-11-15**. Paths below are relative to the repository root. The theme renderer, local MCP server and online API are separate runtimes.

## Source checkout

```text
Elainatheme-typescript/
├── docs/
│   ├── README.md                         Documentation index and verification scope
│   ├── interface-guide.en.md             Current user interface and workflows
│   ├── interface-guide.vi.md             Vietnamese interface guide
│   ├── theme-document.en.md              Maintainer guide
│   ├── theme-document.vi.md              Vietnamese maintainer guide
│   ├── structure.md                      This map
│   ├── settings-meta.json                Setting labels, descriptions and runtime defaults
│   ├── wiki-content.json                 Source prose for generated GitHub Wiki pages
│   └── images/                           Cropped screenshots of the running League client
├── scripts/
│   ├── generate-wiki.mjs                  Validate metadata and generate wiki/*.md
│   ├── mcp-package.mjs                    Build/package MCP and preserve runtime files on deploy
│   └── theme-css.mjs                      Hash CSS and version nested local imports
├── src/
│   ├── index.ts                          Pengu init(context) and load() entrypoints
│   ├── types.d.ts                        Theme globals and shared renderer types
│   ├── elaina-theme-data/                Separate local helper checkout, ignored by root Git
│   │   ├── index.js                      Optional online services and helper startup
│   │   └── src/
│   │       ├── apiWrapper.js             Online API sessions and feature-consent gates
│   │       └── plugins/                  Watermark, shortcuts, holiday/donation helpers
│   └── src/
│       ├── assets/                       Copied to dist/assets
│       │   ├── backgrounds/wallpapers/   Image/video wallpaper files
│       │   ├── backgrounds/audio/        Theme audio files
│       │   ├── backgrounds/runes/        Rune replacement art
│       │   ├── fonts/                    Local font files
│       │   ├── icon/regalia-banners/      Profile banner files; lowercase directory name
│       │   ├── champs/                   Champion replacement assets
│       │   └── styles/                   Theme and component CSS
│       ├── config/                       Defaults, asset mappings, filters and status text
│       ├── locales/                      default.js, vi-VN.js, ru-RU.js, zh-CN.js
│       ├── languages.ts                  Theme/client locale and English fallback
│       ├── otherThings.ts                pluginPath/pluginUrl and theme-folder resolution
│       ├── plugins/
│       │   ├── settings.ts               Tabs, panel builders, drag dialog and restart prompt
│       │   ├── themePresetSettingsTab.ts  Optional quick menu opened by the settings gear
│       │   ├── syncUserIcons.ts           Upload/download gates and visible-user icon cache
│       │   ├── nameSpoofer.ts             Setting-driven observers, no 100 ms polling
│       │   ├── autoAccept.ts              Ready-check toolbar, delay and cancellation
│       │   ├── settingsGroups/
│       │   │   ├── settingsStructure.ts   Four Elaina tabs; not other plugins' tabs
│       │   │   ├── settingsUI.ts          Shared native lol-uikit DOM builders
│       │   │   ├── themeSettings/         General, assets, media, layout and profile
│       │   │   ├── pluginsSettings/       Core, profile, developer and _mcp.ts sections
│       │   │   ├── backupRestore/         backupActions.ts, _manualBackup.ts, _cloudBackup.ts
│       │   │   └── aboutUs/               Credits and donation links
│       │   └── mcp-server/                Independent Node package plus renderer bridge
│       │       ├── browser/              Bundled bridge, capture, commands and configStore
│       │       ├── shared/               Configuration, protocol and bounded buffers
│       │       ├── server/               HTTP/WS service, stdio adapter, tools and platform code
│       │       │   └── tests/            Node integration tests
│       │       ├── package.json          build/start/stdio/check/test; Node 20+
│       │       ├── package-lock.json     Independent npm lockfile
│       │       ├── tsconfig.json         Independent server compilation
│       │       ├── config.example.json   Shipped configuration template
│       │       ├── launcher.mjs          Install/build/config initialization for both launchers
│       │       ├── start.bat             Windows foreground launcher
│       │       ├── start.sh              macOS foreground launcher
│       │       ├── README.md             HTTP/stdio setup and full MCP tool reference
│       │       └── LICENSE-RUMI.txt       Rumi's MIT attribution
│       ├── services/backupAndRestoreDatastore.ts  Fill missing defaults and version markers
│       ├── theme/
│       │   ├── Cdn.ts                    Local helpers in Dev-mode or configured CDN
│       │   ├── loadCustomUi.ts           Start custom client UI
│       │   ├── loadCustomCss.ts          Main/component styles and custom font
│       │   ├── loadCustomFilters.ts      Page/gameflow filters
│       │   └── customUI/
│       │       ├── customHomepage.ts     Media elements, controls and activity-center positioning
│       │       ├── playbackProgress.ts   Save positions on navigation/pause/pagehide
│       │       ├── clientPageObserver.ts Observe visible roots and reused Home
│       │       ├── customIcon.ts         Own/peer icons, shadow roots and reused tooltips
│       │       ├── customProfile.ts      Hover ranks, challenges and invisible banner
│       │       ├── customRuneBg.ts       Rune backgrounds via CSS [primary] selectors
│       │       ├── customChampsBg.ts     Champion backgrounds via debounced observer
│       │       ├── hideFriendList.ts     Sidebar/top-bar layout
│       │       └── removeGamemode.ts     Controls for matching League play-page elements
│       └── utils/
│           ├── themeDataStore.ts         ElainaData, setMany, subscriptions and flush
│           ├── fileSystem.ts             On-demand PluginFS directory scans
│           ├── customFont.ts             One stylesheet for local/Google fonts
│           ├── _styleEngine.ts           Document, shadow-root and iframe styles
│           ├── _assets.ts                Scoped/renamed plugin asset URLs
│           ├── _mutationObserverAddCallback.ts  Callbacks dispatched through UPL
│           ├── _subscribe_endpoint.ts    LCU event helpers
│           └── utils.ts                  Shared utility facade
├── tests/                                Root theme tests and Pengu/browser fakes
├── .github/workflows/                    CI and wiki publishing
├── .husky/                               Git hooks
├── package.json                          Root scripts and deployment configuration
├── pnpm-lock.yaml                        Tracked root dependency lockfile
├── tsconfig.json                         Theme compiler; excludes server sources/output
├── vitest.config.ts                      Root suite; independent MCP suite excluded
├── vite.config.ts                        Build/dev deployment, CSS revisions and ZIP
├── eslint.config.js                      Root lint configuration
├── README.md                             Public project entry point
├── dist/                                 Generated build output, ignored by Git
└── wiki/                                 Generated wiki pages, ignored by Git
```

Additional utilities and asset subfolders are omitted. `autoQueue.ts`, `dodgeButton.ts`, `skipHonor.ts` and `practice5vs5.ts` still exist, but their startup calls are commented out in `src/index.ts`; file presence does not mean a plugin runs. The queue settings section is also commented out in `pluginsSettings.ts`.

## Installed and release layout

```text
<Pengu plugins>/[optional @scope]/elaina-theme/
├── index.js                          Built theme loaded by Pengu
├── assets/                           Wallpaper/audio/fonts/icons/versioned CSS
├── config/                           Runtime modules, not MCP credentials
├── locales/                          Theme translations
├── elaina-theme-data/                Local helpers when available in the build
├── data/                             Runtime settings/icon cache with PluginFS
└── mcp-server/
    ├── package.json, package-lock.json, tsconfig.json
    ├── server/, shared/              Server build inputs
    ├── dist/server/main.js           npm start: one loopback HTTP + WebSocket service
    ├── dist/server/stdio.js          node adapter: connects to that service
    ├── config.example.json, README.md, LICENSE-RUMI.txt
    ├── launcher.mjs, start.bat, start.sh
    ├── config.local.json             Created locally; excluded from ZIP
    └── node_modules/                 Installed locally; excluded from ZIP
```

There are exactly two platform launch scripts. `config.local.json` is server configuration; `data/ElainaData.json` is theme settings. Without PluginFS, settings use the `ElainaTheme` DataStore entry.

Build/development deployment replaces shipped files while preserving installed `data/`, `elaina-theme-data/`, MCP dependencies, local configuration and dependency stamps/cache. Custom media placed only in installed `assets/` can be overwritten or removed by a later source deployment; maintain it in source assets too when using local builds. Resolve folders with `pluginPath()`/`pluginUrl()` to support scoped or renamed installations.

## Runtime and documentation boundaries

| Component | Location | Responsibility |
| --- | --- | --- |
| Online API | Separate `ElainaDaCatto-Server/API_Elainatheme/` project | Remote sessions, icon APIs and cloud backups |
| Local MCP | Theme's `mcp-server` package | Inspect/control the renderer on loopback; separate from the remote API |
| Wiki sources | `docs/wiki-content.json`, `docs/settings-meta.json` | User prose, labels, descriptions and documented runtime defaults |
| Wiki generation | `scripts/generate-wiki.mjs` | Render/check using those sources plus datastore defaults and English locale |

Keep Node server imports out of the browser bundle and MCP credentials out of defaults. Edit wiki sources instead of generated `wiki/*.md`. See the [documentation index](README.md), [English maintainer guide](theme-document.en.md) and [Vietnamese maintainer guide](theme-document.vi.md).
