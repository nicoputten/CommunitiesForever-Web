// WoW: Forever has one mega-realm per ruleset per region, and realm names change at launch, so the site shows the
// ruleset instead of the realm (docs/DESIGN.md §8). The group plays PvP: this table lists the PvP realm names exactly
// as the addon writes Char.realm; every other realm is PvE. Realm names are never parsed (CLAUDE.md "Platform facts").
// Sources: "CAMWOW EU4 Realm 2 PvP", the beta realm in Nico's real file (tests/fixtures/real/beta-2026-10.lua);
// "Forever PvP", the launch realm's name (Nico, 2026-10-25).

export type Ruleset = "PvP" | "PvE";

export const PVP_REALMS: ReadonlySet<string> = new Set(["CAMWOW EU4 Realm 2 PvP", "Forever PvP"]);

/** The ruleset of a character's realm; undefined when the realm is missing. */
export function rulesetOf(realm: string | undefined): Ruleset | undefined {
  if (realm === undefined) return undefined;
  return PVP_REALMS.has(realm) ? "PvP" : "PvE";
}
