import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
    // Ignore patterns
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'wiki/**',
            'Elaina-theme-data/**',
            'src/elaina-theme-data/**',
            'src/src/plugins/mcp-server/node_modules/**',
            'src/src/plugins/mcp-server/dist/**',
            'src/src/plugins/mcp-server/.npm-cache/**',
            'scripts/**',
        ],
    },

    // TypeScript parsing + JSDoc documentation rules
    {
        files: ['src/**/*.{ts,js}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        plugins: {
            jsdoc,
        },
        rules: {
            // ── Documentation enforcement ──────────────────────────────────
            // Require JSDoc on exported classes.
            // Change 'warn' → 'error' once the codebase is fully documented.
            'jsdoc/require-jsdoc': ['warn', {
                require: {
                    ClassDeclaration: true,
                    FunctionDeclaration: false,
                },
                publicOnly: true,
                checkConstructors: false,
            }],

            // Require a description in JSDoc blocks on classes
            'jsdoc/require-description': ['warn', {
                contexts: ['ClassDeclaration'],
            }],

            // Allow custom tags used by the wiki generator
            'jsdoc/check-tag-names': ['warn', {
                definedTags: [
                    'wiki',           // User-facing plugin description
                    'modifier',       // Who modified the code
                    'Nyan',           // Existing tag in the codebase
                    'settings',       // DataStore keys this plugin uses
                    'usage',          // How end users enable/use this feature
                    'category',       // Settings category
                    'link',           // Author link
                ],
            }],

            // Warn if @param has no description (off initially for gradual adoption)
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-returns': 'off',
            'jsdoc/require-returns-description': 'off',
        },
    },

    // Stricter rules specifically for plugin files
    {
        files: ['src/src/plugins/*.ts'],
        rules: {
            'jsdoc/require-jsdoc': ['warn', {
                require: {
                    ClassDeclaration: true,
                    FunctionDeclaration: true,
                },
                publicOnly: true,
                checkConstructors: false,
            }],
        },
    },
];
