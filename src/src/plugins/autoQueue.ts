import * as upl from "pengu-upl"
import { log } from "../utils/themeLog.ts";
import { themeToast } from "../utils/themeToast.ts";

let autoQueue = false

async function getQueueList() {
    // Get queue id list from server
    const queueData = await (await fetch('/lol-game-queues/v1/queues')).json();

    // Invalid queue id
    const invalidIds = [700, 720, 1110, 2010, 2020, 2000];

    // Filtering queue list and sorting it
    const queueList = queueData
        .filter(queue => queue.queueAvailability === 'Available' && !invalidIds.includes(queue.id))
        .map(queue => ({ queueId: queue.id, description: queue.name }))
        .sort((a, b) => a.queueId - b.queueId);

    // Save queue list to Datastore
    ElainaData.set('queueList', { Gamemode: queueList });
}

async function createQueue(data) {
    await fetch('/lol-lobby/v2/lobby', {
        method: 'POST',
        body: JSON.stringify({ queueId: data }),
        headers: {
        'Content-Type': 'application/json'
        }
    })
}

async function matchMaking() {
    await fetch('/lol-lobby/v2/lobby/matchmaking/search', {
        method: 'POST'
    })
}

/**
 * Automatically re-queues for a new game after the end-of-game screen.
 * @usage
 * 1. Open League Client settings
 * 2. Navigate to **Elaina Theme** → **Plugin Settings**
 * 3. Enable **Auto Find Queue** to activate automatic re-queuing
 * 4. Set the **Create Delay** (in ms) to control how long to wait before re-queuing
 * 5. Optionally enable **ARAM Only** mode to always queue for ARAM
 * @settings Auto-Find-Queue, Create-Delay, aram-only, Gamemode
 */
export function AutoQueue(context) {
    context.socket.observe('/lol-gameflow/v1/gameflow-phase', async (data) => {
        const gamePhase = data.data;
  
        if (ElainaData.get("Auto-Find-Queue")) {
            switch (gamePhase) {
                case "EndOfGame": {
                    autoQueue = true
                    let delay = ElainaData.get("Create-Delay")/1000

                    log(`Auto Queue will start in %c${delay}%c seconds`,"color: #blue;","")
                    let countDown = new Promise<void>((resolve, reject) => {
                        setTimeout(async () => {
                            resolve()
                            if (!ElainaData.get("aram-only")) await createQueue(ElainaData.get("Gamemode"));
                            else await createQueue(450);
                        }, delay*1000)
                    })

                    themeToast.promise(countDown, {
                        loading: `Auto Queue will start in ${delay} seconds`,
                        success: 'Queue created!!',
                        error: ''
                    }, 'elaina-auto-queue-create')
                    break;
                }
                case "Lobby": {
                    if (autoQueue) {
                        let delay = ElainaData.get("Find-Delay")/1000

                        let countDown = new Promise<void>((resolve, reject) => {
                            setTimeout(async () => {
                                resolve()
                                await matchMaking()
                            }, delay*1000)
                        })

                        themeToast.promise(countDown, {
                            loading: `Matching game will start in ${delay} seconds`,
                            success: '',
                            error: ''
                        }, 'elaina-auto-queue-matchmaking')
                    }
                    break;
                }
                case "Matchmaking": {
                    autoQueue = false
                    break;
                }
                case "ChampSelect": {
                    autoQueue = true
                    break;
                }
                case "None": {
                    autoQueue = false
                    log("Auto Queue stopped");
                    break;
                }
                default: log(`Unexpected game phase: %c${gamePhase}`, "color: #e4c2b3;");
            }
        }
    });
}

// Refrest queue list everytime go to homepage
upl.observer.subscribeToElementCreation(".rcp-fe-lol-activity-center", (element) => {
    if (element) {
        getQueueList()
        log("Queue list refreshed.")
    }
})
