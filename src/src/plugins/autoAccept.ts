import utils from '../utils/utils.ts';
import * as upl from "pengu-upl"
import { warn, error } from '../utils/themeLog.ts';

/**
 * Automatically accepts the matchmaking ready check when a game is found.
 * @wiki Automatically accepts the matchmaking ready check when a game is found, so you don't have to click Accept manually.
 * @author Lyfhael
 * @modifier Elaina Da Catto
 * @usage
 * 1. Open League Client settings
 * 2. Navigate to **Elaina Theme** → **Plugin Settings**
 * 3. Enable **Auto Accept** to auto-accept queues
 * 4. Optionally, enable the **Auto Accept Button** to show a toggle in the lobby
 * @settings auto_accept, auto_accept_button
 */
export class AutoAccept {
	private maxAcceptDelay = 15000;

	private queueAccepted: boolean = false;
	private playerDeclined: boolean = false
	private autoAcceptTimer: number | null = null;

	getAutoAcceptDelay(): number {
		const rawDelay = Number(ElainaData.get("auto_accept_delay"));

		if (!Number.isFinite(rawDelay) || rawDelay < 0) return 0;
		
		return Math.min(Math.floor(rawDelay), this.maxAcceptDelay);
	}

	clearAutoAcceptTimer(): void {
		if (this.autoAcceptTimer !== null) {
			window.clearTimeout(this.autoAcceptTimer);
			this.autoAcceptTimer = null;
		}
	}

	resetAutoAcceptState(): void {
		this.clearAutoAcceptTimer();

		this.queueAccepted = false;
		this.playerDeclined = false;
	}

	autoAcceptQueueButtonSelect = () => {
		const element = document.getElementById("autoAcceptQueueButton") as HTMLInputElement
		if (element?.hasAttribute("selected")) {
			ElainaData.set("auto_accept", false)
			element.removeAttribute("selected")

			this.resetAutoAcceptState()
		}
		else {
			element?.setAttribute("selected", "true")
			ElainaData.set("auto_accept", true)

			this.scheduleAutoAccept()
		}
	}
	
	fetch_or_create_champselect_buttons_container(): any {
		try {
			document.querySelector(".cs-buttons-container")?.remove()
		}
		catch {
			error("Error while removing old auto accept button")
		}

		const div = document.createElement("div")
		div.className = "cs-buttons-container"

		let nor = document.querySelector(".v2-footer-notifications.ember-view") as HTMLElement
		let tft = document.querySelector(".parties-footer-notifications.ember-view") as HTMLElement

		if (nor) {
			nor.append(div)
			return div
		}
		else if (tft) { 
			tft?.append(div)
			return div
		}
	}

	getReadyCheck = async (): Promise<any> => {
		try {
			const response = await fetch('/lol-matchmaking/v1/ready-check')
			if (!response.ok) return null;
			return await response.json();
		}
		catch {
			return null;
		}
	}

	didPlayerDeclineReadyCheck(readyCheck: any): boolean {
		return readyCheck?.playerResponse === "Declined";
	}

	canAcceptReadyCheck(readyCheck: any): boolean {
		if (!readyCheck) return false;
		if (this.didPlayerDeclineReadyCheck(readyCheck)) return false;
		if (readyCheck.state && readyCheck.state !== "InProgress") return false;

		return readyCheck.playerResponse === "None" || readyCheck.playerResponse === undefined;
	}

	acceptMatchmaking = async (): Promise<void> => {
		if (this.playerDeclined) return;

		const readyCheck = await this.getReadyCheck();

		if (utils.phase != "ReadyCheck" || 
			!ElainaData.get("auto_accept") || 
			!this.canAcceptReadyCheck(readyCheck)
		) return;

		try {
			const response = await fetch('/lol-matchmaking/v1/ready-check/accept', { method: 'POST' })
			if (!response.ok) warn(`Auto Accept request failed with status ${response.status}`)
		}
		catch (err) {
			warn("Auto Accept request failed:", err)
		}
	}

	scheduleAutoAccept = async (readyCheckData?: any): Promise<void> => {
		if (utils.phase != "ReadyCheck" || 
			!ElainaData.get("auto_accept") || 
			this.queueAccepted || 
			this.playerDeclined
		) return;

		const readyCheck = readyCheckData ?? await this.getReadyCheck();
		if (!this.canAcceptReadyCheck(readyCheck)) return;

		this.queueAccepted = true
		this.playerDeclined = false
		const delay = this.getAutoAcceptDelay();

		this.clearAutoAcceptTimer();
		if (delay > 0) {
			this.autoAcceptTimer = window.setTimeout(async () => {
				this.autoAcceptTimer = null;
				if (utils.phase == "ReadyCheck" && ElainaData.get("auto_accept")) {
					await this.acceptMatchmaking()
				}
			}, delay);
		}
		else if (utils.phase == "ReadyCheck" && ElainaData.get("auto_accept")) {
			await this.acceptMatchmaking()
		}
	}

	autoAcceptCallback = async (phase: any) => {
		if (phase == "ReadyCheck") {
			this.playerDeclined = false
			await this.scheduleAutoAccept()
			return;
		}

		this.resetAutoAcceptState()
	}

	readyCheckCallback = async (message: Object) => {
		const parsedData = (message: any) => {
			try {
				return JSON.parse(message["data"])[2]["data"];
			}
			catch {
				return null;
			}
		}
		
		const readyCheck = parsedData(message);
		if (!readyCheck) return;

		if (this.didPlayerDeclineReadyCheck(readyCheck) || readyCheck.state !== "InProgress") {
			this.playerDeclined = this.didPlayerDeclineReadyCheck(readyCheck);
			this.clearAutoAcceptTimer();
			this.queueAccepted = false;
			return;
		}

		await this.scheduleAutoAccept(readyCheck);
	}


	createButton = async (element: HTMLElement) => {
		const newOption = document.createElement("lol-uikit-radio-input-option")
		const container = this.fetch_or_create_champselect_buttons_container()
		const Option2 = document.createElement("div")
		const delayInput = document.createElement("lol-uikit-flat-input")
		const delayInputElement = document.createElement("input")
		
		newOption.setAttribute("id", "autoAcceptQueueButton")
		newOption.setAttribute("onclick", "window.autoAcceptQueueButtonSelect()")
	
		Option2.classList.add("auto-accept-button-text")
		Option2.innerHTML = await getString("auto-accept.auto-accept")

		delayInput.id = "autoAcceptDelayInput"
		delayInput.title = await getString("auto-accept.auto-accept-delay")
		delayInput.style.cssText = "width: 82px; margin-left: 8px;"

		delayInputElement.type = "number"
		delayInputElement.min = "0"
		delayInputElement.max = String(this.maxAcceptDelay)
		delayInputElement.step = "100"
		delayInputElement.placeholder = "ms"
		delayInputElement.value = String(this.getAutoAcceptDelay())
		delayInputElement.addEventListener("input", () => {
			const value = Math.min(Math.max(Number(delayInputElement.value) || 0, 0), this.maxAcceptDelay)
			ElainaData.set("auto_accept_delay", value)
		})

		delayInput.append(delayInputElement)
	
		if (ElainaData.get("auto_accept")){
			newOption.setAttribute("selected", "")
		}
	
		if (element && !document.getElementById("autoAcceptQueueButton")) {
			if (ElainaData.get("auto_accept_button")) {
				container?.append(newOption)
				newOption.append(Option2)
				container?.append(delayInput)
			}
		}
	}

	main = (_auto_accept_button: boolean = true) => {
		window.autoAcceptQueueButtonSelect = this.autoAcceptQueueButtonSelect

		upl.observer.subscribeToElementCreation(".v2-lobby-root-component.ember-view .v2-footer-notifications.ember-view",async (element: any) => {
			await this.createButton(element)
		})

		upl.observer.subscribeToElementCreation(".tft-footer-container.ember-view .parties-footer-notifications.ember-view",async (element: any) => {
			await this.createButton(element)
		})

		utils.onPhaseChange(this.autoAcceptCallback)
		utils.subscribe_endpoint('/lol-matchmaking/v1/ready-check', this.readyCheckCallback)
	} 
}
