import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CLASSES,
  DUNGEONS,
  BATTLEGROUND,
  ELSEWHERE,
  PROFESSIONS,
  RACES,
  ZONE_ALIASES,
  classInfo,
  dungeonPosition,
  professionInfo,
  raceInfo,
  rankForCap,
  resolveZone,
  rulesetOf,
} from "@/core/gamedata";
import { parseLua } from "@/core/lua";
import map from "@/core/map/zones.json";
import { normalize } from "@/core/normalize";

const zones = new Map(map.zones.map((z) => [z.id, z]));
const playable = map.zones.filter((z) => z.kind === "zone");

const root = new URL("../fixtures/", import.meta.url);
const files = [
  ...readdirSync(new URL("addon/", root)).map((release) => `addon/${release}/savedvariables.lua`),
  ...readdirSync(new URL("real/", root)).map((file) => `real/${file}`),
];
const datasets = files.map((path) => normalize(parseLua(readFileSync(new URL(path, root), "utf8"))));
const characters = datasets.flatMap((d) => Object.values(d.characters).filter((c) => c.hasRecord));

/** Even-odd point-in-polygon over the "M x,y x,y …Z" rings zones.json writes. */
function insidePath(d: string, x: number, y: number): boolean {
  let inside = false;
  for (const ring of d.match(/M[^Z]*Z/g) ?? []) {
    const pts = ring
      .slice(1, -1)
      .trim()
      .split(" ")
      .map((p) => p.split(",").map(Number) as [number, number]);
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!;
      const [xj, yj] = pts[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

describe("classes", () => {
  // The token names of docs/DESIGN.md §3 (tokens.css follows them in WEB-15).
  const design = readFileSync(new URL("../../docs/DESIGN.md", import.meta.url), "utf8");
  const tokens = new Set(design.match(/--[a-z-]+(?=:)/g));

  it.each(Object.values(CLASSES))("$name has its colour and text tokens", (c) => {
    expect(tokens).toContain(c.colorToken);
    expect(tokens).toContain(c.textToken);
  });

  it("uses the -text token where the design has one", () => {
    for (const c of Object.values(CLASSES)) {
      const text = `${c.colorToken}-text`;
      expect(c.textToken).toBe(tokens.has(text) ? text : c.colorToken);
    }
  });

  it("knows every class in the fixtures and missing or unknown ones are undefined", () => {
    for (const c of characters) expect(classInfo(c.classFile)?.classFile).toBe(c.classFile);
    expect(classInfo(undefined)).toBeUndefined();
    expect(classInfo("DEATHKNIGHT")).toBeUndefined();
    expect(classInfo("toString")).toBeUndefined();
  });
});

describe("races", () => {
  it("has the eight Vanilla races and Skyborne for each faction", () => {
    expect(Object.keys(RACES).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 95, 96]);
    expect(Object.values(RACES).filter((r) => r.faction === "Horde")).toHaveLength(5);
    expect([raceInfo(95)?.faction, raceInfo(96)?.faction]).toEqual(["Alliance", "Horde"]);
    expect(raceInfo(95)?.name).toBe("Skyborne");
  });

  it("matches the faction the addon recorded", () => {
    for (const c of characters) expect(raceInfo(c.raceID)?.faction).toBe(c.faction);
    expect(raceInfo(undefined)).toBeUndefined();
    expect(raceInfo(10)).toBeUndefined();
  });
});

describe("professions", () => {
  it("has nine primary and three secondary professions", () => {
    const all = Object.values(PROFESSIONS);
    expect(all.filter((p) => p.kind === "primary")).toHaveLength(9);
    expect(
      all
        .filter((p) => p.kind === "secondary")
        .map((p) => p.name)
        .sort(),
    ).toEqual(["Cooking", "First Aid", "Fishing"]);
  });

  it("knows every profession in the fixtures by the addon's key and name", () => {
    for (const c of characters) {
      for (const [id, p] of Object.entries(c.professions)) expect(professionInfo(id)?.name).toBe(p.name);
    }
    expect(professionInfo("633")).toBeUndefined();
    expect(professionInfo(undefined)).toBeUndefined();
  });

  it("names the rank of a cap", () => {
    expect([75, 150, 225, 300].map((max) => rankForCap(max)?.name)).toEqual([
      "Apprentice",
      "Journeyman",
      "Expert",
      "Artisan",
    ]);
    expect(rankForCap(1)).toBeUndefined();
    expect(rankForCap(undefined)).toBeUndefined();
  });
});

describe("rulesets", () => {
  it("shows the beta and launch realms as PvP and every other realm as PvE", () => {
    expect(rulesetOf("CAMWOW EU4 Realm 2 PvP")).toBe("PvP");
    expect(rulesetOf("Forever PvP")).toBe("PvP");
    expect(rulesetOf("Classic Beta PvP")).toBe("PvE");
    expect(rulesetOf("Some PvP Realm")).toBe("PvE");
    expect(rulesetOf(undefined)).toBeUndefined();
  });

  it("gives Nico's real characters the PvP ruleset", () => {
    const real = datasets[files.indexOf("real/beta-2026-10.lua")]!;
    const own = Object.values(real.characters).filter((c) => c.realm !== undefined);
    expect(own.length).toBeGreaterThan(0);
    for (const c of own) expect(rulesetOf(c.realm)).toBe("PvP");
  });
});

describe("dungeons", () => {
  it("has unique ids and names", () => {
    expect(new Set(DUNGEONS.map((d) => d.id)).size).toBe(DUNGEONS.length);
    expect(new Set(DUNGEONS.map((d) => d.name)).size).toBe(DUNGEONS.length);
  });

  const onMap = DUNGEONS.filter((d) => d.zone !== ELSEWHERE);

  it.each(onMap)("$name is in an existing zone, with a map position inside it", (d) => {
    const zone = zones.get(d.zone);
    expect(zone).toBeDefined();
    const at = dungeonPosition(d);
    expect(at).toBeDefined();
    expect(insidePath(zone!.d, at!.x, at!.y)).toBe(true);
  });

  it("matches the map's dungeon list", () => {
    expect(map.dungeons.map((d) => [d.name, d.zone]).sort()).toEqual(onMap.map((d) => [d.name, d.zone]).sort());
  });

  it("puts every dungeon and raid on the map, Forever's in their new zones", () => {
    expect(DUNGEONS.filter((d) => d.zone === ELSEWHERE)).toEqual([]);
    for (const [text, zone] of [
      ["Krol'dok Stronghold", "riverglades"],
      ["The Barrow Deeps", "hyjal"],
      ["Hyjal Summit", "hyjal"],
    ] as const) {
      expect(resolveZone(text).zone).toBe(zone);
      expect(zones.get(zone)?.kind).toBe("zone");
    }
  });

  it("lists only the raids announced for Forever", () => {
    expect(DUNGEONS.filter((d) => d.kind === "raid").map((d) => d.name)).toEqual([
      "Onyxia's Lair",
      "The Barrow Deeps",
      "Hyjal Summit",
    ]);
  });

  it.each(DUNGEONS)("$name has a typical range that spans its wings", (d) => {
    const { min, max } = d.typicalLevels;
    expect(min).toBeGreaterThanOrEqual(1);
    expect(max).toBeLessThanOrEqual(60);
    expect(min).toBeLessThanOrEqual(max);
    if (d.wings) {
      expect(Math.min(...d.wings.map((w) => w.typicalLevels.min))).toBe(min);
      expect(Math.max(...d.wings.map((w) => w.typicalLevels.max))).toBe(max);
    }
    expect(d.zoneTexts).toContain(d.name);
  });
});

describe("map zones", () => {
  // The ids of the map before WEB-31; sightings and the UI refer to them, so they never change.
  const vanilla = [
    "teldrassil", "darkshore", "moonglade", "winterspring", "felwood", "hyjal", "azshara", "ashenvale", "stonetalon",
    "durotar", "barrens", "mulgore", "desolace", "feralas", "dustwallow", "needles", "ungoro", "tanaris", "silithus",
    "uldum", "tirisfal", "wpl", "epl", "silverpine", "hillsbrad", "hinterlands", "arathi", "gilneas", "wetlands",
    "grimbatol", "dunmorogh", "lochmodan", "searing", "badlands", "burning", "elwynn", "redridge", "westfall",
    "duskwood", "deadwind", "swamp", "blasted", "stv",
  ]; // prettier-ignore

  it("keeps the existing ids, in order, and adds Forever's zones after them", () => {
    expect(map.zones.map((z) => z.id)).toEqual([...vanilla, "riverglades", "shendralas", "zephras"]);
  });

  it("has terrain only where no one plays", () => {
    expect(map.zones.filter((z) => z.kind === "terrain").map((z) => z.id)).toEqual(["uldum", "gilneas", "grimbatol"]);
  });

  it("draws Thousand Needles dry: one outline, no lake or islands", () => {
    expect(zones.get("needles")!.d.match(/M/g)).toHaveLength(1);
  });

  it.each(map.zones.map((z) => [z.id, z] as const))("%s has its label point inside it", (_, z) => {
    expect(insidePath(z.d, z.lx, z.ly)).toBe(true);
  });
});

describe("zone aliases", () => {
  it.each(playable)("$name has an alias", (z) => {
    expect(ZONE_ALIASES[z.name]).toBe(z.id);
  });

  it("only points at zones on the map, never at terrain", () => {
    for (const id of Object.values(ZONE_ALIASES)) expect(zones.get(id)?.kind).toBe("zone");
  });

  it("puts Forever's new zones on the map", () => {
    expect(
      ["Mount Hyjal", "The Riverglades", "Riverglades", "Shen'dralas", "Zephras Isle"].map((t) => resolveZone(t).zone),
    ).toEqual(["hyjal", "riverglades", "riverglades", "shendralas", "zephras"]);
  });

  it("puts the capitals in their zone", () => {
    expect(
      ["Orgrimmar", "Thunder Bluff", "Undercity", "Stormwind City", "Ironforge", "Darnassus"].map(
        (t) => resolveZone(t).zone,
      ),
    ).toEqual(["durotar", "mulgore", "tirisfal", "elwynn", "dunmorogh", "teldrassil"]);
  });

  it("puts Alterac Mountains in Hillsbrad", () => {
    expect(resolveZone("Alterac Mountains").zone).toBe("hillsbrad");
  });

  it("puts a dungeon in its zone and names it", () => {
    for (const d of DUNGEONS) {
      for (const text of d.zoneTexts) expect(resolveZone(text)).toEqual({ zone: d.zone, dungeon: d, text });
    }
    expect(resolveZone("Deadmines").dungeon?.id).toBe("dm");
  });

  it("resolves the zone texts of the fixtures and the real beta file", () => {
    const texts = new Set(datasets.flatMap((d) => Object.values(d.locations).map((l) => l.zone)));
    expect([...texts].sort()).toEqual(["Durotar", "Mulgore"]);
    for (const text of texts) expect(resolveZone(text).zone).not.toBe(ELSEWHERE);
  });

  it("puts the battlegrounds off the map as battleground", () => {
    for (const text of ["Warsong Gulch", "Arathi Basin", "Alterac Valley", "Darkspear Islands"]) {
      expect(resolveZone(text)).toEqual({ zone: BATTLEGROUND, text });
    }
  });

  it("keeps unknown text as elsewhere", () => {
    expect(resolveZone("Deeprun Tram")).toEqual({ zone: ELSEWHERE, text: "Deeprun Tram" });
    expect(resolveZone("")).toEqual({ zone: ELSEWHERE, text: "" });
    expect(resolveZone("constructor").zone).toBe(ELSEWHERE);
    expect(resolveZone("  Durotar ")).toEqual({ zone: "durotar", text: "Durotar" });
  });
});
