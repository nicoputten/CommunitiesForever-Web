import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as iconRoute } from "@/app/api/item-icons/[name]/route";
import { getDb } from "@/server/db";
import { items, talentTrees } from "@/server/db/schema";

// WEB-91: the item icon route is open without a session (Discord loads the icons), but serves only icon names the
// item database holds, so it can't be used to make the server fetch anything else. The CDN here is a fake.

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 7]);
let dir: string;
const asked: string[] = [];

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-icon-route-"));
  process.env.DATA_DIR = dir;
  process.env.ICON_CDN_URL = "https://cdn.test/icons/56/{icon}.jpg";
  vi.stubGlobal("fetch", async (input: unknown) => {
    asked.push(String(input));
    return /\/(inv_test_known|spell_test_talent|spell_test_tree)\.jpg$/.test(String(input))
      ? new Response(JPEG)
      : new Response("", { status: 403 });
  });
  getDb()
    .insert(items)
    .values({ id: 1, name: "Test Item", iconName: "inv_test_known", data: { id: 1 }, origin: "import" })
    .run();
  // WEB-100: a talent's and a tree's icon.
  getDb()
    .insert(talentTrees)
    .values({
      classFile: "WARLOCK",
      data: {
        classFile: "WARLOCK",
        traitTreeId: 1,
        columns: 1,
        rows: 1,
        trees: [
          {
            name: "Test",
            icon: "spell_test_tree",
            columns: 1,
            rows: 1,
            talents: [
              {
                id: 1,
                spellId: 1,
                maxRanks: 1,
                posX: 0,
                posY: 0,
                texts: ["Mentions spell_test_other."],
                icon: "spell_test_talent",
              },
            ],
          },
        ],
      },
    })
    .run();
});

afterAll(() => {
  vi.unstubAllGlobals();
  delete process.env.ICON_CDN_URL;
  getDb().$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = (name: string) =>
  iconRoute(new Request(`http://localhost:3000/api/item-icons/${name}`), { params: Promise.resolve({ name }) });

describe("item icon route", () => {
  it("serves an icon the database holds, without a session, cacheable for a week", async () => {
    const res = await get("inv_test_known.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=604800");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
  });

  it("serves a talent's and a talent tree's icon (WEB-100)", async () => {
    expect((await get("spell_test_talent")).status).toBe(200);
    expect((await get("spell_test_tree")).status).toBe(200);
  });

  it("answers 404 for any other name, and never asks the CDN for it", async () => {
    asked.length = 0;
    for (const name of [
      "inv_not_in_database",
      "spell_test_talen",
      "spell_test_other",
      "INV_Misc_QuestionMark",
      "..%2Fsecret",
      "a b",
      "x".repeat(101),
    ]) {
      const res = await get(name);
      expect(res.status, name).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(asked).toEqual([]);
  });
});
