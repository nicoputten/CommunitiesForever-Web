import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uploaderRuns } from "@/core/uploaderRuns";
import { pendingEvents } from "@/server/bot";
import { openDatabase, type Db } from "@/server/db";
import { updateBotSettings } from "@/server/discord";
import {
  answerAskFor,
  answerRunFor,
  askFor,
  askPayload,
  getRun,
  listRuns,
  openAsks,
  writeDueRunEvents,
} from "@/server/runs";
import { upload } from "@/server/uploads";
import { ADMIN, NOW, sampleSavedVariables } from "../design/sample";

// WEB-51: asks on the site. An ask is a run that starts when it is made and takes answers for 10 minutes, without
// slots (Nico, 2026-10-28); from an upload (WEB-43) or the bot (`/ask`). Stored even when the admin's "Ask now from
// the game" is off, which only decides whether Discord gets it.

const GROM = "Player-1-0000A003"; // Nico's Grom Ashfeller, a healer in the sample
const BOB = "Player-1-0000B001"; // Bob, 41 dps
const LIA = "Player-1-0000E001"; // Femke, 37 heal
const MINUTE = 60;
let dir: string;
let db: Db;

beforeEach(() => {
  process.env.ADMIN_BATTLETAG = ADMIN;
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
  expect(upload(db, new TextEncoder().encode(sampleSavedVariables()), ADMIN, NOW).status).toBe("ok");
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

function gameFile(pending: string): Uint8Array {
  const text = sampleSavedVariables()
    .replace('["schemaVersion"] = 1', '["schemaVersion"] = 2')
    .replace('["global"] = {', `["global"] = {\n    pending = ${pending},`);
  return new TextEncoder().encode(text);
}

const types = (after: number) => pendingEvents(db, after, NOW + 3600).map((e) => e.type);
const lastEvent = () => pendingEvents(db, 0, NOW + 3600).at(-1)?.id ?? 0;

describe("asks (WEB-51)", () => {
  it("stores an ask from the game, also with Ask now from the game off, once for the same upload", () => {
    updateBotSettings(db, { askNow: false }, ADMIN, NOW);
    const before = lastEvent();
    const file = gameFile(`{
      { id = "g-1", kind = "ask", at = ${NOW - MINUTE}, dungeon = "dm", guid = "${GROM}", role = "tank", note = "Quick" },
    }`);
    upload(db, file, ADMIN, NOW);
    const asks = openAsks(db, NOW);
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({
      kind: "ask",
      dungeonId: "dm",
      source: "game",
      startsAt: NOW - MINUTE,
      expiresAt: NOW + 9 * MINUTE,
      note: "Quick",
      answers: [{ battleTag: ADMIN, guid: GROM, answer: "in", role: "tank" }],
    });
    // Discord gets nothing with the setting off.
    expect(types(before)).not.toContain("askNow");
    // The same items again: nothing changes.
    upload(db, file, ADMIN, NOW + MINUTE);
    expect(openAsks(db, NOW + MINUTE)).toHaveLength(1);
    // Asks are not runs: not in the runs list, and the run endpoints don't see them.
    expect(listRuns(db).some((r) => r.id === asks[0]!.id)).toBe(false);
    expect(getRun(db, asks[0]!.id)).toBeUndefined();
    expect(answerRunFor(db, asks[0]!.id, { battleTag: "Bob#2002", answer: "maybe", source: "discord" }, NOW)).toBe(
      "unknown_run",
    );
  });

  it("takes answers without slots until it expires, with askNow, askChanged and askExpired once", () => {
    const before = lastEvent();
    const asked = askFor(db, { dungeonId: "sm-armory", organiser: "Bob#2002", source: "discord", leadGuid: BOB }, NOW);
    if (typeof asked === "string") throw new Error(asked);
    const answer = (battleTag: string, a: "in" | "maybe" | "cant", guid: string | undefined, at: number) =>
      answerAskFor(db, asked.id, { battleTag, answer: a, source: "discord", ...(guid ? { guid } : {}) }, at);

    // Four damage dealers are all in: an ask has no slots and no reserve.
    expect(answer(ADMIN, "in", "Player-1-0000A001", NOW + MINUTE)).toMatchObject({ stored: { answer: "in" } });
    expect(answer("Femke#3307", "in", LIA, NOW + MINUTE)).toMatchObject({ stored: { answer: "in", role: "healer" } });
    expect(answer("Mira#1188", "cant", undefined, NOW + 2 * MINUTE)).toMatchObject({ stored: { answer: "cant" } });
    const ask = getRun(db, asked.id, "ask")!;
    const payload = askPayload(db, ask, NOW + 2 * MINUTE);
    expect(payload).toMatchObject({
      id: asked.id,
      from: { name: "Bob" },
      character: "Bob Example",
      role: "dps",
      source: "discord",
      at: NOW,
      expiresAt: NOW + 10 * MINUTE,
      state: "open",
      counts: { in: 3, maybe: 0, cant: 1 },
    });
    expect(payload.answers.some((a) => "reserve" in a)).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("#");

    // After the 10 minutes: refused, and askExpired is written once when the bot polls.
    expect(answer("Jorrit#4410", "maybe", undefined, NOW + 10 * MINUTE)).toBe("expired");
    expect(openAsks(db, NOW + 10 * MINUTE)).toHaveLength(0);
    writeDueRunEvents(db, NOW + 9 * MINUTE);
    expect(types(before).filter((t) => t === "askExpired")).toHaveLength(0);
    writeDueRunEvents(db, NOW + 11 * MINUTE);
    writeDueRunEvents(db, NOW + 12 * MINUTE);
    expect(types(before)).toEqual(["askNow", "askChanged", "askChanged", "askChanged", "askExpired"]);
    const expired = pendingEvents(db, before, NOW + 3600).at(-1)!.data as { ask: { state: string } };
    expect(expired.ask.state).toBe("expired");
  });

  it("refuses an ask for an unknown dungeon or a character that isn't the asker's", () => {
    expect(askFor(db, { dungeonId: "nope", organiser: ADMIN, source: "discord" }, NOW)).toBe("unknown_dungeon");
    expect(askFor(db, { dungeonId: "dm", organiser: ADMIN, source: "discord", leadGuid: BOB }, NOW)).toBe(
      "lead_not_yours",
    );
  });

  it("goes to the game in the uploader's runs feed while it is open", () => {
    const asked = askFor(
      db,
      { dungeonId: "dm", organiser: ADMIN, source: "discord", leadGuid: GROM, note: "Now" },
      NOW,
    );
    if (typeof asked === "string") throw new Error(asked);
    const feed = (now: number) =>
      uploaderRuns({
        runs: [],
        asks: openAsks(db, now),
        characterName: (guid) => (guid === GROM ? "Grom Ashfeller" : undefined),
        timeZoneOf: () => "Europe/Amsterdam",
        reminderMinutes: 30,
        siteUrl: "https://example.com",
        now,
      });
    expect(feed(NOW + MINUTE).asks).toEqual([
      {
        id: `a-${asked.id}`,
        dungeon: "dm",
        dungeonName: "The Deadmines",
        at: NOW,
        expiresAt: NOW + 10 * MINUTE,
        source: "discord",
        note: "Now",
        url: "https://example.com/runs",
        from: { battleTag: ADMIN, guid: GROM, name: "Grom Ashfeller", role: "heal" },
        answers: [
          {
            battleTag: ADMIN,
            guid: GROM,
            name: "Grom Ashfeller",
            answer: "in",
            role: "heal",
            source: "discord",
            at: NOW,
          },
        ],
      },
    ]);
    expect(feed(NOW + MINUTE).updatedAt).toBe(NOW);
    expect(feed(NOW + 10 * MINUTE).asks).toEqual([]);
    // Gone from the list: the list's moment changes, so the uploader writes the file again.
    expect(feed(NOW + 10 * MINUTE).updatedAt).not.toBe(NOW);
  });
});
