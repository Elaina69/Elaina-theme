import * as upl from "pengu-upl"
import { log } from "../utils/themeLog";
import { themeToast } from "../utils/themeToast";

/**
 * Adds an Invite All button to the lobby for bulk friend invitations.
 * @wiki Adds an "Invite All" button to the lobby that sends invitations to all online friends in a selected friend group. Includes a dropdown to pick which friend group to invite from.
 * @author Elaina Da Catto
 * @usage
 * 1. Create or join a lobby
 * 2. Use the **friend group dropdown** to select which group to invite
 * 3. Click **Invite All** to send lobby invitations to all online friends in that group
 * @settings frGroupName, grouplist, friendslist
 */
export class InviteAllFriends {
    setDefaultFriendsListData = () => {
        if (!ElainaData.has("frGroupName")) {
            ElainaData.set("frGroupName", 0)
        }
        if (!ElainaData.has("grouplist")) {
            ElainaData.set("grouplist", [])
        }
        if (!ElainaData.has("friendslist")) {
            ElainaData.set("friendslist", [])
        }
    }

    refreshFriendsList = async (): Promise<void> => {
        try {
            const [friends, groups] = await Promise.all([
                fetch('/lol-chat/v1/friends').then(res => res.json()),
                fetch('/lol-chat/v1/friend-groups').then(res => res.json())
            ]);

            if (ElainaData.get("grouplist").length !== groups.length || ElainaData.get("friendslist").length !== friends.length) {
                ElainaData.set("friendslist", friends.map((friend: any) => ({
                    summonerId: friend.summonerId,
                    groupId: friend.groupId,
                    availability: friend.availability
                })));

                ElainaData.set("grouplist", groups.map((group: any) => ({
                    id: group.id,
                    name: group.name
                })));

                document.getElementById("inviteAllDiv")?.remove();
                this.addInviteAllButton();

                log("Friends list refreshed.");
            }
        } catch (error: any) {
            log("Error refreshing friends list:", error);
        }
    };

    addInviteAllButton = async (): Promise<void> => {
        if (document.querySelector(".lobby-header-buttons-container") != null) {
            let groupList: { name: string[]; id: string[] } = {"name":[],"id":[]}

            for(let i = 0; i < ElainaData.get("grouplist").length ; i++) {
                groupList["id"].push(ElainaData.get("grouplist")[i]["id"])
                groupList["name"].push(ElainaData.get("grouplist")[i]["name"])
            }

            const mainDiv = document.createElement("div")
            mainDiv.id = "inviteAllDiv"
            mainDiv.style.display = "flex"

            let button = document.createElement("lol-uikit-flat-button")
            button.textContent = "Invite all"
            button.onclick = async () => {
                await this.refreshFriendsList()
                let Invited = 0
                themeToast.loading('Inviting all...', 'elaina-invite-all-friends')

                for(let i = 0; i < ElainaData.get("friendslist").length ; i++) {
                    if (ElainaData.get("frGroupName") == ElainaData.get("friendslist")[i]["groupId"]
                    && ElainaData.get("friendslist")[i]["availability"] == "chat") {
                        let invite = await fetch("/lol-lobby/v2/lobby/invitations",{
                            method: 'POST',
                            headers: {"content-type": "application/json"},
                            body: JSON.stringify([{"toSummonerId": ElainaData.get("friendslist")[i]["summonerId"]}])
                        })
                        
                        if (invite.status == 200) Invited++
                    }
                }

                themeToast.success(`Invited ${Invited} friends`, 'elaina-invite-all-friends')
            }

            let div = document.createElement("div")
            div.classList.add("Dropdown-div")

            let dropdown = document.createElement("lol-uikit-framed-dropdown")
            dropdown.classList.add("lol-settings-general-dropdown")
            dropdown.style.cssText = "margin-right: 10px; width: 198px;"

            for (let i = 0; i < groupList["id"].length; i++) {
                let el = document.createElement("lol-uikit-dropdown-option")

                el.setAttribute("slot", "lol-uikit-dropdown-option")
                el.innerText = groupList["name"][i]
                el.onclick = () => {
                    ElainaData.set("frGroupName", groupList["id"][i])
                }

                if (ElainaData.get("frGroupName") == groupList["id"][i]) {
                    el.setAttribute("selected", "true")
                }
                dropdown.appendChild(el)
            }

            div.append(dropdown)
            mainDiv.append(div,button)

            let gameBar = document.querySelector(".lobby-header-buttons-container")
            if (!document.querySelector("#inviteAllDiv")) {
                gameBar?.insertBefore(mainDiv, gameBar.children[1])
            }
        }
    }

    main = () => {
        this.setDefaultFriendsListData()

        upl.observer.subscribeToElementCreation(".v2-header-component.ember-view", (element: any) => {
            this.refreshFriendsList()
            this.addInviteAllButton()
        })
    }
}
