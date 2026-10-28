// The main navigation: top bar on desktop, tab bar on phone.

export const NAV = [
  { href: "/", label: "Map" },
  { href: "/roster", label: "Roster" },
  { href: "/professions", label: "Professions" },
  { href: "/runs", label: "Runs" },
] as const;

export type NavHref = (typeof NAV)[number]["href"];

/**
 * The current section: "/" for the map itself and the dungeon pages (WEB-42), a section for its sub-pages too (a
 * character page is Roster).
 */
export function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/dungeons/");
  if (href === "/roster" && pathname.startsWith("/character/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
