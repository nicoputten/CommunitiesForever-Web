import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as runsRoute } from "@/app/api/uploader/v1/runs/route";
import { isPublic } from "@/proxy";
import { getDb } from "@/server/db";
import { answerRunFor, cancelRun, planRunFor } from "@/server/runs";
import { createToken, revokeToken } from "@/server/uploader";
import { upload } from "@/server/uploads";
import { ADMIN, NOW, sampleSavedVariables } from "../design/sample";

// WEB-44: GET /api/uploader/v1/runs: the token check, only upcoming runs, and the documented shape (the example in
// docs/UPLOADER-API.md "Runs", which the uploader writes into Runs.lua, UP-12).

const doc = readFileSync(new URL("../../docs/UPLOADER-API.md", import.meta.url), "utf8");
let dir: string;
let token: string;
let tokenId: number;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.ADMIN_BATTLETAG = ADMIN;
  process.env.AUTH_URL = "https://wow.example";
  process.env.FIXED_NOW = String(NOW);
  const db = getDb();
  expect(upload(db, new TextEncoder().encode(sampleSavedVariables()), ADMIN, NOW).status).toBe("ok");
  ({ token, id: tokenId } = createToken(db, ADMIN, "DESKTOP-NICO", "1.0.0", "manual", NOW));
});

afterAll(() => {
  delete process.env.FIXED_NOW;
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = (bearer?: string) =>
  runsRoute(
    new NextRequest("http://localhost:3000/api/uploader/v1/runs", {
      headers: bearer === undefined ? {} : { authorization: `Bearer ${bearer}` },
    }),
  );

function example(name: string): unknown {
  const match = new RegExp(`<!-- example: ${name} -->\\s*\`\`\`json\\n([\\s\\S]*?)\`\`\``).exec(doc);
  if (match?.[1] === undefined) throw new Error(`No example ${name} in docs/UPLOADER-API.md`);
  return JSON.parse(match[1]);
}

/** Same keys and value types, recursively; optional keys (missing in either) are allowed only where listed. */
function sameShape(actual: unknown, expected: unknown, optional: string[], at = "$"): void {
  const kind = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
  expect(kind(actual), at).toBe(kind(expected));
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (expected.length > 0) actual.forEach((a, i) => sameShape(a, expected[0], optional, `${at}[${i}]`));
  } else if (kind(actual) === "object") {
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    const keys = (o: object) =>
      Object.keys(o)
        .filter((k) => !optional.includes(k))
        .sort();
    expect(keys(a), at).toEqual(keys(e));
    for (const key of Object.keys(e)) if (key in a) sameShape(a[key], e[key], optional, `${at}.${key}`);
  }
}

describe("runs for the uploader", () => {
  it("needs an active upload token, not a session", async () => {
    expect(isPublic("/api/uploader/v1/runs")).toBe(true);
    expect((await get()).status).toBe(401);
    expect((await get(`cfu_${"x".repeat(43)}`)).status).toBe(401);
  });

  it("lists only upcoming runs, in the documented shape", async () => {
    const db = getDb();
    const plan = (dungeonId: string, startsAt: number, leadGuid?: string) =>
      (
        planRunFor(
          db,
          { dungeonId, startsAt, organiser: ADMIN, source: "website", ...(leadGuid ? { leadGuid } : {}) },
          NOW - 3 * 3600,
        ) as { id: number }
      ).id;
    const armory = plan("sm-armory", NOW + 3600, "Player-1-0000A001");
    answerRunFor(
      db,
      armory,
      { battleTag: "Bob#2002", answer: "in", source: "website", guid: "Player-1-0000B001" },
      NOW - 60,
    );
    answerRunFor(db, armory, { battleTag: "Mira#1188", answer: "cant", source: "website" }, NOW - 30);
    const started = plan("rfk", NOW - 30 * 60);
    plan("wc", NOW - 3 * 3600 + 60); // past: started more than 2 hours ago
    plan("zf", NOW + 20 * 24 * 3600); // beyond 14 days
    const cancelled = plan("sfk", NOW + 2 * 3600);
    cancelRun(db, cancelled, ADMIN, true, NOW - 10);

    const res = await get(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { runs: { id: string; state: string; dungeon: string; url: string }[] };
    expect(body.runs.map((r) => [r.dungeon, r.state])).toEqual([
      ["rfk", "started"],
      ["smarm", "open"],
      ["sfk", "cancelled"],
    ]);
    expect(body.runs[1]!.url).toBe(`https://wow.example/runs/${armory}`);
    expect(body.runs[0]!.id).toBe(`r-${started}`);
    sameShape(body, example("runs"), ["note", "guid", "name", "fit", "reserve"]);
    // Asked again without a change: the same list, the same updatedAt.
    expect(await (await get(token)).json()).toEqual(body);
  });

  it("stops with the token", async () => {
    revokeToken(getDb(), ADMIN, tokenId, NOW);
    expect((await get(token)).status).toBe(401);
  });
});
