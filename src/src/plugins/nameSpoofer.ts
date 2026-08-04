const SELECTORS = `
    .banner-summoner-name,
    .chat-gnt,
    .chat-name,
    .conversation-title,
    .custom-member-name,
    .hover-card-game-name,
    .hover-card-game-tag,
    .hover-card-name,
    .lol-leagues-list-col-3.lol-leagues-list-col,
    .lol-leagues-list-item.me.current.ember-view .rank-standing-row-component,
    .match-details-team-list .player-history-mode,
    .member-name,
    .name-text,
    .prompted-voting-candidate-name,
    .scoreboard-row-player-name,
    .style-profile-search-trail-summoner-name,
    .message-name,
    .system-message,
    .invite-info-name,
    .lol_parties__invite_dialog_name-and-context,
    .chat-name,
    .chat-gnt,
    .message-box-messages-system-message,
    .reform-card-chat-log-name,
    .hover-card-name,
    .hover-card-game-name,
    .hover-card-game-tag,
    .create-panel-summoner-name,
    .create-panel-game-name,
    .player-name__game-name,
    .player-name__force-locale-text-direction
`;

/**
 * Replaces your displayed summoner name with a custom name throughout the client.
 * @wiki Replaces your displayed summoner name throughout the client with a custom name. Affects the sidebar, profile, chat, lobby, hover cards, scoreboards, and more. This is a local visual change only — other players still see your real name.
 * @usage
 * 1. Open League Client settings
 * 2. Navigate to **Elaina Theme** → **Plugin Settings**
 * 3. Enable **Name Spoofer** and set your desired **Spoof Name**
 * @settings Name-Spoofer, Spoof-name
 */
export class NameSpoofer {
    updateNames(root = document) {
        const Name = ElainaData.get("Spoof-name");
        const spoof = ElainaData.get("Name-Spoofer");
        
        if (!spoof) return;
        
        const elements = root.querySelectorAll(SELECTORS);
        elements.forEach((element: any) => {
            if (element.textContent !== Name) {
                element.textContent = Name;
            }
        });
    
        const systemMessages = root.querySelectorAll(".system-message");
        systemMessages.forEach((sysMessage) => {
            if (sysMessage.textContent !== "🐱‍👤") {
                sysMessage.textContent = "🐱‍👤";
            }
        });
    }
    
    observeChanges(target: any) {
        new MutationObserver(() => this.updateNames(target)).observe(target, {
            childList: true,
            subtree: true,
        });
    }

    main = () => {
        const manager = document.getElementById("rcp-fe-viewport-root");
        
        if (manager) {
            this.observeChanges(manager);
        }
    
        const myMessageBox: any = document.getElementById("embedded-messages-frame");
        if (myMessageBox && myMessageBox.contentDocument) {
            this.observeChanges(myMessageBox.contentDocument);
        }
    
        // Initial update
        // Periodically check for new elements (consider removing if performance is an issue)
        setInterval(this.updateNames, 100);
    }
}