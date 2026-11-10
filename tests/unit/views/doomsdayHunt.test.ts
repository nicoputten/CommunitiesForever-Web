import { describe, expect, it } from "vitest";
import {
  type Census,
  friendHunt as friendHuntData,
  huntToday as huntTodayData,
  huntWeek as huntWeekData,
  targetOf,
} from "@/core/doomsday/hunt";
import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";
import type { PersonView } from "@/core/views/characters";
import { doomsdayPage } from "@/core/views/doomsday";
import {
  censusWindow,
  friendHunt,
  huntFeats,
  huntToday,
  huntTrophies,
  huntWeek,
  quarryView,
  raceShort,
  type HuntPageData,
} from "@/core/views/doomsdayHunt";
import type { HuntKill } from "@/core/views/pool6";
import { doomsdaySample } from "../../fixtures/doomsday/sampleSnapshot";

// WEB-110: the Hunt on the Doomsday pages (boards DS01HuntToday, DS02HuntMore), from WEB-108's Hunt data built by its
// own functions (src/core/doomsday/hunt.ts) on made-up kills and a made-up census.

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

const NE_DRUID = targetOf("4:11")!;
const GNOME_MAGE = targetOf("7:8")!;
const HUMAN_PALADIN = targetOf("1:2")!;
const SKY_DRUID = targetOf("95:11")!;

/** The sample with the Hunt: today a Night Elf Druid, tomorrow a Gnome Mage, a census, kills of Nico, Bob and Mira. */
function sample(census = true): { s: DoomsdaySnapshot; hunt: HuntPageData } {
  const s = doomsdaySample(PEOPLE, NOW);
  const day = s.schedule.day;
  const start = s.schedule.dayStart;
  const by = (key: string) => s.friends.find((f) => f.friendKey === key)!;
  by("bob").classFile = "WARRIOR";
  const kill = (owner: string, d: number, at: number | undefined, t = NE_DRUID, zone?: string): HuntKill => ({
    owner,
    guid: `${owner}-1`,
    day: d,
    ...(at !== undefined ? { at } : {}),
    ...(zone !== undefined ? { zone } : {}),
    target: t,
    quarry: true,
  });
  // Nico's Hunt goal is done in the sample; his kill comes from an older addon without a zone.
  const nicoAt = by("nico").today!.goals.find((g) => g.goal.slot === "hunt")!.doneAt!;
  const kills = [
    kill("nico", day - 9, start - 9 * 86400 + 3600, HUMAN_PALADIN),
    kill("nico", day - 8, start - 8 * 86400 + 3600, HUMAN_PALADIN),
    kill("nico", day - 7, start - 7 * 86400 + 3600, HUMAN_PALADIN),
    kill("nico", day - 3, start - 3 * 86400 + 3600, SKY_DRUID),
    kill("nico", day, nicoAt),
    kill("bob", day, start + 74 * 60, NE_DRUID, "Ashenvale"),
    kill("mira", day - 1, start - 86400 + 3600, HUMAN_PALADIN),
  ];
  const counts: Record<string, number> = {};
  for (const r of ["1", "3", "4", "7"]) for (const c of [1, 2, 3, 4, 5, 7, 8, 9, 11]) counts[`${r}:${c}`] = 300;
  counts[NE_DRUID.key] = 230;
  counts[HUMAN_PALADIN.key] = 435;
  counts[SKY_DRUID.key] = 45;
  const c: Census | undefined = census
    ? { asOf: NOW, characters: 16400, installs: 13, source: "everloot", counts }
    : undefined;
  const friends = ["nico", "bob", "mira", "femke", "jorrit"].map((owner) =>
    friendHuntData({
      friend: { owner, factions: ["Horde"] },
      kills,
      today: day,
      ...(c !== undefined ? { census: c, censusAt: NOW } : {}),
    }),
  );
  const plan = { [day]: { Alliance: NE_DRUID.key }, [day + 1]: { Alliance: GNOME_MAGE.key } };
  return {
    s,
    hunt: { hunt: huntTodayData(day, plan, friends, c, NOW), friends, week: huntWeekData(friends) },
  };
}

const page = ({ s, hunt }: ReturnType<typeof sample>) =>
  doomsdayPage({ snapshot: s, timeZone: ZONE, viewerKey: "nico", hunt });

const INFO = {
  at: NOW,
  asOf: NOW,
  source: "everloot",
  stale: false,
  url: "https://everloot.app/census",
  licence: "CC BY-SA 4.0",
} as const;

describe("the quarry", () => {
  it("names a quarry and its race ring", () => {
    expect(quarryView(NE_DRUID)).toMatchObject({ name: "Night Elf Druid", raceShort: "NE", classFile: "DRUID" });
    expect(quarryView(GNOME_MAGE).raceShort).toBe("Gn");
    expect(quarryView(SKY_DRUID).name).toBe("Skyborne Druid");
    expect(raceShort("Undead")).toBe("Un");
  });

  it("dates the census window", () => {
    expect(censusWindow(INFO, ZONE)).toBe("13–19 Nov");
    expect(censusWindow({ ...INFO, asOf: NOW - 16 * 86400 }, ZONE)).toBe("28 Oct–3 Nov");
  });
});

describe("the Hunt card", () => {
  const open = (x: ReturnType<typeof sample>) => {
    const me = x.s.friends.find((f) => f.friendKey === "nico")!;
    for (const g of me.today!.goals) if (g.goal.slot === "hunt") delete g.doneAt;
    delete x.hunt.friends.find((f) => f.owner === "nico")!.todayKill;
    return x;
  };

  it("is open with the census number and Everloot's census with its dates", () => {
    const card = page(open(sample())).today!.pvp[0]!.hunt!;
    expect(card.quarry.name).toBe("Night Elf Druid");
    expect(card.worth).toBe("+5 PvP");
    expect(card.seen).toEqual({ count: "230", href: "https://everloot.app/census", window: "13–19 Nov" });
    expect(card.seenTip).toBe("Night Elf Druids seen in the last 7 days (13–19 Nov). More seen = easier to find.");
    expect(card.bagged).toBeUndefined();
  });

  it("is bagged with the time, and the zone when the addon sent one", () => {
    const x = sample();
    expect(page(x).today!.pvp[0]!.hunt!.bagged).toBe("bagged at 19:38");
    x.hunt.friends.find((f) => f.owner === "nico")!.todayKill!.zone = "Ashenvale";
    const card = page(x).today!.pvp[0]!.hunt!;
    expect(card.bagged).toBe("bagged at 19:38 in Ashenvale");
    expect(card.seen).toBeUndefined();
  });

  it("shows no census number without a census", () => {
    const card = page(open(sample(false))).today!.pvp[0]!.hunt!;
    expect(card.seen).toBeUndefined();
    expect(card.seenTip).toBeUndefined();
  });

  it("stays a plain goal without the Hunt's data", () => {
    const { s } = sample();
    expect(doomsdayPage({ snapshot: s, timeZone: ZONE, viewerKey: "nico" }).today!.pvp[0]!.hunt).toBeUndefined();
  });
});

describe("The Hunt today", () => {
  it("lists who bagged one first, at most four, and tomorrow's quarry", () => {
    const x = sample();
    const view = huntToday(x.s, x.hunt, "nico", ZONE);
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
    expect(page(sample()).soFar.hunts.map((h) => h.text)).toEqual([
      "Nico bagged a Night Elf Druid · 19:38",
      "Bob bagged a Night Elf Druid · 20:14",
    ]);
  });
});

describe("the board's Hunt column", () => {
  it("has the quarry in its header and the kill's time and zone on hover", () => {
    const board = page(sample()).board;
    const i = board.columns.findIndex((c) => c.quarry !== undefined);
    expect(board.columns[i]).toMatchObject({ id: "hunt:alliance", title: "Night Elf Druid" });
    const nico = board.rows.find((r) => r.key === "nico")!;
    expect(nico.cells?.[i]).toMatchObject({ kind: "done", time: "19:38", hunt: "Bagged 19:38" });
  });
});

describe("Hunt trophies", () => {
  it("collects the other faction's targets, gold with the count where bagged", () => {
    const x = sample();
    const nico = x.s.friends.find((f) => f.friendKey === "nico")!;
    const view = huntTrophies(x.s, nico, friendHunt(x.hunt, "nico")!.trophies, ZONE);
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
    expect(view.rows[4]!.cells[8]).toMatchObject({
      count: 1,
      rare: true,
      label: "Skyborne Druid · bagged 1× · last Mon · 45 seen this week",
    });
    expect(view.rarest).toMatchObject({ name: "Skyborne Druid", seen: { count: "45", window: "13–19 Nov" } });
  });

  it("has no rarest line and no rings without a census", () => {
    const x = sample(false);
    const mira = x.s.friends.find((f) => f.friendKey === "mira")!;
    const view = huntTrophies(x.s, mira, friendHunt(x.hunt, "mira")!.trophies, ZONE);
    expect(view.rarest).toBeUndefined();
    expect(view.rows.flatMap((r) => r.cells).some((c) => c.kind === "target" && c.rare)).toBe(false);
    expect(view.summary).toBe("1 of 28 · 1 quarry");
  });
});

describe("Hunt · this week", () => {
  it("ranks friends by days with the quarry bagged this week, named and with their class", () => {
    const x = sample();
    const rows = huntWeek(x.s, x.hunt).rows;
    expect(rows.map((r) => r.place)).toEqual(rows.map((_, i) => i + 1));
    expect(rows.find((r) => r.name === "Bob")).toMatchObject({ days: "1 day", classFile: "WARRIOR" });
    expect(rows.every((r) => /^\d+ days?$/.test(r.days))).toBe(true);
  });
});

describe("Hunt feats", () => {
  it("gives the six feats with progress, in the board's words", () => {
    const feats = huntFeats(friendHunt(sample().hunt, "nico")!);
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
});

describe("the Duel slot (pool version 6)", () => {
  it("shows a rotating duel mission in the slot's place, never twice", () => {
    const x = sample();
    const me = x.s.friends.find((f) => f.friendKey === "nico")!;
    me.today!.goals.push({
      goal: { id: "p.duelWin", track: "pvp", slot: "duel", title: "Win a duel", known: true },
      columnId: "p.duelWin",
      points: 3,
    });
    const today = page(x).today!;
    expect(today.pvp.some((g) => g.key === "p.duelWin")).toBe(false);
    expect(today.duelGoal).toMatchObject({ kind: "PvP · Duel slot", title: "Win a duel", worth: "+3 PvP" });
  });

  it("keeps the first-duel card for p.duelFirst", () => {
    const x = sample();
    const me = x.s.friends.find((f) => f.friendKey === "nico")!;
    me.today!.goals.push({
      goal: { id: "p.duelFirst", track: "pvp", slot: "duel", title: "First duel with each friend", known: true },
      columnId: "p.duelFirst",
      points: 0,
    });
    const today = page(x).today!;
    expect(today.duelGoal).toBeUndefined();
    expect(today.pvp.some((g) => g.key === "p.duelFirst")).toBe(false);
  });
});
