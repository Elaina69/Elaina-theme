/**
 * @author Teisseire117
 * @modifier Elaina Da Catto
 * @version 1.5.0
 * @description Utility functions for League of Legends client customization
 */

import { stop } from './_stop';
import { addStyleNode } from './_addStyleNode';
import { addStyleNodeWithID } from './_addStyleNodeWithID';
import { addFont } from './_addFont';
import { updateImageSrc } from './_updateImageSrc';
import { CustomCursor } from './_CustomCursor';
import { getSummonerID } from './_getSummonerID';
import { getPUUID } from './_getPUUID';
import { subscribe_endpoint } from './_subscribe_endpoint';
import { routineAddCallback as _routineAddCallback } from './_routineAddCallback';
import { mutationObserverAddCallback as _mutationObserverAddCallback } from './_mutationObserverAddCallback';
import { freezeProperties } from './_freezeProperties';
import { sanitizeColor, sanitizeFileName, escapeHtml, escapeCssString, cssUrl, getSafeGoogleFont } from './_sanitize';

// State variables
let pvp_net_id: any,
    summoner_id: any,
    phase: any;

const routines: {callback: Function, target: string[]}[] = [];
const mutationCallbacks: {callback: Function, target: string[]}[] = [];

/**
 * Updates user PvP.net info
 * @param {MessageEvent} message - The WebSocket message event
 */
const updateUserPvpNetInfos = async (message: MessageEvent) => {
    const data = JSON.parse(message.data)[2].data;
    if (data) {
        pvp_net_id = data.id;
        summoner_id = data.summonerId;
    }
};

/**
 * Updates the gameflow phase
 * @param {MessageEvent} message - The WebSocket message event
 */
const updatePhaseCallback = async (message: MessageEvent) => {
    phase = JSON.parse(message.data)[2].data;
};

// Initialize event listeners and observers
window.addEventListener('load', () => {
    subscribe_endpoint("/lol-gameflow/v1/gameflow-phase", updatePhaseCallback);
    subscribe_endpoint("/lol-chat/v1/me", updateUserPvpNetInfos);
    
    setInterval(() => {
        routines.forEach((routine) => routine.callback());
    }, 1000);

    const observer = new MutationObserver((mutationsList: any) => {
        for (const mutation of mutationsList) {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === Node.ELEMENT_NODE && addedNode.classList) {
                    for (const addedNodeClass of addedNode.classList) {
                        for (const obj of mutationCallbacks) {
                            if (obj.target.indexOf(addedNodeClass) !== -1 || obj.target.indexOf("*") !== -1) {
                                obj.callback(addedNode);
                            }
                        }
                    }
                }
            }
        }
    });
    
    observer.observe(document, { attributes: true, childList: true, subtree: true });
});

// Export utility class
class Utils {
    get phase() { return phase; }
    set phase(value: any) { phase = value; }

    get summoner_id() { return summoner_id; }
    set summoner_id(value: any) { summoner_id = value; }

    get pvp_net_id() { return pvp_net_id; }
    set pvp_net_id(value: any) { pvp_net_id = value; }

    subscribe_endpoint = subscribe_endpoint;

    routineAddCallback(callback: Function, target: string[]) {
        _routineAddCallback(routines, callback, target);
    }

    mutationObserverAddCallback(callback: Function, target: string[]) {
        _mutationObserverAddCallback(mutationCallbacks, callback, target);
    }

    addStyleNode = addStyleNode;
    addFont = addFont;
    CustomCursor = CustomCursor;
    getSummonerID = getSummonerID;
    getPUUID = getPUUID;
    addStyleNodeWithID = addStyleNodeWithID;
    freezeProperties = freezeProperties;
    stop = stop;
    updateImageSrc = updateImageSrc;
    sanitizeColor = sanitizeColor;
    sanitizeFileName = sanitizeFileName;
    escapeHtml = escapeHtml;
    escapeCssString = escapeCssString;
    cssUrl = cssUrl;
    getSafeGoogleFont = getSafeGoogleFont;
}

const utils = new Utils();

export default utils;
