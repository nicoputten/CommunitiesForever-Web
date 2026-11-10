import { describe, expect, it } from "vitest";
import { huntTargets, HUNT_TARGETS, targetKey, targetOfTokens } from "@/core/doomsday/hunt";
import { weekStart } from "@/core/doomsday/rules";
import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";
import type { PersonView } from "@/core/views/characters";
import { doomsdayPage } from "@/core/views/doomsday";
import {
  censusWindow,
  huntFeats,
  huntToday,
  huntTrophies,
  huntWeek,
  quarryView,
  raceShort,
} from "@/core/views/doomsdayHunt";
import { doomsdaySample } from "../../fixtures/doomsday/sampleSnapshot";

// WEB-110: the Hunt on the Doomsday pages (boards DS01HuntToday, DS02HuntMore). Made-up census numbers.

// 2026-11-19 20:00 UTC, a Thursday: 21:00 in Amsterdam, two hours after the 19:00 reset.
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

const NE_DRUID = { race: 4, class: 11 };
const GNOME_MAGE = { race: 7, class: 8 };
const HUMAN_PALADIN = { race: 1, class: 2 };
const SKY_DRUID = { race: 95, class: 11 };

/** The sample with the Hunt's facts: today a Night Elf Druid, tomorrow a Gnome Mage, a census, Bob's kill today. */
function sample(): DoomsdaySnapshot {
  const s = doomsdaySample(PEOPLE, NOW);
  const day = s.schedule.day;
  const dayStart = s.schedule.dayStart;
  s.quarry = { today: { Alliance: NE_DRUID }, tomorrow: { Alliance: GNOME_MAGE } };
  const counts: Record<string, number> = {};
  huntTargets("Alliance").forEach((t) => (counts[targetKey(t)] = 300));
  counts[targetKey(NE_DRUID)] = 230;
  counts[targetKey(HUMAN_PALADIN)] = 435;
  counts[targetKey(SKY_DRUID)] = 45;
  s.census = { at: NOW, characters: 16400, counts };
  s.rare = [targetKey(SKY_DRUID)];
  for (const f of s.friends) {
    if (f.status !== "active") continue;
    f.hunted = "Alliance";
    f.huntKills = [];
  }
  const by = (key: string) => s.friends.find((f) => f.friendKey === key)!;
  by("bob").classFile = "WARRIOR";
  by("bob").huntKills = [{ day, at: dayStart + 74 * 60, zone: "Ashenvale", ...NE_DRUID }];
  by("mira").huntKills = [
    { day: day - 2, at: dayStart - 2 * 86400 + 3600, ...HUMAN_PALADIN },
    { day: day - 1, at: dayStart - 86400 + 3600, ...HUMAN_PALADIN },
  ];
  // Nico: the sample has the Hunt done today at 19:38; the kill without a zone (an addon before CF-118).
  const huntDone = by("nico").today!.goals.find((g) => g.goal.slot === "hunt")!.doneAt!;
  by("nico").huntKills = [
    { day: day - 9, at: dayStart - 9 * 86400 + 3600, ...HUMAN_PALADIN },
    { day: day - 8, at: dayStart - 8 * 86400 + 3600, ...HUMAN_PALADIN },
    { day: day - 7, at: dayStart - 7 * 86400 + 3600, ...HUMAN_PALADIN },
    { day: day - 3, at: dayStart - 3 * 86400 + 3600, ...SKY_DRUID },
    { day, at: huntDone, ...NE_DRUID },
  ];
  return s;
}

describe("the Hunt's targets (pool-6 contract)", () => {
  it("has 28 valid targets per faction, Skyborne included", () => {
    expect(huntTargets("Alliance")).toHaveLength(28);
    expect(huntTargets("Horde")).toHaveLength(28);
    expect(HUNT_TARGETS.Alliance.map((r) => r.race)).toEqual([1, 3, 4, 7, 95]);
    expect(HUNT_TARGETS.Horde.map((r) => r.race)).toEqual([2, 5, 6, 8, 96]);
  });

  it("maps the rules' tokens to ids", () => {
    expect(targetOfTokens("NightElf", "DRUID")).toEqual(NE_DRUID);
    expect(targetOfTokens("Scourge", "PRIEST")).toEqual({ race: 5, class: 5 });
    expect(targetOfTokens("Pandaren", "MONK")).toBeUndefined();
  });

  it("names a quarry and its race ring", () => {
    expect(quarryView(NE_DRUID)).toMatchObject({ name: "Night Elf Druid", raceShort: "NE", classFile: "DRUID" });
    expect(quarryView(GNOME_MAGE).raceShort).toBe("Gn");
    expect(quarryView(SKY_DRUID).name).toBe("Skyborne Druid");
    expect(raceShort("Undead")).toBe("Un");
  });

  it("dates the census window", () => {
    expect(censusWindow({ at: NOW, characters: 1, counts: {} }, ZONE)).toBe("13–19 Nov");
    expect(censusWindow({ at: NOW - 16 * 86400, characters: 1, counts: {} }, ZONE)).toBe("28 Oct–3 Nov");
  });
});

describe("the Hunt card", () => {
  it("is open with the census number, linked to Everloot's census", () => {
    const s = sample();
    const me = s.friends.find((f) => f.friendKey === "nico")!;
    for (const g of me.today!.goals) if (g.goal.slot === "hunt") delete g.doneAt;
    const card = doomsdayPage({ snapshot: s, timeZone: ZONE, viewerKey: "nico" }).today!.pvp[0]!.hunt!;
    expect(card.quarry.name).toBe("Night Elf Druid");
    expect(card.worth).toBe("+5 PvP");
    expect(card.seen).toEqual({ count: "230", href: "https://everloot.app/census", window: "13–19 Nov" });
    expect(card.seenTip).toBe("Night Elf Druids seen in the last 7 days (13–19 Nov). More seen = easier to find.");
    expect(card.bagged).toBeUndefined();
  });

  it("is bagged with the time, and the zone when the addon sent one", () => {
    const s = sample();
    expect(doomsdayPage({ snapshot: s, timeZone: ZONE, viewerKey: "nico" }).today!.pvp[0]!.hunt!.bagged).toBe(
      "bagged at 19:38",
    );
    s.friends.find((f) => f.friendKey === "nico")!.huntKills!.at(-1)!.zone = "Ashenvale";
    const card = doomsdayPage({ snapshot: s, timeZone: ZONE, viewerKey: "nico" }).today!.pvp[0]!.hunt!;
    expect(card.bagged).toBe("bagged at 19:38 in Ashenvale");
    expect(card.seen).toBeUndefined();
  });

  it("shows no census number without a census", () => {
    const s = sample();
    delete s.census;
    const me = s.friends.find((f) => f.friendKey === "nico")!;
    for (const g of me.today!.goals) if (g.goal.slot === "hunt") delete g.doneAt;
    const card = doomsdayPage({ snapshot: s, timeZone: ZONE, viewerKey: "nico" }).today!.pvp[0]!.hunt!;
    expect(card.seen).toBeUndefined();
    expect(card.seenTip).toBeUndefined();
  });
});

describe("The Hunt today", () => {
  it("lists who bagged one first, at most four, and tomorrow's quarry", () => {
    const view = huntToday(sample(), "nico", ZONE);
    expect(view.count).toBe("2 of 5 bagged one");
    expect(view.friends.map((f) => [f.name, f.text])).toEqual([
      ["Nico", "19:38"],
      ["Bob", "20:14 · Ashenvale"],
      ["Femke", "—"],
      ["Jorrit", "—"],
    ]);
    expect(view.friends[1]?.classFile).toBe("WARRIOR");
    expect(view.more).toEqual({ text: "+ 1 more", href: "/doomsday/board#hunt" });
    expect(view.tomorrow?.name).toBe("Gnome Mage");
  });

  it("adds a line to Today so far", () => {
    const soFar = doomsdayPage({ snapshot: sample(), timeZone: ZONE, viewerKey: "nico" }).soFar;
    expect(soFar.hunts.map((h) => h.text)).toEqual([
      "Nico bagged a Night Elf Druid · 19:38",
      "Bob bagged a Night Elf Druid · 20:14",
    ]);
  });
});

describe("the board's Hunt column", () => {
  it("has the quarry in its header and the kill's time and zone on hover", () => {
    const s = sample();
    const board = doomsdayPage({ snapshot: s, timeZone: ZONE, viewerKey: "nico" }).board;
    const i = board.columns.findIndex((c) => c.quarry !== undefined);
    expect(board.columns[i]).toMatchObject({ id: "hunt:alliance", title: "Night Elf Druid" });
    const bob = board.rows.find((r) => r.key === "bob")!;
    const nico = board.rows.find((r) => r.key === "nico")!;
    // Bob's Hunt goal isn't done in the sample's goals: the cell follows the goal, the hover the kill.
    expect(nico.cells?.[i]).toMatchObject({ kind: "done", time: "19:38", hunt: "Bagged 19:38" });
    expect(bob.cells?.[i]?.kind).not.toBe(undefined);
  });
});

describe("Hunt trophies", () => {
  it("collects the other faction's targets, gold with the count where bagged", () => {
    const s = sample();
    const view = huntTrophies(
      s,
      s.friends.find((f) => f.friendKey === "nico")!,
      ZONE,
    );
    expect(view.title).toBe("Hunt trophies · Nico");
    expect(view.summary).toBe("3 of 28 · 5 quarries");
    expect(view.percent).toBe(11);
    expect(view.classes.map((c) => c.name)).toEqual([
      "Warrior",
      "Paladin",
      "Hunter",
      "Rogue",
      "Priest",
      "Shaman",
      "Mage",
      "Warlock",
      "Druid",
    ]);
    expect(view.rows.map((r) => r.name)).toEqual(["Human", "Dwarf", "Night Elf", "Gnome", "Skyborne"]);
    const human = view.rows[0]!.cells;
    expect(human[1]).toEqual({
      kind: "target",
      key: "1:2",
      count: 3,
      rare: false,
      label: "Human Paladin · bagged 3× · last 12 Nov · 435 seen this week",
    });
    expect(human[5]).toEqual({ kind: "na" });
    const sky = view.rows[4]!.cells;
    expect(sky[8]).toMatchObject({
      count: 1,
      rare: true,
      label: "Skyborne Druid · bagged 1× · last Mon · 45 seen this week",
    });
    expect(view.rarest).toMatchObject({ name: "Skyborne Druid", seen: { count: "45" } });
  });

  it("has no rarest line and no rings without a census", () => {
    const s = sample();
    delete s.census;
    const view = huntTrophies(
      s,
      s.friends.find((f) => f.friendKey === "mira")!,
      ZONE,
    );
    expect(view.rarest).toBeUndefined();
    expect(view.rows.flatMap((r) => r.cells).some((c) => c.kind === "target" && c.rare)).toBe(false);
    expect(view.summary).toBe("1 of 28 · 2 quarries");
  });
});

describe("Hunt · this week", () => {
  it("ranks friends by days with the quarry bagged this week", () => {
    const s = sample();
    const rows = huntWeek(s).rows;
    const inWeek = (d: number) => d >= weekStart(s.schedule.week);
    const expected = s.friends
      .map((f) => [f.name, new Set((f.huntKills ?? []).filter((k) => inWeek(k.day)).map((k) => k.day)).size] as const)
      .filter(([, n]) => n > 0);
    expect(rows.map((r) => r.name).sort()).toEqual(expected.map(([n]) => n).sort());
    expect(rows[0]?.place).toBe(1);
    expect(rows.every((r) => /^\d+ days?$/.test(r.days))).toBe(true);
  });
});

describe("Hunt feats", () => {
  it("gives the six feats with progress", () => {
    const s = sample();
    const feats = huntFeats(
      s,
      s.friends.find((f) => f.friendKey === "nico")!,
    );
    expect(feats.map((f) => [f.title, f.text, f.done, f.progress?.text])).toEqual([
      ["First quarry", "Bag your first Hunt target", true, undefined],
      ["Quarry ×10", "Bag 10 Hunt targets", false, "5 / 10"],
      ["Every class", "Bag every Alliance class", false, "2 / 9"],
      ["Big game", "Bag all 28 race and class targets", false, "3 / 28"],
      ["Rare quarry", "Bag a target under 1% of the census", true, undefined],
      ["Hunter’s week", "Bag the quarry 7 days in a row", false, "3 / 7"],
    ]);
    expect(feats[1]?.progress?.percent).toBe(50);
  });

  it("names the Horde for an Alliance player", () => {
    const s = sample();
    const f = s.friends.find((x) => x.friendKey === "jorrit")!;
    f.hunted = "Horde";
    expect(huntFeats(s, f)[2]?.text).toBe("Bag every Horde class");
  });
});
