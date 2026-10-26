import { describe, expect, it } from "vitest";
import map from "@/core/map/zones.json";
import {
  CONTINENT_SPLIT,
  ZOOM_MAX,
  continentAt,
  continentViewBox,
  markerLabel,
  parseContinent,
  placeLabel,
  worldMap,
  zoomLevel,
  zoomStep,
} from "@/core/views";
import type { Dataset } from "@/core/model";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import { NOW, sample } from "./sample";

describe("world map", () => {
  const view = worldMap(sample(), NOW);
  const place = (zone: string) => view.places.find((p) => p.zone === zone);

  it("puts every located character in its zone, newest first", () => {
    expect(view.places.map((p) => [p.zone, p.markers.map((m) => m.name)])).toEqual([
      ["barrens", ["Grom Ashfeller"]],
      ["durotar", ["Mira Sunstrider", "Zul Kazrek"]],
      ["hillsbrad", ["Tok Ironhide"]],
      ["stonetalon", ["Ruk Bloodhoof"]],
      ["stv", ["Lia Thornwhisper", "Ves Doombringer"]],
      ["westfall", ["Bob Example", "Kel Dawnhammer"]],
    ]);
  });

  it("anchors a place at the zone's label point", () => {
    const stv = map.zones.find((z) => z.id === "stv")!;
    expect(place("stv")).toMatchObject({ zoneName: "Stranglethorn Vale", x: stv.lx, y: stv.ly });
  });

  it("gives a marker what its card shows", () => {
    const ves = place("stv")!.markers[1];
    expect(ves).toMatchObject({
      name: "Ves Doombringer",
      initials: "VD",
      classFile: "WARLOCK",
      level: 39,
      ownerName: "Nico",
      zoneName: "Stranglethorn Vale",
      seenAgo: "2 h ago",
      age: "live",
    });
    expect(ves?.ageTag).toBeUndefined();
  });

  it("tags every sighting that is not new with its age in days", () => {
    expect(place("barrens")!.markers[0]?.ageTag).toBe("3d");
    expect(place("stonetalon")!.markers[0]).toMatchObject({ age: "week", ageTag: "9d" });
  });

  it("names the dungeon of a sighting inside one", () => {
    const westfall = place("westfall")!;
    expect(westfall.markers[0]).toMatchObject({ name: "Bob Example", dungeonName: "The Deadmines" });
    expect(westfall.dungeons).toEqual(["The Deadmines"]);
    expect(placeLabel(westfall)).toBe("2 characters in Westfall, including 1 in The Deadmines");
  });

  it("tints each occupied zone by its newest sighting", () => {
    expect(view.occupied).toEqual({
      barrens: "days",
      durotar: "recent",
      hillsbrad: "live",
      stonetalon: "week",
      stv: "live",
      westfall: "live",
    });
  });

  it("leaves battlegrounds, unknown places and characters without a sighting off the map", () => {
    const d: Dataset = sample();
    const [first, second] = Object.keys(d.locations);
    d.locations[first!] = { ...d.locations[first!]!, zone: "Warsong Gulch" };
    d.locations[second!] = { ...d.locations[second!]!, zone: "Somewhere New" };
    const count = (v: ReturnType<typeof worldMap>) => v.places.reduce((n, p) => n + p.markers.length, 0);
    expect(count(worldMap(d, NOW))).toBe(count(view) - 2);
  });

  it("shows a sighted friend without the addon as an unnamed marker", () => {
    const d = normalize(
      parseLua(`return { schemaVersion = 1,
        self = { battleTag = "Ada#1001", chars = { A = { name = "Ada Example", level = 6 } } },
        presence = { C1 = { battleTag = "Cleo#3003", lastSeen = ${NOW} } },
        locations = { C1 = { zone = "Mulgore", seenAt = ${NOW - 600} } } }`),
    );
    const stub = worldMap(d, NOW).places.find((p) => p.zone === "mulgore")?.markers[0];
    expect(stub).toMatchObject({ initials: "?", age: "live", ownerName: "Cleo" });
    expect(stub?.name).toBeUndefined();
  });

  it("labels markers for screen readers", () => {
    expect(markerLabel(place("stv")!.markers[0]!)).toBe(
      "Lia Thornwhisper, level 37 Priest, Stranglethorn Vale, seen 1 h ago",
    );
    expect(
      markerLabel({ initials: "?", guid: "x", zoneName: "Duskwood", seenAt: 0, seenAgo: "just now", age: "live" }),
    ).toBe("Unknown character, Duskwood, seen just now");
  });
});

describe("continents", () => {
  it("reads the continent from the URL, the whole world otherwise", () => {
    expect(parseContinent("kalimdor")).toBe("kalimdor");
    expect(parseContinent("eastern-kingdoms")).toBe("eastern-kingdoms");
    expect(parseContinent("outland")).toBe("azeroth");
    expect(parseContinent(undefined)).toBe("azeroth");
  });

  it("frames both continents, centred, or one continent with every zone of it inside", () => {
    const world = continentViewBox("azeroth");
    const kal = continentViewBox("kalimdor");
    const ek = continentViewBox("eastern-kingdoms");
    expect(world).toEqual({
      x: kal.x,
      y: Math.min(kal.y, ek.y),
      width: ek.x + ek.width - kal.x,
      height: Math.max(kal.y + kal.height, ek.y + ek.height) - Math.min(kal.y, ek.y),
    });
    for (const [continent, cont] of [
      ["kalimdor", "K"],
      ["eastern-kingdoms", "E"],
    ] as const) {
      const box = continentViewBox(continent);
      for (const z of map.zones.filter((zone) => zone.cont === cont)) {
        expect(z.lx).toBeGreaterThan(box.x);
        expect(z.lx).toBeLessThan(box.x + box.width);
        expect(z.ly).toBeGreaterThan(box.y);
        expect(z.ly).toBeLessThan(box.y + box.height);
      }
    }
    const k = continentViewBox("kalimdor");
    const e = continentViewBox("eastern-kingdoms");
    expect(k.x + k.width).toBeLessThan(e.x + e.width);
  });
});

describe("map zoom", () => {
  it("shows more detail from 2× and from 4×", () => {
    expect([1, 1.5, 1.99, 2, 3.9, 4].map(zoomLevel)).toEqual([
      "world",
      "world",
      "continent",
      "continent",
      "continent",
      "zone",
    ]);
  });

  it("steps through 1×, 2× and 4×, and stays at the ends", () => {
    expect([1, 1.4, 2, 3, 4].map((s) => zoomStep(s, 1))).toEqual([2, 2, 4, 4, ZOOM_MAX]);
    expect([1, 1.4, 2, 3, 4].map((s) => zoomStep(s, -1))).toEqual([1, 1, 1, 2, 2]);
  });

  it("names the continent under the centre of the screen once zoomed in", () => {
    expect(continentAt(720, 1, CONTINENT_SPLIT)).toBe("azeroth");
    expect(continentAt(300, 1.05, CONTINENT_SPLIT)).toBe("kalimdor");
    expect(continentAt(800, 2, CONTINENT_SPLIT)).toBe("eastern-kingdoms");
    // Between the land: Kalimdor's zones end at x 547.7, the Eastern Kingdoms' start at 592 (zones.json).
    expect(CONTINENT_SPLIT).toBeGreaterThan(547.7);
    expect(CONTINENT_SPLIT).toBeLessThan(592);
  });
});
