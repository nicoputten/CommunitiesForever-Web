import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readBossKills } from "@/core/bossKills";
import { parseLua } from "@/core/lua";
import { killsOf } from "@/server/bossProgress";
import { openDatabase, type Db } from "@/server/db";
import { bossKills } from "@/server/db/schema";
import { rebuild, upload } from "@/server/uploads";
import { beforeRosters } from "./beforeRosters";

// WEB-97 (addon CF-103): the boss kills of an upload: a record's finished runs (`bossKills`), the uploader's run in
// progress (`runs[guid].bosses`) and friends' live kills (`liveKills`). Older addons send a count only, which gives
// no kills. Made-up names and ids.

const ADMIN = "Nico#1000";
const file = (body: string) => `return { schemaVersion = 3, ${body} }`;
const lua = (body: string) => new TextEncoder().encode(file(body));

const NICO = (extra = "") => `
  self = { battleTag = "${ADMIN}", version = 1, chars = { ["G-V"] = { name = "Ves Example", level = 22, updatedAt = 1 } },
    feed = { [20744] = { ["G-V"] = { at = 1792200000, runs = {
      { name = "The Deadmines", kind = "party", bosses = 3, with = { "G-A" },
        bossKills = { [1] = 1792199000, [2] = 1792199300, [6] = 1792199900 } },
      { name = "Ragefire Chasm", kind = "party", bosses = 2 } } } } } },
  people = { ["Ada#1001"] = { version = 1, chars = { ["G-A"] = { name = "Ada Example", level = 21, updatedAt = 1 } },
    feed = { [20744] = { ["G-A"] = { at = 1792200000, runs = {
      { name = "The Deadmines", bosses = 3, bossKills = { [1] = 1792199000, [2] = 1792199301 } } } } } } } },
  runs = { ["G-V"] = { name = "Shadowfang Keep", bosses = { [10] = 1792201000, [11] = true } } },
  liveKills = { ["G-A"] = { [10] = 1792201002, ["x"] = 5, [12] = -3 } },
  settings = { clubId = 7, clubName = "Friends" },
  ${extra}`;

describe("reading boss kills", () => {
  it("takes kills from records, the run in progress and live kills; drops what isn't a whole time", () => {
    const kills = readBossKills(parseLua(file(NICO())));
    expect(kills.map((k) => [k.guid, k.encounterId, k.at])).toEqual([
      ["G-V", 1, 1792199000],
      ["G-V", 2, 1792199300],
      ["G-V", 6, 1792199900],
      ["G-A", 1, 1792199000],
      ["G-A", 2, 1792199301],
      ["G-V", 10, 1792201000],
      ["G-A", 10, 1792201002],
    ]);
  });

  it("finds none in a file of an addon without CF-103 (a count only)", () => {
    expect(
      readBossKills(
        parseLua(file(`self = { feed = { [1] = { ["G-V"] = { runs = { { name = "X", bosses = 3 } } } } } }`)),
      ),
    ).toEqual([]);
    expect(readBossKills(parseLua("return nil"))).toEqual([]);
  });
});

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = beforeRosters(openDatabase(path.join(dir, "test.sqlite")));
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const stored = () =>
  db
    .select()
    .from(bossKills)
    .all()
    .map((r) => [r.guid, r.encounterId, r.at])
    .sort();

describe("storing boss kills", () => {
  it("keeps every kill once over uploads, and writes the same rows on a rebuild", () => {
    expect(upload(db, lua(NICO()), ADMIN, 1792202000, ADMIN).status).toBe("ok");
    expect(stored()).toHaveLength(7);
    expect(upload(db, lua(NICO()), ADMIN, 1792203000, ADMIN).status).toBe("ok");
    const before = stored();
    expect(before).toHaveLength(7);
    rebuild(db, ADMIN);
    expect(stored()).toEqual(before);
    expect(killsOf(db, [1, 6], 1792199000, 1792199900).map((k) => [k.guid, k.encounterId])).toEqual([
      ["G-V", 1],
      ["G-A", 1],
    ]);
  });
});
