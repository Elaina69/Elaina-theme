import { UI } from "../settingsUI.ts"
import { restartAfterChange } from "../../settings.ts"
import { windowEffectList } from "../../../utils/windowEffectList.ts"
import {
    del_webm_buttons,
    create_webm_buttons,
    setWallpaper,
    setImageWallpaper,
    wallpaperPlayPause,
    applyWindowEffect,
    setWindowEffectsSettingsVisibility
} from "../../../theme/customUI/customHomepage.ts"

/**
 * Tạo input chỉnh tốc độ phát wallpaper
 */
function createSpeedInput(Datastore: string): HTMLElement {
    const { origin, searchbox } = UI.createInputElement(
        Datastore, 
        "margin-bottom: 12px; width: 190px;", 
        async () => {
            let input: any = {
                get value() {
                    return searchbox.value
                },
            }

            let speedCheck: any = document.getElementById("speed-check")
            if (input.value >= 6.25 && input.value <= 300) {
                ElainaData.set(Datastore, input.value)
                speedCheck.textContent = ""
                speedCheck.style.color = ""
            }
            else {
                speedCheck.textContent = await getString("theme-settings.speed-check-deny")
                speedCheck.style.color = "red"
            }

            let bg: any = document.getElementById('elaina-bg')
            bg.playbackRate = ElainaData.get("Playback-speed")/100
        }
    )
    return origin
}

/**
 * Tạo window effects sub-section
 */
async function windowEffectsRow(): Promise<HTMLElement> {
    return UI.createRow("window-effects-settings", [
        UI.createLabel(await getString("theme-settings.window-effects"), "", "theme-settings-subsection-title"),
        UI.createRow("window-effect-main-row", [
            UI.createDropdown(
                windowEffectList["window-effect-name"].map((o: any) => ({ label: o.name, value: o.id })),
                ElainaData.get("window-effect-name"),
                {
                    title: await getString("theme-settings.window-effect-name"),
                    id: "window-effect-name-dropdown",
                    datastoreKey: "window-effect-name",
                    onChange: () => applyWindowEffect()
                }
            ),
            UI.createRow("window-effect-color-row", [
                UI.createLabel(await getString("theme-settings.window-effect-color"), ""),
                UI.colorPicker("window-effect-color-picker", "window-effect-color-base", () => {
                    const input = document.getElementById("window-effect-color-picker") as HTMLInputElement | null;
                    const label = document.getElementById("window-effect-color-text");
                    if (!input) return;

                    ElainaData.set("window-effect-color-base", input.value);
                    ElainaData.set("window-effect-color", input.value + ElainaData.get("window-effect-alpha"));

                    if (label) label.textContent = ElainaData.get("window-effect-color");
                    applyWindowEffect();
                }),
                UI.createLabel(ElainaData.get("window-effect-color"), "window-effect-color-text"),
            ]),
        ]),
        UI.opacitySlider("window-effect-opacity", await getString("theme-settings.opacity"), "window-effect-alpha", async () => {
            const slider: any = document.getElementById("window-effect-opacity");
            const title = document.getElementById("window-effect-opacity-title");
            const label = document.getElementById("window-effect-color-text");
            if (!slider) return;

            ElainaData.set("window-effect-alpha", Math.round(slider.value / 100 * 255).toString(16).padStart(2, '0'));
            ElainaData.set("window-effect-color", ElainaData.get("window-effect-color-base") + ElainaData.get("window-effect-alpha"));

            if (title) title.textContent = `${await getString("theme-settings.opacity")}: ${slider.value}%`;
            if (label) label.textContent = ElainaData.get("window-effect-color");
            applyWindowEffect();
        }),
        UI.createDropdown(
            windowEffectList["window-effect-material"].map((o: any) => ({ label: o.name, value: o.id })),
            ElainaData.get("window-effect-material"),
            {
                title: await getString("theme-settings.window-effect-material"),
                id: "window-effect-material-dropdown",
                datastoreKey: "window-effect-material",
                onChange: () => applyWindowEffect()
            }
        ),
    ], true)
}

export async function wallpaperSection(): Promise<HTMLElement> {
    const br = () => document.createElement("br")

    return UI.createSection("theme-settings-wallpaper", await getString("theme-settings.settings-section-wallpaper"), [
        UI.createButton(await getString("theme-settings.open-background-folder"), "open-background-folder", () => { window.openPluginsFolder(`${ElainaData.get("Plugin-folder-name")}/assets/backgrounds`) }),
        UI.createSlider(
            await getString("theme-settings.wallpaper-volume"), ElainaData.get("wallpaper-volume") * 100,
            (value) => {
                const audio: any = document.getElementById("elaina-bg")
                if (audio) audio.volume = value / 100
                ElainaData.set("wallpaper-volume", value / 100)
            }
        ),
        UI.createRow("changePlaybackRow", [
            UI.createLabel(await getString("theme-settings.wallpaper-speed"), ""),
            createSpeedInput("Playback-speed"),
            UI.createLabel("%", "playback-percent"),
        ]),
        UI.createLabel("", "speed-check"),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.old-prev-next-button")}`, "oldpnb", "oldpnbbox",
            () => {
                del_webm_buttons()
                create_webm_buttons()
            }, true, "old-prev/next-button"
        ),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.wallpaper-slideshow")}`, 'wallpaperSlide', 'wallpaperSlidebox',
            () => {
                restartAfterChange("wallpaperSlide", "wallpaper-slideshow")
            }, true, "wallpaper-slideshow"
        ),
        UI.createRow("slideTimeRow", [
            UI.createLabel(await getString("theme-settings.change-slide-delay"), ""),
            UI.createSearchBox("wallpaper-change-slide-time"),
        ]),
        UI.createCheckBox(
            `${await getString("theme-settings.disable-theme-wallpaper")}`, "disablethemewallpaper", "disablethemewallpaperbox", () => {
                let wallpaperController: HTMLElement | null = document.querySelector(".wallpaper-controls")
                let video: HTMLVideoElement | null = document.getElementById("elaina-bg") as HTMLVideoElement | null
                let imgWallpaper: HTMLImageElement | null = document.getElementById("elaina-static-bg") as HTMLImageElement | null

                if (!ElainaData.get("disable-theme-wallpaper")) {
                    setWallpaper()
                    setImageWallpaper()
                    wallpaperPlayPause()
                    if (wallpaperController) wallpaperController.style.display = "flex"
                }
                else {
                    if (video) video.src = ''
                    if (imgWallpaper) imgWallpaper.src = ''
                    if (wallpaperController) wallpaperController.style.display = "none"
                }
                setWindowEffectsSettingsVisibility()
                applyWindowEffect()
            }, true, "disable-theme-wallpaper"
        ),
        await windowEffectsRow(),
    ])
}
