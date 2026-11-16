import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMcpBrowser } from './fakes/mcpBrowser';
import { dispatchAddedNode } from '../src/src/utils/_mutationObserverAddCallback';
let env: ReturnType<typeof installMcpBrowser>;
beforeEach(() => { env = installMcpBrowser(); });
afterEach(async () => { await env.dispose(); });
describe('shared UPL creation callback dispatch', () => {
    it('calls a subscriber only once when several target classes match', () => {
        const node = document.createElement('div'); node.className = 'screen-root first second';
        const callback = vi.fn(); dispatchAddedNode([{ callback, target: ['first','second'] }], node);
        expect(callback).toHaveBeenCalledExactlyOnceWith(node);
    });
    it('keeps wildcard subscriptions and isolates callback failures', async () => {
        const node = document.createElement('div'); const callback = vi.fn();
        dispatchAddedNode([{ callback: () => { throw new Error('failure'); }, target:['*'] }, { callback, target:['*'] }], node);
        await Promise.resolve(); expect(callback).toHaveBeenCalledExactlyOnceWith(node);
        expect(env.console.error).toHaveBeenCalled();
    });
});
