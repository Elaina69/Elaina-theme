import { UI } from "../settingsUI.ts"
import { restartAfterChange } from "../../settings.ts"
import { rankList } from "../../../utils/rankList.ts"

export async function pluginsProfileSection(): Promise<HTMLElement> {
    const br = () => document.createElement("br")
    const rank = await rankList()

    const rankDropdown = (key: string, title: string) => {
        const items = (rank[key] || []).map((o: any) => ({ label: o.name, value: o.id }))
        return UI.createDropdown(items, ElainaData.get(key), {
            title,
            datastoreKey: key,
        })
    }

    return UI.createSection("plugins-settings-profile", await getString("plugins-settings.settings-section-plugin-profile"), [
        UI.createCheckBox(await getString("plugins-settings.invisible-banner"), 'invbanner', 'invbannerbox',
            () => {
                restartAfterChange('invbanner', "invisible_banner")
            }, true, "invisible_banner"
        ),
        br(),
        UI.createCheckBox(
            `${await getString("plugins-settings.custom-profile-hover")}`, 'cusprf', 'cusprfbox',
            () => {
                restartAfterChange('cusprf', "Custom-profile-hover")
            }, true, "Custom-profile-hover"
        ),
        UI.createRowHideable("customprf", [
            br(),
            UI.createCheckBox(
                `${await getString("plugins-settings.custom-mastery-score")}`, 'cusmastery', 'cusmasterybox',
                () => {
                    restartAfterChange('cusmastery', "Custom-mastery-score")
                }, true, "Custom-mastery-score"
            ),
            br(),
            UI.createSearchBox("Mastery-Score"),
            br(),
            UI.createRow("customrank_checkbox", [
                UI.createCheckBox(
                    `${await getString("plugins-settings.custom-rank-hover")}`, 'cusrankhover', 'cusrankhoverbox',
                    () => {
                        restartAfterChange('cusrankhover', "Custom-rank")
                    }, true, "Custom-rank"
                ),
                br(),
                UI.createButton(await getString("common.refresh"), "refresh_option", async () => {
                    window.customRank()
                })
            ]),
            UI.createRow("customrank_detail", [
                rankDropdown("Ranked Queue ID", await getString("plugins-settings.ranked-queue")),
                rankDropdown("Ranked Tier ID", await getString("plugins-settings.ranked-tier")),
                rankDropdown("Ranked Division ID", await getString("plugins-settings.ranked-division")),
            ]),
            UI.createLabel(`${await getString("plugins-settings.custom-rank-classic")}`),
            UI.createRow("customrank_detail", [
                rankDropdown("classic-ranked-tier-id", await getString("plugins-settings.ranked-tier")),
                rankDropdown("classic-ranked-division-id", await getString("plugins-settings.ranked-division")),
            ]),
            br(),
            UI.createCheckBox(
                `${await getString("plugins-settings.custom-challenge-crystal")}`, 'cuschalcry', 'cuschalcrybox',
                () => {
                    restartAfterChange('cuschalcry', "Custom-challenge-crystal")
                }, true, "Custom-challenge-crystal"
            ),
            br(),
            UI.createRow("customchallengecrystal", [
                rankDropdown("Ranked Tier ID", await getString("plugins-settings.challenge-rank")),
                UI.createLabel(`${await getString("plugins-settings.challenge-point")}`, "challenge-point-Text"),
                UI.createSearchBox("Challenge-Points"),
            ]),
            UI.createCheckBox(
                `${await getString("plugins-settings.custom-status")}`, 'cussta', 'cusstabox',
                () => {
                    if (ElainaData.get("Custom-Status")) {
                        if (window.confirm("This may cause some issues with the client's chat, are you sure you want to enable this plugins?")) {
                            restartAfterChange('cussta', "Custom-Status")
                        }
                        else {
                            let box: HTMLInputElement | null = document.getElementById("cusstabox") as HTMLInputElement | null
                            if (box) box.checked = false
                            ElainaData.set("Custom-Status", false)
                        }
                    }
                    else {
                        restartAfterChange('cussta', "Custom-Status")
                    }
                }, true, "Custom-Status"
            ),
            br(),
            UI.createRow("customstatus", [
                UI.createCheckBox(
                    `${await getString("plugins-settings.custom-status-local")}`, 'cussta-local', 'cussta-localbox',
                    () => {
                        restartAfterChange('cussta-local', "Custom-Status-Local")
                    }, true, "Custom-Status-Local"
                ),
                UI.createLabel(`${await getString("plugins-settings.status-delay")}`, ""),
                UI.createSearchBox("status-delay"),
            ]),
        ]),
        UI.createRow("namespoof", [
            UI.createCheckBox(
                `${await getString("plugins-settings.name-spoofer")}`, 'namespf', 'namespfbox',
                () => {
                    restartAfterChange('namespf', "Name-Spoofer")
                }, true, "Name-Spoofer"
            ),
            br(),
            UI.createSearchBox("Spoof-name"),
        ]),
    ])
}
