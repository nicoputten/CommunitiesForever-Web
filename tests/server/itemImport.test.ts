import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCsv } from "@/core/recipes/csv";
import { openDatabase, type Db } from "@/server/db";
import { adminLog, itemImport, recipes } from "@/server/db/schema";
import { importItems, latestBuilds } from "@/server/itemImport";
import { importFinished, importRunState, startItemImport } from "@/server/itemImportRun";

// WEB-91: the item import as the server runs it for the owner's "Import item data" (and `npm run import:items`),
// against a fake wago.tools and GitHub serving the invented fixtures (tests/fixtures/items/).

const FIXTURES = path.join(__dirname, "../fixtures/items");
const FOREVER = "1.60.1.70790";
const ERA = "1.15.9.70576";
const OWNER = "Nico#1000";

let dir: string;
let db: Db;
let asked: string[];
let wagoDown: boolean;

/** A CSV body that breaks off after `cut` characters, as wago.tools does with long exports. */
function cutOff(body: string, cut: number): Response {
  const bytes = new TextEncoder().encode(body.slice(0, cut));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
    },
    // Erroring at once would drop the queued part: break off on the next read.
    pull(controller) {
      controller.error(new Error("other side closed"));
    },
  });
  return new Response(stream, { status: 200 });
}

const fake: typeof fetch = async (input) => {
  const url = new URL(String(input));
  asked.push(url.pathname + url.search);
  // 403: no retry (a 5xx is asked again after a pause).
  if (url.host === "wago.tools" && wagoDown) return new Response("", { status: 403 });
  if (url.pathname === "/api/builds") {
    return Response.json({
      wowf: [
        { version: "1.60.1.70755", created_at: "2026-11-03 18:16:08" },
        { version: FOREVER, created_at: "2026-11-04 18:08:09" },
      ],
      wow_classic_era: [{ version: ERA, created_at: "2026-10-26 23:15:05" }],
    });
  }
  const db2 = /^\/db2\/(\w+)\/csv$/.exec(url.pathname);
  if (db2 !== null) {
    const table = db2[1]!;
    const era = url.searchParams.get("build") === ERA;
    const name = era && url.searchParams.get("filter[Effect]") === "exact:36" ? "SpellEffect-learn" : table;
    // In ID order (`sort[ID]=asc`), after `filter[ID]=>N` when asked.
    const csv = parseCsv(readFileSync(path.join(FIXTURES, era ? "era" : "forever", `${name}.csv`), "utf8"));
    const after = /^>(\d+)$/.exec(url.searchParams.get("filter[ID]") ?? "");
    const rows = csv.rows
      .filter((r) => after === null || Number(r.ID) > Number(after[1]))
      .sort((a, b) => Number(a.ID) - Number(b.ID));
    const lines = [csv.header.join(","), ...rows.map((r) => csv.header.map((h) => JSON.stringify(r[h])).join(","))];
    const text = lines.join("\n");
    // The first ItemSparse request breaks off in the middle of its fourth row.
    if (table === "ItemSparse" && after === null) return cutOff(text, lines.slice(0, 4).join("\n").length + 10);
    return new Response(text);
  }
  if (url.host === "raw.githubusercontent.com") {
    return new Response(gzipSync(readFileSync(path.join(FIXTURES, "cmangos.sql"))));
  }
  return new Response("", { status: 404 });
};

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-import-"));
  db = openDatabase(path.join(dir, "test.sqlite"));
  asked = [];
  wagoDown = false;
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const options = () => ({ cache: path.join(dir, "cache"), fetch: fake });

describe("importItems", () => {
  it("picks the newest builds, continues a cut-off table and writes the database", async () => {
    expect(await latestBuilds(fake)).toEqual({ build: FOREVER, era: ERA });
    const summary = await importItems(db, { ...options(), now: 100 });
    expect(summary).toEqual({
      build: FOREVER,
      era: ERA,
      items: 10,
      recipes: 10,
      foreverOnly: 1,
      unobtainable: 1,
      sources: 10,
      changed: true,
    });
    // ItemSparse came in two parts: from the start, then after the last whole row (ID 5003).
    expect(asked.filter((a) => a.includes("/db2/ItemSparse/"))).toEqual([
      `/db2/ItemSparse/csv?build=${FOREVER}&sort%5BID%5D=asc`,
      `/db2/ItemSparse/csv?build=${FOREVER}&sort%5BID%5D=asc&filter%5BID%5D=%3E5003`,
    ]);
    expect(db.select().from(itemImport).get()).toMatchObject({ build: FOREVER, eraBuild: ERA, recipes: 10 });

    // Again from the cache, nothing downloaded and nothing changed.
    asked = [];
    expect(await importItems(db, { ...options(), build: FOREVER, era: ERA, offline: true })).toMatchObject({
      changed: false,
    });
    expect(asked).toEqual([]);
  });
});

describe("Import item data", () => {
  it("runs one at a time, shows its result and logs it", async () => {
    expect(startItemImport(db, OWNER, 100, options())).toBe(true);
    expect(importRunState().running).toBe(true);
    expect(startItemImport(db, OWNER, 101, options())).toBe(false);
    await importFinished();
    const state = importRunState();
    expect(state.running).toBe(false);
    expect(state.last).toMatchObject({ summary: { build: FOREVER, recipes: 10, changed: true } });
    expect(db.select().from(recipes).all()).toHaveLength(10);
    expect(db.select().from(adminLog).all()).toMatchObject([{ by: OWNER, action: "itemImport", detail: FOREVER }]);
  });

  it("says what went wrong and leaves the data alone", async () => {
    wagoDown = true;
    expect(startItemImport(db, OWNER, 100, options())).toBe(true);
    await importFinished();
    expect(importRunState()).toMatchObject({ running: false, last: { error: "wago.tools answered 403." } });
    expect(db.select().from(itemImport).get()).toBeUndefined();
    expect(db.select().from(adminLog).all()).toEqual([]);
  });
});
