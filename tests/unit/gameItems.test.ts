import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FeedDay } from "@/core/feed";
import { readGameItems, siteRunId } from "@/core/gameItems";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import { ranIt, runDays } from "@/core/runOutcome";
import { runDungeonByAddonId, type RunRecord } from "@/core/runs";

// WEB-43: the game's items (addon CF-47/48 `pending`, schema 2) read from the addon's own sample, and when a planned
// run happened according to the run log.

const sample = readFileSync(new URL("../fixtures/addon-unreleased/pending.lua", import.meta.url), "utf8");
/** The sample's list, as the saved file holds it under global.pending. */
const pendingList = sample.slice(sample.indexOf("return ") + "return ".length);
const file = (pending: string, schemaVersion = 2) =>
  parseLua(`CommunitiesForeverDB = { ["global"] = { schemaVersion = ${schemaVersion}, pending = ${pending} } }`);

describe("the game's items", () => {
  it("reads every kind from the addon's sample", () => {
    const items = readGameItems(file(pendingList));
    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ["plan", "k3f9c0a7e21b-1793120000-1"],
      ["answer", "k3f9c0a7e21b-1793120060-2"],
      ["answer", "k3f9c0a7e21b-1793120120-3"],
      ["ask", "k3f9c0a7e21b-1793120180-4"],
      ["ping", "k3f9c0a7e21b-1793120190-5"],
    ]);
    expect(items[0]).toEqual({
      id: "k3f9c0a7e21b-1793120000-1",
      at: 1793120000,
      kind: "plan",
      dungeon: "smarm",
      startsAt: 1793190600,
      guid: "Player-1-0000AAAA",
      name: "Ada Lovewell",
      role: "tank",
      note: "Bring water",
    });
    expect(items[2]).toEqual({
      id: "k3f9c0a7e21b-1793120120-3",
      at: 1793120120,
      kind: "answer",
      run: "r-103",
      answer: "cant",
    });
    expect(items[4]).toMatchObject({ kind: "ping", run: "r-102", battleTag: "Bo#2002", name: "Bo Example" });
  });

  it("is a schema the site reads, and older files have none", () => {
    expect(() => normalize(file(pendingList))).not.toThrow();
    expect(readGameItems(parseLua(`CommunitiesForeverDB = { ["global"] = { schemaVersion = 1 } }`))).toEqual([]);
  });

  it("leaves out what's broken, strips WoW escapes, never repeats an id", () => {
    const items = readGameItems(
      file(`{
        { id = "a-1", kind = "answer", at = 10, run = "r-1", answer = "in" },
        { id = "a-1", kind = "answer", at = 11, run = "r-1", answer = "cant" },
        { id = "bad id!", kind = "answer", at = 12, run = "r-1", answer = "in" },
        { id = "a-2", kind = "answer", at = 13, run = "r-1", answer = "sure" },
        { id = "a-3", kind = "nap", at = 14 },
        { id = "a-4", kind = "plan", at = 15, dungeon = "rfc" },
        { id = "a-5", kind = "ask", at = 16, dungeon = "dm", note = "|cffff0000Red|r run", role = "boss" },
        "text",
      }`),
    );
    expect(items).toEqual([
      { id: "a-1", at: 10, kind: "answer", run: "r-1", answer: "in" },
      { id: "a-5", at: 16, kind: "ask", dungeon: "dm", note: "Red run" },
    ]);
  });

  it("keeps an answer's note: trimmed, without control characters or WoW escapes, cut at 80 (WEB-67, CF-63)", () => {
    const long = "x".repeat(100);
    const items = readGameItems(
      file(`{
        { id = "n-1", kind = "answer", at = 10, run = "r-1", answer = "maybe", note = "  Late,\\tstart |cffff0000without|r me \\n " },
        { id = "n-2", kind = "answer", at = 11, run = "r-1", answer = "in", note = "${long}" },
        { id = "n-3", kind = "answer", at = 12, run = "r-1", answer = "cant", note = "   " },
        { id = "n-4", kind = "answer", at = 13, run = "r-1", answer = "cant" },
      }`),
    );
    expect(items.map((i) => (i.kind === "answer" ? i.note : "?"))).toEqual([
      "Late, start without me",
      "x".repeat(80),
      undefined,
      undefined,
    ]);
  });

  it("reads a carried ask's asker and an in-game answer to an ask (WEB-53, addon CF-51)", () => {
    const items = readGameItems(
      file(`{
        { id = "k-ada-1", kind = "ask", at = 20, dungeon = "dm", guid = "Player-1-0000A001", battleTag = "Ada#1001" },
        { id = "b-1", kind = "askAnswer", at = 21, ask = "k-ada-1", answer = "in", guid = "Player-1-0000B001", role = "heal" },
        { id = "b-2", kind = "askAnswer", at = 22, ask = "k-ada-1", answer = "soon" },
        { id = "b-3", kind = "askAnswer", at = 23, answer = "in" },
      }`),
    );
    expect(items).toEqual([
      { id: "k-ada-1", at: 20, kind: "ask", dungeon: "dm", guid: "Player-1-0000A001", battleTag: "Ada#1001" },
      { id: "b-1", at: 21, kind: "askAnswer", ask: "k-ada-1", answer: "in", guid: "Player-1-0000B001", role: "heal" },
    ]);
  });

  it("knows the site's runs and the addon's dungeons", () => {
    expect([siteRunId("r-102"), siteRunId("r-x"), siteRunId("102")]).toEqual([102, undefined, undefined]);
    expect(["smarm", "ubrs", "lbrs", "lfg1984", "lfg9999"].map((id) => runDungeonByAddonId(id)?.id)).toEqual([
      "sm-armory",
      "brs",
      "brs",
      "thanes",
      undefined,
    ]);
  });
});

describe("did a planned run happen", () => {
  const START = Date.UTC(2026, 10, 19, 19, 30) / 1000;
  const run: RunRecord = {
    id: 1,
    dungeonId: "sm-armory",
    startsAt: START,
    organiser: "Nico#2201",
    source: "website",
    createdAt: START - 86400,
    updatedAt: START - 86400,
    answers: [
      { battleTag: "Nico#2201", guid: "VES", answer: "in", role: "damage", source: "website", answeredAt: 1 },
      { battleTag: "Bob#2002", guid: "BOB", answer: "in", role: "damage", source: "website", answeredAt: 2 },
      { battleTag: "Femke#3307", guid: "LIA", answer: "in", role: "healer", source: "website", answeredAt: 3 },
      { battleTag: "Mira#1188", guid: "MIRA", answer: "maybe", role: "damage", source: "website", answeredAt: 4 },
    ],
  };
  const today = Math.floor(START / 86400);
  const entry = (runs: FeedDay["runs"]): FeedDay => ({ quests: {}, ranks: {}, learned: [], runs });
  const log = (byDay: Record<number, Record<string, FeedDay>>) => (d: number) => byDay[d] ?? {};

  it("ran when the log shows the monastery that day with two who said I'm in", () => {
    const days = log({ [today]: { VES: entry([{ name: "Scarlet Monastery", with: ["BOB", "MIRA", "ZUL"] }]) } });
    expect(ranIt(run, days)).toEqual({ came: 2, signedUp: 3 });
  });

  it("not with one of them, another dungeon, or another day", () => {
    expect(
      ranIt(run, log({ [today]: { VES: entry([{ name: "Scarlet Monastery", with: ["MIRA"] }]) } })),
    ).toBeUndefined();
    expect(ranIt(run, log({ [today]: { VES: entry([{ name: "Razorfen Kraul", with: ["BOB"] }]) } }))).toBeUndefined();
    expect(
      ranIt(run, log({ [today - 3]: { VES: entry([{ name: "Scarlet Monastery", with: ["BOB"] }]) } })),
    ).toBeUndefined();
    expect(runDays(START)).toContain(today);
  });
});
