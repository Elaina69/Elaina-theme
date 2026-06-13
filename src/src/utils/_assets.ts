import { pluginUrl } from '../otherThings.ts';
import { cssUrl } from './_sanitize.ts';

type AssetPathPart = unknown;

const url = (...parts: AssetPathPart[]): string => pluginUrl(...parts);
const cssAssetUrl = (...parts: AssetPathPart[]): string => cssUrl(url(...parts));

const icon = (...parts: AssetPathPart[]): string => url('assets/icon', ...parts);
const background = (...parts: AssetPathPart[]): string => url('assets/backgrounds', ...parts);
const champ = (...parts: AssetPathPart[]): string => url('assets/champs', ...parts);
const style = (...parts: AssetPathPart[]): string => url('assets/styles', ...parts);

export const assets = {
    url,
    cssUrl: cssAssetUrl,
    icon,
    cssIcon: (...parts: AssetPathPart[]): string => cssUrl(icon(...parts)),
    background,
    cssBackground: (...parts: AssetPathPart[]): string => cssUrl(background(...parts)),
    champ,
    cssChamp: (...parts: AssetPathPart[]): string => cssUrl(champ(...parts)),
    style,
    cssStyle: (...parts: AssetPathPart[]): string => cssUrl(style(...parts))
};
