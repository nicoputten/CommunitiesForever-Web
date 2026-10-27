import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonical } from "@/core/merge";
import { uploaderUploadResponse } from "@/core/uploader";
import { openDatabase, type Db } from "@/server/db";
import { loadState, upload } from "@/server/uploads";

// Several uploaders at once (WEB-33, Nico 2026-10-27): friends' files arrive out of sync. Each holds its owner's
// newest own data and older copies of everyone else's. Only what is newer may change the state, whatever the order,
// and an upload's response names only what that upload changed.

const ADA = "Ada#1001";
const BOB = "Bob#2002";
const CLEO = "Cleo#3003";

let dir: string;
let db: Db;
let opened: Db[] = [];

function freshDb(): Db {
  const d = openDatabase(path.join(dir, `${opened.length}.sqlite`));
  opened.push(d);
  return d;
}

beforeEach(() => {
  vi.stubEnv("ADMIN_BATTLETAG", ADA);
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = freshDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const d of opened) d.$client.close();
  opened = [];
  rmSync(dir, { recursive: true, force: true });
});

/** A character as the addon writes it: level and updatedAt. */
type Char = [name: string, level: number, updatedAt: number];
const chars = (c: Record<string, Char>) =>
  Object.entries(c)
    .map(([guid, [name, level, at]]) => `${guid} = { name = "${name}", level = ${level}, updatedAt = ${at} }`)
    .join(", ");

/** One friend's file: their own characters, and their copies of the others. */
function file(
  owner: string,
  version: number,
  own: Record<string, Char>,
  others: Record<string, { version: number; chars: Record<string, Char> }> = {},
): Uint8Array {
  const people = Object.entries(others)
    .map(
      ([tag, p]) =>
        `["${tag}"] = { displayName = "${tag.split("#")[0]}", version = ${p.version}, chars = { ${chars(p.chars)} } }`,
    )
    .join(", ");
  return new TextEncoder().encode(
    `return { schemaVersion = 1, settings = { clubId = 7, clubName = "Friends" },
      self = { battleTag = "${owner}", version = ${version}, chars = { ${chars(own)} } },
      people = { ${people} } }`,
  );
}

const adaOld = { A: ["Ada Example", 10, 100] } satisfies Record<string, Char>;
const adaNew = { A: ["Ada Example", 14, 300] } satisfies Record<string, Char>;
const bobOld = { B: ["Bob Example", 20, 100] } satisfies Record<string, Char>;
const bobNew = { B: ["Bob Example", 23, 310] } satisfies Record<string, Char>;
const cleoOld = { C: ["Cleo Example", 30, 100] } satisfies Record<string, Char>;
const cleoNew = { C: ["Cleo Example", 31, 320] } satisfies Record<string, Char>;

/** The admin's first upload: everyone at their old data. */
const base = file(ADA, 100, adaOld, {
  [BOB]: { version: 100, chars: bobOld },
  [CLEO]: { version: 100, chars: cleoOld },
});
/** Each friend's newest own data, with old copies of the others. */
const latest: [string, Uint8Array][] = [
  [ADA, file(ADA, 300, adaNew, { [BOB]: { version: 100, chars: bobOld }, [CLEO]: { version: 100, chars: cleoOld } })],
  [BOB, file(BOB, 310, bobNew, { [ADA]: { version: 100, chars: adaOld }, [CLEO]: { version: 100, chars: cleoOld } })],
  [CLEO, file(CLEO, 320, cleoNew, { [ADA]: { version: 100, chars: adaOld }, [BOB]: { version: 100, chars: bobOld } })],
];

const permutations = <T>(xs: T[]): T[][] =>
  xs.length <= 1
    ? [xs]
    : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));

const levels = (d: Db) =>
  Object.fromEntries(Object.entries(loadState(d)?.data.characters ?? {}).map(([guid, c]) => [guid, c.level]));

describe("several uploaders", () => {
  it("ends in the same state whatever order the files arrive in", () => {
    const states = permutations(latest).map((order) => {
      const d = freshDb();
      expect(upload(d, base, ADA, 1000).status).toBe("ok");
      order.forEach(([who, bytes], i) => expect(upload(d, bytes, who, 2000 + i).status).toBe("ok"));
      return canonical(loadState(d)?.data);
    });
    expect(new Set(states).size).toBe(1);
  });

  it("keeps the newest data of everyone and names only what each upload changed", () => {
    upload(db, base, ADA, 1000);
    for (const [i, [who, bytes]] of latest.entries()) {
      const r = upload(db, bytes, who, 2000 + i);
      const app = uploaderUploadResponse({ ...r, first: false }, "https://wow.vestras.nl");
      const [name, from, to] = {
        [ADA]: ["Ada Example", 10, 14],
        [BOB]: ["Bob Example", 20, 23],
        [CLEO]: ["Cleo Example", 30, 31],
      }[who]!;
      expect(app.status).toBe("ok");
      expect(app.highlights).toEqual([`${name} ${from} → ${to}`]);
      expect(r.summary?.levelUps).toHaveLength(1);
    }
    expect(levels(db)).toEqual({ A: 14, B: 23, C: 31 });
  });

  it("answers nothing_new for a late file with only stale data", () => {
    upload(db, base, ADA, 1000);
    for (const [i, [who, bytes]] of latest.entries()) upload(db, bytes, who, 2000 + i);
    // Bob's file from before his level up, with old copies of the others, arrives last.
    const stale = file(BOB, 100, bobOld, {
      [ADA]: { version: 100, chars: adaOld },
      [CLEO]: { version: 100, chars: cleoOld },
    });
    const r = upload(db, stale, BOB, 3000);
    expect(uploaderUploadResponse({ ...r, first: false }, "https://wow.vestras.nl")).toMatchObject({
      status: "nothing_new",
      summaryLine: "Nothing new",
      highlights: [],
    });
    expect(levels(db)).toEqual({ A: 14, B: 23, C: 31 });
  });

  it("applies only the newer part of a mostly stale file", () => {
    upload(db, base, ADA, 1000);
    for (const [i, [who, bytes]] of latest.entries()) upload(db, bytes, who, 2000 + i);
    // Cleo levels again; her copies of Ada and Bob are still the old ones.
    const again = file(
      CLEO,
      400,
      { C: ["Cleo Example", 33, 400] },
      {
        [ADA]: { version: 100, chars: adaOld },
        [BOB]: { version: 100, chars: bobOld },
      },
    );
    const r = upload(db, again, CLEO, 3000);
    expect(uploaderUploadResponse({ ...r, first: false }, "https://wow.vestras.nl")).toMatchObject({
      status: "ok",
      summaryLine: "2 levels gained",
      highlights: ["Cleo Example 31 → 33"],
    });
    expect(levels(db)).toEqual({ A: 14, B: 23, C: 33 });
  });
});
