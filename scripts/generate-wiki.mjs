#!/usr/bin/env node

/**
 * GitHub Wiki generator for Elaina Theme.
 *
 * The wiki text is maintained in docs/wiki-content.json.
 * Setting descriptions are maintained in docs/settings-meta.json.
 *
 * Usage:
 *   node scripts/generate-wiki.mjs
 *   node scripts/generate-wiki.mjs --check
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'src', 'src', 'config');
const LOCALES_DIR = path.join(ROOT, 'src', 'src', 'locales');
const DOCS_DIR = path.join(ROOT, 'docs');
const WIKI_DIR = path.join(ROOT, 'wiki');

const DEFAULTS_FILE = path.join(CONFIG_DIR, 'datastoreDefault.js');
const LOCALE_FILE = path.join(LOCALES_DIR, 'default.js');
const SETTINGS_META_FILE = path.join(DOCS_DIR, 'settings-meta.json');
const WIKI_CONTENT_FILE = path.join(DOCS_DIR, 'wiki-content.json');

const CHECK_MODE = process.argv.includes('--check');
const warnings = [];
const errors = [];

async function loadJsDefault(filePath, fallback, label) {
    try {
        const module = await import(pathToFileURL(filePath).href);
        return module.default ?? fallback;
    } catch (err) {
        errors.push(`Could not load ${label}: ${err.message}`);
        return fallback;
    }
}

function loadJson(filePath, fallback, label) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
        errors.push(`Could not load ${label}: ${err.message}`);
        return fallback;
    }
}

function inferType(value) {
    if (value === null || value === undefined) return 'unknown';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function formatDefault(value) {
    if (value === undefined) return '_not set in defaults_';
    if (typeof value === 'string') return value === '' ? '_empty_' : `\`${escapePipes(`"${value}"`)}\``;
    if (Array.isArray(value)) return value.length === 0 ? '_empty list_' : `_${value.length} items_`;
    if (typeof value === 'object') return '_object_';
    return `\`${String(value)}\``;
}

function escapePipes(value) {
    return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function sanitizeLocaleProperty(key) {
    return String(key)
        .replace(/&/g, ' and ')
        .replace(/[’'`]/g, '')
        .replace(/\+/g, ' plus ')
        .replace(/[\s_./]+/g, '-')
        .replace(/[^A-Za-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}

function settingLocaleKey(key, settingsMeta) {
    const documented = settingsMeta.settings?.[key]?.localeKey;
    if (documented) return documented;
    const explicitKeys = {
        auto_accept: 'auto-accept.auto-accept',
        auto_accept_delay: 'auto-accept.auto-accept-delay',
        BE: 'loot-helper.be',
    };

    if (explicitKeys[key]) return explicitKeys[key];

    const category = settingsMeta.settings?.[key]?.category;
    const prefixByCategory = {
        backup: 'backup-restore',
        plugins: 'plugins-settings',
        tft: 'theme-settings',
        'theme-core': 'theme-settings',
        'theme-visual': 'theme-settings',
        'custom-assets': 'theme-settings',
        'wallpaper-audio': 'theme-settings',
    };
    const prefix = prefixByCategory[category] || 'theme-settings';
    return `${prefix}.${sanitizeLocaleProperty(key)}`;
}

function settingLabel(key, locale, settingsMeta) {
    const localeKey = settingLocaleKey(key, settingsMeta);
    return locale[localeKey] || settingsMeta.settings?.[key]?.label || locale[key] || locale[key.replace(/-/g, '_')] || key;
}

function settingRow(key, defaults, settingsMeta, locale) {
    const meta = settingsMeta.settings?.[key];
    const value = Object.hasOwn(defaults, key) ? defaults[key] : meta?.default;
    const type = meta?.type || inferType(value);
    const label = settingLabel(key, locale, settingsMeta);
    const description = meta?.description || label || '_Missing description_';
    return `| \`${escapePipes(key)}\` | ${escapePipes(label)} | ${formatDefault(value)} | ${escapePipes(type)} | ${escapePipes(description)} |`;
}

function renderSettingTable(keys, defaults, settingsMeta, locale) {
    const rows = keys.map((key) => settingRow(key, defaults, settingsMeta, locale));
    return [
        '| Setting key | UI label | Default | Type | Function |',
        '|-------------|----------|---------|------|----------|',
        ...rows,
    ].join('\n');
}

function renderSettingGroups(groups, defaults, settingsMeta, locale) {
    return groups.map((group) => {
        const description = group.description ? `${group.description}\n\n` : '';
        return `### ${group.title}\n\n${description}${renderSettingTable(group.keys, defaults, settingsMeta, locale)}`;
    }).join('\n\n');
}

function renderAssetTable(assets) {
    return [
        '| Asset | Folder | Supported formats | Data list | Function |',
        '|-------|--------|-------------------|-----------|----------|',
        ...assets.map((asset) => `| ${asset.name} | \`${asset.folder}\` | ${asset.formats.map((format) => `\`${format}\``).join(', ')} | \`${asset.listKey}\` | ${escapePipes(asset.description)} |`),
    ].join('\n');
}

function renderBulletList(items) {
    return items.map((item) => `- ${item}`).join('\n');
}

function renderNumberedList(items) {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function renderInstallationQuickGuide(quickGuide) {
    if (!quickGuide) return '';

    const steps = quickGuide.steps.map((step, index) => {
        const images = (step.images || [])
            .map((image) => `<img alt="${image.alt || 'image'}" src="${image.src}" />`)
            .join('\n\n');
        const body = step.body ? `\n\n${step.body}` : '';
        const imageBlock = images ? `\n\n${images}` : '';

        return `${index + 1}. ${step.title}${body}${imageBlock}`;
    }).join('\n\n');

    const tree = quickGuide.tree
        ? `\n\n### Expected folder structure\n\n${quickGuide.treeIntro || ''}\n\n\`\`\`text\n${quickGuide.tree}\n\`\`\``
        : '';

    return `## Main Installation Guide\n\n**${quickGuide.warning}**\n\n***\n\n${steps}${tree}\n`;
}

function renderLinkList(items) {
    return items.map((item) => `- [${item.title}](${item.file.replace(/\.md$/, '')})`).join('\n');
}

function renderPageFooter() {
    return [
        '',
        '---',
        '',
        // '> This page is generated from `docs/wiki-content.json`, `docs/settings-meta.json`, and `src/src/config/datastoreDefault.js`.',
        // '> Edit those files to update the wiki content.',
        '',
    ].join('\n');
}

function generateHomePage(content, defaults) {
    const visibleSettings = Object.entries(defaults).filter(([key]) => !content.internalSettingKeys?.includes(key));
    return `# 1. Home

${content.home.introduction}

## Wiki sections

${renderLinkList(content.navigation.filter((item) => item.file !== 'Home.md'))}

## What Elaina Theme changes

${renderBulletList(content.home.features)}

## Current configuration model

${renderBulletList(content.home.configurationModel)}

## Generated reference

- Settings loaded from \`datastoreDefault.js\`: ${Object.keys(defaults).length}
- Visible documented settings: ${visibleSettings.length}
- Main settings tabs in client: Theme Settings, Plugins Settings, Backup & Restore, About Us
${renderPageFooter()}`;
}

function generateInstallationPage(content) {
    const install = content.installation;
    return `# 2. Installation Instructions

${install.introduction}

## Requirements

${renderBulletList(install.requirements)}

${renderInstallationQuickGuide(install.quickGuide)}

## Folder layout

${renderBulletList(install.folderLayout)}

## After installation

${renderNumberedList(install.afterInstall)}
${renderPageFooter()}`;
}

function generateThemeCustomizationPage(content, defaults, settingsMeta, locale) {
    const theme = content.themeCustomization;
    return `# 3. Theme Customization

${theme.introduction}

## 3.1. Add Wallpaper/Audio

${theme.assets.introduction}

${renderAssetTable(theme.assets.items)}

### Legacy settings without PluginFS

${renderNumberedList(theme.assets.legacySteps)}

### Pengu with usable PluginFS

${renderNumberedList(theme.assets.pluginFsSteps)}

### Asset rules

${renderBulletList(theme.assets.rules)}

## 3.2. Theme Settings

${theme.themeSettingsIntroduction}

${renderSettingGroups(theme.themeSettingGroups, defaults, settingsMeta, locale)}

## 3.3. Plugins Settings

${theme.pluginSettingsIntroduction}

${renderSettingGroups(theme.pluginSettingGroups, defaults, settingsMeta, locale)}
${renderPageFooter()}`;
}

function generateBackupRestorePage(content, defaults, settingsMeta, locale) {
    const backup = content.backupRestore;
    return `# 4. Backup/Restore

${backup.introduction}

## Storage modes

${renderBulletList(backup.storageModes)}

## Related settings

${renderSettingTable(backup.settingKeys, defaults, settingsMeta, locale)}

## Manual backup

${renderNumberedList(backup.manualBackup)}

## Manual restore

${renderNumberedList(backup.manualRestore)}

## Cloud backup

${renderNumberedList(backup.cloudBackup)}

## Cloud restore/delete

${renderNumberedList(backup.cloudRestore)}

## Notes

${renderBulletList(backup.notes)}
${renderPageFooter()}`;
}

function generateFaqPage(content) {
    return `# 5. FAQ & Troubleshooting

${content.faq.introduction}

${content.faq.items.map((item) => `## ${item.question}\n\n${renderBulletList(item.answer)}`).join('\n\n')}
${renderPageFooter()}`;
}

function generateSidebar(content) {
    return content.navigation.map((item) => `- [${item.title}](${item.file.replace(/\.md$/, '')})`).join('\n') + '\n';
}

function validateContent(content, defaults, settingsMeta) {
    const defaultKeys = new Set(Object.keys(defaults));
    const metaKeys = new Set(Object.keys(settingsMeta.settings || {}));
    const runtimeKeys = new Set(content.runtimeSettingKeys || []);
    const referencedKeys = new Set();

    const collectKeys = (groups = []) => {
        for (const group of groups) {
            for (const key of group.keys || []) referencedKeys.add(key);
        }
    };

    collectKeys(content.themeCustomization?.themeSettingGroups);
    collectKeys(content.themeCustomization?.pluginSettingGroups);
    for (const key of content.backupRestore?.settingKeys || []) referencedKeys.add(key);

    for (const key of referencedKeys) {
        if (!defaultKeys.has(key) && !runtimeKeys.has(key)) {
            warnings.push(`[WIKI CONTENT] Referenced setting "${key}" is not in datastoreDefault.js`);
        }
        if (!metaKeys.has(key)) {
            warnings.push(`[WIKI CONTENT] Referenced setting "${key}" is missing from docs/settings-meta.json`);
        }
    }

    for (const key of defaultKeys) {
        if (!metaKeys.has(key)) {
            warnings.push(`[SETTINGS META] "${key}" exists in datastoreDefault.js but is missing from docs/settings-meta.json`);
        }
    }

    const pageFiles = new Set(content.navigation?.map((item) => item.file));
    const requiredPages = ['Home.md', 'Installation-instructions.md', 'Theme-customization.md', 'Backup-Restore.md', 'FAQ-Troubleshooting.md'];
    for (const page of requiredPages) {
        if (!pageFiles.has(page)) errors.push(`[NAVIGATION] Missing ${page} from docs/wiki-content.json navigation`);
    }
}

async function main() {
    console.log('Generating Elaina Theme wiki');

    const defaults = await loadJsDefault(DEFAULTS_FILE, {}, 'datastoreDefault.js');
    const locale = await loadJsDefault(LOCALE_FILE, {}, 'default locale');
    const settingsMeta = loadJson(SETTINGS_META_FILE, { categories: {}, settings: {} }, 'settings-meta.json');
    const content = loadJson(WIKI_CONTENT_FILE, {}, 'wiki-content.json');

    validateContent(content, defaults, settingsMeta);

    if (CHECK_MODE) {
        for (const warning of warnings) console.log(`WARN: ${warning}`);
        for (const error of errors) console.log(`ERROR: ${error}`);
        console.log(`Checked ${Object.keys(defaults).length} settings and ${content.navigation?.length || 0} wiki pages.`);
        if (errors.length > 0) process.exit(1);
        process.exit(0);
    }

    if (errors.length > 0) {
        for (const error of errors) console.error(`ERROR: ${error}`);
        process.exit(1);
    }

    fs.mkdirSync(WIKI_DIR, { recursive: true });

    const pages = {
        'Home.md': generateHomePage(content, defaults),
        'Installation-instructions.md': generateInstallationPage(content),
        'Theme-customization.md': generateThemeCustomizationPage(content, defaults, settingsMeta, locale),
        'Backup-Restore.md': generateBackupRestorePage(content, defaults, settingsMeta, locale),
        'FAQ-Troubleshooting.md': generateFaqPage(content),
        '_Sidebar.md': generateSidebar(content),
    };

    for (const [filename, markdown] of Object.entries(pages)) {
        fs.writeFileSync(path.join(WIKI_DIR, filename), markdown, 'utf-8');
    }

    console.log(`Written ${Object.keys(pages).length} wiki pages to ${path.relative(ROOT, WIKI_DIR)}`);
    if (warnings.length > 0) {
        console.log('\nDocumentation warnings:');
        for (const warning of warnings) console.log(`WARN: ${warning}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
