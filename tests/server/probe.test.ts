import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beforeRosters } from "./beforeRosters";
import { GET as probeRoute } from "@/app/api/admin/probe/route";
import { putGuest, touchLastSeen } from "@/server/access";
import { appointAdmin } from "@/server/admins";
import { getDb } from "@/server/db";
import { loadProbeFile, loadProbeSummary } from "@/server/probe";
import { upload } from "@/server/uploads";

// WEB-82: the owner's download of the launch-probe results in friends' uploads. Nico is the owner, Gwen a guest he
// made an admin, Bob a member. Made-up BattleTags.

const SECRET = "test-secret-at-least-32-characters-long";
const OWNER = "Nico#1000";
const COOKIE = "authjs.session-token";

let dir: string;

const file = (self: string, name: string, probe?: string, people = "") =>
  new TextEncoder().encode(`CommunitiesForeverDB = { ["global"] = {
    ["schemaVersion"] = 2,
    ["self"] = { ["battleTag"] = "${self}", ["displayName"] = "${name}" },
    ["people"] = { ${people} },
    ["settings"] = { ["clubId"] = "40000001", ["clubName"] = "Friends" },
    ${probe === undefined ? "" : `["probe"] = ${probe},`}
  } }`);
const probe = (status: string) =>
  `{ ["era"] = { ["GetGuildRosterInfo"] = { ["status"] = "${status}", ["at"] = 1, ["build"] = "1.15.8" } } }`;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = SECRET;
  process.env.ADMIN_BATTLETAG = OWNER;
  const db = beforeRosters(getDb());
  putGuest(db, "Gwen#4004", true, OWNER);
  touchLastSeen(db, "Gwen#4004", 10);
  appointAdmin(db, "Gwen#4004", OWNER, 10);
  const bob = `["Bob#2002"] = { ["displayName"] = "Bob" }`;
  expect(upload(db, file(OWNER, "Nico", undefined, bob), OWNER, 100).status).toBe("ok");
  expect(upload(db, file(OWNER, "Nico", probe("nico")), OWNER, 200).status).toBe("ok");
  expect(upload(db, file("Bob#2002", "Bob", probe("bob-old")), "Bob#2002", 300).status).toBe("ok");
  expect(upload(db, file("Bob#2002", "Bob", probe("bob-new")), "Bob#2002", 400).status).toBe("ok");
  expect(upload(db, file("Bob#2002", "Bob"), "Bob#2002", 500).status).toBe("ok");
  // Bob sends Nico's file: rejected, so its probe doesn't count.
  expect(upload(db, file(OWNER, "Nico", probe("not-bobs")), "Bob#2002", 600).status).toBe("rejected");
  // Gwen's own file without a probe.
  expect(upload(db, file("Gwen#4004", "Gwen"), "Gwen#4004", 700).status).toBe("ok");
});

afterAll(() => {
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function request(as?: string): Promise<NextRequest> {
  const headers = new Headers();
  if (as !== undefined)
    headers.set("cookie", `${COOKIE}=${await encode({ token: { battleTag: as }, secret: SECRET, salt: COOKIE })}`);
  return new NextRequest(new URL("/api/admin/probe", "http://localhost:3000"), { headers });
}

describe("probe results", () => {
  it("summarises the friends with results for the Admin box", () => {
    expect(loadProbeSummary(getDb())).toEqual({ friends: 2, newestAt: 400 });
    // Again, from the per-hash memory: the same answer.
    expect(loadProbeSummary(getDb())).toEqual({ friends: 2, newestAt: 400 });
  });

  it("takes each friend's newest accepted upload with a probe section, as it is", () => {
    const out = loadProbeFile(getDb(), 1000);
    expect(out.friends.map((f) => [f.displayName, f.battleTag, f.uploadedAt])).toEqual([
      ["Bob", "Bob#2002", "1970-01-01T00:06:40.000Z"],
      ["Nico", OWNER, "1970-01-01T00:03:20.000Z"],
    ]);
    expect(out.friends[0]!.probe).toEqual({
      era: { GetGuildRosterInfo: { status: "bob-new", at: 1, build: "1.15.8" } },
    });
    expect(out.friends[1]!.probe).toMatchObject({ era: { GetGuildRosterInfo: { status: "nico" } } });
  });
});

describe("GET /api/admin/probe", () => {
  it("needs a session", async () => {
    expect((await probeRoute(await request())).status).toBe(401);
  });

  it("refuses friends and admins", async () => {
    for (const who of ["Bob#2002", "Gwen#4004"]) {
      const res = await probeRoute(await request(who));
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain("era");
    }
  });

  it("sends the owner the file as an attachment", async () => {
    const res = await probeRoute(await request(OWNER));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="probe-results-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = (await res.json()) as { friends: { battleTag: string }[] };
    expect(body.friends.map((f) => f.battleTag)).toEqual(["Bob#2002", OWNER]);
  });
});
