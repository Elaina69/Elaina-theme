import { CHROME_SCREENS, HOME_SCREENS } from './playbackProgress.ts';

/** Watch viewport roots only; League reuses the homepage by toggling its hidden class. */
export class ClientPageObserver {
    private observer: MutationObserver | null = null;
    private containers = new Set<Element>();
    private roots = new Set<HTMLElement>();
    private queued = false;
    private currentRoot: HTMLElement | null = null;
    private currentName: string | null = null;

    constructor(private changed: (root: HTMLElement) => void | Promise<void>) {}

    start(): void {
        if (this.observer) return;
        this.observer = new MutationObserver(records => {
            if (records.some(record => record.type === 'childList')) this.observeRoots();
            this.schedule();
        });
        document.querySelectorAll('.rcp-fe-viewport-main, .rcp-fe-viewport-persistent').forEach(el => this.containers.add(el));
        this.observeRoots();
        this.reconcile();
    }

    observeScreen(root: HTMLElement): void {
        const name = root.getAttribute('data-screen-name');
        if (!name || CHROME_SCREENS.has(name) || !root.parentElement) return;
        this.start();
        this.containers.add(root.parentElement);
        this.observeRoots();
        this.schedule();
    }

    private observeRoots(): void {
        if (!this.observer) return;
        this.observer.disconnect();
        this.roots.clear();
        for (const container of this.containers) {
            if (!container.isConnected) { this.containers.delete(container); continue; }
            this.observer.observe(container, { childList: true });
            for (const child of container.children) {
                if (!(child instanceof HTMLElement) || !child.classList.contains('screen-root')) continue;
                if (CHROME_SCREENS.has(child.getAttribute('data-screen-name') ?? '')) continue;
                this.roots.add(child);
                this.observer.observe(child, { attributes: true, attributeFilter: ['class', 'style', 'hidden', 'data-screen-name'] });
            }
        }
    }

    private schedule(): void {
        if (this.queued) return;
        this.queued = true;
        queueMicrotask(() => { this.queued = false; if (this.observer) this.reconcile(); });
    }

    private reconcile(): void {
        const visible = [...this.roots].filter(root => root.isConnected && !root.hidden && !root.classList.contains('hidden') && getComputedStyle(root).display !== 'none');
        // A persistent homepage can stay mounted underneath another page.
        const root = visible.find(el => !HOME_SCREENS.has(el.getAttribute('data-screen-name') ?? '')) ?? visible[0];
        if (!root) return;
        const name = root.getAttribute('data-screen-name');
        if (root === this.currentRoot && name === this.currentName) return;
        this.currentRoot = root;
        this.currentName = name;
        void Promise.resolve(this.changed(root)).catch(reason => console.error('Elaina homepage navigation failed:', reason));
    }

    stop(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.containers.clear();
        this.roots.clear();
        this.currentRoot = null;
        this.currentName = null;
    }
}
