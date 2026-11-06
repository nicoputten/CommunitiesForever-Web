import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { beforeRosters } from "./beforeRosters";
import { GET as lookupRoute } from "@/app/api/bot/v1/lookup/[what]/route";
import type { ItemDatabase, RecipeRecord } from "@/core/recipes/build";
import { acknowledge, createBotToken, pendingEvents } from "@/server/bot";
import { getDb, openDatabase, type Db } from "@/server/db";
import { recipeFinds } from "@/server/db/schema";
import { updateBotSettings } from "@/server/discord";
import { writeItemDatabase } from "@/server/itemDb";
import type { RecipeFindsEvent } from "@/server/recipeBot";
import { rebuild, upload } from "@/server/uploads";

// WEB-93 (recipes Part D, board RC08): the bot's rare-find posts and `/craft`. Invented names and data (rule 7).

const ADMIN = "Nico#1000";
const r = (id: number, skillLineId: number, over: Partial<RecipeRecord> = {}): RecipeRecord => ({
  id,
  name: `Test Recipe ${id}`,
  skillLineId,
  createdItemId: id + 100,
  orange: 100,
  yellow: 110,
  green: 120,
  grey: 130,
  obtainable: true,
  foreverOnly: false,
  ...over,
});

/** 1 trainer, 2 boss drop (epic), 3 rep (rare), 4 drop nobody knows; reagents 900 and 901. */
const DATABASE: ItemDatabase = {
  items: [
    { id: 101, name: "Test Bolt", quality: 1, iconName: "inv_test_bolt" },
    { id: 102, name: "Test Robe", quality: 4, iconName: "inv_test_robe" },
    { id: 103, name: "Test Gloves", quality: 3, iconName: "inv_test_gloves" },
    { id: 104, name: "Test Boots", quality: 3 },
    { id: 900, name: "Test Thread", quality: 1 },
    { id: 901, name: "Test Essence", quality: 2 },
  ],
  recipes: [r(1, 197), r(2, 197), r(3, 197), r(4, 197)],
  reagents: [
    { recipeId: 2, itemId: 900, count: 12 },
    { recipeId: 2, itemId: 901, count: 2 },
  ],
  sources: [
    { recipeId: 1, kind: "trainer", isRare: false },
    { recipeId: 2, kind: "drop", place: "Test Spire", npc: "Test Boss", isRare: true },
    { recipeId: 3, kind: "rep", faction: "Test Brotherhood", rank: "Honored", isRare: true },
    { recipeId: 4, kind: "drop", isRare: true },
  ],
};

const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 2, ${body} }`);
const file = (version: number, recipes: string, skill = 120) =>
  lua(`
    self = { battleTag = "${ADMIN}", displayName = "Nico", version = ${version},
      chars = { V = { name = "Ves Example", classFile = "WARLOCK", level = 40, updatedAt = ${version},
        professions = { [197] = { name = "Tailoring", rank = ${skill}, max = 150, scannedAt = ${version} } },
        recipes = { ${recipes} }, recipesAt = ${version} } } },
    settings = { clubId = 1, clubName = "Friends" },
  `);

let dir: string;
let db: Db;

/** A fresh database with the item data. */
function fresh(): Db {
  const d = beforeRosters(openDatabase(path.join(dir, "test.sqlite")));
  writeItemDatabase(d, DATABASE, { build: "test", era: "test", cmangos: "test" }, 1);
  return d;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const NOW = 10_000;
const findEvents = () =>
  pendingEvents(db, 0, NOW)
    .filter((e) => e.type === "recipeFinds")
    .map((e) => ({ id: e.id, data: e.data as RecipeFindsEvent }));

describe("rare-find events", () => {
  beforeEach(() => {
    db = fresh();
  });
  afterEach(() => {
    db.$client.close();
  });

  it("none for a first scan, none for a trainer recipe, one post for new drop and rep recipes, never again", () => {
    // The first scan holds a drop recipe: the baseline, never posted.
    upload(db, file(1000, "[2] = 102"), ADMIN, 1000, ADMIN);
    expect(findEvents()).toEqual([]);
    // A new trainer recipe: not rare.
    upload(db, file(2000, "[2] = 102, [1] = 101"), ADMIN, 2000, ADMIN);
    expect(findEvents()).toEqual([]);
    // A new rep recipe and a new drop recipe in one upload: one post for the character, best quality first.
    upload(db, file(3000, "[2] = 102, [1] = 101, [3] = 103, [4] = 104", 125), ADMIN, 3000, ADMIN);
    const events = findEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toEqual({
      uploadId: 3,
      uploadedAt: 3000,
      character: { guid: "V", name: "Ves Example", classFile: "WARLOCK", level: 40, ownerName: "Nico" },
      color: "#0070dd",
      finds: [
        {
          recipeId: 4,
          item: { id: 104, name: "Test Boots", quality: 3, qualityColor: "#0070dd" },
          profession: { skillLine: 197, name: "Tailoring", skill: 125 },
          sources: [{ kind: "drop" }],
          url: "/professions/tailoring?recipe=4",
        },
        {
          recipeId: 3,
          item: {
            id: 103,
            name: "Test Gloves",
            quality: 3,
            qualityColor: "#0070dd",
            iconPath: "/api/item-icons/inv_test_gloves.jpg",
          },
          profession: { skillLine: 197, name: "Tailoring", skill: 125 },
          sources: [{ kind: "rep", faction: "Test Brotherhood", rank: "Honored" }],
          url: "/professions/tailoring?recipe=3",
        },
      ],
    });
    // Never a BattleTag in what the bot gets.
    expect(JSON.stringify(events)).not.toContain("#1000");

    // The bot posts it: the finds are posted, and a rebuild makes no event again.
    expect(acknowledge(db, events[0]!.id, "1100000000000000001", NOW)).toBe("ok");
    expect(
      db
        .select()
        .from(recipeFinds)
        .all()
        .map((f) => [f.recipeId, f.postedAt]),
    ).toEqual([
      [3, NOW],
      [4, NOW],
    ]);
    rebuild(db, ADMIN);
    expect(findEvents()).toEqual([]);
  });

  it("none while the feats switch is off", () => {
    upload(db, file(1000, "[1] = 101"), ADMIN, 1000, ADMIN);
    updateBotSettings(db, { milestones: false }, ADMIN, 1500);
    upload(db, file(2000, "[1] = 101, [2] = 102"), ADMIN, 2000, ADMIN);
    expect(findEvents()).toEqual([]);
  });
});

describe("/craft look-ups", () => {
  const get = async (what: string, query: string) => {
    const res = await lookupRoute(
      new Request(`http://localhost:3000/api/bot/v1/lookup/${what}?${query}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ what }) },
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  // The route reads the app's database (getDb, once per process): one for these tests.
  let token: string;
  let shared: string;
  beforeAll(() => {
    shared = mkdtempSync(path.join(tmpdir(), "cf-web-"));
    process.env.DATA_DIR = shared;
    const app = beforeRosters(getDb());
    writeItemDatabase(app, DATABASE, { build: "test", era: "test", cmangos: "test" }, 1);
    token = createBotToken(app, ADMIN, 1);
    upload(app, file(1000, "[1] = 101, [2] = 102", 120), ADMIN, 1000, ADMIN);
  });
  afterAll(() => {
    getDb().$client.close();
    rmSync(shared, { recursive: true, force: true });
  });

  it("autocompletes what recipes make, by name", async () => {
    expect((await get("craftable", "q=test")).body).toEqual({
      names: [
        { name: "Test Bolt", value: "1" },
        { name: "Test Robe", value: "2" },
        { name: "Test Boots", value: "4" },
        { name: "Test Gloves", value: "3" },
      ],
    });
    expect((await get("craftable", "q=rob")).body).toEqual({ names: [{ name: "Test Robe", value: "2" }] });
  });

  it("someone can make it: the crafters with their colour, the reagents and the recipe's link", async () => {
    const { status, body } = await get("craft", "item=2");
    expect(status).toBe(200);
    expect(body).toEqual({
      recipe: { id: 2, name: "Test Recipe 2", skillLine: 197, profession: "Tailoring", skill: 100 },
      item: {
        id: 102,
        name: "Test Robe",
        quality: 4,
        qualityColor: "#a335ee",
        iconPath: "/api/item-icons/inv_test_robe.jpg",
      },
      crafters: [
        { guid: "V", name: "Ves Example", classFile: "WARLOCK", ownerName: "Nico", skill: 120, difficulty: "green" },
      ],
      reagents: [
        { id: 900, name: "Test Thread", count: 12, quality: 1, qualityColor: "#ffffff" },
        { id: 901, name: "Test Essence", count: 2, quality: 2, qualityColor: "#1eff00" },
      ],
      sources: [{ kind: "drop", place: "Test Spire", npc: "Test Boss" }],
      url: "/professions/tailoring?recipe=2",
    });
    // By name too, without the autocomplete.
    expect((await get("craft", "item=test%20robe")).body.recipe).toMatchObject({ id: 2 });
  });

  it("nobody can make it: no crafters, where it is learned", async () => {
    const { body } = await get("craft", "item=Test%20Gloves");
    expect(body).toMatchObject({
      item: { name: "Test Gloves" },
      crafters: [],
      sources: [{ kind: "rep", faction: "Test Brotherhood", rank: "Honored" }],
    });
  });

  it("no recipe makes it: 404", async () => {
    expect(await get("craft", "item=Test%20Sword")).toEqual({
      status: 404,
      body: { error: "not_found", error_description: "No recipe makes that." },
    });
    expect((await get("craft", "")).status).toBe(400);
  });
});
