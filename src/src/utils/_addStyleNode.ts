import { styleEngine } from './_styleEngine.ts';

let legacyStyleNodeCounter = 0;

/** Adds a CSS style to the document head. */
export function addStyleNode(style: string) {
    legacyStyleNodeCounter++;
    styleEngine.apply(`legacy-${legacyStyleNodeCounter}`, style);
}
