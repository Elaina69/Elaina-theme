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
    private observers = new Map<ParentNode, MutationObserver>();
    private lifecycle: AbortController | null = null;
    private frame: HTMLIFrameElement | null = null;
    private unsubscribe: (() => void) | null = null;

    updateNames(root: ParentNode = document) {
        const Name = ElainaData.get("Spoof-name");
        const spoof = ElainaData.get("Name-Spoofer");
        
        if (!spoof) return;
        
        const elements = root.querySelectorAll(SELECTORS.replace(/\.system-message,\s*/, ''));
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
    
    observeChanges(target: ParentNode) {
        if (this.observers.has(target)) return;
        const observer = new MutationObserver(() => {
            this.updateNames(target);
            this.watchMessageFrame();
        });
        observer.observe(target as Node, {
            childList: true,
            characterData: true,
            subtree: true,
        });
        this.observers.set(target, observer);
        this.updateNames(target);
    }

    private watchMessageFrame = () => {
        if (!this.lifecycle) return;
        const frame = document.getElementById('embedded-messages-frame') as HTMLIFrameElement | null;
        if (frame !== this.frame) {
            this.frame?.removeEventListener('load', this.watchMessageFrame);
            this.frame = frame;
            frame?.addEventListener('load', this.watchMessageFrame);
        }
        let frameDocument: Document | null = null;
        try { frameDocument = frame?.contentDocument ?? null; } catch { /* Other-origin frames are unavailable. */ }
        for (const [target, observer] of this.observers) {
            if ((target as Node).nodeType === 9 && target !== frameDocument) {
                observer.disconnect();
                this.observers.delete(target);
            }
        }
        if (frameDocument) this.observeChanges(frameDocument);
    };

    private stopObservers(): void {
        this.lifecycle?.abort();
        this.lifecycle = null;
        this.frame?.removeEventListener('load', this.watchMessageFrame);
        this.frame = null;
        for (const observer of this.observers.values()) observer.disconnect();
        this.observers.clear();
    }

    private reconcile = () => {
        if (ElainaData.get('Name-Spoofer') !== true) {
            this.stopObservers();
            return;
        }
        if (!this.lifecycle) {
            this.lifecycle = new AbortController();
            this.observeChanges(document.getElementById('rcp-fe-viewport-root') ?? document.body);
            window.addEventListener('pagehide', () => this.stop(), { signal: this.lifecycle.signal });
        } else {
            for (const target of this.observers.keys()) this.updateNames(target);
        }
        this.watchMessageFrame();
    };

    main = () => {
        this.unsubscribe ??= ElainaData.subscribe(keys => {
            if (keys.includes('Name-Spoofer') || keys.includes('Spoof-name')) this.reconcile();
        });
        this.reconcile();
    }

    stop(): void {
        this.stopObservers();
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}
