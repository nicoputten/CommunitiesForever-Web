import { describe, expect, it } from "vitest";
import type { PersonView } from "@/core/views/characters";
import { featsView } from "@/core/views/doomsdayFeats";
import { ladderView, parseLadderScope, pvpView } from "@/core/views/doomsdayLadder";
import { doomsdaySample } from "../../fixtures/doomsday/sampleSnapshot";

// 2026-11-19 20:00 UTC, a Thursday: 21:00 in Paris, two hours after the 19:00 reset.
const NOW = 1795118400;
const ZONE = "Europe/Amsterdam";

const person = (displayName: string, hasAddon = true): PersonView => ({
  key: displayName.toLowerCase(),
  displayName,
  isUploader: displayName === "Nico",
  hasAddon,
  dataAge: "live",
  old: false,
});

const PEOPLE = ["Nico", "Bob", "Mira", "Femke", "Jorrit"].map((n) => person(n)).concat(person("Sanne", false));
const sample = () => doomsdaySample(PEOPLE, NOW);

describe("ladderView", () => {
  it("reads the scope from the query", () => {
    expect(parseLadderScope("all")).toBe("allTime");
    expect(parseLadderScope(undefined)).toBe("week");
    expect(parseLadderScope("nonsense")).toBe("week");
  });

  it("ranks each track on its own, with movement this week", () => {
    const view = ladderView(sample(), "week", "nico", ZONE);
    expect(view.resets).toBe("week resets Sunday 19:00 · in 2 d 22 h");
    const [pve, pvp] = view.tracks;
    expect(pve.rows.map((r) => [r.place, r.name, r.points, r.movement?.text])).toEqual([
      [1, "Mira", "120", "▲ 1"],
      [2, "Femke", "95", "▲ 2"],
      [3, "Nico", "85", "▼ 2"],
      [4, "Bob", "60", "– 0"],
      [5, "Jorrit", "15", "new"],
    ]);
    expect(pvp.rows.map((r) => [r.place, r.name, r.points])).toEqual([
      [1, "Bob", "310"],
      [2, "Nico", "240"],
      [3, "Mira", "96"],
      [4, "Jorrit", "4"],
    ]);
    expect(pvp.rows[1]?.movement?.label).toBe("down 1 since last week");
  });

  it("splits a row per character and marks the viewer", () => {
    const nico = ladderView(sample(), "week", "nico", ZONE).tracks[1].rows[1]!;
    expect(nico.you).toBe(true);
    expect(nico.characters.map((c) => [c.name, c.points])).toEqual([
      ["Ves Doombringer", "168"],
      ["Grom Ashfeller", "72"],
    ]);
    expect(nico.href).toBe("/doomsday/pvp?friend=nico");
  });

  it("shows PvP Virgins apart, never ranked", () => {
    const [pve, pvp] = ladderView(sample(), "week", "nico", ZONE).tracks;
    expect(pvp.rows.some((r) => r.name === "Femke")).toBe(false);
    expect(pvp.virgins.map((v) => v.name)).toEqual(["Femke"]);
    expect(pve.virgins).toEqual([]);
  });

  it("has no movement all time, with thousands separated", () => {
    const [, pvp] = ladderView(sample(), "allTime", "nico", ZONE).tracks;
    expect(pvp.when).toBe("all time");
    expect(pvp.rows[0]).toMatchObject({ name: "Bob", points: "1,540" });
    expect(pvp.rows.every((r) => r.movement === undefined)).toBe(true);
  });

  it("marks guessed points with ≈", () => {
    const s = sample();
    s.ladders.week.pvp[0]!.approx = true;
    expect(ladderView(s, "week", "nico", ZONE).tracks[1].rows[0]?.points).toBe("≈310");
  });
});

describe("pvpView", () => {
  it("shows the viewer first and by default, with chips for every friend with data", () => {
    const view = pvpView(sample(), undefined, "nico");
    expect(view.friends.map((f) => [f.name, f.current])).toEqual([
      ["Nico", true],
      ["Bob", false],
      ["Femke", false],
      ["Jorrit", false],
      ["Mira", false],
    ]);
    expect(view.you).toBe(true);
  });

  it("gives kills, ranks with our titles, and kills by zone", () => {
    const view = pvpView(sample(), "nico", "nico");
    expect(view.kills).toEqual({ total: "45", detail: "12 solo · 3 skulls", approx: false });
    expect(view.ranks.map((r) => [r.rankText, r.title, r.name])).toEqual([
      ["Stone Guard · rank 6", "Mailbox Menace", "Ves Doombringer"],
      ["Grunt · rank 2", "Accidental Flagger", "Grom Ashfeller"],
    ]);
    expect(view.byZone[0]).toEqual({ zone: "Hillsbrad Foothills", kills: 21, percent: 100 });
    expect(view.byZone[3]).toEqual({ zone: "Ashenvale", kills: 4, percent: 19 });
  });

  it("builds the duel grid and the Elo line with the leader", () => {
    const duels = pvpView(sample(), "nico", "nico").duels!;
    expect([duels.won, duels.lost]).toEqual([7, 5]);
    expect(duels.grid.names.map((n) => n.name)).toEqual(["Nico", "Bob", "Mira", "Jorrit"]);
    expect(duels.grid.cells[0]).toEqual([
      undefined,
      { text: "4–2", result: "won" },
      { text: "1–3", result: "lost" },
      { text: "2–0", result: "won" },
    ]);
    expect(duels.grid.cells[1]?.[2]).toEqual({ text: "2–2", result: "even" });
    expect(duels.elo).toEqual({ rating: "1,084", place: "2nd · Bob 1,112", change: { kind: "up", text: "▲ 22" } });
    expect(pvpView(sample(), "bob", "nico").duels?.elo?.place).toBe("1st");
  });

  it("lists battlegrounds apart, and first wins", () => {
    const view = pvpView(sample(), "nico", "nico");
    expect(view.battlegrounds[0]).toEqual({ name: "Warsong Gulch", won: 6, lost: 4, kills: 38 });
    expect(view.firstWins).toBe("First wins unlocked: Warsong Gulch, Arathi Basin, Alterac Valley");
  });

  it("calls a friend without kills a PvP Virgin, ranks as Conscientious Objector", () => {
    const view = pvpView(sample(), "femke", "nico");
    expect(view.pvpVirgin).toBe(true);
    expect(view.ranks[0]).toMatchObject({ rankText: "No rank yet", title: "Conscientious Objector" });
  });

  it("says so when a friend has no PvP data", () => {
    const s = sample();
    delete s.friends.find((f) => f.friendKey === "mira")!.pvp;
    expect(pvpView(s, "mira", "nico").empty).toMatch(/^No PvP data yet/);
  });

  it("leaves out a character without a rank (an addon before CF-52)", () => {
    const s = sample();
    const ves = s.friends.find((f) => f.friendKey === "nico")!.pvp!.characters[0]!;
    delete ves.rank;
    delete ves.highestRank;
    expect(pvpView(s, "nico", "nico").ranks.map((r) => r.name)).toEqual(["Grom Ashfeller"]);
  });
});

describe("featsView", () => {
  it("lists the group's feats newest first, without those from before tracking", () => {
    const view = featsView(sample(), undefined, "nico", ZONE);
    expect(view.group.map((f) => [f.title.before + (f.title.epic ?? ""), f.meta, f.firstInGroup])).toEqual([
      ["Stone Guard, a.k.a. Mailbox Menace", "today 20:14 · rank 6", true],
      ["First epic: Robes of the Exalted", "today 19:31 · chest · item level 66", true],
      ["Epic mount · riding 150", "yesterday", true],
      ["Fish Whisperer · Fishing 300", "Sun 15 Nov", false],
      ["100 deaths: a spirit healer’s best friend", "Sat 14 Nov", false],
      ["Head Chef · Cooking 300", "Fri 13 Nov", false],
      ["100 honorable kills", "Mon 19 Oct", false],
    ]);
    expect(view.group[0]).toMatchObject({ icon: "rank", rank: 6 });
    expect(view.group[1]).toMatchObject({ icon: "epic", title: { epic: "Robes of the Exalted" } });
  });

  it("gives the viewer's own feats, before tracking marked, then the next steps; no total", () => {
    const view = featsView(sample(), undefined, "nico", ZONE);
    expect(view.ownTitle).toBe("Your feats");
    expect(view.ownCount).toBe(4);
    expect(view.own.map((f) => [f.title, f.meta, f.done])).toEqual([
      ["Stone Guard, a.k.a. Mailbox Menace", "Ves Doombringer · today 20:14", true],
      ["Head Chef · Cooking 300", "Ves Doombringer · Fri 13 Nov", true],
      ["100 honorable kills", "Ves Doombringer · Mon 19 Oct", true],
      ["First blood", "Ves Doombringer · before tracking", true],
      ["1,000 honorable kills", "412 / 1,000", false],
      ["Duel wins: 10", "7 / 10", false],
      ["First epic item", "not yet", false],
    ]);
  });

  it("shows another friend's feats when picked", () => {
    const view = featsView(sample(), "mira", "nico", ZONE);
    expect(view.ownTitle).toBe("Mira's feats");
    expect(view.friends.find((f) => f.current)?.name).toBe("Mira");
  });

  it("lists every PvP rank with our title", () => {
    const ranks = featsView(sample(), undefined, "nico", ZONE).ranks;
    expect(ranks).toHaveLength(15);
    expect(ranks[0]).toEqual({ rank: 0, horde: "none", alliance: "none", title: "Conscientious Objector" });
    expect(ranks[14]).toEqual({
      rank: 14,
      horde: "High Warlord",
      alliance: "Grand Marshal",
      title: "Grass: Untouched",
    });
  });
});
