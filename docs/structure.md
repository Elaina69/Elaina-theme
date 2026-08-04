# Elaina Theme Structure

```text
Elainatheme-typescript/
├── .github/                                      # GitHub automation/config files
├── .husky/                                       # Git hooks
├── dist/                                         # Generated build output and release zip
├── docs/                                         # Maintainer docs and wiki source metadata
│   ├── settings-meta.json                        # Settings metadata for wiki generation
│   ├── structure.md                              # Project structure map
│   ├── theme-document.en.md                      # English theme maintenance document
│   ├── theme-document.vi.md                      # Vietnamese theme maintenance document
│   └── wiki-content.json                         # Source content for generated wiki pages
├── scripts/                                      # Maintenance scripts
│   └── generate-wiki.mjs                         # Generate/check GitHub Wiki pages
├── src/                                          # Source root used by Vite
│   ├── index.ts                                  # Pengu Loader entry point: init/load lifecycle
│   ├── types.d.ts                                # Global TypeScript declarations
│   ├── elaina-theme-data/                        # CDN/helper data package copied to build output
│   │   ├── index.js                              # CDN package entry: backend init, tracking, helper imports
│   │   ├── package.json                          # CDN package metadata
│   │   ├── README.md                             # CDN package readme
│   │   ├── LICENSE.txt                           # CDN package license
│   │   └── src/                                  # CDN package runtime modules and assets
│   │       ├── apiWrapper.js                     # Backend API client exposed as window.elainathemeApi
│   │       ├── importupdate.js                   # Loads CDN update stylesheet and datastore marker
│   │       ├── assets/                           # CDN package media and style assets
│   │       │   ├── icon/                         # General, donation and plugin icon assets
│   │       │   ├── image/                        # Holiday/date image assets
│   │       │   ├── styles/                       # CDN package CSS files
│   │       │   └── video/                        # CDN package video assets
│   │       ├── config/                           # CDN package config/data files
│   │       │   ├── championPrices.js             # Champion price data
│   │       │   ├── holiday.js                    # Holiday metadata
│   │       │   ├── images.js                     # Holiday/CDN image metadata
│   │       │   ├── pandoru.txt                   # Static text data
│   │       │   └── serverDomain.js               # Backend domain and expiry metadata
│   │       ├── plugins/                          # CDN-side helper plugins
│   │       │   ├── commandBar.js                 # Command bar actions
│   │       │   ├── donate.js                     # Donation UI
│   │       │   ├── holidayMessages.js            # Holiday message UI
│   │       │   ├── keyCombines.js                # Keyboard shortcut helpers
│   │       │   ├── preloadImg.js                 # CDN image preload helper
│   │       │   ├── syncIcons.js                  # Hash-check own icon upload/sync helper
│   │       │   └── watermark.js                  # Theme watermark UI
│   │       ├── update/                           # CDN update metadata
│   │       │   └── update.js                     # CDN version, update type and changelog text
│   │       └── utils/                            # CDN package utility helpers
│   │           ├── observer.js                   # DOM observer helper
│   │           ├── themeLog.js                   # CDN logging helpers
│   │           └── utils.js                      # Shared CDN utility functions
│   └── src/                                      # Main TypeScript theme runtime
│       ├── languages.ts                          # Runtime i18n loader and window.getString
│       ├── otherThings.ts                        # Misc startup helpers such as theme name resolution
│       ├── assets/                               # Bundled theme assets copied to dist/assets
│       │   ├── backgrounds/                      # Wallpaper, audio and rune background assets
│       │   ├── champs/                           # Champion replacement images and previews
│       │   ├── fonts/                            # Bundled theme fonts
│       │   ├── icon/                             # Theme icons, banners, borders and cursor assets
│       │   └── styles/                           # Theme/component CSS files
│       ├── config/                               # Runtime config copied to dist/config
│       │   ├── cdnServer.js                      # CDN config
│       │   ├── champsBgList.js                   # Champion background replacement data
│       │   ├── customStatus.txt                  # Custom status text data
│       │   ├── datastoreDefault.js               # Default ElainaData settings
│       │   ├── filters.js                        # Wallpaper/filter config
│       │   └── icons.js                          # Icon asset config and legacy aliases
│       ├── locales/                              # Locale modules copied to dist/locales
│       │   ├── default.js                        # Default English strings
│       │   ├── ru-RU.js                          # Russian strings
│       │   ├── vi-VN.js                          # Vietnamese strings
│       │   └── zh-CN.js                          # Chinese strings
│       ├── plugins/                              # Theme plugins and settings UI
│       │   ├── autoAccept.ts                     # Matchmaking ready-check auto accept
│       │   ├── autoQueue.ts                      # Auto queue helper
│       │   ├── customBeRp.ts                     # Local BE/RP display override
│       │   ├── customStatus.ts                   # Custom status/profile hover behavior
│       │   ├── customSummonerLv.ts               # Local summoner level override
│       │   ├── dodgeButton.ts                    # Champ select dodge button
│       │   ├── forceJungleLane.ts                # Role/lane selection helper
│       │   ├── inviteAllFriends.ts               # Invite all friends button
│       │   ├── lootHelper.ts                     # Loot helper buttons
│       │   ├── nameSpoofer.ts                    # Local summoner name spoofing
│       │   ├── offlineMode.ts                    # Local offline/away mode
│       │   ├── practice5vs5.ts                   # Practice 5v5 helper
│       │   ├── settings.ts                       # Elaina Theme settings panel registration
│       │   ├── skipHonor.ts                      # Honor screen skip helper
│       │   ├── syncUserIcons.ts                  # Custom icon sync with visible users
│       │   ├── themePresetSettingsTab.ts         # Theme preset settings tab
│       │   └── settingsGroups/                   # Settings panel sections and builders
│       │       ├── settingsStructure.ts          # Settings tab/section structure
│       │       ├── settingsUI.ts                 # Shared settings DOM builders
│       │       ├── aboutUs/                      # About/credits settings page
│       │       ├── backupRestore/                # Backup/restore settings page
│       │       ├── pluginsSettings/              # Plugin settings sections
│       │       └── themeSettings/                # Theme settings sections
│       ├── services/                             # Theme services
│       │   └── backupAndRestoreDatastore.ts      # Default restore and backup/restore helpers
│       ├── theme/                                # Theme UI/CSS loaders and custom UI modules
│       │   ├── Cdn.ts                            # CDN data package loader
│       │   ├── loadCustomCss.ts                  # Main/component/custom CSS loader
│       │   ├── loadCustomFilters.ts              # Wallpaper/gameflow filter loader
│       │   ├── loadCustomUi.ts                   # Broad custom UI loader
│       │   └── customUI/                         # Specific League Client UI customizations
│       │       ├── customChampsBg.ts             # Champion image replacement
│       │       ├── customGameSearchCard.ts       # Game search card styling
│       │       ├── customHomepage.ts             # Homepage wallpaper/audio/navbar customization
│       │       ├── customIcon.ts                 # Avatar/banner/border/rank/clash icon rendering
│       │       ├── customProfile.ts              # Profile/rank/challenge hover customization
│       │       ├── customRuneBg.ts               # Rune page background replacement
│       │       ├── hideFriendList.ts             # Friend list/sidebar visibility controls
│       │       ├── removeGamemode.ts             # Game mode visibility controls
│       │       └── transparentLobby.ts           # Lobby transparency adjustments
│       ├── updates/                              # Theme update helpers
│       │   ├── checkUpdate.ts                    # Theme update check
│       │   └── updateKeyLocal.ts                 # Local update key data
│       └── utils/                                # Shared runtime utilities
│           ├── utils.ts                          # Main utility facade and shared state
│           ├── themeDataStore.ts                 # ElainaData PluginFS/DataStore wrapper
│           ├── fileSystem.ts                     # PluginFS/FileSystem abstraction
│           ├── themeLog.ts                       # Styled theme logger
│           ├── debug.ts                          # Debug helpers
│           ├── fileRegex.ts                      # File extension/regex helpers
│           ├── rankList.ts                       # Rank metadata
│           ├── settingsUtils.ts                  # Settings integration helpers
│           ├── windowEffectList.ts               # Window effect option data
│           ├── _addFont.ts                       # Font injection helper
│           ├── _addStyleNode.ts                  # Legacy style injection helper
│           ├── _addStyleNodeWithID.ts            # ID-based style injection helper
│           ├── _assetReplacement.ts              # CSS asset replacement helper
│           ├── _assets.ts                        # Asset URL helpers
│           ├── _CustomCursor.ts                  # Custom cursor helper
│           ├── _freezeProperties.ts              # Property freeze helper
│           ├── _getPUUID.ts                      # PUUID helper
│           ├── _getSummonerID.ts                 # Summoner ID helper
│           ├── _mutationObserverAddCallback.ts   # Mutation callback registry helper
│           ├── _routineAddCallback.ts            # Routine callback registry helper
│           ├── _sanitize.ts                      # Sanitization helpers
│           ├── _stop.ts                          # Stop/control helper
│           ├── _styleEngine.ts                   # Document/ShadowRoot/iframe CSS engine
│           ├── _subscribe_endpoint.ts            # League websocket endpoint subscription helper
│           └── _updateImageSrc.ts                # Image src update helper
├── wiki/                                         # Generated GitHub Wiki pages
│   ├── _Sidebar.md                              # Generated wiki sidebar
│   ├── Backup-Restore.md                        # Generated backup/restore page
│   ├── FAQ-Troubleshooting.md                   # Generated FAQ page
│   ├── Home.md                                  # Generated wiki home page
│   ├── Installation-instructions.md             # Generated installation page
│   └── Theme-customization.md                   # Generated customization page
├── package.json                                  # Package scripts, metadata and dependencies
├── pnpm-lock.yaml                                # pnpm dependency lockfile
├── package-lock.json                             # npm dependency lockfile
├── tsconfig.json                                 # TypeScript compiler config
├── vite.config.ts                                # Vite build/dev/package config
├── eslint.config.js                              # ESLint config
├── README.md                                     # Public project README
├── LICENSE.txt                                   # Project license
└── Elainatheme-typescript.code-workspace         # VS Code workspace file

ElainaDaCatto-Server/                             # Backend Server
```
