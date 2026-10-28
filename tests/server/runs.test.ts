import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as dungeonsRoute } from "@/app/api/bot/v1/dungeons/route";
import { GET as planChoicesRoute } from "@/app/api/bot/v1/plan/route";
import { POST as answerRoute } from "@/app/api/bot/v1/runs/[id]/answers/route";
import { POST as cancelRoute } from "@/app/api/bot/v1/runs/[id]/cancel/route";
import { POST as moveRoute } from "@/app/api/bot/v1/runs/[id]/move/route";
import { GET as charactersRoute } from "@/app/api/bot/v1/runs/[id]/characters/route";
import { GET as runRoute, PATCH as editRoute } from "@/app/api/bot/v1/runs/[id]/route";
import { GET as runsRoute, POST as planRoute } from "@/app/api/bot/v1/runs/route";
import { block } from "@/server/access";
import { createBotToken, pendingEvents } from "@/server/bot";
import { getDb } from "@/server/db";
import { runAnswers } from "@/server/db/schema";
import { linkDiscord, setTimeZone, updateBotSettings } from "@/server/discord";
import { answerRunFor, cancelRun, editRun, getRun, planRunFor, runPayload, writeDueRunEvents } from "@/server/runs";
import { upload } from "@/server/uploads";
import { ADMIN, NOW, sampleSavedVariables } from "../design/sample";

// WEB-40: runs through the bot (docs/BOT-API.md "Run actions") and the site: rights (own, admin), slots from roles,
// moving up from Maybe, the bot events, reminders when the bot polls.

const BASE = "http://localhost:3000";
const VES = "Player-1-0000A001"; // Nico, 39 dps
const BOB = "Player-1-0000B001"; // Bob, 41 dps
const TOK = "Player-1-0000B002"; // Bob, 33 heal
const LIA = "Player-1-0000E001"; // Femke, 37 heal
const RUK = "Player-1-0000D001"; // Jorrit, 27 dps
const IDS = {
  nico: "100000000000000001",
  bob: "100000000000000002",
  femke: "100000000000000003",
  jorrit: "100000000000000004",
};
const HOUR = 3600;

let dir: string;
let token: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.ADMIN_BATTLETAG = ADMIN;
  process.env.FIXED_NOW = String(NOW);
  const db = getDb();
  expect(upload(db, new TextEncoder().encode(sampleSavedVariables()), ADMIN, NOW).status).toBe("ok");
  token = createBotToken(db, ADMIN, NOW);
  linkDiscord(db, ADMIN, { id: IDS.nico, name: "nico" }, NOW);
  linkDiscord(db, "Bob#2002", { id: IDS.bob, name: "bob" }, NOW);
  linkDiscord(db, "Femke#3307", { id: IDS.femke, name: "femke" }, NOW);
  linkDiscord(db, "Jorrit#4410", { id: IDS.jorrit, name: "jorrit" }, NOW);
  setTimeZone(db, "Bob#2002", "Europe/London", "picked", NOW);
});

afterAll(() => {
  delete process.env.FIXED_NOW;
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

function req(pathname: string, method = "GET", body?: unknown) {
  const headers = new Headers({ authorization: `Bearer ${token}` });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(new URL(pathname, BASE), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const params = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
// Responses are read loosely here; the contract test of their shape is docs/BOT-API.md's table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as Json });
const eventTypes = (after: number) => pendingEvents(getDb(), after, NOW).map((e) => e.type);
const lastEventId = () => pendingEvents(getDb(), 0, NOW).at(-1)?.id ?? 0;

describe("runs through the bot", () => {
  let runId: number;

  it("lists the dungeons, Scarlet Monastery as four wings", async () => {
    const { body } = await json(dungeonsRoute(req("/api/bot/v1/dungeons")));
    expect(body.dungeons.map((d: { id: string }) => d.id)).toEqual(
      expect.arrayContaining(["sm-armory", "sm-graveyard"]),
    );
    expect(body.dungeons.map((d: { id: string }) => d.id)).not.toContain("sm");
  });

  it("plans for a linked Discord user only, the time in their own zone", async () => {
    const plan = (body: unknown) => planRoute(req("/api/bot/v1/runs", "POST", body));
    expect(
      (await json(await plan({ discordUserId: "999", dungeonId: "sm-armory", startsAt: NOW + HOUR }))).status,
    ).toBe(403);
    expect((await json(await plan({ discordUserId: IDS.bob, dungeonId: "sm", startsAt: NOW + HOUR }))).body.error).toBe(
      "unknown_dungeon",
    );
    expect(
      (await json(await plan({ discordUserId: IDS.bob, dungeonId: "sm-armory", startsAt: NOW - 60 }))).body.error,
    ).toBe("time_passed");
    // Bob is in London: "20:30" there is 19:30 UTC in winter (NOW is in November 2026).
    const before = lastEventId();
    const day = new Date((NOW + 24 * HOUR) * 1000).toISOString().slice(0, 10);
    const made = await json(
      await plan({
        discordUserId: IDS.bob,
        dungeonId: "sm-armory",
        date: day,
        time: "20:30",
        leadGuid: BOB,
        note: "Bring water",
      }),
    );
    expect(made.status).toBe(201);
    runId = made.body.run.id;
    expect(made.body.run.startsAt).toBe(Date.parse(`${day}T20:30:00Z`) / 1000);
    expect(made.body.run).toMatchObject({
      dungeon: { name: "Scarlet Monastery: Armory", typicalLevels: { min: 32, max: 42 } },
      organiser: { name: "Bob", character: "Bob Example", discordId: IDS.bob },
      source: "discord",
      state: "open",
      open: { tank: 1, healer: 1, damage: 2 },
    });
    expect(JSON.stringify(made.body)).not.toContain("#");
    expect(eventTypes(before)).toEqual(["runCreated"]);
  });

  it("reads /plan's day as an offset in the asker's own calendar (BOT-04)", async () => {
    // Bob is in London. NOW is Thu 19 Nov 2026 20:00 UTC: day 1 is Friday 20 Nov there.
    const made = await json(
      await planRoute(
        req("/api/bot/v1/runs", "POST", { discordUserId: IDS.bob, dungeonId: "rfk", dayOffset: 1, time: "19:00" }),
      ),
    );
    expect(made.body.run.startsAt).toBe(Date.parse("2026-11-20T19:00:00Z") / 1000);
    const bad = await planRoute(
      req("/api/bot/v1/runs", "POST", { discordUserId: IDS.bob, dungeonId: "rfk", dayOffset: 7, time: "19:00" }),
    );
    expect((await json(bad)).body.error).toBe("invalid_time");
    await cancelRoute(
      req(`/api/bot/v1/runs/${made.body.run.id}/cancel`, "POST", { discordUserId: IDS.bob }),
      params(made.body.run.id),
    );
  });

  it("refuses a lead character that isn't the organiser's", async () => {
    const res = await planRoute(
      req("/api/bot/v1/runs", "POST", {
        discordUserId: IDS.bob,
        dungeonId: "sm-armory",
        startsAt: NOW + HOUR,
        leadGuid: VES,
      }),
    );
    expect((await json(res)).body.error).toBe("lead_not_yours");
  });

  it("Pick my character lists the friend's characters in range", async () => {
    const pick = async (id: string) =>
      (
        await json(
          await charactersRoute(req(`/api/bot/v1/runs/${runId}/characters?discordUserId=${id}`), params(runId)),
        )
      ).body;
    expect((await pick(IDS.nico)).characters.map((c: { name: string }) => c.name)).toEqual(["Ves Doombringer"]);
    // Ruk (27) is 5 below the Armory: he may still join (WEB-47 levelFit), with how he fits.
    expect((await pick(IDS.jorrit)).characters).toMatchObject([
      { name: "Ruk Bloodhoof", fit: "5 below", roles: ["damage"] },
    ]);
  });

  it("answers fill slots from roles; out of range only Maybe; not someone else's character", async () => {
    const answer = async (id: string, a: string, guid?: string) =>
      json(
        await answerRoute(
          req(`/api/bot/v1/runs/${runId}/answers`, "POST", { discordUserId: id, answer: a, ...(guid ? { guid } : {}) }),
          params(runId),
        ),
      );
    expect((await answer(IDS.femke, "in", LIA)).body.stored).toEqual({
      answer: "in",
      role: "healer",
      reserve: false,
      waitlisted: false,
    });
    // Zul Kazrek (15) is 17 below the Armory: Maybe only (WEB-47 levelFit). Femke's answer stays.
    expect((await answer(IDS.femke, "in", "Player-1-0000E002")).body.error).toBe("out_of_range");
    expect((await answer(IDS.jorrit, "maybe", RUK)).body.stored.answer).toBe("maybe");
    expect((await answer(IDS.nico, "in", BOB)).body.error).toBe("not_your_character");
    expect((await answer(IDS.nico, "in")).body.error).toBe("no_character");
    expect((await answer(IDS.nico, "yes", VES)).status).toBe(400);
    const ves = await answer(IDS.nico, "in", VES);
    expect(ves.body.run.open).toEqual({ tank: 1, healer: 0, damage: 1 });
    expect(ves.body.run.counts).toEqual({ in: 3, maybe: 1, cant: 0 });
  });

  it("only the organiser edits; the organiser or the admin cancels", async () => {
    const edit = async (id: string, body: object) =>
      json(await editRoute(req(`/api/bot/v1/runs/${runId}`, "PATCH", { discordUserId: id, ...body }), params(runId)));
    expect((await edit(IDS.femke, { note: "mine now" })).body.error).toBe("not_organiser");
    const before = lastEventId();
    const edited = await edit(IDS.bob, { note: "Bring water and food" });
    expect(edited.body.run.note).toBe("Bring water and food");
    expect(pendingEvents(getDb(), before, NOW).map((e) => [e.type, (e.data as { changed: string[] }).changed])).toEqual(
      [["runChanged", ["note"]]],
    );
    expect(
      (
        await json(
          await cancelRoute(
            req(`/api/bot/v1/runs/${runId}/cancel`, "POST", { discordUserId: IDS.femke }),
            params(runId),
          ),
        )
      ).status,
    ).toBe(403);
    const got = await json(await runRoute(req(`/api/bot/v1/runs/${runId}`), params(runId)));
    expect(got.body.run.state).toBe("open");
    expect((await json(await runRoute(req("/api/bot/v1/runs/999"), params(999)))).status).toBe(404);
  });

  it("the admin cancels any run; a blocked friend can do nothing", async () => {
    const extra = planRunFor(
      getDb(),
      { dungeonId: "rfk", startsAt: NOW + 2 * HOUR, organiser: "Bob#2002", source: "website" },
      NOW,
    );
    const id = (extra as { id: number }).id;
    const cancel = (who: string) =>
      cancelRoute(req(`/api/bot/v1/runs/${id}/cancel`, "POST", { discordUserId: who }), params(id));
    const done = await json(await cancel(IDS.nico));
    expect(done.body.run.state).toBe("cancelled");
    expect((await json(await cancel(IDS.nico))).body.error).toBe("already_cancelled");
    const upcoming = (await json(runsRoute(req("/api/bot/v1/runs")))).body.runs.map((r: { id: number }) => r.id);
    expect(upcoming).toEqual([runId]);

    block(getDb(), "Jorrit#4410", ADMIN, NOW);
    const blocked = await answerRoute(
      req(`/api/bot/v1/runs/${runId}/answers`, "POST", { discordUserId: IDS.jorrit, answer: "cant" }),
      params(runId),
    );
    expect((await json(blocked)).body.error).toBe("not_linked");
  });
});

describe("the organiser's moves (WEB-47)", () => {
  it("only the organiser or the admin moves; the moved friend gets a quiet notice", async () => {
    const db = getDb();
    const id = (
      planRunFor(
        db,
        { dungeonId: "sm-library", startsAt: NOW + 4 * HOUR, organiser: "Bob#2002", source: "website", leadGuid: TOK },
        NOW,
      ) as { id: number }
    ).id;
    answerRunFor(
      db,
      id,
      { battleTag: "Femke#3307", answer: "in", source: "website", guid: LIA, role: "damage" },
      NOW + 1,
    );
    const move = async (who: string, body: object) =>
      json(await moveRoute(req(`/api/bot/v1/runs/${id}/move`, "POST", { discordUserId: who, ...body }), params(id)));

    // Femke (not the organiser) can't move her own sign-up; Bob (organiser) and Nico (admin) can.
    expect((await move(IDS.femke, { characterId: LIA, to: "healer" })).body.error).toBe("not_allowed");
    expect((await move(IDS.bob, { characterId: LIA, to: "tank" })).body.error).toBe("role_not_for_class");
    expect((await move(IDS.bob, { characterId: LIA, to: "heal" })).status).toBe(400);
    const before = pendingEvents(db, 0, NOW).at(-1)?.id ?? 0;
    // Tok holds the healer slot: Femke can't go there, so the admin first moves Tok to reserve.
    expect((await move(IDS.bob, { characterId: LIA, to: "healer" })).body.error).toBe("role_full");
    expect((await move(IDS.nico, { characterId: TOK, to: "reserve" })).status).toBe(200);
    const moved = await move(IDS.bob, { characterId: LIA, to: "healer" });
    expect(moved.status).toBe(200);
    const lia = moved.body.run.answers.find((a: { character: string }) => a.character === "Lia Thornwhisper");
    expect(lia).toMatchObject({ answer: "in", role: "healer", guid: LIA, fit: { kind: "fits", label: "fits" } });
    const tok = moved.body.run.answers.find((a: { character: string }) => a.character === "Tok Ironhide");
    expect(tok).toMatchObject({ answer: "maybe", reserve: true, role: "healer" });
    const notices = pendingEvents(db, before, NOW).filter((e) => e.type === "runMoved");
    expect(notices.map((e) => (e.data as { to: string; who: { name: string } }).to)).toEqual(["reserve", "healer"]);
    expect((notices[0]!.data as { who: { name: string; discordId: string } }).who).toEqual({
      name: "Bob",
      discordId: IDS.bob,
    });

    // Remove: the answer goes; Femke may answer again.
    expect((await move(IDS.bob, { characterId: LIA, to: "remove" })).status).toBe(200);
    expect(getRun(db, id)!.answers.some((a) => a.guid === LIA)).toBe(false);
    expect(
      answerRunFor(db, id, { battleTag: "Femke#3307", answer: "maybe", source: "website", guid: LIA }, NOW + 2),
    ).toMatchObject({
      stored: { answer: "maybe" },
    });
  });

  it("turns WEB-40's 'Maybe, first in line' into reserve (migration 0011)", () => {
    const db = getDb();
    const id = (
      planRunFor(db, { dungeonId: "rfk", startsAt: NOW + 6 * HOUR, organiser: ADMIN, source: "website" }, NOW) as {
        id: number;
      }
    ).id;
    db.insert(runAnswers)
      .values([
        {
          runId: id,
          key: "bob#2002",
          battleTag: "Bob#2002",
          guid: TOK,
          answer: "maybe",
          role: "healer",
          source: "website",
          answeredAt: NOW,
          waitlisted: true,
          movedUp: false,
        },
        {
          runId: id,
          key: "femke#3307",
          battleTag: "Femke#3307",
          guid: LIA,
          answer: "maybe",
          role: "healer",
          source: "website",
          answeredAt: NOW,
          waitlisted: false,
          movedUp: false,
        },
      ])
      .run();
    db.$client.exec(readFileSync(new URL("../../drizzle/0011_reserve.sql", import.meta.url), "utf8"));
    const rows = db
      .select()
      .from(runAnswers)
      .all()
      .filter((r) => r.runId === id);
    expect(rows.map((r) => [r.battleTag, r.answer, r.waitlisted])).toEqual([
      ["Bob#2002", "reserve", false],
      ["Femke#3307", "maybe", false],
    ]);
  });
});

describe("the bot's run post data (BOT-04)", () => {
  it("names who could fill each open role, with levels, classes and fit", () => {
    const db = getDb();
    const id = (
      planRunFor(
        db,
        { dungeonId: "sm-armory", startsAt: NOW + 8 * HOUR, organiser: ADMIN, source: "website", leadGuid: VES },
        NOW,
      ) as { id: number }
    ).id;
    const payload = runPayload(db, getRun(db, id)!, NOW);
    expect(payload.organiser).toMatchObject({
      name: "Nico",
      character: "Ves Doombringer",
      level: 39,
      classFile: "WARLOCK",
    });
    expect(payload.answers[0]).toMatchObject({ character: "Ves Doombringer", level: 39, classFile: "WARLOCK" });
    const byRole = Object.fromEntries(payload.couldFill.map((r) => [r.role, r]));
    // Tank: nobody in range; Kel Dawnhammer (18, Mira's paladin tank) is the closest below.
    expect(byRole.tank).toMatchObject({
      open: 1,
      characters: [],
      close: [{ character: "Kel Dawnhammer", level: 18, name: "Mira" }],
    });
    expect(byRole.healer!.characters.map((c) => c.character)).toEqual(["Lia Thornwhisper", "Tok Ironhide"]);
    // Damage: Bob Example fits; Mira Sunstrider (60) is a carry and Ruk (27) only low: not suggested.
    expect(byRole.damage!.characters.map((c) => [c.character, c.fit.label])).toEqual([["Bob Example", "fits"]]);
    expect(JSON.stringify(payload)).not.toContain("#");
  });

  it("gives /plan the days in the asker's calendar and who they would lead as", async () => {
    const res = await planChoicesRoute(req(`/api/bot/v1/plan?discordUserId=${IDS.bob}`));
    const { status, body } = await json(res);
    expect(status).toBe(200);
    // Bob is in London; NOW is Thu 19 Nov 2026 20:00 UTC.
    expect(body.timeZone).toBe("Europe/London");
    expect(body.admin).toBe(false);
    expect(body.days).toHaveLength(7);
    expect(body.days[1]).toEqual({ offset: 1, label: "Fri 20", date: "2026-11-20" });
    const byId = Object.fromEntries(body.dungeons.map((d: Json) => [d.id, d]));
    // The Armory (32–42): Bob Example 41 fits before Tok Ironhide 33.
    expect(byId["sm-armory"].lead).toMatchObject({ guid: BOB, name: "Bob Example", level: 41, fit: { kind: "fits" } });
    expect(byId["scholo"].lead).toBeNull();
    expect(JSON.stringify(body)).not.toContain("#");
    expect((await planChoicesRoute(req("/api/bot/v1/plan?discordUserId=100000000000000099"))).status).toBe(403);
  });
});

describe("moving up and reminders", () => {
  it("a full role keeps the next I'm in as Maybe, who moves up when someone drops", () => {
    const db = getDb();
    const { id } = planRunFor(
      db,
      { dungeonId: "sm-armory", startsAt: NOW + 3 * HOUR, organiser: ADMIN, source: "website", leadGuid: VES },
      NOW,
    ) as { id: number };
    // Damage: Ves (organiser) and Bob.
    expect(
      answerRunFor(db, id, { battleTag: "Bob#2002", answer: "in", source: "website", guid: BOB }, NOW + 1),
    ).toMatchObject({
      stored: { answer: "in" },
    });
    // Healer: Lia.
    answerRunFor(db, id, { battleTag: "Femke#3307", answer: "in", source: "website", guid: LIA }, NOW + 2);
    const before = lastEventId();
    // Bob switches to Tok, a healer: the healer slot is full, so he is kept as Maybe, first in line.
    const swap = answerRunFor(db, id, { battleTag: "Bob#2002", answer: "in", source: "website", guid: TOK }, NOW + 3);
    expect(swap).toMatchObject({ stored: { answer: "reserve", role: "healer" } });
    // Femke drops: Bob (Tok) moves up into the healer slot.
    const drop = answerRunFor(db, id, { battleTag: "Femke#3307", answer: "cant", source: "website" }, NOW + 4);
    expect(drop).toMatchObject({ movedUp: { battleTag: "Bob#2002", guid: TOK, answer: "in", movedUp: true } });
    expect(eventTypes(before)).toEqual(["runChanged", "runChanged", "runMovedUp"]);
    expect(getRun(db, id)!.answers.find((a) => a.battleTag === "Bob#2002")).toMatchObject({
      answer: "in",
      role: "healer",
    });
  });

  it("writes the reminder and starting now once, when the bot polls, and mentions only I'm in and Maybe", () => {
    const db = getDb();
    const { id } = planRunFor(
      db,
      { dungeonId: "rfk", startsAt: NOW + 20 * 60, organiser: "Femke#3307", source: "website" },
      NOW,
    ) as { id: number };
    answerRunFor(db, id, { battleTag: "Bob#2002", answer: "maybe", source: "website" }, NOW);
    answerRunFor(db, id, { battleTag: ADMIN, answer: "cant", source: "website" }, NOW);
    const before = lastEventId();
    writeDueRunEvents(db, NOW);
    writeDueRunEvents(db, NOW + 60);
    const reminders = pendingEvents(db, before, NOW).filter((e) => (e.data as { run: { id: number } }).run.id === id);
    expect(reminders.map((e) => [e.type, (e.data as { mention: string[] }).mention])).toEqual([
      ["runReminder", [IDS.bob]],
    ]);
    writeDueRunEvents(db, NOW + 21 * 60);
    writeDueRunEvents(db, NOW + 22 * 60);
    const all = pendingEvents(db, before, NOW).filter((e) => (e.data as { run: { id: number } }).run.id === id);
    expect(all.map((e) => e.type)).toEqual(["runReminder", "runStarting"]);
    // A new time brings both back.
    expect(editRun(db, id, "Femke#3307", { startsAt: NOW + 25 * 60 }, NOW + 22 * 60)).toBe("closed");
  });

  it("no run events with the admin's Runs switch off; no reminder with Reminders off", () => {
    const db = getDb();
    updateBotSettings(db, { runs: false }, ADMIN, NOW);
    const before = lastEventId();
    const made = planRunFor(db, { dungeonId: "wc", startsAt: NOW + 10 * 60, organiser: ADMIN, source: "website" }, NOW);
    expect(eventTypes(before)).toEqual([]);
    updateBotSettings(db, { runs: true, reminders: false }, ADMIN, NOW);
    writeDueRunEvents(db, NOW);
    expect(eventTypes(before)).toEqual([]);
    cancelRun(db, (made as { id: number }).id, ADMIN, true, NOW);
    expect(eventTypes(before)).toEqual(["runCancelled"]);
    updateBotSettings(db, { reminders: true }, ADMIN, NOW);
  });
});
