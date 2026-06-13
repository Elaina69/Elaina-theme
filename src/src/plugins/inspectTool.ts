import utils from "../utils/utils.ts";
import { fileSystem } from "../utils/fileSystem.ts";
import { ElainaData } from "../utils/themeDataStore.ts";
import { error, warn } from "../utils/themeLog.ts";

type ModalState = {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    minimized?: boolean;
};

type CssPropertyDefinition = {
    property: string;
    group: string;
    input?: "text" | "color" | "select";
    options?: string[];
    placeholder?: string;
};

type AssetItem = {
    element: Element;
    selector: string;
    property: string;
    url: string;
    kind: "image" | "background";
};

const TOOL_OPEN_KEY = "inspect-tool";
const CSS_DATASTORE_KEY = "InspectTool-CSS";
const MODAL_STATE_KEY = "InspectTool-Modal-State";
const CSS_FILE_PATH = "./data/InspectTool.css";

const SAVED_STYLE_ID = "inspect-tool-user-css";
const PREVIEW_STYLE_ID = "inspect-tool-preview-css";
const TOOL_UI_STYLE_ID = "inspect-tool-ui";

const URL_RE = /url\((['"]?)([^'")]+)\1\)/g;
const SKIP_PROPS = new Set([
    "animation-delay",
    "animation-direction",
    "animation-duration",
    "animation-fill-mode",
    "animation-iteration-count",
    "animation-name",
    "animation-play-state",
    "animation-timing-function",
    "block-size",
    "border-block-end-color",
    "border-block-end-style",
    "border-block-end-width",
    "border-block-start-color",
    "border-block-start-style",
    "border-block-start-width",
    "border-inline-end-color",
    "border-inline-end-style",
    "border-inline-end-width",
    "border-inline-start-color",
    "border-inline-start-style",
    "border-inline-start-width",
    "column-rule-color",
    "direction",
    "inline-size",
    "inset-block-end",
    "inset-block-start",
    "inset-inline-end",
    "inset-inline-start",
    "margin-block-end",
    "margin-block-start",
    "margin-inline-end",
    "margin-inline-start",
    "min-block-size",
    "min-inline-size",
    "perspective-origin",
    "padding-block-end",
    "padding-block-start",
    "padding-inline-end",
    "padding-inline-start",
    "text-decoration-color",
    "text-decoration-line",
    "text-decoration-style",
    "text-decoration-thickness",
    "text-emphasis-color",
    "transform-origin",
    "unicode-bidi",
    "writing-mode",
]);

const ALWAYS_INCLUDE = new Set([
    "background-color",
    "background-image",
    "background-position",
    "background-repeat",
    "background-size",
    "border-color",
    "border-radius",
    "border-style",
    "border-width",
    "box-shadow",
    "color",
    "display",
    "filter",
    "font-family",
    "font-size",
    "font-weight",
    "height",
    "margin",
    "opacity",
    "overflow",
    "padding",
    "position",
    "text-shadow",
    "transform",
    "visibility",
    "width",
    "z-index",
]);

const PROPERTY_CATALOG: CssPropertyDefinition[] = [
    { property: "color", group: "Color", input: "color", placeholder: "#c8aa6e" },
    { property: "background-color", group: "Color", input: "color", placeholder: "#000000" },
    { property: "background-image", group: "Background", placeholder: "url(...)" },
    { property: "background-size", group: "Background", input: "select", options: ["cover", "contain", "100% 100%", "auto"] },
    { property: "background-position", group: "Background", placeholder: "center" },
    { property: "background-repeat", group: "Background", input: "select", options: ["no-repeat", "repeat", "repeat-x", "repeat-y"] },
    { property: "border", group: "Border", placeholder: "1px solid #c8aa6e" },
    { property: "border-radius", group: "Border", placeholder: "8px" },
    { property: "box-shadow", group: "Border", placeholder: "0 0 12px #c8aa6e" },
    { property: "margin", group: "Spacing", placeholder: "0" },
    { property: "padding", group: "Spacing", placeholder: "8px" },
    { property: "width", group: "Layout", placeholder: "100%" },
    { property: "height", group: "Layout", placeholder: "100%" },
    { property: "display", group: "Layout", input: "select", options: ["block", "flex", "grid", "inline-block", "none"] },
    { property: "position", group: "Layout", input: "select", options: ["static", "relative", "absolute", "fixed", "sticky"] },
    { property: "top", group: "Layout", placeholder: "0" },
    { property: "right", group: "Layout", placeholder: "0" },
    { property: "bottom", group: "Layout", placeholder: "0" },
    { property: "left", group: "Layout", placeholder: "0" },
    { property: "z-index", group: "Layout", placeholder: "1" },
    { property: "overflow", group: "Layout", input: "select", options: ["visible", "hidden", "auto", "scroll"] },
    { property: "font-family", group: "Typography", placeholder: "Custom, sans-serif" },
    { property: "font-size", group: "Typography", placeholder: "14px" },
    { property: "font-weight", group: "Typography", input: "select", options: ["400", "500", "600", "700", "bold"] },
    { property: "text-align", group: "Typography", input: "select", options: ["left", "center", "right", "justify"] },
    { property: "text-shadow", group: "Typography", placeholder: "0 0 8px #000" },
    { property: "opacity", group: "Effects", placeholder: "0.85" },
    { property: "filter", group: "Effects", placeholder: "brightness(1.1)" },
    { property: "backdrop-filter", group: "Effects", placeholder: "blur(12px)" },
    { property: "transform", group: "Effects", placeholder: "scale(1)" },
    { property: "visibility", group: "Effects", input: "select", options: ["visible", "hidden"] },
    { property: "object-fit", group: "Assets", input: "select", options: ["cover", "contain", "fill", "none"] },
    { property: "object-position", group: "Assets", placeholder: "center" },
];

function isElementNode(node: unknown): node is Element {
    return !!node && typeof node === "object" && (node as Node).nodeType === 1;
}

function isIframeElement(element: Element): element is HTMLIFrameElement {
    return element.tagName.toLowerCase() === "iframe";
}

function cssEscape(value: string): string {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeRegExp(value: string): string {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCssValue(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return /!\s*important/i.test(trimmed) ? trimmed : `${trimmed} !important`;
}

function unique<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function getHeadHost(): HTMLElement {
    return document.getElementById("lol-uikit-layer-manager-wrapper") || document.body || document.documentElement;
}

class InspectTool {
    private initialized = false;
    private isOpen = false;
    private modal: HTMLElement | null = null;
    private panel: HTMLElement | null = null;
    private selectorInput: HTMLInputElement | null = null;
    private matchInfo: HTMLElement | null = null;
    private currentCssList: HTMLElement | null = null;
    private possibleCssList: HTMLElement | null = null;
    private assetsList: HTMLElement | null = null;
    private rawTextarea: HTMLTextAreaElement | null = null;
    private statusText: HTMLElement | null = null;
    private selectedElement: Element | null = null;
    private selectedSelector = "";
    private savedCss = "";
    private draftCss = "";
    private previewTimer: number | null = null;
    private pickerCleanup: (() => void) | null = null;
    private overlay: HTMLElement | null = null;
    private dragCleanup: (() => void) | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private defaultStyleCache: Record<string, string> | null = null;

    init = async (): Promise<void> => {
        if (this.initialized) return;
        this.initialized = true;

        this.installToolStyle();
        this.installHotkey();
        await this.applySavedCss();

        if (ElainaData.get("Dev-mode")) {
            (window as any).elainaInspectTool = this;
        }

        if (ElainaData.get(TOOL_OPEN_KEY)) {
            this.open();
        }
    };

    applySavedCss = async (): Promise<void> => {
        this.savedCss = await this.loadSavedCss();
        utils.styleEngine.apply(SAVED_STYLE_ID, this.savedCss, {
            document: true,
            shadow: true,
            iframe: true,
        });
    };

    saveCss = async (css: string): Promise<void> => {
        this.savedCss = String(css || "");

        let saved = false;
        if (window.isContextFSExist) {
            try {
                await fileSystem.mkdir("./data");
                saved = await fileSystem.write(CSS_FILE_PATH, this.savedCss, false);
            } catch (err: any) {
                error("Failed to save InspectTool.css", err);
            }
        }

        if (!saved) {
            ElainaData.set(CSS_DATASTORE_KEY, this.savedCss);
        }

        utils.styleEngine.apply(SAVED_STYLE_ID, this.savedCss, {
            document: true,
            shadow: true,
            iframe: true,
        });
        utils.styleEngine.remove(PREVIEW_STYLE_ID);
        this.setStatus(saved ? "Saved to ./data/InspectTool.css" : "Saved to DataStore fallback");
    };

    toggle = (force?: boolean): void => {
        const shouldOpen = typeof force === "boolean" ? force : !this.isOpen;
        if (shouldOpen) this.open();
        else this.close();
    };

    open = (): void => {
        if (this.isOpen) return;
        this.isOpen = true;
        ElainaData.set(TOOL_OPEN_KEY, true);
        this.syncSettingsCheckbox(true);
        this.createModal();
        this.setStatus("Inspect Tool ready. Pick an element or edit raw CSS.");
    };

    close = (): void => {
        if (!this.isOpen) return;
        this.isOpen = false;
        ElainaData.set(TOOL_OPEN_KEY, false);
        this.syncSettingsCheckbox(false);
        this.stopPicker();
        utils.styleEngine.remove(PREVIEW_STYLE_ID);
        this.saveModalState();
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.dragCleanup?.();
        this.dragCleanup = null;
        this.modal?.remove();
        this.modal = null;
        this.panel = null;
    };

    private installHotkey(): void {
        window.addEventListener("keydown", (event) => {
            if (!event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
            if (event.key.toLowerCase() !== "i") return;

            event.preventDefault();
            event.stopPropagation();
            this.toggle();
        }, true);
    }

    private async loadSavedCss(): Promise<string> {
        if (window.isContextFSExist) {
            try {
                const fileCss = await fileSystem.read(CSS_FILE_PATH);
                if (typeof fileCss === "string") return fileCss;
            } catch (err: any) {
                warn("InspectTool.css is not readable, using DataStore fallback", err);
            }
        }

        return String(ElainaData.get(CSS_DATASTORE_KEY, "") || "");
    }

    private installToolStyle(): void {
        utils.styleEngine.apply(TOOL_UI_STYLE_ID, /*css*/`
            #elaina-inspect-tool {
                position: fixed;
                inset: 0;
                z-index: 99990;
                pointer-events: none;
                color: #d8d0bd;
                font-family: Arial, Helvetica, sans-serif;
            }

            #elaina-inspect-tool .eit-panel {
                position: fixed;
                width: 920px;
                height: 620px;
                min-width: 620px;
                min-height: 390px;
                max-width: calc(100vw - 28px);
                max-height: calc(100vh - 28px);
                background: rgba(8, 14, 24, 0.96);
                border: 1px solid #785a28;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.55);
                resize: both;
                overflow: hidden;
                pointer-events: auto;
            }

            #elaina-inspect-tool .eit-panel.minimized {
                height: 42px !important;
                min-height: 42px;
                resize: none;
            }

            #elaina-inspect-tool .eit-header {
                display: flex;
                align-items: center;
                gap: 8px;
                height: 42px;
                padding: 0 10px;
                background: #0e1828;
                border-bottom: 1px solid #2f2618;
                cursor: move;
                user-select: none;
            }

            #elaina-inspect-tool .eit-title {
                flex: 1;
                min-width: 0;
                color: #f0d69a;
                font-size: 13px;
                font-weight: 700;
                text-transform: uppercase;
            }

            #elaina-inspect-tool .eit-btn {
                border: 1px solid #785a28;
                background: #111d2d;
                color: #d8d0bd;
                min-height: 26px;
                padding: 3px 9px;
                font-size: 11px;
                cursor: pointer;
            }

            #elaina-inspect-tool .eit-btn:hover {
                background: #1c2b3f;
                color: #f0d69a;
            }

            #elaina-inspect-tool .eit-body {
                display: grid;
                grid-template-columns: minmax(280px, 38%) 1fr;
                height: calc(100% - 42px);
                min-height: 0;
            }

            #elaina-inspect-tool .minimized .eit-body {
                display: none;
            }

            #elaina-inspect-tool .eit-left,
            #elaina-inspect-tool .eit-right {
                min-height: 0;
                overflow: auto;
            }

            #elaina-inspect-tool .eit-left {
                border-right: 1px solid #1d2a3b;
            }

            #elaina-inspect-tool .eit-section {
                border-bottom: 1px solid #1d2a3b;
                padding: 10px;
            }

            #elaina-inspect-tool .eit-section-title {
                color: #c8aa6e;
                font-size: 11px;
                font-weight: 700;
                margin: 0 0 8px;
                text-transform: uppercase;
            }

            #elaina-inspect-tool .eit-row {
                display: grid;
                grid-template-columns: minmax(92px, 34%) 1fr auto auto;
                gap: 6px;
                align-items: center;
                margin-bottom: 6px;
            }

            #elaina-inspect-tool .eit-label,
            #elaina-inspect-tool .eit-muted {
                color: #8ea0b4;
                font-size: 11px;
                overflow-wrap: anywhere;
            }

            #elaina-inspect-tool .eit-input,
            #elaina-inspect-tool .eit-select,
            #elaina-inspect-tool .eit-textarea {
                box-sizing: border-box;
                width: 100%;
                border: 1px solid #26384e;
                background: #07101d;
                color: #e4dccb;
                font-family: Consolas, "Courier New", monospace;
                font-size: 11px;
                min-height: 26px;
                padding: 4px 6px;
            }

            #elaina-inspect-tool input[type="color"].eit-input {
                padding: 1px;
            }

            #elaina-inspect-tool .eit-target-row {
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: 6px;
            }

            #elaina-inspect-tool .eit-list {
                max-height: 180px;
                overflow: auto;
                padding-right: 2px;
            }

            #elaina-inspect-tool .eit-assets .eit-row {
                grid-template-columns: 1fr;
                border: 1px solid #1d2a3b;
                padding: 6px;
            }

            #elaina-inspect-tool .eit-asset-actions {
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: 6px;
                margin-top: 6px;
            }

            #elaina-inspect-tool .eit-right {
                display: flex;
                flex-direction: column;
            }

            #elaina-inspect-tool .eit-toolbar {
                display: flex;
                gap: 6px;
                align-items: center;
                padding: 10px;
                border-bottom: 1px solid #1d2a3b;
            }

            #elaina-inspect-tool .eit-status {
                flex: 1;
                min-width: 0;
                color: #8ea0b4;
                font-size: 11px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #elaina-inspect-tool .eit-textarea {
                flex: 1;
                min-height: 0;
                resize: none;
                border: 0;
                border-radius: 0;
                line-height: 1.45;
                padding: 12px;
            }

            #elaina-inspect-highlight {
                position: fixed;
                z-index: 99999;
                pointer-events: none;
                border: 2px solid #c8aa6e;
                background: rgba(200, 170, 110, 0.16);
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.18);
            }

            #elaina-inspect-highlight .eit-highlight-label {
                position: absolute;
                left: 0;
                top: -30px;
                max-width: 420px;
                padding: 4px 7px;
                background: #07101d;
                border: 1px solid #c8aa6e;
                color: #f0d69a;
                font: 11px Consolas, "Courier New", monospace;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        `);
    }

    private createModal(): void {
        if (this.modal) {
            this.modal.hidden = false;
            return;
        }

        this.draftCss = this.savedCss;

        const root = document.createElement("div");
        root.id = "elaina-inspect-tool";
        root.setAttribute("data-elaina-inspect-tool", "true");

        const panel = document.createElement("div");
        panel.className = "eit-panel";
        panel.setAttribute("data-elaina-inspect-tool", "true");
        this.applyModalState(panel);

        panel.innerHTML = `
            <div class="eit-header" data-elaina-inspect-tool="true">
                <div class="eit-title">Elaina Inspect Tool</div>
                <button class="eit-btn" data-action="pick">Inspect</button>
                <button class="eit-btn" data-action="refresh">Refresh</button>
                <button class="eit-btn" data-action="minimize">_</button>
                <button class="eit-btn" data-action="close">Close</button>
            </div>
            <div class="eit-body">
                <div class="eit-left">
                    <div class="eit-section">
                        <div class="eit-section-title">Target</div>
                        <div class="eit-target-row">
                            <input class="eit-input" id="eit-selector" placeholder="Pick or enter a selector">
                            <button class="eit-btn" data-action="copy-selector">Copy</button>
                            <button class="eit-btn" data-action="select-selector">Use</button>
                        </div>
                        <div class="eit-muted" id="eit-match-info">No element selected.</div>
                    </div>
                    <div class="eit-section">
                        <div class="eit-section-title">Current CSS</div>
                        <div class="eit-list" id="eit-current-css"></div>
                    </div>
                    <div class="eit-section">
                        <div class="eit-section-title">Possible CSS</div>
                        <div class="eit-list" id="eit-possible-css"></div>
                    </div>
                    <div class="eit-section eit-assets">
                        <div class="eit-section-title">Assets</div>
                        <div class="eit-list" id="eit-assets"></div>
                    </div>
                </div>
                <div class="eit-right">
                    <div class="eit-toolbar">
                        <button class="eit-btn" data-action="save">Save</button>
                        <button class="eit-btn" data-action="revert">Revert</button>
                        <button class="eit-btn" data-action="apply-preview">Preview</button>
                        <div class="eit-status" id="eit-status"></div>
                    </div>
                    <textarea class="eit-textarea" id="eit-raw-css" spellcheck="false"></textarea>
                </div>
            </div>
        `;

        root.appendChild(panel);
        getHeadHost().appendChild(root);

        this.modal = root;
        this.panel = panel;
        this.selectorInput = panel.querySelector("#eit-selector");
        this.matchInfo = panel.querySelector("#eit-match-info");
        this.currentCssList = panel.querySelector("#eit-current-css");
        this.possibleCssList = panel.querySelector("#eit-possible-css");
        this.assetsList = panel.querySelector("#eit-assets");
        this.rawTextarea = panel.querySelector("#eit-raw-css");
        this.statusText = panel.querySelector("#eit-status");

        if (this.rawTextarea) {
            this.rawTextarea.value = this.draftCss;
            this.rawTextarea.addEventListener("input", () => {
                this.draftCss = this.rawTextarea?.value || "";
                this.schedulePreview();
            });
        }

        panel.querySelector<HTMLElement>('[data-action="pick"]')?.addEventListener("click", () => this.startPicker());
        panel.querySelector<HTMLElement>('[data-action="refresh"]')?.addEventListener("click", () => this.refreshSelection());
        panel.querySelector<HTMLElement>('[data-action="copy-selector"]')?.addEventListener("click", () => this.copySelector());
        panel.querySelector<HTMLElement>('[data-action="select-selector"]')?.addEventListener("click", () => this.selectByCurrentSelector());
        panel.querySelector<HTMLElement>('[data-action="save"]')?.addEventListener("click", () => void this.saveCurrentDraft());
        panel.querySelector<HTMLElement>('[data-action="revert"]')?.addEventListener("click", () => this.revertDraft());
        panel.querySelector<HTMLElement>('[data-action="apply-preview"]')?.addEventListener("click", () => this.previewDraft());
        panel.querySelector<HTMLElement>('[data-action="minimize"]')?.addEventListener("click", () => this.toggleMinimized());
        panel.querySelector<HTMLElement>('[data-action="close"]')?.addEventListener("click", () => this.close());

        this.installDrag(panel);
        this.installResizeObserver(panel);
    }

    private applyModalState(panel: HTMLElement): void {
        const state = this.getModalState();
        const width = Math.max(620, Number(state.width) || 920);
        const height = Math.max(390, Number(state.height) || 620);
        const left = Math.max(14, Math.min(Number(state.left) || 80, window.innerWidth - 120));
        const top = Math.max(14, Math.min(Number(state.top) || 70, window.innerHeight - 80));

        panel.style.width = `${width}px`;
        panel.style.height = `${height}px`;
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        if (state.minimized) panel.classList.add("minimized");
    }

    private getModalState(): ModalState {
        const value = ElainaData.get(MODAL_STATE_KEY, {});
        return value && typeof value === "object" ? value : {};
    }

    private saveModalState(): void {
        if (!this.panel) return;

        const rect = this.panel.getBoundingClientRect();
        ElainaData.set(MODAL_STATE_KEY, {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            minimized: this.panel.classList.contains("minimized"),
        });
    }

    private installDrag(panel: HTMLElement): void {
        const header = panel.querySelector<HTMLElement>(".eit-header");
        if (!header) return;

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        const onMouseMove = (event: MouseEvent) => {
            if (!dragging) return;
            const nextLeft = Math.max(0, Math.min(startLeft + event.clientX - startX, window.innerWidth - 80));
            const nextTop = Math.max(0, Math.min(startTop + event.clientY - startY, window.innerHeight - 42));
            panel.style.left = `${nextLeft}px`;
            panel.style.top = `${nextTop}px`;
        };

        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            this.saveModalState();
        };

        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest("button, input, textarea, select")) return;
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
            startLeft = panel.getBoundingClientRect().left;
            startTop = panel.getBoundingClientRect().top;
            event.preventDefault();
        };

        header.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        this.dragCleanup = () => {
            header.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }

    private installResizeObserver(panel: HTMLElement): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = new ResizeObserver(() => this.saveModalState());
        this.resizeObserver.observe(panel);
    }

    private toggleMinimized(): void {
        this.panel?.classList.toggle("minimized");
        this.saveModalState();
    }

    private syncSettingsCheckbox(open: boolean): void {
        const checkbox = document.getElementById("inspecttoolbox") as HTMLInputElement | null;
        const origin = document.getElementById("inspecttool");
        if (!checkbox || !origin) return;

        checkbox.checked = open;
        if (open) origin.setAttribute("class", "checked");
        else origin.removeAttribute("class");
    }

    private setStatus(message: string): void {
        if (this.statusText) this.statusText.textContent = message;
    }

    private schedulePreview(): void {
        if (this.previewTimer) window.clearTimeout(this.previewTimer);
        this.previewTimer = window.setTimeout(() => this.previewDraft(), 180);
    }

    private previewDraft(): void {
        utils.styleEngine.apply(PREVIEW_STYLE_ID, this.draftCss, {
            document: true,
            shadow: true,
            iframe: true,
        });
        this.setStatus("Preview applied. Save to persist or Revert to discard.");
    }

    private async saveCurrentDraft(): Promise<void> {
        this.draftCss = this.rawTextarea?.value || "";
        await this.saveCss(this.draftCss);
    }

    private revertDraft(): void {
        this.draftCss = this.savedCss;
        if (this.rawTextarea) this.rawTextarea.value = this.savedCss;
        utils.styleEngine.remove(PREVIEW_STYLE_ID);
        this.refreshSelection();
        this.setStatus("Preview reverted. Saved CSS is still active.");
    }

    private startPicker(): void {
        this.stopPicker();

        const overlay = document.createElement("div");
        overlay.id = "elaina-inspect-highlight";
        overlay.setAttribute("data-elaina-inspect-tool", "true");
        overlay.hidden = true;
        const label = document.createElement("div");
        label.className = "eit-highlight-label";
        overlay.appendChild(label);
        document.body.appendChild(overlay);
        this.overlay = overlay;

        let currentTarget: Element | null = null;
        const docs = this.getAccessibleDocuments();

        const onMove = (event: MouseEvent) => {
            const element = this.getEventElement(event);
            if (!element || this.isToolElement(element)) return;
            currentTarget = element;
            this.renderHighlight(element);
        };

        const onClick = (event: MouseEvent) => {
            if (!currentTarget) return;
            event.preventDefault();
            event.stopPropagation();
            this.selectElement(currentTarget);
            this.stopPicker();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            this.stopPicker();
        };

        for (const doc of docs) {
            doc.addEventListener("mousemove", onMove, true);
            doc.addEventListener("click", onClick, true);
            doc.addEventListener("keydown", onKeyDown, true);
        }

        this.pickerCleanup = () => {
            for (const doc of docs) {
                doc.removeEventListener("mousemove", onMove, true);
                doc.removeEventListener("click", onClick, true);
                doc.removeEventListener("keydown", onKeyDown, true);
            }
            overlay.remove();
            this.overlay = null;
        };

        this.setStatus("Picker active. Click an element, or press Esc to cancel.");
    }

    private stopPicker(): void {
        this.pickerCleanup?.();
        this.pickerCleanup = null;
    }

    private getAccessibleDocuments(): Document[] {
        const docs: Document[] = [document];

        const scan = (doc: Document) => {
            for (const iframe of Array.from(doc.querySelectorAll("iframe"))) {
                try {
                    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!frameDoc || docs.includes(frameDoc)) continue;
                    docs.push(frameDoc);
                    scan(frameDoc);
                } catch {}
            }
        };

        scan(document);
        return docs;
    }

    private getEventElement(event: Event): Element | null {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        for (const item of path) {
            if (isElementNode(item) && !this.isToolElement(item)) return item;
        }

        const target = event.target;
        return isElementNode(target) && !this.isToolElement(target) ? target : null;
    }

    private isToolElement(element: Element): boolean {
        return !!element.closest?.("[data-elaina-inspect-tool], #elaina-inspect-highlight");
    }

    private renderHighlight(element: Element): void {
        if (!this.overlay) return;

        const rect = element.getBoundingClientRect();
        if (!rect.width && !rect.height) return;

        const offset = this.getDocumentOffset(element.ownerDocument);
        const selector = this.buildSelector(element);

        this.overlay.hidden = false;
        this.overlay.style.left = `${rect.left + offset.left}px`;
        this.overlay.style.top = `${rect.top + offset.top}px`;
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;

        const label = this.overlay.querySelector<HTMLElement>(".eit-highlight-label");
        if (label) label.textContent = selector;
    }

    private getDocumentOffset(targetDocument: Document): { left: number; top: number } {
        let left = 0;
        let top = 0;
        let win = targetDocument.defaultView;

        try {
            while (win?.frameElement) {
                const frame = win.frameElement as HTMLElement;
                const rect = frame.getBoundingClientRect();
                left += rect.left;
                top += rect.top;
                win = frame.ownerDocument.defaultView;
            }
        } catch {}

        return { left, top };
    }

    private selectElement(element: Element): void {
        this.selectedElement = element;
        this.selectedSelector = this.buildSelector(element);
        if (this.selectorInput) this.selectorInput.value = this.selectedSelector;
        this.refreshSelection();
    }

    private selectByCurrentSelector(): void {
        const selector = this.selectorInput?.value.trim();
        if (!selector) return;

        const element = this.piercingQuerySelectorAll(selector)[0];
        if (!element) {
            this.selectedElement = null;
            this.selectedSelector = selector;
            this.refreshSelection();
            return;
        }

        this.selectedElement = element;
        this.selectedSelector = selector;
        this.refreshSelection();
    }

    private refreshSelection(): void {
        const selector = this.selectorInput?.value.trim() || this.selectedSelector;
        if (selector) this.selectedSelector = selector;

        const matches = selector ? this.piercingQuerySelectorAll(selector) : [];
        if (!this.selectedElement || (selector && !matches.includes(this.selectedElement))) {
            this.selectedElement = matches[0] || null;
        }

        if (this.matchInfo) {
            if (!selector) this.matchInfo.textContent = "No element selected.";
            else this.matchInfo.textContent = `${matches.length} matching element${matches.length === 1 ? "" : "s"}`;
        }

        this.renderCssLists();
        this.renderAssets();
    }

    private copySelector(): void {
        const selector = this.selectorInput?.value.trim() || this.selectedSelector;
        if (!selector) return;

        void navigator.clipboard?.writeText(selector).then(
            () => this.setStatus("Selector copied."),
            () => this.setStatus("Clipboard is unavailable.")
        );
    }

    private buildSelector(element: Element): string {
        const id = element.getAttribute("id");
        if (id && !/^ember\d+$/i.test(id)) return `#${cssEscape(id)}`;

        const dataAttrNames = ["data-testid", "data-test-id", "data-dd-action-name", "data-screen-name", "data-ui", "data-id"];
        for (const attr of dataAttrNames) {
            const value = element.getAttribute(attr);
            if (value) return `${element.tagName.toLowerCase()}[${attr}="${utils.escapeCssString(value)}"]`;
        }

        const classNames = Array.from(element.classList)
            .filter(cls => cls && !/^ember/.test(cls))
            .slice(0, 3);

        const simple = `${element.tagName.toLowerCase()}${classNames.map(cls => `.${cssEscape(cls)}`).join("")}`;
        if (this.countInRoot(element, simple) === 1) return simple;

        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current.tagName.toLowerCase() !== "html") {
            const tag = current.tagName.toLowerCase();
            const currentId = current.getAttribute("id");
            if (currentId && !/^ember\d+$/i.test(currentId)) {
                parts.unshift(`#${cssEscape(currentId)}`);
                break;
            }

            const stableClasses = Array.from(current.classList)
                .filter(cls => cls && !/^ember/.test(cls))
                .slice(0, 2);

            let part = `${tag}${stableClasses.map(cls => `.${cssEscape(cls)}`).join("")}`;
            const parent = current.parentElement;
            if (parent) {
                const sameTag = Array.from(parent.children as HTMLCollectionOf<Element>).filter(child => child.tagName === current!.tagName);
                if (sameTag.length > 1) {
                    part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
                }
            }

            parts.unshift(part);
            const selector = parts.join(" > ");
            if (this.countInRoot(element, selector) === 1) return selector;

            current = parent;
        }

        return parts.join(" > ") || simple;
    }

    private countInRoot(element: Element, selector: string): number {
        try {
            const root = element.getRootNode() as Document | ShadowRoot;
            return root.querySelectorAll(selector).length;
        } catch {
            return 0;
        }
    }

    private piercingQuerySelectorAll(selector: string): Element[] {
        const results: Element[] = [];
        const visitedDocuments = new Set<Document>();

        const scanRoot = (root: Document | ShadowRoot) => {
            try {
                root.querySelectorAll(selector).forEach(element => results.push(element));
            } catch {
                return;
            }

            let allElements: Element[] = [];
            try {
                allElements = Array.from(root.querySelectorAll("*"));
            } catch {}

            for (const element of allElements) {
                const shadowRoot = (element as HTMLElement).shadowRoot;
                if (shadowRoot) scanRoot(shadowRoot);
            }

            if ("querySelectorAll" in root) {
                for (const iframe of allElements.filter(isIframeElement)) {
                    try {
                        const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (!frameDoc || visitedDocuments.has(frameDoc)) continue;
                        visitedDocuments.add(frameDoc);
                        scanRoot(frameDoc);
                    } catch {}
                }
            }
        };

        visitedDocuments.add(document);
        scanRoot(document);
        return unique(results);
    }

    private renderCssLists(): void {
        if (!this.currentCssList || !this.possibleCssList) return;

        this.currentCssList.innerHTML = "";
        this.possibleCssList.innerHTML = "";

        if (!this.selectedElement || !this.selectedSelector) {
            this.currentCssList.appendChild(this.createMuted("Pick an element to inspect computed CSS."));
            this.possibleCssList.appendChild(this.createMuted("Pick an element to add CSS declarations."));
            return;
        }

        const currentProps = this.getCurrentCssProperties(this.selectedElement);
        const currentSet = new Set(currentProps.map(item => item.property));

        if (!currentProps.length) {
            this.currentCssList.appendChild(this.createMuted("No non-default computed CSS detected."));
        } else {
            for (const item of currentProps.slice(0, 80)) {
                this.currentCssList.appendChild(this.createPropertyRow(item.property, item.value));
            }
        }

        const possible = PROPERTY_CATALOG.filter(item => !currentSet.has(item.property));
        for (const definition of possible) {
            this.possibleCssList.appendChild(this.createPropertyRow(definition.property, "", definition));
        }
    }

    private getDefaultStyles(doc: Document): Record<string, string> {
        if (this.defaultStyleCache) return this.defaultStyleCache;

        const element = doc.createElement("div");
        (doc.body || doc.documentElement).appendChild(element);
        const style = doc.defaultView?.getComputedStyle(element);
        const defaults: Record<string, string> = {};

        if (style) {
            for (let i = 0; i < style.length; i++) {
                const prop = style[i];
                defaults[prop] = style.getPropertyValue(prop).trim();
            }
        }

        element.remove();
        this.defaultStyleCache = defaults;
        return defaults;
    }

    private getCurrentCssProperties(element: Element): { property: string; value: string }[] {
        const doc = element.ownerDocument;
        const style = doc.defaultView?.getComputedStyle(element);
        if (!style) return [];

        const defaults = this.getDefaultStyles(doc);
        const items: { property: string; value: string }[] = [];

        for (let i = 0; i < style.length; i++) {
            const property = style[i];
            if (SKIP_PROPS.has(property)) continue;

            const value = style.getPropertyValue(property).trim();
            if (!value) continue;

            if (ALWAYS_INCLUDE.has(property) || value !== defaults[property]) {
                items.push({ property, value });
            }
        }

        return items.sort((a, b) => a.property.localeCompare(b.property));
    }

    private createPropertyRow(property: string, value = "", definition?: CssPropertyDefinition): HTMLElement {
        const row = document.createElement("div");
        row.className = "eit-row";

        const label = document.createElement("div");
        label.className = "eit-label";
        label.textContent = property;

        const input = this.createPropertyInput(definition || PROPERTY_CATALOG.find(item => item.property === property), value);

        const setButton = document.createElement("button");
        setButton.className = "eit-btn";
        setButton.textContent = "Set";
        setButton.addEventListener("click", () => {
            this.setDeclaration(property, input.value);
        });

        const clearButton = document.createElement("button");
        clearButton.className = "eit-btn";
        clearButton.textContent = "Clear";
        clearButton.addEventListener("click", () => {
            input.value = "";
            this.setDeclaration(property, "");
        });

        row.append(label, input, setButton, clearButton);
        return row;
    }

    private createPropertyInput(definition: CssPropertyDefinition | undefined, value: string): HTMLInputElement | HTMLSelectElement {
        if (definition?.input === "select") {
            const select = document.createElement("select");
            select.className = "eit-select";
            const empty = document.createElement("option");
            empty.value = "";
            empty.textContent = "";
            select.appendChild(empty);
            for (const option of definition.options || []) {
                const item = document.createElement("option");
                item.value = option;
                item.textContent = option;
                select.appendChild(item);
            }
            select.value = value;
            return select;
        }

        const input = document.createElement("input");
        input.className = "eit-input";
        const canUseColorInput = definition?.input === "color" && (!value || /^#[0-9a-f]{6}$/i.test(value));
        input.type = canUseColorInput ? "color" : "text";
        input.placeholder = definition?.placeholder || "";
        input.value = value;
        if (input.type === "color" && !input.value) input.value = "#c8aa6e";
        return input;
    }

    private setDeclaration(property: string, value: string): void {
        if (!this.selectedSelector) return;

        this.draftCss = this.upsertDeclaration(this.rawTextarea?.value || this.draftCss, this.selectedSelector, property, value);
        if (this.rawTextarea) this.rawTextarea.value = this.draftCss;
        this.previewDraft();
        this.refreshSelection();
    }

    private upsertDeclaration(css: string, selector: string, property: string, value: string): string {
        const normalizedValue = normalizeCssValue(value);
        const blockPattern = new RegExp(`(${escapeRegExp(selector)}\\s*\\{)([\\s\\S]*?)(\\})`, "m");
        const declarationPattern = new RegExp(`\\s*${escapeRegExp(property)}\\s*:[^;]*;?`, "i");

        if (!blockPattern.test(css)) {
            if (!normalizedValue) return css;
            return `${css.trimEnd()}\n\n${selector} {\n    ${property}: ${normalizedValue};\n}\n`;
        }

        return css.replace(blockPattern, (_match, start, body, end) => {
            let nextBody = String(body);
            if (declarationPattern.test(nextBody)) {
                nextBody = normalizedValue
                    ? nextBody.replace(declarationPattern, `\n    ${property}: ${normalizedValue};`)
                    : nextBody.replace(declarationPattern, "");
            } else if (normalizedValue) {
                nextBody = `${nextBody.trimEnd()}\n    ${property}: ${normalizedValue};\n`;
            }

            return `${start}${nextBody}${end}`;
        });
    }

    private renderAssets(): void {
        if (!this.assetsList) return;
        this.assetsList.innerHTML = "";

        if (!this.selectedElement) {
            this.assetsList.appendChild(this.createMuted("Pick an element to extract image assets."));
            return;
        }

        const assets = this.collectAssets(this.selectedElement).slice(0, 60);
        if (!assets.length) {
            this.assetsList.appendChild(this.createMuted("No image asset found for this element."));
            return;
        }

        for (const asset of assets) {
            this.assetsList.appendChild(this.createAssetRow(asset));
        }
    }

    private collectAssets(element: Element): AssetItem[] {
        const assets: AssetItem[] = [];
        const seen = new Set<string>();

        const addAsset = (item: AssetItem) => {
            const fingerprint = `${item.selector}|${item.property}|${item.url}`;
            if (seen.has(fingerprint)) return;
            seen.add(fingerprint);
            assets.push(item);
        };

        const collectFromElement = (target: Element, selector: string) => {
            for (const attr of ["src", "poster", "data-src"]) {
                const value = target.getAttribute(attr);
                if (value) addAsset({ element: target, selector, property: attr, url: value, kind: "image" });
            }

            const srcset = target.getAttribute("srcset");
            if (srcset) {
                for (const part of srcset.split(",")) {
                    const url = part.trim().split(/\s+/)[0];
                    if (url) addAsset({ element: target, selector, property: "srcset", url, kind: "image" });
                }
            }

            const style = target.ownerDocument.defaultView?.getComputedStyle(target);
            if (style) {
                for (const prop of ["background-image", "content", "-webkit-mask-image", "-webkit-mask", "border-image-source"]) {
                    for (const url of this.extractUrls(style.getPropertyValue(prop))) {
                        addAsset({ element: target, selector, property: prop, url, kind: prop === "content" ? "image" : "background" });
                    }
                }
            }

            for (const pseudo of ["::before", "::after"]) {
                const pseudoStyle = target.ownerDocument.defaultView?.getComputedStyle(target, pseudo);
                if (!pseudoStyle) continue;

                for (const prop of ["background-image", "content", "-webkit-mask-image", "-webkit-mask", "border-image-source"]) {
                    for (const url of this.extractUrls(pseudoStyle.getPropertyValue(prop))) {
                        addAsset({ element: target, selector: `${selector}${pseudo}`, property: prop, url, kind: prop === "content" ? "image" : "background" });
                    }
                }
            }
        };

        collectFromElement(element, this.buildSelector(element));

        for (const child of Array.from(element.querySelectorAll("*")).slice(0, 80)) {
            collectFromElement(child, this.buildSelector(child));
        }

        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < 6) {
            collectFromElement(parent, this.buildSelector(parent));
            parent = parent.parentElement;
            depth++;
        }

        return assets;
    }

    private extractUrls(value: string): string[] {
        const urls: string[] = [];
        URL_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = URL_RE.exec(value))) {
            if (match[2]) urls.push(match[2]);
        }
        return urls;
    }

    private createAssetRow(asset: AssetItem): HTMLElement {
        const row = document.createElement("div");
        row.className = "eit-row";

        const meta = document.createElement("div");
        meta.className = "eit-muted";
        meta.textContent = `${asset.property}: ${asset.url}`;

        const selector = document.createElement("div");
        selector.className = "eit-muted";
        selector.textContent = asset.selector;

        const actions = document.createElement("div");
        actions.className = "eit-asset-actions";

        const input = document.createElement("input");
        input.className = "eit-input";
        input.placeholder = "New asset URL";

        const imageButton = document.createElement("button");
        imageButton.className = "eit-btn";
        imageButton.textContent = "Image";
        imageButton.addEventListener("click", () => this.addAssetReplacement(asset, input.value, "image"));

        const backgroundButton = document.createElement("button");
        backgroundButton.className = "eit-btn";
        backgroundButton.textContent = "Background";
        backgroundButton.addEventListener("click", () => this.addAssetReplacement(asset, input.value, "background"));

        actions.append(input, imageButton, backgroundButton);
        row.append(meta, selector, actions);
        return row;
    }

    private addAssetReplacement(asset: AssetItem, newUrl: string, mode: "image" | "background"): void {
        if (!newUrl.trim()) {
            this.setStatus("Enter a new asset URL first.");
            return;
        }

        const css = mode === "image"
            ? utils.assetReplacement.imageReplacement(asset.selector, newUrl.trim())
            : utils.assetReplacement.backgroundReplacement(asset.selector, newUrl.trim());

        this.appendCss(css);
        this.previewDraft();
        this.setStatus("Asset replacement CSS added to raw editor.");
    }

    private appendCss(css: string): void {
        this.draftCss = `${(this.rawTextarea?.value || this.draftCss).trimEnd()}\n\n${css}\n`;
        if (this.rawTextarea) this.rawTextarea.value = this.draftCss;
    }

    private createMuted(text: string): HTMLElement {
        const element = document.createElement("div");
        element.className = "eit-muted";
        element.textContent = text;
        return element;
    }
}

export const inspectTool = new InspectTool();
