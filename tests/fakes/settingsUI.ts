import { vi } from 'vitest';

/** Minimal DOM-shaped tree for settings callbacks; no browser or extra package needed. */
export class FakeElement {
    children: FakeElement[] = [];
    parent: FakeElement | null = null;
    style: Record<string, string> = {};
    attributes = new Map<string, string>();
    id = '';
    className = '';
    textContent = '';
    value = '';
    files: File[] | null = null;
    onchange?: (event: any) => unknown;
    onclick?: (event?: any) => unknown;
    toggle?: () => unknown;
    removed = false;

    constructor(readonly tagName = 'div') {}
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    appendChild(element: FakeElement) { element.parent = this; this.children.push(element); return element; }
    append(...elements: FakeElement[]) { elements.forEach(element => this.appendChild(element)); }
    prepend(element: FakeElement) { element.parent = this; this.children.unshift(element); }
    remove() {
        this.removed = true;
        if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    }
    click = vi.fn(() => this.onclick?.());
}

export function findElement(elements: FakeElement[], name: string): FakeElement | undefined {
    for (const element of elements) {
        if (element.id === name || element.className === name) return element;
        const child = findElement(element.children, name);
        if (child) return child;
    }
}

export const fakeUI = {
    createLoading(text: string) { return this.createLabel(text, 'settings-loading'); },
    createLabel(text = '', id = '') {
        const element = new FakeElement('p'); element.id = id; element.textContent = text; return element;
    },
    createRow(id: string, children: FakeElement[]) {
        const element = new FakeElement(); element.id = id; element.append(...children); return element;
    },
    createButton(text: string, className: string, onclick: () => unknown) {
        const element = this.createLabel(text); element.className = className; element.onclick = onclick; return element;
    },
    fileInput(id: string, _accept: string, onchange: (event: any) => unknown) {
        const element = new FakeElement('input'); element.id = id; element.onchange = onchange; return element;
    },
    createCheckBox(_text: string, id: string, _boxId: string, check: () => unknown, _show: boolean, key: string) {
        const element = new FakeElement(); element.id = id;
        element.toggle = () => { ElainaData.set(key, !ElainaData.get(key)); return check(); };
        return element;
    },
};
