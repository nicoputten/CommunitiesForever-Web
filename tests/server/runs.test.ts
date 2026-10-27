import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as dungeonsRoute } from "@/app/api/bot/v1/dungeons/route";
import { POST as answerRoute } from "@/app/api/bot/v1/runs/[id]/answers/route";
import { POST as cancelRoute } from "@/app/api/bot/v1/runs/[id]/cancel/route";
import { GET as charactersRoute } from "@/app/api/bot/v1/runs/[id]/characters/route";
import { GET as runRoute, PATCH as editRoute } from "@/app/api/bot/v1/runs/[id]/route";
import { GET as runsRoute, POST as planRoute } from "@/app/api/bot/v1/runs/route";
import { block } from "@/server/access";
import { createBotToken, pendingEvents } from "@/server/bot";
import { getDb } from "@/server/db";
import { linkDiscord, setTimeZone, updateBotSettings } from "@/server/discord";
import { answerRunFor, cancelRun, editRun, getRun, planRunFor, writeDueRunEvents } from "@/server/runs";
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
    expect((await pick(IDS.jorrit)).characters).toEqual([]);
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
      waitlisted: false,
    });
    expect((await answer(IDS.jorrit, "in", RUK)).body.error).toBe("out_of_range");
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
    expect(swap).toMatchObject({ stored: { answer: "maybe", waitlisted: true, role: "healer" } });
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
