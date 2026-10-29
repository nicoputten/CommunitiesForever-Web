import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sameBattleTag } from "@/core/access";
import type { GameItem } from "@/core/gameItems";
import { summaryLine } from "@/core/views/upload";
import { pendingEvents } from "@/server/bot";
import { openDatabase, type Db } from "@/server/db";
import { gameItemCarriers, gameItems, runs } from "@/server/db/schema";
import { applyGameItems, markRanIt, receivedIds } from "@/server/gameItems";
import { answerRunFor, getRun, listRuns, markDidntHappen, openAsks, planRunFor } from "@/server/runs";
import { getUpload, rebuild, upload } from "@/server/uploads";
import { ADMIN, NOW, sampleSavedVariables } from "../design/sample";

// WEB-43: runs from uploads. The game's plans, answers, asks and pings (addon CF-47/48 `pending`, schema 2) are
// applied once each; "Ran it" from the run log, "didn't happen" when no upload showed it within 4 hours.

const VES = "Player-1-0000A001"; // Nico, 39 dps
const BOB = "Player-1-0000B001"; // Bob, 41 dps
const HOUR = 3600;
const DAY = 24 * HOUR;
let dir: string;
let db: Db;

beforeEach(() => {
  process.env.ADMIN_BATTLETAG = ADMIN;
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
  // Without the Doomsday feed: these tests bring their own run log for the same day (WEB-63).
  expect(upload(db, new TextEncoder().encode(sampleSavedVariables({ doomsday: false })), ADMIN, NOW).status).toBe("ok");
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

/** The sample as a schema 2 file with the game's items (and, optionally, the uploader's run log). */
function gameFile(pending: string, feed = ""): Uint8Array {
  let text = sampleSavedVariables({ doomsday: false })
    .replace('["schemaVersion"] = 1', '["schemaVersion"] = 2')
    .replace('["global"] = {', `["global"] = {\n    pending = ${pending},`);
  if (feed !== "") text = text.replace('["self"] = {', `["self"] = {\n      feed = ${feed},`);
  return new TextEncoder().encode(text);
}

const plan = (dungeonId: string, startsAt: number, organiser = ADMIN, leadGuid?: string) =>
  (
    planRunFor(
      db,
      { dungeonId, startsAt, organiser, source: "website", ...(leadGuid ? { leadGuid } : {}) },
      NOW - HOUR,
    ) as { id: number }
  ).id;

describe("the game's items", () => {
  it("plans, answers, asks and pings once each; drops a late plan and an old ask", () => {
    const bobs = plan("sm-armory", NOW + 3 * HOUR, "Bob#2002", BOB);
    const before = pendingEvents(db, 0, NOW).at(-1)?.id ?? 0;
    const file = gameFile(`{
      { id = "g-1", kind = "plan", at = ${NOW - 120}, dungeon = "smlib", startsAt = ${NOW + 5 * HOUR},
        guid = "${VES}", name = "Ves Doombringer", role = "dps", note = "From the game" },
      { id = "g-2", kind = "plan", at = ${NOW - 120}, dungeon = "rfk", startsAt = ${NOW - 60} },
      { id = "g-3", kind = "answer", at = ${NOW - 90}, run = "r-${bobs}", answer = "in", guid = "${VES}" },
      { id = "g-4", kind = "ask", at = ${NOW - 60}, dungeon = "dm", guid = "${VES}", role = "dps", note = "Quick" },
      { id = "g-5", kind = "ask", at = ${NOW - 3600}, dungeon = "dm" },
      { id = "g-6", kind = "ping", at = ${NOW - 30}, run = "r-${bobs}", battleTag = "Bob#2002" },
      { id = "g-7", kind = "answer", at = ${NOW - 20}, run = "r-99999", answer = "maybe" },
    }`);
    const result = upload(db, file, ADMIN, NOW);
    expect(result.status).toBe("ok");

    const fromGame = listRuns(db).find((r) => r.source === "game")!;
    expect(fromGame).toMatchObject({
      dungeonId: "sm-library",
      startsAt: NOW + 5 * HOUR,
      organiser: ADMIN,
      note: "From the game",
    });
    expect(fromGame.answers).toMatchObject([{ guid: VES, answer: "in", source: "game" }]);
    expect(getRun(db, bobs)!.answers.find((a) => a.guid === VES)).toMatchObject({ answer: "in", source: "game" });

    const results = Object.fromEntries(
      db
        .select()
        .from(gameItems)
        .all()
        .map((i) => [i.id, i.result]),
    );
    expect(results).toEqual({
      "g-1": "applied",
      "g-2": "time_passed",
      "g-3": "applied",
      "g-4": "applied",
      "g-5": "expired",
      "g-6": "applied",
      "g-7": "unknown_run",
    });
    const events = pendingEvents(db, before, NOW).map((e) => e.type);
    expect(events).toEqual(expect.arrayContaining(["runCreated", "runChanged", "askNow", "ping"]));
    const ask = pendingEvents(db, before, NOW).find((e) => e.type === "askNow")!.data as { ask: unknown };
    expect(ask.ask).toMatchObject({
      dungeon: { id: "dm", name: "The Deadmines" },
      from: { name: "Nico" },
      note: "Quick",
    });
    expect(JSON.stringify(ask)).not.toContain("#");

    // "N run answers" in the report and the summary line, also after a rebuild.
    expect(result.summary?.runAnswers).toBe(1);
    expect(summaryLine(result.summary, false)).toContain("1 run answer");
    rebuild(db);
    expect(getUpload(db, result.id)?.summary?.runAnswers).toBe(1);

    // The ids go back to the game.
    expect(receivedIds(db, ADMIN).sort()).toEqual(["g-1", "g-2", "g-3", "g-4", "g-5", "g-6", "g-7"]);
    expect(receivedIds(db, "Bob#2002")).toEqual([]);

    // The same items again (another file, so not the same upload): nothing changes.
    const count = listRuns(db).length;
    const eventsBefore = pendingEvents(db, 0, NOW).length;
    const again = upload(db, file, ADMIN, NOW + 60);
    expect(again.duplicate).toBe(true);
    const changed = gameFile(
      `{ { id = "g-1", kind = "plan", at = ${NOW - 120}, dungeon = "smlib", startsAt = ${NOW + 5 * HOUR} } }`,
    );
    expect(upload(db, changed, ADMIN, NOW + 120).status).toBe("ok");
    expect(listRuns(db)).toHaveLength(count);
    expect(pendingEvents(db, 0, NOW).length).toBe(eventsBefore);
  });
});

describe("the role from the game (WEB-47)", () => {
  it("takes the role the addon sends when the class can play it, else the character's own", () => {
    const GROM = "Player-1-0000A002"; // Nico, 24 warrior (tank)
    const bobs = plan("rfk", NOW + 3 * HOUR, "Bob#2002", "Player-1-0000B002");
    const file = gameFile(`{
      { id = "r-1", kind = "plan", at = ${NOW - 60}, dungeon = "dm", startsAt = ${NOW + 4 * HOUR}, guid = "${GROM}", role = "dps" },
      { id = "r-2", kind = "answer", at = ${NOW - 30}, run = "r-${bobs}", answer = "maybe", guid = "${VES}", role = "tank" },
    }`);
    expect(upload(db, file, ADMIN, NOW).status).toBe("ok");
    const planned = listRuns(db).find((r) => r.source === "game")!;
    // A warrior may deal damage: the role the game sent.
    expect(planned.answers).toMatchObject([{ guid: GROM, role: "damage", answer: "in" }]);
    // A warlock can't tank: Ves's own role (damage).
    expect(getRun(db, bobs)!.answers.find((a) => a.guid === VES)).toMatchObject({ role: "damage", answer: "maybe" });
  });
});

describe("how runs ended", () => {
  it("ran it when an upload's run log shows the monastery with two who said I'm in", () => {
    const id = plan("sm-armory", NOW + HOUR, ADMIN, VES);
    answerRunFor(db, id, { battleTag: "Bob#2002", answer: "in", source: "website", guid: BOB }, NOW);
    const day = Math.floor((NOW + HOUR) / DAY);
    const feed = `{ [${day}] = { ["${VES}"] = { name = "Ves Doombringer", runs = {
      { name = "Scarlet Monastery", kind = "party", bosses = 4, with = { "${BOB}" } } } } } }`;
    const before = pendingEvents(db, 0, NOW).at(-1)?.id ?? 0;
    expect(upload(db, gameFile("{}", feed), ADMIN, NOW + 2 * HOUR).status).toBe("ok");
    expect(getRun(db, id)!.outcome).toEqual({ kind: "done", at: NOW + 2 * HOUR, came: 2, signedUp: 2 });
    const ended = pendingEvents(db, before, NOW).find((e) => e.type === "runEnded")!.data as Record<string, unknown>;
    expect(ended).toMatchObject({ outcome: "done", came: 2, signedUp: 2 });
    // Once only.
    expect(markRanIt(db, NOW + 2 * HOUR)).toBe(0);
  });

  it("didn't happen when no upload showed it within 4 hours; old runs are marked without a post", () => {
    const id = plan("rfk", NOW + HOUR);
    const old = plan("wc", NOW + HOUR);
    db.update(runs)
      .set({ startsAt: NOW - 3 * DAY })
      .where(eq(runs.id, old))
      .run();
    const before = pendingEvents(db, 0, NOW).at(-1)?.id ?? 0;
    // The old one now, without a post (a day late is no news); the new one not yet.
    expect(markDidntHappen(db, NOW)).toBe(1);
    expect(getRun(db, old)!.outcome).toEqual({ kind: "didntHappen", at: NOW - 3 * DAY + 4 * HOUR });
    expect(getRun(db, id)!.outcome).toBeUndefined();
    expect(pendingEvents(db, before, NOW).map((e) => e.type)).not.toContain("runEnded");
    // 4 hours after its start, with no upload showing it.
    expect(markDidntHappen(db, NOW + 5 * HOUR)).toBe(1);
    expect(getRun(db, id)!.outcome).toEqual({ kind: "didntHappen", at: NOW + 5 * HOUR });
    expect(pendingEvents(db, before, NOW).map((e) => e.type)).toContain("runEnded");
    expect(markDidntHappen(db, NOW + 6 * HOUR)).toBe(0);
  });
});

describe("carried asks and in-game answers (WEB-53)", () => {
  const ask = (over: Partial<Extract<GameItem, { kind: "ask" }>> = {}): GameItem => ({
    id: "k-nico-1",
    at: NOW - 60,
    kind: "ask",
    dungeon: "dm",
    guid: VES,
    role: "dps",
    note: "Quick",
    ...over,
  });
  const askEvents = (after: number) => pendingEvents(db, after, NOW).filter((e) => e.type === "askNow");

  it("takes a friend's ask from any carrier once; every carrier gets it back in received", () => {
    const before = pendingEvents(db, 0, NOW).at(-1)?.id ?? 0;
    for (const carrier of ["Bob#2002", "Femke#3307", "Jorrit#4410", "Mira#1188"]) {
      applyGameItems(db, 1, carrier, [ask()], NOW);
    }
    const asks = openAsks(db, NOW);
    expect(asks).toHaveLength(1);
    // The asker's ask: Nico's (Ves is his), not the first carrier's.
    expect(asks[0]).toMatchObject({ organiser: ADMIN, source: "game", dungeonId: "dm", note: "Quick" });
    expect(askEvents(before)).toHaveLength(1);
    for (const carrier of ["Bob#2002", "Femke#3307", "Jorrit#4410", "Mira#1188"]) {
      expect(receivedIds(db, carrier)).toContain("k-nico-1");
    }
    // The asker's own file later: nothing new; the asker forgets it too.
    applyGameItems(db, 2, ADMIN, [ask()], NOW + 30);
    expect(openAsks(db, NOW + 30)).toHaveLength(1);
    expect(receivedIds(db, ADMIN)).toContain("k-nico-1");
    const audit = db.select().from(gameItemCarriers).where(eq(gameItemCarriers.id, "k-nico-1")).all();
    expect(audit.map((r) => r.battleTag).sort()).toEqual(["Bob#2002", "Femke#3307", "Jorrit#4410", "Mira#1188"]);
  });

  it("drops an expired carried ask and one from someone outside the community", () => {
    applyGameItems(db, 1, "Bob#2002", [ask({ id: "k-old", at: NOW - 11 * 60 })], NOW);
    applyGameItems(
      db,
      1,
      "Bob#2002",
      [ask({ id: "k-stranger", guid: "Player-1-0000F999", battleTag: "Stranger#9999" })],
      NOW,
    );
    expect(openAsks(db, NOW)).toHaveLength(0);
    const results = Object.fromEntries(
      db
        .select()
        .from(gameItems)
        .all()
        .map((r) => [r.id, r.result]),
    );
    expect(results).toMatchObject({ "k-old": "expired", "k-stranger": "not_member" });
    expect(receivedIds(db, "Bob#2002")).toEqual(expect.arrayContaining(["k-old", "k-stranger"]));
  });

  it("answers an ask from the answerer's own file; an unknown ask is logged and ignored", () => {
    applyGameItems(db, 1, "Femke#3307", [ask()], NOW);
    const answer: GameItem = {
      id: "k-bob-1",
      at: NOW + 20,
      kind: "askAnswer",
      ask: "k-nico-1",
      answer: "in",
      guid: BOB,
    };
    const unknown: GameItem = { id: "k-bob-2", at: NOW + 20, kind: "askAnswer", ask: "k-none", answer: "maybe" };
    applyGameItems(db, 2, "Bob#2002", [answer, unknown], NOW + 30);
    const [stored] = openAsks(db, NOW + 30);
    expect(stored!.answers.find((a) => sameBattleTag(a.battleTag, "Bob#2002"))).toMatchObject({
      answer: "in",
      guid: BOB,
      source: "game",
    });
    const results = Object.fromEntries(
      db
        .select()
        .from(gameItems)
        .all()
        .map((r) => [r.id, r.result]),
    );
    expect(results).toMatchObject({ "k-bob-1": "applied", "k-bob-2": "unknown_ask" });
    // After its 10 minutes the answer is refused.
    applyGameItems(db, 3, "Bob#2002", [{ ...answer, id: "k-bob-3", answer: "cant" }], NOW + 11 * 60);
    expect(db.select().from(gameItems).where(eq(gameItems.id, "k-bob-3")).get()?.result).toBe("expired");
  });
});
