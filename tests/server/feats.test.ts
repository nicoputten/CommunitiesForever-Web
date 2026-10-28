import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MilestonesEvent } from "@/core/bot";
import { openDatabase, type Db } from "@/server/db";
import { botEvents, feats } from "@/server/db/schema";
import { rebuild, upload } from "@/server/uploads";

// WEB-56: feats held from every accepted upload, posted as milestones unless already had; a rebuild holds the same
// feats and posts nothing.

const ADMIN = "Nico#1000";
const lua = (body: string) => new TextEncoder().encode(`return { schemaVersion = 2, ${body} }`);

/** Nico's file: Ves (Horde) and Ada's relayed record with Mira. */
const file = (version: number, ves: string, mira: string, vesFeed = "") =>
  lua(`
    self = { battleTag = "${ADMIN}", displayName = "Nico", version = ${version},
      chars = { V = { name = "Ves Example", classFile = "WARLOCK", faction = "Horde", level = 40, updatedAt = ${version}, ${ves} } }
      ${vesFeed !== "" ? `, feed = { [20754] = { V = { at = ${version}, ${vesFeed} } } }` : ""} },
    people = { ["Ada#1001"] = { displayName = "Ada", version = ${version},
      chars = { M = { name = "Mira Example", classFile = "MAGE", faction = "Horde", level = 60, updatedAt = ${version}, ${mira} } } } },
    settings = { clubId = 1, clubName = "Friends" },
  `);

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

const held = () =>
  db
    .select()
    .from(feats)
    .all()
    .map((f) => `${f.guid} ${f.key}${f.alreadyHad ? " had" : ""}${f.firstInGroup ? " first" : ""}`)
    .sort();
const posts = () =>
  db
    .select()
    .from(botEvents)
    .all()
    .map((e) => e.data as MilestonesEvent);

describe("feats", () => {
  it("holds what a character already had silently, and posts what comes after", () => {
    // The site's first upload: Mira is rank 8 with an epic mount and 3,000 kills; Ves has no PvP data yet.
    upload(
      db,
      file(100, "", "riding = 150, pvp = { hk = 3000, rank = 8, rankName = 'Legionnaire' }"),
      ADMIN,
      1000,
      ADMIN,
    );
    expect(held()).toEqual([
      "M epicMount had",
      "M honorKills:1000 had",
      "M maxLevel had",
      "M mount had",
      "M pvpRank:8 had",
    ]);
    expect(posts()).toEqual([]);

    // Ves's PvP data arrives (an addon update): already had. Mira kills on to 5,000: posted.
    upload(
      db,
      file(
        200,
        "riding = 0, pvp = { hk = 40, rank = 2 }",
        "riding = 150, pvp = { hk = 5000, rank = 8, rankName = 'Legionnaire' }",
      ),
      ADMIN,
      2000,
      ADMIN,
    );
    expect(held()).toContain("V honorKills:1 had");
    expect(held()).toContain("V pvpRank:2 had");
    const second = posts()[0]!;
    expect(second.milestones.map((m) => [m.kind, m.character.name, m.text])).toEqual([
      ["honorKills", "Mira Example", "Mira Example: 5,000 honorable kills"],
    ]);

    // Ves: rank 7 (a new highest, not first: Mira had 8), a first mount (the 2nd in the group), a first epic from
    // the feed (first in the group), a battleground's first win, the Arcanite Reaper, 100 deaths from the feed.
    const feed = `runs = { { name = "Warsong Gulch", kind = "pvp", won = true, with = {} } },
      loot = { rare = 1, epic = { { id = 1, name = "Example Blade", slot = "INVTYPE_2HWEAPON", level = 40 } } },
      notable = { [12784] = 1 },
      deaths = { ${Array.from({ length: 50 }, (_, i) => `{ t = ${i} }`).join(", ")} }`;
    upload(
      db,
      file(300, "riding = 75, pvp = { hk = 90, rank = 7, rankName = 'Blood Guard' }", "riding = 150", feed),
      ADMIN,
      3000,
      ADMIN,
    );
    const third = posts()[1]!;
    expect(third.milestones.map((m) => `${m.kind}${m.firstInGroup ? " first" : ""}`)).toEqual([
      "pvpRank",
      "bgFirstWin",
      "firstEpic first",
      "mount",
      "notableItem first",
    ]);
    const [rank, , epic, mount] = third.milestones;
    expect(rank).toMatchObject({ rank: 7, rankName: "Blood Guard", title: "Flag Hugger", card: expect.any(String) });
    expect(epic).toMatchObject({ item: { id: 1, name: "Example Blade", slot: "Two-Hand", level: 40 } });
    expect(mount).toMatchObject({ riding: 75, place: 2 });
    // The most special card: the watch-list item, over the first epic and rank 7.
    expect(third.card).toBe(third.milestones[4]!.card);
    expect(third.milestones[1]!.card).toBeUndefined();

    // 50 more deaths in the next upload's feed: 100 in all.
    const before = held();
    upload(
      db,
      file(
        400,
        "riding = 75, pvp = { hk = 90, rank = 7 }",
        "riding = 150",
        `deaths = { ${Array.from({ length: 50 }, (_, i) => `{ t = ${i} }`).join(", ")} }`,
      ),
      ADMIN,
      4000,
      ADMIN,
    );
    // The feed day 20754 was stored again (a newer copy), so it counts once: still 50.
    expect(held()).toEqual(before);

    // A rebuild holds the same feats and posts nothing new.
    const events = posts().length;
    rebuild(db, ADMIN);
    expect(held()).toEqual(before);
    expect(posts()).toHaveLength(events);
  });

  it("takes duel wins and deaths from the lifetime counters", () => {
    upload(db, file(100, "pvp = { hk = 1, duelsWon = 3, deaths = 20 }", ""), ADMIN, 1000, ADMIN);
    upload(db, file(200, "pvp = { hk = 1, duelsWon = 12, deaths = 101 }", ""), ADMIN, 2000, ADMIN);
    expect(posts()[0]!.milestones.map((m) => m.text)).toEqual([
      "Ves Example: 10 duel wins",
      "Ves Example: a spirit healer's best friend (100 deaths)",
    ]);
  });

  it("gives a profession cap at 300 its title", () => {
    upload(
      db,
      file(100, "professions = { [185] = { name = 'Cooking', rank = 280, max = 300 } }", ""),
      ADMIN,
      1000,
      ADMIN,
    );
    upload(
      db,
      file(200, "professions = { [185] = { name = 'Cooking', rank = 300, max = 300 } }", ""),
      ADMIN,
      2000,
      ADMIN,
    );
    expect(posts()[0]!.milestones[0]).toMatchObject({ kind: "professionCap", rank: 300, title: "Head Chef" });
  });
});
