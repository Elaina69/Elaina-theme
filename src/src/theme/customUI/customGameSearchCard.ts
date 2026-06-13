import utils from "../../utils/utils.ts"

let filters = (await import(utils.assets.url("config/filters.js"))).default;

/** Restyles the game search and queue card UI with custom layout and animations. */
export class CustomGameSearchCard {
	restyleGamesearchCard = () => {
		utils.styleEngine.apply("custom-game-search-card", /*css*/`
			.parties-game-info-panel-bg-container,
			.parties-game-search-divider,
			.parties-status-card-bg-container,
			.parties-game-invite-heading-text {
				display: none !important;
			}

			.parties-game-search-status {
				border: 1px solid #8c8263 !important;
				border-radius: 10px !important;
				margin-top: 1px !important;
			}

			.parties-game-search-header {
				height: 28px !important;
			}

			.parties-game-search-map {
				filter: ${filters["PartiesStatusCard"]} !important;
			}

			.parties-status-card {
				background: transparent !important;
			}

			.parties-status-card-header {
				visibility: hidden !important;
				height: 14px !important;
			}

			.parties-status-card-body {
				margin-top: -23px !important;
				padding: 10px 5px 10px 10px !important;
				border: 1px solid #8c8263 !important;
				border-radius: 10px !important;
			}

			.parties-status-card-map {
				margin: -3px 10px 0 0 !important;
				filter: ${filters["PartiesStatusCard"]} !important;
			}
		`, { document: true, shadow: true })
		utils.styleEngine.refresh()
	}
}
