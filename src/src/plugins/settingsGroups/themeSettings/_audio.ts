import { UI } from "../settingsUI.ts"
import { setAudio, audioPlayPause } from "../../../theme/customUI/customHomepage.ts"

export async function audioSection(): Promise<HTMLElement> {
    const br = () => document.createElement("br")

    return UI.createSection("theme-settings-audio", await getString("theme-settings.settings-section-audio"), [
        UI.createSlider(
            await getString("theme-settings.music-volume"), ElainaData.get("audio-volume") * 100,
            (value) => {
                const audio: any = document.getElementById("bg-audio")
                if (audio) audio.volume = value / 100
                ElainaData.set("audio-volume", value / 100)
            }
        ),
        UI.createCheckBox(
            `${await getString("theme-settings.turnoff-audio-ingame")}`, 'offaudio', 'offaudiobox',
            () => { }, true, "turnoff-audio-ingame"
        ),
        br(),
        UI.createCheckBox(
            `${await getString("theme-settings.disable-theme-audio")}`, "disablethemeaudio", "disablethemeaudiobox", () => {
                let audioController: HTMLElement | null = document.querySelector(".webm-bottom-buttons-container")
                let audio: HTMLAudioElement | null = document.getElementById("bg-audio") as HTMLAudioElement | null

                if (!ElainaData.get("disable-theme-audio")) {
                    setAudio()
                    audioPlayPause()
                    if (audioController) audioController.style.display = "flex"
                }
                else {
                    if (audio) audio.src = ''
                    if (audioController) audioController.style.display = "none"
                }
            }, true, "disable-theme-audio"
        ),
    ])
}
