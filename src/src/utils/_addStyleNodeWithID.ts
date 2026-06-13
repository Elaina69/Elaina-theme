import { styleEngine } from './_styleEngine.ts';

/** Adds or replaces a CSS style with a specific ID. */
export function addStyleNodeWithID(Id: string, style: string) {
    styleEngine.apply(Id, style);
}
