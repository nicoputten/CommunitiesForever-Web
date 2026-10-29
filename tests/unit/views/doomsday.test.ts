import { describe, expect, it } from "vitest";
import type { DoomsdaySnapshot } from "@/core/doomsday/snapshot";
import type { PersonView } from "@/core/views/characters";
import { countdown, doomsdayChips, doomsdayPage } from "@/core/views/doomsday";
import { doomsdaySample } from "@/server/doomsdaySample";

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
const page = (snapshot: DoomsdaySnapshot = sample(), viewerKey: string | undefined = "nico") =>
  doomsdayPage({ snapshot, timeZone: ZONE, ...(viewerKey === undefined ? {} : { viewerKey }) });

describe("countdown", () => {
  it("shows days and hours, hours and minutes, or minutes", () => {
    expect(countdown(NOW + 4 * 86400 + 11 * 3600 + 120, NOW)).toBe("4 d 11 h");
    expect(countdown(NOW + 11 * 3600 + 30 * 60, NOW)).toBe("11 h 30 m");
    expect(countdown(NOW + 25 * 60 + 10, NOW)).toBe("25 m");
    expect(countdown(NOW - 10, NOW)).toBe("1 m");
  });
});

describe("doomsdayPage header", () => {
  it("gives the viewer's points per track, never added together, and the streak", () => {
    const { header } = page();
    expect(header.today).toEqual({ pve: 10, pvp: 9, approx: false });
    expect(header.week).toEqual({ pve: 85, pvp: 240, approx: false });
    expect(header.streak).toEqual({ current: 6, best: 11 });
  });

  it("names the reset in the viewer's zone", () => {
    expect(page().header.sub).toMatch(/^Daily goals at 19:00,/);
    expect(doomsdayPage({ snapshot: sample(), timeZone: "Europe/London" }).header.sub).toMatch(
      /^Daily goals at 18:00,/,
    );
  });

  it("has no numbers for a viewer without Doomsday data", () => {
    const view = page(sample(), "sanne");
    expect(view.header.today).toBeUndefined();
    expect(view.today).toBeUndefined();
    expect(view.week).toBeUndefined();
  });

  it("marks guessed PvP points with ≈", () => {
    const s = sample();
    s.friends.find((f) => f.friendKey === "nico")!.points!.approx = { pvp: true };
    expect(page(s).header.today?.approx).toBe(true);
  });
});

describe("doomsdayPage today", () => {
  it("lists the viewer's goals with checks, times and progress", () => {
    const today = page().today!;
    expect(today.title).toBe("Your goals · Thu 19 Nov");
    expect(today.doneText).toBe("3 of 5 done");
    expect(today.resets).toBe("resets in 22 h 0 m");
    expect(today.pve.map((g) => [g.kind, g.title, g.done, g.doneText ?? g.progress?.text])).toEqual([
      ["PvE daily", "Finish 10 quests", true, "done at 19:12"],
      ["PvE daily", "Run a dungeon with a friend", true, "done at 19:55"],
      ["PvE daily", "Raise Cooking, First Aid or Fishing", false, "3 / 5"],
    ]);
    expect(today.pve[2]?.progress?.percent).toBe(60);
    expect(today.pve[2]?.worth).toBe("+5 PvE");
    expect(today.pvp.map((g) => [g.kind, g.title, g.done])).toEqual([
      ["PvP · the Hunt", "Hunt: Night Elf Druids", true],
      ["PvP · Skirmish", "Lone wolf: 3 solo kills", false],
    ]);
  });

  it("shows the Duel slot: won, lost and still open", () => {
    expect(page().today?.duels).toEqual({ count: 1, text: "Won vs Bob · Mira and Jorrit still open today" });
    expect(page(sample(), "bob").today?.duels.text).toBe("Lost vs Nico · Mira and Jorrit still open today");
  });

  it("puts the original of a swapped goal in its tooltip", () => {
    const mira = page(sample(), "mira").today!;
    expect(mira.pve[2]).toMatchObject({
      title: "Earn 5 profession skill points",
      swap: "Instead of: Raise Cooking, First Aid or Fishing",
    });
  });

  it("shows unknown progress as nothing, never 0", () => {
    const s = sample();
    delete s.friends.find((f) => f.friendKey === "nico")!.today!.goals[2]!.progress;
    expect(page(s).today?.pve[2]?.progress).toBeUndefined();
  });

  it("names an unknown goal from a newer version and still lists it", () => {
    const s = sample();
    const g = s.friends.find((f) => f.friendKey === "nico")!.today!.goals[0]!;
    g.goal = { ...g.goal, id: "d.future", title: "A goal from a newer version", known: false };
    expect(page(s).today?.pve[0]?.title).toBe("A goal from a newer version");
  });
});

describe("doomsdayPage today so far", () => {
  it("gives the crown, who finished, who is part way, and who hasn't started or has no addon", () => {
    const soFar = page().soFar;
    expect(soFar.crown).toEqual({ name: "Mira", time: "19:30" });
    expect(soFar.finished.map((f) => [f.name, f.time])).toEqual([["Femke", "20:40"]]);
    expect(soFar.partial.map((f) => `${f.name}: ${f.text}`)).toEqual([
      "Bob: 1 PvE daily + Hunt + Skirmish done",
      "Nico: 2 PvE dailies + Hunt done",
    ]);
    expect(soFar.rest).toBe("Jorrit hasn't started · Sanne has no addon");
    expect(soFar.empty).toBe(false);
  });
});

describe("doomsdayPage board", () => {
  it("has the 3 PvE dailies, the Alliance Hunt and the Skirmish as columns", () => {
    expect(page().board.columns.map((c) => [c.track, c.title])).toEqual([
      ["pve", "Finish 10 quests"],
      ["pve", "Run a dungeon with a friend"],
      ["pve", "Raise Cooking, First Aid or Fishing"],
      ["pvp", "Hunt: Night Elf Druids"],
      ["pvp", "Lone wolf: 3 solo kills"],
    ]);
  });

  it("puts the viewer first and friends without data last, dimmed with a note", () => {
    const rows = page().board.rows;
    expect(rows.map((r) => r.name)).toEqual(["Nico", "Mira", "Bob", "Femke", "Jorrit", "Sanne"]);
    expect(rows[0]?.you).toBe(true);
    expect(rows[5]).toMatchObject({
      dim: true,
      note: "No addon yet · goals start counting once Sanne installs CommunitiesForever",
    });
    expect(rows[5]?.cells).toBeUndefined();
  });

  it("crosses out a friend with all 3 PvE dailies done and gives the crown its time", () => {
    const mira = page().board.rows.find((r) => r.name === "Mira")!;
    expect(mira.crossedOut).toBe(true);
    expect(mira.crown).toBe("19:30");
    expect(page().board.rows.find((r) => r.name === "Nico")?.crossedOut).toBe(false);
  });

  it("shows cells as a check with the time, progress, or open; a swap keeps its column", () => {
    const rows = page().board.rows;
    expect(rows.find((r) => r.name === "Bob")?.cells?.map((c) => c.kind)).toEqual([
      "progress",
      "done",
      "open",
      "done",
      "done",
    ]);
    expect(rows.find((r) => r.name === "Mira")?.cells?.[2]).toEqual({
      kind: "done",
      time: "19:21",
      swap: "Instead of: Raise Cooking, First Aid or Fishing",
    });
  });

  it("marks PvP Virgins and gives the duels line", () => {
    const rows = page().board.rows;
    expect(rows.find((r) => r.name === "Femke")?.pvpVirgin).toBe(true);
    expect(rows.find((r) => r.name === "Nico")?.duels).toBe("1 won · vs Bob");
    expect(rows.find((r) => r.name === "Mira")?.duels).toBe("—");
  });

  it("says when only one friend has data", () => {
    const s = sample();
    for (const f of s.friends) if (f.friendKey !== "nico") f.status = "noDoomsday";
    expect(page(s).board.lonely).toBe(
      "Only you have data so far. The board fills up as friends install the addon and upload.",
    );
  });
});

describe("doomsdayPage week", () => {
  it("lists the 3 weeklies and the bounty with the time to Sunday's reset", () => {
    const week = page().week!;
    expect(week.resets).toBe("resets Sunday 19:00 · in 2 d 22 h");
    expect(week.goals.map((g) => [g.kind, g.title, g.doneText ?? g.progress?.text, g.worth])).toEqual([
      ["PvE weekly", "Run 3 different dungeons", "2 / 3", "+15 PvE"],
      ["PvE weekly", "Gain 3 levels", "1 / 3", "+15 PvE"],
      ["PvE weekly", "Group with 3 different friends", "done at Mon 22:10", "+15 PvE"],
      ["PvP bounty", "Bounty: a kill of every enemy class", "5 / 8", "+15 PvP"],
    ]);
  });
});

describe("doomsdayPage heatmap", () => {
  it("has 84 days per friend with data, oldest first, today last", () => {
    const { heatmap } = page();
    expect(heatmap.rows.map((r) => r.name)).toEqual(["Nico", "Mira", "Bob", "Femke", "Jorrit"]);
    const nico = heatmap.rows[0]!;
    expect(nico.days).toHaveLength(84);
    expect(nico.best).toBe(11);
    expect(nico.days[83]).toEqual({ level: 3, label: "Thu 19 Nov: 3 goals done" });
    expect(heatmap.without).toBe("Sanne: no Doomsday data yet.");
  });

  it("shows a day without data as empty, labelled so", () => {
    const days = page().heatmap.rows[0]!.days;
    expect(days[0]).toEqual({ level: 0, label: "Fri 28 Aug: no data" });
  });
});

describe("doomsdayPage first day", () => {
  it("is day one while nobody has a point yet, ever", () => {
    const s = sample();
    delete s.crown;
    for (const f of s.friends) {
      for (const g of f.today?.goals ?? []) delete g.doneAt;
      delete f.today?.finishedAt;
      if (f.points !== undefined) f.points.allTime = { pve: 0, pvp: 0 };
    }
    expect(page(s).firstDay).toBe(true);
    expect(page(s).soFar.empty).toBe(true);
    expect(page().firstDay).toBe(false);
  });

  it("is not day one on a later morning before anyone did a goal", () => {
    const s = sample();
    delete s.crown;
    for (const f of s.friends) {
      for (const g of f.today?.goals ?? []) delete g.doneAt;
      delete f.today?.finishedAt;
    }
    expect(page(s).firstDay).toBe(false);
    expect(page(s).soFar.empty).toBe(true);
  });
});

describe("doomsdayChips", () => {
  it("gives this week's points per track and the streak, a quiet chip without data, none without the addon", () => {
    const s = sample();
    s.friends.find((f) => f.friendKey === "jorrit")!.status = "noDoomsday";
    const chips = doomsdayChips(s);
    expect(chips.get("nico")).toEqual({
      kind: "points",
      week: { pve: 85, pvp: 240, approx: false },
      streak: 6,
      pvpVirgin: false,
    });
    expect(chips.get("femke")).toMatchObject({ kind: "points", pvpVirgin: true });
    expect(chips.get("jorrit")).toEqual({ kind: "none" });
    expect(chips.has("sanne")).toBe(false);
  });

  it("gives no chips before any Doomsday data", () => {
    expect(doomsdayChips(undefined).size).toBe(0);
  });
});
