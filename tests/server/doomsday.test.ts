import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { cardFor } from "@/server/cards";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boardData, lookupData, recapSection } from "@/core/doomsday/posts";
import { dayStart, draw } from "@/core/doomsday/rules";
import { acknowledge } from "@/server/bot";
import { openDatabase, type Db } from "@/server/db";
import { botEvents } from "@/server/db/schema";
import { doomsdayResetNow, getBotSettings, updateBotSettings } from "@/server/discord";
import { doomsdayFor, doomsdayInput } from "@/server/doomsdayEngine";
import { runDueDoomsday } from "@/server/doomsdayPosts";
import { upload } from "@/server/uploads";

// WEB-58: the Doomsday engine on stored uploads: points per track (goals from the addon's `done`, kills and duels from
// the raw feed), all-time totals and Elo over more than 7 days, friends without data, the reset setting (from the
// next reset only), and the bot's board, its updates (the latest only), the final update and the weekly ladder.

const ADMIN = "Nico#1000";
const CET = 3600;
/** Doomsday day 20767 (Tue 10 Nov 2026) starts at 19:00 CET. */
const DAY = 20767;
const start = (n: number) => dayStart(n, { offset: CET, reset: 68400 });
const T = start(DAY);

/** Dailies of a day as drawn (no swaps in these files: the situation is unknown). */
const dailies = (n: number) => draw(n).dailies;
const set = (n: number) => [...dailies(n), draw(n).skirmish!];

const doneLua = (done: Record<string, number>) =>
  `{ ${Object.entries(done)
    .map(([id, at]) => `["${id}"] = ${at}`)
    .join(", ")} }`;
const dayLua = (n: number, done: Record<string, number>) =>
  `[${n}] = { set = { ${set(n)
    .map((id) => `"${id}"`)
    .join(", ")} }, swapped = {}, done = ${doneLua(done)}, at = ${Math.max(start(n) + 1, ...Object.values(done))} }`;

/** Nico (uploader, Ves) and Ada (relayed, Mira); Bob has no addon (presence only). */
function file(version: number, opts: { nico?: string; ada?: string; nicoFeed?: string; adaFeed?: string } = {}) {
  return new TextEncoder().encode(`return { schemaVersion = 2,
    self = { battleTag = "${ADMIN}", displayName = "Nico", version = ${version},
      chars = { V = { name = "Ves Example", classFile = "WARLOCK", faction = "Horde", level = 40, updatedAt = ${version} } },
      ${opts.nicoFeed !== undefined ? `feed = { ${opts.nicoFeed} },` : ""}
      ${opts.nico !== undefined ? `goals = { days = { ${opts.nico} }, weeks = {}, streak = 0, best = 0 },` : ""} },
    people = { ["Ada#1001"] = { displayName = "Ada", version = ${version},
      chars = { M = { name = "Mira Example", classFile = "MAGE", faction = "Horde", level = 30, updatedAt = ${version} } },
      ${opts.adaFeed !== undefined ? `feed = { ${opts.adaFeed} },` : ""}
      ${opts.ada !== undefined ? `goals = { days = { ${opts.ada} }, weeks = {}, best = 5 },` : ""} } },
    presence = { ["Player-1-B"] = { battleTag = "Bob#2002", lastSeen = 1 } },
    settings = { clubId = 1, clubName = "Friends" } }`);
}

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A realm day (the feed's key) for a moment. */
const realmDay = (t: number) => Math.floor((t + CET) / 86400);

describe("the Doomsday engine", () => {
  it("has no data before any friend's goals", () => {
    upload(db, file(100), ADMIN, T, ADMIN);
    expect(doomsdayFor(db, T + 60)).toBeUndefined();
  });

  it("counts goals, kills and duels per track, ranks both ladders, and keeps all-time totals and Elo", () => {
    const [d1, d2] = dailies(DAY);
    // Nico: 2 dailies today, 1 yesterday; kills over two weeks (one a week earlier), a duel won against Ada's Mira.
    const kill = (t: number, lvl: number) =>
      `{ t = ${t}, zone = "Ashenvale", name = "Foe ${t}", lvl = ${lvl}, myLvl = 40 }`;
    const nicoFeed = [
      `[${realmDay(T + 600)}] = { V = { at = ${T + 900}, pvpKills = { ${kill(T + 600, 42)}, ${kill(T + 700, 44)} },
        duels = { { t = ${T + 800}, won = true, vs = "Mira Example" } } } }`,
      `[${realmDay(T - 8 * 86400)}] = { V = { at = ${T - 8 * 86400}, pvpKills = { ${kill(T - 8 * 86400, -1)} } } }`,
    ].join(", ");
    const adaFeed = `[${realmDay(T + 600)}] = { M = { at = ${T + 801}, duels = { { t = ${T + 801}, won = false, vs = "Ves Example" } } } }`;
    upload(
      db,
      file(100, {
        nico: [
          dayLua(DAY, { [d1!]: T + 100, [d2!]: T + 200 }),
          dayLua(DAY - 1, { [dailies(DAY - 1)[0]!]: T - 3600 }),
        ].join(", "),
        ada: dayLua(DAY, {}),
        nicoFeed,
        adaFeed,
      }),
      ADMIN,
      T + 1000,
      ADMIN,
    );
    const snap = doomsdayFor(db, T + 1200)!;
    expect(snap.schedule).toMatchObject({ day: DAY, dayStart: T, nextReset: T + 86400, resetSeconds: 68400 });
    const nico = snap.friends.find((f) => f.name === "Nico")!;
    const ada = snap.friends.find((f) => f.name === "Ada")!;
    const bob = snap.friends.find((f) => f.name === "Bob")!;
    expect([nico.status, ada.status, bob.status]).toEqual(["active", "active", "noAddon"]);
    // Today: 2 dailies = 10 PvE; kills 1 + 2 (44 is 4 above) + the duel won 3 = 6 PvP.
    expect(nico.points!.today).toEqual({ pve: 10, pvp: 6 });
    // All time adds yesterday's daily and the skull a week before: PvE 15, PvP 9.
    expect(nico.points!.allTime).toEqual({ pve: 15, pvp: 9 });
    expect(ada.points!.today).toEqual({ pve: 0, pvp: 1 });
    expect(nico.streak).toEqual({ current: 2, best: 2 });
    expect(ada.streak).toEqual({ current: 0, best: 5 });
    expect(nico.today!.goals.filter((g) => g.doneAt !== undefined)).toHaveLength(2);
    expect(nico.today!.duels.first).toEqual([{ friendKey: "Ada#1001", name: "Ada", result: "won", at: T + 800 }]);
    expect(nico.heatmap!.slice(-2)).toEqual([1, 2]);
    // Elo: one duel, 1000 each before, so +16 / -16.
    expect(nico.pvp!.duels.elo).toMatchObject({ rating: 1016, place: 1 });
    // Ada never killed anyone, but lost a duel: that is a PvP point, so no PvP Virgin (live test 2026-10-29).
    expect(ada.pvpVirgin).toBe(false);
    expect(snap.ladders.week.pvp.map((r) => r.name)).toEqual(["Nico", "Ada"]);
    // The week began on Sunday: yesterday's daily counts too.
    expect(snap.ladders.week.pve.map((r) => [r.name, r.points])).toEqual([
      ["Nico", 15],
      ["Ada", 0],
    ]);
    expect(snap.ladders.allTime.pvp[0]).toMatchObject({ name: "Nico", points: 9 });

    // The look-up and the recap section.
    const me = lookupData(snap, ADMIN) as Record<string, unknown>;
    expect(me).toMatchObject({ friend: "Nico", today: { pve: 10, pvp: 6 }, place: { pve: { place: 1, of: 2 } } });
    expect(lookupData(snap, "Bob#2002")).toEqual({ friend: "Bob", noData: true });
    const input = doomsdayInput(db, T + 1200)!;
    expect(recapSection(input, T - 2 * 86400, T + 86400)).toMatchObject({
      mostDevoted: { name: "Nico", days: 2 },
      points: {
        pve: [{ name: "Nico", points: 15 }],
        pvp: [
          { name: "Nico", points: 6 },
          { name: "Ada", points: 1 },
        ],
      },
      crowns: [],
    });
  });

  it("changes the reset from the next reset only", () => {
    upload(db, file(100, { nico: dayLua(DAY, {}) }), ADMIN, T + 60, ADMIN);
    // At 21:00 on day DAY the admin moves the reset to 09:00.
    updateBotSettings(db, { doomsdayReset: 32400 }, ADMIN, T + 2 * 3600);
    const s = getBotSettings(db);
    expect([s.doomsdayReset, s.doomsdayResetPrevious]).toEqual([32400, 68400]);
    // The rest of today still runs to 19:00 tomorrow.
    expect(doomsdayFor(db, T + 3 * 3600)!.schedule).toMatchObject({
      day: DAY,
      resetSeconds: 68400,
      nextReset: T + 86400,
    });
    expect(doomsdayResetNow(s, T + 3 * 3600)).toMatchObject({ reset: 68400, changedAt: 0 });
    // From that reset on, days run from 09:00.
    expect(doomsdayFor(db, T + 86400 + 60)!.schedule.resetSeconds).toBe(32400);
    expect(doomsdayResetNow(s, T + 86400 + 60)).toMatchObject({ reset: 32400, changedAt: T + 86400 });
    // The realm's clock for the addon: CET now, CEST from the last Sunday of March 2027 at 01:00 UTC.
    expect(doomsdayResetNow(s, T)).toMatchObject({
      offset: 3600,
      offsetUntil: Date.UTC(2027, 2, 28, 1) / 1000,
      offsetAfter: 7200,
    });
  });
});

describe("Doomsday's bot events", () => {
  const events = (type: string) =>
    db
      .select()
      .from(botEvents)
      .where(eq(botEvents.type, type))
      .all()
      .map((e) => ({ id: e.id, postedAt: e.postedAt, data: e.data as Record<string, unknown> }));

  it("posts the board at the reset, updates the latest only, closes the day and posts the ladder on Sunday", () => {
    updateBotSettings(db, { doomsdayBoard: true, doomsdayLadder: true }, ADMIN, T);
    const [d1, d2, d3] = dailies(DAY);
    upload(db, file(100, { nico: dayLua(DAY, {}), ada: dayLua(DAY, {}) }), ADMIN, T + 30, ADMIN);
    runDueDoomsday(db, T + 60);
    runDueDoomsday(db, T + 120);
    const [board] = events("doomsdayBoard");
    expect(events("doomsdayBoard")).toHaveLength(1);
    expect(board!.data).toMatchObject({
      day: DAY,
      label: "Tue evening",
      span: "Tue 19:00 → Wed 19:00",
      start: T,
      end: T + 86400,
      crown: null,
    });
    expect((board!.data.friends as { name: string }[]).map((f) => f.name)).toEqual(["Ada", "Nico"]);
    expect(board!.data.withoutData).toEqual(["Bob"]);
    // WEB-66: the news line and the board image, which the bot fetches by its id.
    expect(board!.data.news).toMatch(/^New day, new doom\. PvE .+\. 5 points each\. 1 friend without addon data\.$/);
    expect(board!.data.image).toMatch(new RegExp(`^doomsday-${DAY}-[0-9a-f]{6}$`));
    expect((board!.data.goals as { shortLabel: string }[]).every((g) => g.shortLabel.length <= 10)).toBe(true);
    const spec = cardFor(db, String(board!.data.image), T + 120, "wow.example.test");
    expect(spec).toMatchObject({ kind: "board", title: "Tue evening · just started", footer: "resets Wed 19:00" });
    expect(cardFor(db, `doomsday-${DAY}-000000`, T + 120)).toBeUndefined();

    // Two uploads before the bot polls: only the newest update is handed out.
    upload(db, file(200, { nico: dayLua(DAY, { [d1!]: T + 100 }), ada: dayLua(DAY, {}) }), ADMIN, T + 200, ADMIN);
    upload(
      db,
      file(300, { nico: dayLua(DAY, { [d1!]: T + 100, [d2!]: T + 250, [d3!]: T + 280 }), ada: dayLua(DAY, {}) }),
      ADMIN,
      T + 300,
      ADMIN,
    );
    const updates = events("doomsdayBoardUpdate");
    expect(updates).toHaveLength(2);
    expect(updates[0]!.postedAt).not.toBeNull();
    expect(updates[1]!.postedAt).toBeNull();
    expect(updates[1]!.data).toMatchObject({
      boardEvent: board!.id,
      messageId: null,
      final: false,
      crown: { name: "Nico", at: T + 280 },
    });
    // An upload that changes nothing sends nothing.
    upload(
      db,
      file(301, { nico: dayLua(DAY, { [d1!]: T + 100, [d2!]: T + 250, [d3!]: T + 280 }), ada: dayLua(DAY, {}) }),
      ADMIN,
      T + 310,
      ADMIN,
    );
    expect(events("doomsdayBoardUpdate")).toHaveLength(2);
    acknowledge(db, board!.id, "1100000000000000001", T + 320);

    // The next reset: the final update with the summary, then the new day's board with yesterday's crown.
    runDueDoomsday(db, T + 86400 + 30);
    const final = events("doomsdayBoardUpdate").at(-1)!;
    expect(final.data).toMatchObject({
      day: DAY,
      final: true,
      messageId: "1100000000000000001",
      summary: { goalsDone: 3, hunt: null, longestStreak: { name: "Nico", days: 1 } },
    });
    expect(events("doomsdayBoard").at(-1)!.data).toMatchObject({ day: DAY + 1, yesterdayCrown: { name: "Nico" } });

    // Sunday's reset (day 20772): last week's ladder.
    runDueDoomsday(db, start(20772) + 60);
    const [ladder] = events("doomsdayLadder");
    expect(ladder!.data).toMatchObject({
      week: 2967,
      label: "week 46",
      end: start(20772),
      pvpVirgins: ["Ada", "Nico"],
    });
    expect((ladder!.data.pve as { name: string; points: number }[])[0]).toMatchObject({ name: "Nico", points: 15 });
  });

  it("posts nothing with the switches off, as they are until the admin turns them on", () => {
    upload(db, file(100, { nico: dayLua(DAY, {}) }), ADMIN, T + 30, ADMIN);
    runDueDoomsday(db, T + 60);
    expect(
      db
        .select()
        .from(botEvents)
        .where(and(isNull(botEvents.postedAt)))
        .all()
        .filter((e) => e.type.startsWith("doomsday")),
    ).toEqual([]);
  });

  it("writes the board's payload as the contract says", () => {
    upload(db, file(100, { nico: dayLua(DAY, {}) }), ADMIN, T + 30, ADMIN);
    const input = doomsdayInput(db, T + 60)!;
    const data = boardData(input, doomsdayFor(db, T + 60)!);
    expect(data.goals.map((g) => g.slot)).toEqual(["pve1", "pve2", "pve3", "skirmish"]);
    expect(data.goals.every((g) => g.points === 5)).toBe(true);
  });
});
