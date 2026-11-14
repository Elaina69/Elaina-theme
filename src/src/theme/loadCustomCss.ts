import utils from "../utils/utils.ts"
import { applyCustomFont } from '../utils/customFont.ts';

let icdata: Object = (await import(utils.assets.url("config/icons.js"))).default;

const cssAssetUrl = utils.assets.cssUrl;
const cssIconUrl = utils.assets.cssIcon;
const cssBgUrl = utils.assets.cssBackground;

class AddCss {
	cssVar = () => {
		utils.addStyleNode(/*css*/`
			:root {
				--classic_def: ${cssIconUrl("gamemodes", icdata["classic_def"])};
				--classic_act: ${cssIconUrl("gamemodes", icdata["classic_act"])};
				--aram_def: ${cssIconUrl("gamemodes", icdata["aram_def"])};
				--aram_act: ${cssIconUrl("gamemodes", icdata["aram_act"])};
				--tft_def: ${cssIconUrl("gamemodes", icdata["tft_def"])};
				--tft_act: ${cssIconUrl("gamemodes", icdata["tft_act"])};
				--cherry_def: ${cssIconUrl("gamemodes", icdata["cherry_def"])};
				--cherry_act: ${cssIconUrl("gamemodes", icdata["cherry_act"])};
				--brawl_def: ${cssIconUrl("gamemodes", icdata["brawl_def"])};
				--brawl_act: ${cssIconUrl("gamemodes", icdata["brawl_act"])};

				--pri8000: ${cssBgUrl("runes", icdata['Precision'])};
				--pri8100: ${cssBgUrl("runes", icdata['Domination'])};
				--pri8200: ${cssBgUrl("runes", icdata['Sorcery'])};
				--pri8300: ${cssBgUrl("runes", icdata['Inspiration'])};
				--pri8400: ${cssBgUrl("runes", icdata['Resolve'])};

				--Loading: ${cssIconUrl(icdata["Loading"])};
				--Avatar: ${cssIconUrl(icdata["Avatar"])};
				--RP-Icon: ${cssIconUrl(icdata["RP-icon"])};
				--BE-Icon: ${cssIconUrl(icdata["BE-icon"])};
				--Clash-banner: ${cssIconUrl(icdata["Clash-banner"])};
				--Ticker: ${cssIconUrl(icdata["Ticker"])};
				--Trophy: ${cssIconUrl(icdata["Trophy"])};
				--Border: ${cssIconUrl(icdata["Border"])};
				--ElainaFly: ${cssIconUrl(icdata["Animation-logo"])};
				--ElainaStatic: ${cssIconUrl(icdata["Static-logo"])};
				--Hover-card-backdrop: ${cssIconUrl(icdata['Hover-card'])};
			}
		`)
	}

	mainThemeCss = () => {
		const stylesheet = utils.assets.url('assets/styles/themes/elaina.css') + '?elaina=' + process.env.ELAINA_CSS_REVISION;
		utils.addStyleNode(`
			@import ${utils.cssUrl(stylesheet)};
			@font-face {
				font-family: 'Elaina';
				src: ${cssAssetUrl("assets/fonts/beaufortforlol-bold.ttf")}
			}`
		)
	}

	componentsCss = () => {
		let cssImports = "";
		let addonCssList = {
			"componentsCss": [
				{
					key: "hide-vertical-lines",
					css: "hide-vertical-lines.css",
					altCss: "null.css"
				},
				{
					key: "aram-only",
					css: "aram-only.css",
					altCss: "null.css"
				},
				{
					key: "hide-champions-splash-art",
					css: "hide-champs-splash-art.css",
					altCss: "null.css"
				},
				{
					key: "hide-profile-background",
					css: "hide-profile-background.css",
					altCss: "null.css"
				},
				{
					key: "animate-loading",
					css: "animate-loading-screen.css",
					altCss: "static-loading-screen.css"
				},
				{
					key: "custom-navbar-css",
					css: "customNavbar.css",
					altCss: "null.css"
				},
				{
					key: "lobby-transparent-filter",
					css: "lobby-transparent-filter.css",
					altCss: "null.css"
				},
			],
	
			"iconCss": [
				{
					key: 'Custom-Avatar',
					css: 'avatar.css',
					altCss: "null.css"
				},
				{
					key: 'Custom-RP-Icon',
					css: 'riotpoint.css',
					altCss: "null.css"
				},
				{
					key: 'Custom-Clash-banner',
					css: 'clashbanner.css',
					altCss: "null.css"
				},
				{
					key: 'Custom-BE-Icon',
					css: 'blueessence.css',
					altCss: "null.css"
				},
				{
					key: 'Custom-Emblem',
					css: 'emblem.css',
					altCss: "null.css"
				},
				{
					key: 'Custom-Ticker',
					css: 'ticker.css',
					altCss: "null.css"
				},
				{
					key: 'Custom-Trophy',
					css: 'trophy.css',
					altCss: "null.css"
				},
				{
					key: 'Custom-Gamemode-Icon',
					css: "gamemodes.css",
					altCss: "null.css"
				},
				{
					key: 'Custom-Loading-Icon',
					css: "loadingIcon.css",
					altCss: "null.css"
				}
			]
		};
	
		for (const groupKey in addonCssList) {
			addonCssList[groupKey].forEach(({ key, css, altCss }) => {
				let cssPath = ElainaData.get(key) ? css : altCss;

				if ((cssPath && groupKey == "iconCss" && ElainaData.get("Custom-Icon"))
				||  (cssPath && groupKey == "componentsCss")) {
					cssImports += `@import ${cssAssetUrl("assets/styles/components", cssPath)};\n`;
				}
			});
		}
	
		utils.addStyleNode(cssImports);
	};

	customFont = applyCustomFont;

	customCursor = () => {
		utils.CustomCursor(cssIconUrl(icdata["Mouse-cursor"]),`@import ${cssAssetUrl("assets/styles/components/cursor.css")}`)
	}

	customNicknameColor = () => {
		utils.addStyleNodeWithID("nickname-color-css", /*css*/`
			span.player-name__force-locale-text-direction, #nickname-color-preview {
				color: ${utils.sanitizeColor(ElainaData.get("nickname-color-with-opacity"))};
			}
		`)
	}

	customSidebarColor = () => {
		const sidebarColor = utils.sanitizeColor(ElainaData.get("sidebar-color-with-opacity"));
		if (!sidebarColor) return;

		utils.styleEngine.apply("sidebar-color-css", /*css*/`
			:root {
				--social-sidebar-bg-color: ${sidebarColor};
			}

			.sidebar-background {
				background: ${sidebarColor} !important;
			}
		`)
	}
}
export const addCss = new AddCss()

/** Loads theme CSS stylesheets, custom fonts, cursor, and nickname color overrides. */
export class LoadCss {
	main = () => {
		addCss.mainThemeCss()
		addCss.componentsCss()
		addCss.cssVar()

		if (ElainaData.get("Custom-Font")) addCss.customFont()
		if (ElainaData.get("Custom-Cursor")) addCss.customCursor()
		if (ElainaData.get("change-nickname-color")) addCss.customNicknameColor()
		if (ElainaData.get("change-sidebar-color")) addCss.customSidebarColor()
	}
}
