# Tài liệu Elaina Theme

> Tài liệu này tổng hợp các phần tài liệu không thuộc GitHub Wiki của Elaina Theme.
> Nội dung không bao gồm GitHub Wiki page content và wiki metadata như
> `docs/wiki-content.json` và `docs/settings-meta.json`.

---

## 1. Mục đích tài liệu

Tài liệu này là bản tổng hợp cho việc đọc hiểu, bảo trì và nâng cấp Elaina Theme.

## 2. Tổng quan dự án

Elaina Theme là theme/plugin cho Pengu Loader, chạy bên trong League of Legends Client. Dự án gồm 3 phần chính:

| Thành phần | Vai trò | Công nghệ |
|---|---|---|
| `Elainatheme-typescript` | Frontend theme chạy trong League Client | TypeScript, Vite, pengu-upl, nano-jsx |
| `elaina-theme-data` | CDN data và module phụ trợ | JavaScript, jsDelivr/CDN |
| `Elainatheme-backend` | Backend API cho backup và custom icon | Node.js, Express |

Luồng tổng thể:

1. Pengu Loader load theme từ thư mục plugin.
2. Frontend chạy `init(context)`.
3. Theme khởi tạo `ElainaData`, PluginFS/FileSystem, settings, UI, CSS và plugin.
4. CDN package cung cấp `window.elainathemeApi` và các module phụ trợ.
5. Backend hỗ trợ cloud backup và custom image.
6. Theme dùng cả LoL Client local API (`/lol-*`) và backend API.

## 3. Frontend: Elainatheme-typescript

### 3.1 Entry point và lifecycle

Entry point chính là `src/index.ts`.

Thứ tự khởi tạo quan trọng:

1. `init(context)` được Pengu gọi.
2. `initThemeName(context)` xác định tên folder theme.
3. `await ElainaData.init(context)` khởi tạo datastore.
4. `restoreDefaultDataStore()` đảm bảo default setting tồn tại.
5. `fileSystem.init(context)` khởi tạo PluginFS/FileSystem wrapper.
6. `syncUserIcons.init()` chọn storage mode cho icon sync.
7. `initThemeDataCdn()` load CDN data.
8. Khởi tạo settings, lobby transparency, auto queue, skip honor.
9. `load()` chạy theme chính: update check, UI, filters, CSS, preset settings, plugins.

Không được đọc/ghi `ElainaData` trước khi `ElainaData.init(context)` hoàn tất.

### 3.2 Cấu trúc quan trọng

| Đường dẫn | Vai trò |
|---|---|
| `src/index.ts` | Entry point Pengu, init/load lifecycle |
| `src/types.d.ts` | Global type declarations |
| `src/src/languages.ts` | i18n runtime, expose `window.getString()` |
| `src/src/locales/` | Locale files: default, ru-RU, vi-VN, zh-CN |
| `src/src/config/datastoreDefault.js` | Default values cho settings |
| `src/src/utils/themeDataStore.ts` | `ElainaData` wrapper |
| `src/src/utils/fileSystem.ts` | PluginFS/FileSystem abstraction |
| `src/src/plugins/settings.ts` | Settings panel integration |
| `src/src/plugins/syncUserIcons.ts` | Sync custom icon giữa Elaina users |
| `src/src/theme/customUI/customIcon.ts` | Avatar, border, banner, hover card, tooltip icon |
| `src/src/theme/customUI/customHomepage.ts` | Wallpaper, audio, navbar, homepage customization |
| `src/elaina-theme-data/` | CDN data package bundled/copied with build |

### 3.3 Settings và datastore

Theme dùng `ElainaData` thay vì truy cập trực tiếp `window.DataStore`.

Quy tắc:

- Tất cả settings runtime đi qua `ElainaData.get/set/has/remove`.
- Không gọi `ElainaData.*` ở top-level module import.
- Chỉ dùng `ElainaData.*` sau `await ElainaData.init(context)`.
- PluginFS mode dùng `context.fs`; legacy mode fallback về Pengu `DataStore`.
- Không merge legacy `window.DataStore` vào PluginFS ở mọi lần startup. Chỉ migrate khi file PluginFS chưa tồn tại hoặc rỗng.
- PluginFS write phải dùng dạng API hiện tại:
  `context.fs.write(path, content, { append: false })`.
- `context.fs.ls(path)` có thể trả `undefined`; dùng `await fs.ls(path) ?? []`.

### 3.4 Locale/i18n

Locale files nằm trong `src/src/locales/`.

Các key dịch dùng dạng namespaced:

```js
"common.home": "Home",
"auto-accept.auto-accept": "Auto Accept",
"theme-settings.sync-user-icons": "Sync users' custom icons",
"plugins-settings.loot-helper": "Loot helper",
```

Runtime gọi:

```ts
await getString("theme-settings.sync-user-icons")
```

## 4. Plugin và UI patterns

### 4.1 Plugin pattern

Plugin thường là class có method `main()`:

```ts
class SomePlugin {
  main() {
    // subscribe API, observe DOM, inject UI, etc.
  }
}
```

Các plugin thường check setting trước khi chạy:

```ts
if (ElainaData.get("loot-helper")) lootHelper.main()
```

### 4.2 DOM và Shadow DOM

League Client dùng nhiều Web Component và Shadow DOM. Theme thường cần:

- `pengu-upl` observer để bắt element mới.
- `MutationObserver` cho component được League render lại nhiều lần.
- Shadow DOM traversal khi cần thay avatar, border, banner, rank icon, Clash banner, tooltip icon.
- `utils.styleEngine` để inject CSS dùng lại được vào document, Shadow DOM và same-origin iframe.
- `utils.assets` và `utils.assetReplacement` để tạo URL asset đã escape và thay ảnh bằng CSS.
- Không dùng interval dài hạn nếu có thể dùng observer/event-driven.

Khi CSS được inject vào Shadow DOM hoặc iframe, các phần đổi text động vẫn nên xử lý bằng JavaScript. Style engine sẽ tách rule chỉ nên nằm ở document như `@import` và `@font-face` khỏi CSS nhúng để tránh lỗi trong Shadow DOM/iframe.

### 4.3 Custom icon rendering

`customIcon.ts` xử lý:

- Own avatar.
- Synced visible user avatar.
- Border.
- Regalia banner.
- Hover card backdrop.
- Social roster avatar.
- Chat header avatar.
- Conversation avatar.
- Identity tooltip avatar khi hover icon.
- Loading icon, game mode icon, honor emblem, rank icon trong profile và Clash banner trong profile.

Nguyên tắc:

- Lookup bằng `summonerID` trước.
- `puuid` chỉ dùng để match DOM khi có.
- Không freeze `src` cho element được League tái sử dụng giữa nhiều user, ví dụ tooltip.
- Non-Elaina user giữ default League UI.
- Không spam log/error khi user chưa có custom icon.

## 5. Sync custom user icons

### 5.1 Mô hình hiện tại

Sync user icon hiện dùng khái niệm visible users/peers:

- Friends từ `/lol-chat/v1/friends`.
- Lobby members từ `/lol-lobby/v2/lobby`.
- Champ select members từ `/lol-champ-select/v1/session`.
- DOM elements có `summoner-id`, `puuid`, `voice-puuid`.
- Conversation chat được resolve từ conversation data sang summoner.
- On-demand sync qua `window.syncUserIcons.ensureUserIcons()`.

`friendIconList` vẫn giữ tên export cũ để tránh sửa rộng, nhưng nội dung hiện là synced visible users.
Payload sync icon hiện gồm `avatar`, `border`, `banner`, `emblem`, `hoverCardBackdrop`, `rankIcon`, và `clashBanner`; client cũ chỉ hiểu 5 type cũ vẫn dùng cùng endpoint bình thường.
CDN icon config vẫn giữ `Class-banner` làm alias cũ của `Clash-banner` để bản theme cũ vẫn resolve được cùng asset.
Client mới gửi danh sách `types` nó hỗ trợ; nếu thiếu, backend chỉ trả payload 5 icon cũ.

### 5.2 Cache và compatibility

Pengu Loader 1.2.0+:

- Dùng PluginFS cache tại `./data/icons`.
- Dùng `hashes.json` và hash diff sync.
- Không xóa cache chỉ vì user không còn là friend.
- Cleanup bằng TTL/size limit.

Pengu Loader 1.1.6:

- Không có `context.fs`.
- Dùng memory mode.
- Backend trả full data URI qua batch endpoint.

### 5.3 Backend endpoints

Endpoint mới trung lập:

- `POST /api/elainatheme/image/getUsersImage`
- `POST /api/elainatheme/image/syncUsersIcons`

Endpoint cũ vẫn là alias để không phá client cũ:

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

## 6. CDN data package

`src/elaina-theme-data/index.js` chạy sau khi window load.

Vai trò chính:

- Import module phụ trợ: watermark, donate, holiday messages, command bar, key combines, preload image.
- Check backend availability.
- Login backend để lấy token API khi cần dùng cloud backup/custom image.
- Expose `window.elainathemeApi`.
- Gọi `window.syncUserIcons.main()`.

`apiWrapper.js` là lớp client giao tiếp backend, bao gồm:

- Register/login.
- Cloud backup read/write/delete.
- Image upload/get/delete/hash.
- Batch user icon sync.

## 7. Backend: Elainatheme-backend

Elaina Theme backend features:

- Register/login user.
- Protected backup API.
- Total users.
- Image upload/get/hash/delete.
- Batch icon sync.

Image storage:

- Lưu theo `summonerID`.
- Type gồm `avatar`, `border`, `banner`, `emblem`, `hoverCardBackdrop`, `rankIcon`, `clashBanner`.
- Backend sanitize filename/path.
- Upload cần token hợp lệ.
- Read/sync endpoint không cần friendship relation.

## 8. Build và validation

Frontend build:

```bash
pnpm run build
```

Wiki consistency check, chỉ khi chạm tài liệu/wiki metadata:

```bash
pnpm run wiki:check
```

Các bước nên chạy khi sửa theme:

- Sửa TypeScript/JS: `pnpm run build`.
- Sửa docs/wiki metadata: `pnpm run wiki:check`.
- Sửa custom icon/sync: test friend, non-friend, lobby, champ select, chat, hover card.
- Sửa PluginFS/datastore: test cả Pengu 1.1.6 và 1.2.0+ nếu có thể.

## 9. Quy tắc dành cho AI/coding agents

Quy tắc quan trọng nhất:

> Không gọi `ElainaData.get/set/has/remove` trong lúc module import.

Trước khi sửa code PluginFS/datastore, phải đọc `docs/PLUGINFS_DATASTORE_RULES.md`.

Khi sửa code:

- Không revert thay đổi không do mình tạo.
- Ưu tiên pattern hiện có.
- Không đổi datastore key nếu chỉ đang đổi UI label/locale.
- Không thêm interval nếu observer/event-driven đủ dùng.
- Không sửa generated wiki pages thủ công.
- Với sync icon, giữ compatibility với endpoint cũ nếu backend/client cũ còn tồn tại.
