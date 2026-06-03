// HOW TO ADD A NEW CHAMPION BACKGROUND:
/**
 *  - default_champion_name: The name of the champion as it appears in the client (Example: Collection tab).
 *
 *  - default_icon_id: The ID of the champion's default icon.
 *    You can find it here: https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/
 *
 *  - first_default_filename: The filename of the champion's default background image.
 *    You must use DevTools to inspect the element inside collection tab and find the filename of the default background image.
 *    Example: For Teemo, his default background image filename is "Teemo"
 *
 *  - second_default_filename: The filename of the champion's default background image.
 *    You must use DevTools to inspect the element inside collection tab and find the filename of the default background image.
 *    Example: For Teemo, his second default background image filename is "ASU_Teemo"
 *
 *  - replace_name: The name of the champion that will replace the default champion.
 *
 *  - replace_sub_name: The sub name of the champion that will replace the default champion.
 *
 *  - lore: The lore of the champion.
 *
 *  - image: The filename of the custom background image
 *
 *  - image_preview: The filename of the custom background image preview
 *
 *  - image_thumbnail: The filename of the custom background image thumbnail
 *
 *  - skill_passive, skill_q, skill_w, skill_e, skill_r:
 *    The filenames of custom ability icons. Leave blank to keep the original icon.
 *
 *  - skill_passive_name, skill_q_name, skill_w_name, skill_e_name, skill_r_name:
 *    The custom ability names. Leave blank to keep the original name.
 *
 *  - skill_passive_desc, skill_q_desc, skill_w_desc, skill_e_desc, skill_r_desc:
 *    The custom ability descriptions. Leave blank to keep the original description.
 *
 *  - css-left: The CSS left property value for positioning the background image in collection.
 *
 * Leave any replacement field blank ("") to keep the original League Client value/image for that field.
 */

export default [
        {
        "default_champion_name"     : "Aurora",
        "default_icon_id"           : 893,

        "first_default_filename"    : "Aurora",
        "second_default_filename"   : "Aurora",
        "lore"                      : "She draws the bow slowly, gently whispering her wishes. \nThough not a single note has ever changed, her audience, her stage, and she herself have been constantly evolving. \nShe will not stop playing, until this land and sky hold her music in their memory.",

        "replace_name"              : "Amiya",
        "replace_sub_name"          : "Solo Around The World",

        "image"                     : "amiyi.webp",
        "image_preview"             : "amiyi_preview.webp",
        "image_thumbnail"           : "amiyi_thumbnail.webp",

        "skill_passive"             : "amiyi_skill_passive.webp",
        "skill_passive_name"        : "Tactical Chant γ",
        "skill_passive_desc"        : "ASPD +90",

        "skill_q"                   : "amiyi_skill_q.webp",
        "skill_q_name"              : "Spirit Burst",
        "skill_q_desc"              : "Fires 8 times with 60% ATK when attacking and attacks random targets within Attack Range",

        "skill_w"                   : "amiyi_skill_w.webp",
        "skill_w_name"              : "Empathy of Grief",
        "skill_w_desc"              : "ASPD +75, and heals all nearby allies within a certain range by 25% ATK upon each attack.",

        "skill_e"                   : "amiyi_skill_e.webp",
        "skill_e_name"              : "Chimera",
        "skill_e_desc"              : "ATK +230%, Max HP +100%, Range expands, damage type changes to True; After the skill ends, Amiya will automatically be retreated",

        "skill_r"                   : "amiyi_skill_r.webp",
        "skill_r_name"              : "Vision of Mercy",
        "skill_r_desc"              : "Performs an attack with 200% ATK against all enemies in range, inflicting -60 ASPD and -60% Movement Speed on targets for 10s. For every enemy hit, ATK +30% (up to 5 stacks), subsequent damage becomes True, and attacks 2 enemies at once.",

        "css-left"                  : "160px"
    },
    {
        "default_champion_name"     : "Sona",
        "default_icon_id"           : 37,

        "first_default_filename"    : "Sona",
        "second_default_filename"   : "Sona",

        "replace_name"              : "Hatsune Miku",
        "replace_sub_name"          : "Voicaloid",
        "lore"                      : "Crypton - the parent company that owns Miku, \ngave her the concept of an android diva who came from a future where music is gone. \nHence her name meaning \"First sound from the future\"",

        "image"                     : "miku.webp",
        "image_preview"             : "miku_preview.webp",
        "image_thumbnail"           : "miku_thumbnail.webp",

        "skill_passive"             : "",
        "skill_passive_name"        : "",
        "skill_passive_desc"        : "",

        "skill_q"                   : "",
        "skill_q_name"              : "",
        "skill_q_desc"              : "",

        "skill_w"                   : "",
        "skill_w_name"              : "",
        "skill_w_desc"              : "",

        "skill_e"                   : "",
        "skill_e_name"              : "",
        "skill_e_desc"              : "",

        "skill_r"                   : "",
        "skill_r_name"              : "",
        "skill_r_desc"              : "",

        "css-left"                  : "100px"
    }
]
