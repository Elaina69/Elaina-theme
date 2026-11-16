/**
 * Adds a mutation observer callback
 * @param {function} callback - The callback function
 * @param {string} target - The list of class targets
 */
export function mutationObserverAddCallback(
    mutationCallbacks: {callback: Function, target: string[]}[],
    callback: Function,
    target: string[]
) {
    mutationCallbacks.push({ callback, target });
}

/** Dispatch each subscriber once even when several of its classes match one node. */
export function dispatchAddedNode(
    mutationCallbacks: { callback: Function, target: string[] }[],
    addedNode: Element,
): void {
    for (const obj of mutationCallbacks) {
        if (!obj.target.includes('*') && !obj.target.some(name => addedNode.classList.contains(name))) continue;
        try {
            void Promise.resolve(obj.callback(addedNode)).catch(err => console.error('Elaina utils DOM callback failed:', err));
        } catch (err) {
            console.error('Elaina utils DOM callback failed:', err);
        }
    }
}
