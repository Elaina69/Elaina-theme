// The theme reads and writes globals on `window`. Tests run in plain Node, so `window` is
// just the global object. Switch a test file to a DOM environment only when it needs one.
(globalThis as any).window ??= globalThis;
