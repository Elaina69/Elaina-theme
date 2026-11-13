// The theme reads and writes globals on `window`. Tests run in plain Node, so `window` is
// just the global object. Switch a test file to a DOM environment only when it needs one.
(globalThis as any).window ??= globalThis;

// Node's global object has no events; the theme listens for `pagehide` on `window`.
const events = new EventTarget();
(globalThis as any).addEventListener ??= events.addEventListener.bind(events);
(globalThis as any).dispatchEvent ??= events.dispatchEvent.bind(events);
