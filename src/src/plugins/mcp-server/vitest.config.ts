import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: { include: ['server/tests/**/*.test.ts'], testTimeout: 15000, restoreMocks: true },
});
