import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts on purpose: that config deploys the build into the
// Pengu plugins folder, which tests must never do.
export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        setupFiles: ['tests/setup.ts'],
    },
});
