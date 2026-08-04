/**
 * @author Elaina Da Catto
 * @version 1.6.0
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
import { assets } from './_assets.ts';
import { styleEngine } from './_styleEngine.ts';
import { assetReplacement } from './_assetReplacement.ts';

// State variables
let pvp_net_id: any,
    summoner_id: any,
    phase: any;

type PhaseChangeCallback = (currentPhase: any, previousPhase: any) => void | Promise<void>;

const routines: {callback: Function, target: string[]}[] = [];
const mutationCallbacks: {callback: Function, target: string[]}[] = [];
const phaseChangeCallbacks = new Set<PhaseChangeCallback>();

function setPhase(value: any): void {
    const previousPhase = phase;
    phase = value;

    if (previousPhase === value) return;

    for (const callback of Array.from(phaseChangeCallbacks)) {
        try {
            const result = callback(value, previousPhase);
            if (result instanceof Promise) {
                result.catch((err) => console.error("Elaina utils phase callback failed:", err));
            }
        }
        catch (err) {
            console.error("Elaina utils phase callback failed:", err);
        }
    }
}

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
    setPhase(JSON.parse(message.data)[2].data);
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
    set phase(value: any) { setPhase(value); }

    get summoner_id() { return summoner_id; }
    set summoner_id(value: any) { summoner_id = value; }

    get pvp_net_id() { return pvp_net_id; }
    set pvp_net_id(value: any) { pvp_net_id = value; }

    subscribe_endpoint = subscribe_endpoint;

    onPhaseChange(callback: PhaseChangeCallback) {
        phaseChangeCallbacks.add(callback);
        return () => phaseChangeCallbacks.delete(callback);
    }

    routineAddCallback(callback: Function, target: string[]) {
        _routineAddCallback(routines, callback, target);
    }

    mutationObserverAddCallback(callback: Function, target: string[]) {
        _mutationObserverAddCallback(mutationCallbacks, callback, target);
    }

    getSummonerID = getSummonerID;
    getPUUID = getPUUID;
    
    stop = stop;

    addStyleNode = addStyleNode;
    addStyleNodeWithID = addStyleNodeWithID;
    freezeProperties = freezeProperties;
    addFont = addFont;
    CustomCursor = CustomCursor;

    updateImageSrc = updateImageSrc;
    assets = assets;
    styleEngine = styleEngine;
    assetReplacement = assetReplacement;

    sanitizeColor = sanitizeColor;
    sanitizeFileName = sanitizeFileName;
    escapeHtml = escapeHtml;
    escapeCssString = escapeCssString;
    cssUrl = cssUrl;
    getSafeGoogleFont = getSafeGoogleFont;
}

const utils = new Utils();

export default utils;
