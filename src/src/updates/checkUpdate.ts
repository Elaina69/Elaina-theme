import LocalKey from "./updateKeyLocal.ts"
import { pluginUrl, cdnImport } from "../otherThings.ts"
import { log, warn, error } from "../utils/themeLog.ts"

interface UpdateData {
	version: string
	key: number
	"update-type": "Auto" | "Manual" | "New"
	text: string[]
}

type UpdateAction = "changelog" | "changelog-new" | "force-update" | "none"

const updateTypeLocaleKeys: Record<UpdateData["update-type"], string> = {
	Auto: "common.auto-update",
	Manual: "common.manual-update",
	New: "common.new-update",
}

/** Checks the CDN for theme updates and handles changelog display and forced updates. */
export class CheckUpdate {
	private cdnUpdate: UpdateData | null = null
	private cdnServer: any = null
	private cdnKey: number = LocalKey

	fetchCdnData = async () => {
		this.cdnServer = (await import(pluginUrl("config/cdnServer.js"))).default

		const cdnUrl = `${this.cdnServer["cdn-url"]}elaina-theme-data@${this.cdnServer["version"]}`
		const localUrl = pluginUrl("elaina-theme-data")

		try {
			let updateModule: any

			if (ElainaData.get("Dev-mode")) {
				updateModule = await cdnImport(`${localUrl}/src/update/update.js`, "Can't load update data")
				log('%cRunning Elaina theme - %cDev version', 'color: #e4c2b3', 'color: red')
			}
			else {
				updateModule = await cdnImport(`${cdnUrl}/src/update/update.js`, "Can't load update data")
				log('%cRunning Elaina theme - %cStable version', 'color: #e4c2b3', 'color: #00ff44')
			}

			this.cdnUpdate = updateModule.default
			this.cdnKey = updateModule.default.key
		}
		catch {
			this.cdnKey = LocalKey
			log('%cRunning Elaina theme - %cChecking version error', 'color: #e4c2b3', 'color:rgb(229, 255, 0)')
			warn("Failed to load CDN update data, skipping update check")
		}

		if (this.cdnKey === LocalKey) {
			try {
				if (!ElainaData.get("Change-CDN-version")) {
					const response = await fetch(`${cdnUrl}/package.json`)
					const { version: cdnVersion } = await response.json()
					ElainaData.set("Cdn-version", cdnVersion)
				}
			}
			catch (err: any) { error("Can't get theme version", err) }
		}
	}

	determineUpdateAction = (cdn: UpdateData): UpdateAction => {
		const keySame = LocalKey === cdn.key
		const updateType = cdn["update-type"]

		// Key same = user already has the correct build
		if (keySame) {
			if (updateType === "New") return "changelog-new"
			return "changelog"
		}

		// Key different = user needs to update
		if (!keySame && updateType === "Manual") return "force-update"

		return "none"
	}

	escapeHtml = (text: string): string => {
		const div = document.createElement('div')
		div.textContent = text
		return div.innerHTML
	}

	createCheckbox = (text: string, datastoreName: string): HTMLElement => {
		const container = document.createElement("div")
		container.style.width = "fit-content"
		container.style.marginLeft = "18px"

		const origin = document.createElement("lol-uikit-flat-checkbox") as HTMLElement
		const checkbox = document.createElement("input") as HTMLInputElement
		const label = document.createElement("label")

		checkbox.type = "checkbox"
		checkbox.id = "update-checkbox-input"
		checkbox.setAttribute("slot", "input")

		if (ElainaData.get(datastoreName)) {
			checkbox.checked = true
			origin.setAttribute("class", "checked")
		}

		checkbox.onclick = () => {
			const current = ElainaData.get(datastoreName)
			ElainaData.set(datastoreName, !current)
			checkbox.checked = !current
			origin.setAttribute("class", !current ? "checked" : "")
		}

		label.innerHTML = text
		label.setAttribute("slot", "label")

		origin.appendChild(checkbox)
		origin.appendChild(label)
		container.appendChild(origin)

		return container
	}

	waitForManager = async (): Promise<HTMLElement> => {
		const getManager = () => document.getElementById('lol-uikit-layer-manager-wrapper')
		while (!getManager()) await new Promise(r => setTimeout(r, 200))
		return getManager()!
	}

	setupCloseButton = (): void => {
		const interval = window.setInterval(() => {
			try {
				const frame = document.querySelector("#Elaina-Update lol-uikit-dialog-frame") as HTMLElement
				const closeButton = frame?.shadowRoot?.querySelector(
					"div.lol-uikit-dialog-frame-close-button > lol-uikit-close-button"
				)
				if (closeButton) {
					closeButton.addEventListener("click", () => {
						document.getElementById("Elaina-Update")!.hidden = true
					})
					window.clearInterval(interval)
				}
			} catch {}
		}, 500)
	}

	showChangelogDialog = async (cdn: UpdateData, showDownload: boolean): Promise<void> => {
		const manager = await this.waitForManager()

		const closeText = await getString('preset-settings.close')
		const downloadText = await getString('preset-settings.download')

		const changelogHtml = cdn.text
			.map(t => `<p class="Elaina-Update">${this.escapeHtml(t)}</p>`)
			.join('')

		const root = document.createElement('div')
		root.innerHTML = `
			<div class="modal" style="position: absolute; inset: 0px; z-index: 8500;" id="Elaina-Update">
				<lol-uikit-full-page-backdrop class="backdrop" style="display: flex; align-items: center; justify-content: center; position: absolute; inset: 0px;"></lol-uikit-full-page-backdrop>
				<div class="dialog-confirm" style="display: flex; align-items: center; justify-content: center; position: absolute; inset: 0px;">
					<lol-uikit-dialog-frame class="dialog-frame" orientation="bottom" close-button="false">
						<div class="dialog-content">
							<lol-uikit-content-block class="app-controls-exit-dialog" type="dialog-small" style="width: 500px;" id="elaina-update-text">
								<h5>Elaina_V4 - ${await getString(updateTypeLocaleKeys[cdn["update-type"]])} ${this.escapeHtml(cdn.version)}</h5>
								<hr class="heading-spacer" />
								${changelogHtml}
							</lol-uikit-content-block>
						</div>
						<lol-uikit-flat-button-group type="dialog-frame" id="update-button-group">
						</lol-uikit-flat-button-group>
					</lol-uikit-dialog-frame>
				</div>
			</div>
		`

		const buttonGroup = root.querySelector("#update-button-group")!

		const closeBtn = document.createElement("lol-uikit-flat-button")
		closeBtn.setAttribute("tabindex", "1")
		closeBtn.className = "button-decline"
		closeBtn.textContent = closeText
		closeBtn.addEventListener("click", () => {
			document.getElementById("Elaina-Update")!.hidden = true
		})
		buttonGroup.appendChild(closeBtn)

		if (showDownload) {
			const downloadBtn = document.createElement("lol-uikit-flat-button")
			downloadBtn.setAttribute("tabindex", "1")
			downloadBtn.style.marginLeft = "10px"
			downloadBtn.textContent = downloadText
			downloadBtn.addEventListener("click", () => {
				window.open(`https://github.com/Elaina69/Elaina-V4/releases/tag/v${cdn.version}`)
			})
			buttonGroup.appendChild(downloadBtn)
		}

		manager.prepend(root)
		this.setupCloseButton()
	}

	showForceUpdateDialog = async (cdn: UpdateData): Promise<void> => {
		const manager = await this.waitForManager()

		const downloadText = await getString('preset-settings.download')
		const preventText = await getString('theme-settings.prevent-manual-update')

		const root = document.createElement('div')
		root.innerHTML = `
			<div class="modal" style="position: absolute; inset: 0px; z-index: 8500;" id="Elaina-Update">
				<lol-uikit-full-page-backdrop class="backdrop" style="display: flex; align-items: center; justify-content: center; position: absolute; inset: 0px;"></lol-uikit-full-page-backdrop>
				<div class="dialog-confirm" style="display: flex; align-items: center; justify-content: center; position: absolute; inset: 0px;">
					<lol-uikit-dialog-frame class="dialog-frame" orientation="bottom" close-button="false">
						<div class="dialog-content">
							<lol-uikit-content-block class="app-controls-exit-dialog" type="dialog-small" style="width: 520px;">
								<h5>Elaina_V4 - ${await getString(updateTypeLocaleKeys[cdn["update-type"]])} </h5>
								<hr class="heading-spacer" />
								<hr class="heading-spacer" />
								<p class="Elaina-Update" style="text-align: center">${await getString('common.update-available-1')}</p>
								<p class="Elaina-Update" style="text-align: center">${await getString('common.update-available-2')}</p>
								<hr class="heading-spacer" />
								<p class="Elaina-Update" style="text-align: center">Meow ~~~</p>
								<div id="force-update-checkbox"></div>
							</lol-uikit-content-block>
						</div>
						<lol-uikit-flat-button-group type="dialog-frame">
						</lol-uikit-flat-button-group>
					</lol-uikit-dialog-frame>
				</div>
			</div>
		`

		const checkboxContainer = root.querySelector("#force-update-checkbox")!
		checkboxContainer.appendChild(this.createCheckbox(preventText, "prevent-manual-update"))

		const buttonGroup = root.querySelector("lol-uikit-flat-button-group")!
		const downloadBtn = document.createElement("lol-uikit-flat-button")
		downloadBtn.setAttribute("tabindex", "1")
		downloadBtn.textContent = downloadText
		downloadBtn.addEventListener("click", () => {
			window.open(`https://github.com/Elaina69/Elaina-V4/releases/tag/v${cdn.version}`)
		})
		buttonGroup.appendChild(downloadBtn)

		manager.prepend(root)
		this.setupCloseButton()
	}

	main = async () => {
		log(`%cChecking theme version...`, "color: #e4c2b3")

		// Fetch CDN data (update info + package version)
		await this.fetchCdnData()

		try {
			if (!this.cdnUpdate) {
				warn("No CDN update data available, skipping update check")
				return
			}

			const cdn = this.cdnUpdate
			const localVersion = ElainaData.get("Theme-version") || ""

			// First install
			if (!localVersion) {
				ElainaData.set("Theme-version", cdn.version)
				log(`%cFirst install detected, saved version: ${cdn.version}`, "color: #e4c2b3")
			}

			const action = this.determineUpdateAction(cdn)

			log(`%cLocal  : %cv${ElainaData.get("Theme-version")} (key: ${LocalKey})`, 'color: #e4c2b3', 'color: #00ff44')
			log(`%cCDN    : %cv${cdn.version} (key: ${cdn.key}, type: ${cdn["update-type"]})`, 'color: #e4c2b3', 'color: #00ff44')
			log(`%cAction : %c${action}`, 'color: #e4c2b3', 'color: #00ff44')

			switch (action) {
				case "changelog":
				case "changelog-new": {
					// Only show once per CDN version
					if (ElainaData.get("changelog-shown-version") === cdn.version) {
						log(`%cChangelog already shown for v${cdn.version}`, 'color: #e4c2b3')

						window.Toast.success('Latest release now')
						return
					}

					window.Toast.success(`New changelog available: v${cdn.version}`)

					window.addEventListener("load", async () => {
						await this.showChangelogDialog(cdn, action === "changelog-new")

						// Mark changelog as shown & save version
						ElainaData.set("changelog-shown-version", cdn.version)
						ElainaData.set("Theme-version", cdn.version)

						log(`%cChangelog displayed for v${cdn.version}`, 'color: #e4c2b3')
					})
					break
				}

				case "force-update": {
					if (ElainaData.get("prevent-manual-update")) {
						log(`%cManual update notification disabled by user`, 'color: #e4c2b3')
						return
					}

					window.Toast.error('New theme manual update available')

					window.addEventListener("load", async () => {
						await this.showForceUpdateDialog(cdn)
						log(`%cForce update notification displayed`, 'color: #e4c2b3')
					})
					break
				}

				case "none":
				default: {
					log(`%cNo update action required`, 'color: #e4c2b3')

					let checkVersion = new Promise<void>((resolve) => {
						setTimeout(() => resolve(), 2000)
					})

					window.Toast.promise(checkVersion, {
						loading: 'Checking theme version...',
						success: 'Latest release now',
						error: 'Version check failed'
					})
					break
				}
			}
		}
		catch (err: any) {
			error("Update check failed", err)
		}
	}
}
