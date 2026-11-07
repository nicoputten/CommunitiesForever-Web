// Item icons (WEB-90, handoff B3): fetched once by name from a CDN, kept on the site's own disk and served from there
// (src/server/itemIcons.ts). Blizzard's render CDN serves the game's icons by file name at 56 px (checked on
// 2026-11-06: `https://render.worldofwarcraft.com/eu/icons/56/inv_chest_cloth_38.jpg` is a 56 x 56 JPEG; an unknown
// name answers 403). The names come from the item database (`items.icon_name`, the client's icon file names).

/** The CDN URL for an icon; `{icon}` is replaced by the name. Config: ICON_CDN_URL (.env.example). */
export const DEFAULT_ICON_CDN = "https://render.worldofwarcraft.com/eu/icons/56/{icon}.jpg";

/** The game's own question-mark icon (INV_Misc_QuestionMark): the neutral fallback for a missing icon. */
export const FALLBACK_ICON = "inv_misc_questionmark";

/** An icon file name as the import stores it: lower case letters, digits, `_` and `-`, at most 100. */
export function iconName(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const name = raw.toLowerCase();
  return /^[a-z0-9_-]{1,100}$/.test(name) ? name : undefined;
}

export function iconUrl(template: string, name: string): string {
  return template.replace("{icon}", encodeURIComponent(name));
}

/** A JPEG starts with FF D8 FF. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
