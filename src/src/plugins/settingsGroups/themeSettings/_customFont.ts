import { UI } from "../settingsUI.ts"
import { log } from "../../../utils/themeLog.ts"
import { addCss } from '../../../theme/loadCustomCss';

/**
 * Đồng bộ chế độ font (local/google) - chỉ cho phép 1 chế độ hoạt động
 */
function syncExclusiveFontMode(mode: "local" | "google") {
    ElainaData.set("Custom-Font-Local", mode === "local");
    ElainaData.set("Custom-Font-Google", mode === "google");

    const localBox = document.getElementById("cusfontlocalbox") as HTMLInputElement | null;
    const googleBox = document.getElementById("cusfontgooglebox") as HTMLInputElement | null;
    const localOrigin = document.getElementById("cusfontlocal");
    const googleOrigin = document.getElementById("cusfontgoogle");

    if (localBox) localBox.checked = mode === "local";
    if (googleBox) googleBox.checked = mode === "google";
    if (localOrigin) localOrigin.classList.toggle("checked", mode === "local");
    if (googleOrigin) googleOrigin.classList.toggle("checked", mode === "google");
}

/**
 * Tạo dropdown chọn font local từ danh sách font
 */
function createFontDropdown(): HTMLElement {
    const items = ElainaData.get("Font-list").map((f: string) => ({
        label: f, value: f
    }))
    return UI.createDropdown(items, ElainaData.get("CurrentFont"), {
        datastoreKey: "CurrentFont",
        onChange: (item) => {
            if (ElainaData.get("Custom-Font") && !ElainaData.get("Custom-Font-Google")) {
                addCss.customFont()
                log("Font changed to: " + item.value)
            }
        }
    })
}

// ===== UI Export =====

export async function customFontSection(): Promise<HTMLElement[]> {
    const br = () => document.createElement("br")

    // Khởi tạo state ban đầu
    if (ElainaData.get("Custom-Font-Local") === ElainaData.get("Custom-Font-Google")) {
        syncExclusiveFontMode("local")
    }

    // Tạo Google Font input
    const googleFontInput = UI.createInputElement(
        "Google-Font-Url",
        "margin-bottom: 12px; width: 420px; max-width: 100%;",
        async () => {
            ElainaData.set("Google-Font-Url", googleFontInput.searchbox.value.trim());
            addCss.customFont();
        }
    );
    googleFontInput.searchbox.value = ElainaData.get("Google-Font-Url") || "";
    googleFontInput.searchbox.placeholder = "https://fonts.googleapis.com/css2?family=Roboto&display=swap";

    // Tạo các row cho local/google font
    const localFontRow = UI.createRow("custom-font-local-row", [
        createFontDropdown(),
    ]);
    const googleFontRow = UI.createRow("custom-font-google-row", [
        UI.createLabel(await getString("theme-settings.google-font-url"), ""),
        googleFontInput.origin,
    ]);

    const updateVisibility = () => {
        localFontRow.style.display = ElainaData.get("Custom-Font-Local") ? "" : "none";
        googleFontRow.style.display = ElainaData.get("Custom-Font-Google") ? "" : "none";
    };
    updateVisibility();

    return [
        UI.createCheckBox(
            await getString("theme-settings.custom-font"), "cusfont", "cusfontbox",
            async () => {
                addCss.customFont();
            }, true, "Custom-Font"
        ),
        br(),
        UI.createRow("custom-font-mode-row", [
            UI.createCheckBox(
                await getString("theme-settings.custom-font-local"), "cusfontlocal", "cusfontlocalbox",
                async () => {
                    syncExclusiveFontMode("local");
                    updateVisibility();
                    addCss.customFont();
                }, true, "Custom-Font-Local"
            ),
            UI.createCheckBox(
                await getString("theme-settings.custom-font-google"), "cusfontgoogle", "cusfontgooglebox",
                async () => {
                    syncExclusiveFontMode("google");
                    updateVisibility();
                    addCss.customFont();
                }, true, "Custom-Font-Google"
            ),
        ]),
        br(),
        localFontRow,
        googleFontRow,
        br(),
    ]
}
