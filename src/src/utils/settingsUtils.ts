import { log } from "./themeLog.ts"

export function settingsUtils(context, groupDataArray) {
    log("Loaded settings utils")
    context.rcp.postInit('rcp-fe-lol-settings', async (api) => {
        log("Loaded rcp-fe-lol-settings for Elaina's settings")
        // @ts-ignore
        window.__RCP_SETTINGS_API = api;

        // @ts-ignore
        const emberApi = window.__RCP_EMBER_API;
        const ember = await emberApi.getEmber();

        groupDataArray.forEach((groupData) => {
            const newGroup = {
                name: groupData.groupName,
                titleKey: groupData.titleKey,
                capitalTitleKey: groupData.capitalTitleKey,
                categories: [],
            };

            const addCategoryToGroup = (name, title) => {
                // @ts-ignore
                newGroup.categories.push({
                    name,
                    titleKey: title,
                    routeName: name,
                    group: newGroup,
                    loginStatus: true,
                    requireLogin: false,
                    forceDisabled: false,
                    computeds: ember.Object.create({
                        disabled: false,
                    }),
                    isEnabled: () => true,
                });
            };

            groupData.element.forEach((element) => {
                addCategoryToGroup(element.name, element.title);
            });

            api._modalManager._registeredCategoryGroups.splice(1, 0, newGroup);
            api._modalManager._refreshCategoryGroups();
        });
    });

    context.rcp.postInit('rcp-fe-ember-libs', async (api) => {
        log("Loaded rcp-fe-ember-libs for Elaina's settings")
        // @ts-ignore
        window.__RCP_EMBER_API = api;

        const ember = await api.getEmber();

        const originalExtend = ember.Router.extend;
        ember.Router.extend = function () {
            const result = originalExtend.apply(this, arguments);

            result.map(function () {
                groupDataArray.forEach((groupData) => {
                    groupData.element.forEach((element) => {
                        this.route(element.name);
                    });
                });
            });

            return result;
        };
    });

    context.rcp.postInit('rcp-fe-lol-l10n', async (api) => {
        log("Loaded rcp-fe-lol-l10n for Elaina's settings")
        const tra = api.tra();

        const originalGet = tra.__proto__.get;
        tra.__proto__.get = function (key) {
            if (key.startsWith('el_')) {
                for (const groupData of groupDataArray) {
                    if (key === groupData.titleKey) {
                        return groupData.titleName;
                    } 
                    else if (key === groupData.capitalTitleKey) {
                        return groupData.capitalTitleName;
                    }
                    for (const element of groupData.element) {
                        if (key === element.title) {
                            return element.titleName;
                        }
                    }
                }
            }

            return originalGet.apply(this, [key]);
        };
    });

    context.rcp.postInit('rcp-fe-ember-libs', async (api) => {
        log("Loaded rcp-fe-ember-libs for Elaina's settings")
        // @ts-ignore
        window.__RCP_EMBER_API = api;

        const ember = await api.getEmber();

        const originalExtend = ember.Router.extend;
        ember.Router.extend = function () {
            const result = originalExtend.apply(this, arguments);

            result.map(function () {
                groupDataArray.forEach((groupData) => {
                    groupData.element.forEach((element) => {
                        this.route(element.name);
                    });
                });
            });

            return result;
        };

        const factory = await api.getEmberApplicationFactory();

        const originalBuilder = factory.factoryDefinitionBuilder;
        factory.factoryDefinitionBuilder = function () {
            const builder = originalBuilder.apply(this, arguments);
            const originalBuild = builder.build;

            builder.build = function () {
                const name = this.getName();
                if (name === 'rcp-fe-lol-settings') {
                    // @ts-ignore
                    window.__SETTINGS_OBJECT = this;

                    const addTab = (name, id, tab) => {
                        this.addTemplate(
                            name,
                            ember.HTMLBars.template({
                                id,
                                block: JSON.stringify(tab),
                                meta: {},
                            })
                        );
                    };

                    const createSettingsTab = (className) => ({
                        statements: [
                            ['open-element', 'lol-uikit-scrollable', []],
                            ['static-attr', 'class', className],
                            ['flush-element'],
                            ['close-element'],
                        ],
                        locals: [],
                        named: [],
                        yields: [],
                        blocks: [],
                        hasPartials: false,
                    });

                    groupDataArray.forEach((groupData) => {
                        groupData.element.forEach((element) => {
                            addTab(
                                element.name,
                                element.id,
                                createSettingsTab(element.class)
                            );
                        });
                    });
                }

                return originalBuild.apply(this, arguments);
            };

            return builder;
        };
    });
}