// HOW TO ADD A NEW CHAMPION BACKGROUND: 
/**
 *  - default_champion_name: The name of the champion as it appears in the client (Example: Collection tab).
 * 
 *  - first_default_filename: The filename of the champion's default background image. 
 *    You must use DevTools to inspect the element inside collection tab and find the filename of the default background image.
 *    Example: For Teemo, his default background image filename is "Teemo"
 * 
 *  - second_default_filename: The filename of the champion's default background image. 
 *    You must use DevTools to inspect the element inside collection tab and find the filename of the default background image.
 *    Example: For Teemo, his second default background image filename is "ASU_Teemo"
 * 
 *  - default_icon_id: The ID of the champion's default icon. 
 *    You can find it here: https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/
 * 
 *  - replace_name: The name of the champion that will replace the default champion.
 * 
 *  - replace_sub_name: The sub name of the champion that will replace the default champion.
 * 
 *  - image: The filename of the custom background image
 * 
 *  - image_preview: The filename of the custom background image preview
 * 
 *  - image_thumbnail: The filename of the custom background image thumbnail
 * 
 *  - css-left: The CSS left property value for positioning the background image.
 * 
 *  - lore: The lore of the champion.  
 */

export default [
    {
        "default_champion_name"     : "Sona",
        "first_default_filename"    : "Sona",
        "second_default_filename"   : "Sona",
        "default_icon_id"           : 37,

        "replace_name"              : "Hatsune Miku",
        "replace_sub_name"          : "Voicaloid",
        "image"                     : "miku.webp",
        "image_preview"             : "miku_preview.png",
        "image_thumbnail"           : "miku_thumbnail.png",
        "css-left"                  : "100px",
        "lore"                      : "Crypton - the parent company that owns Miku, \ngave her the concept of an android diva who came from a future where music is gone. \nHence her name meaning \"First sound from the future\"",
    },
    {
        "default_champion_name"     : "Aurora",
        "first_default_filename"    : "Aurora",
        "second_default_filename"   : "Aurora",
        "default_icon_id"           : 893,

        "replace_name"              : "Amiya",
        "replace_sub_name"          : "Solo Around The World",
        "image"                     : "amiyi.webp",
        "image_preview"             : "amiyi_preview.png",
        "image_thumbnail"           : "amiyi_thumbnail.png",
        "css-left"                  : "160px",
        "lore"                      : "She draws the bow slowly, gently whispering her wishes. \nThough not a single note has ever changed, her audience, her stage, and she herself have been constantly evolving. \nShe will not stop playing, until this land and sky hold her music in their memory.",
    }
]
