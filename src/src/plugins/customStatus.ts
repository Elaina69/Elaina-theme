import { pluginUrl } from "../otherThings"

const text = await (await fetch(pluginUrl("config/customStatus.txt"))).text()

/**
 * Sets a custom rotating chat status message from a text file.
 * @wiki Sets a custom chat status message that rotates through multiple messages defined in a text file. Supports both server-side status updates (visible to friends) and local-only display. Messages are separated by `(end status)` in the config file.
 * @author Elaina Da Catto
 * @usage
 * 1. Edit the `config/customStatus.txt` file with your desired status messages, separated by `(end status)`
 * 2. Open League Client settings
 * 3. Navigate to **Elaina Theme** → **Plugin Settings**
 * 4. Configure the **Status Delay** to control rotation speed
 * 5. Optionally enable **Local Only** mode to only change the status display locally
 * @settings Custom-Status-Local, status-delay
 */
export class CustomStatus {
    private i: number = 0

    sendCustomStatus = async () => {
        let statusMessage = JSON.stringify(text)
            statusMessage = statusMessage.replaceAll("\n", "\\n")
            statusMessage = statusMessage.replaceAll("\r", "\\r")
            statusMessage = statusMessage.replaceAll("\"", "")
        let MultiStatus = statusMessage.split("\\r\\n(end status)\\r\\n")

        if   (this.i == MultiStatus.length - 1) {this.i = 0}
        else {this.i++}
    
        await fetch("/lol-chat/v1/me", {
            method :"PUT",
            headers:{"content-type":"application/json"},
            body   : `{"statusMessage": "${MultiStatus[this.i]}"}`
        }) 
    }

    sendLocalStatus = async () => {
        const statusCard = document.querySelector('.hover-card-status-message')
        let MultiStatus = text.split("(end status)")

        if (statusCard) {
            if   (this.i == MultiStatus.length - 1) {this.i = 0}
            else {this.i++}

            statusCard.textContent = MultiStatus[this.i]
        }
    }

    main = () => {
        if (!ElainaData.get("Custom-Status-Local")) {
            window.setInterval(async ()=> {
                await this.sendCustomStatus()
            }, ElainaData.get("status-delay"))
        }
        else {
            window.setInterval(async ()=> {
                await this.sendLocalStatus()
            }, ElainaData.get("status-delay"))
        } 
    }
}
