import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { iconName } from "@/core/recipes/icons";
import { itemIcon } from "@/server/itemIcons";

// WEB-90 (handoff B3): icons fetched once from the CDN, then served from the site's own disk; the question mark for
// a name the CDN doesn't have. The CDN here is a fake.

const JPEG = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, n]);
const CDN = "https://cdn.test/icons/56/{icon}.jpg";

let dir: string;
let asked: string[];
let up: boolean;
const fake: typeof fetch = async (input) => {
  const url = String(input);
  asked.push(url);
  if (!up) throw new Error("offline");
  if (url.endsWith("/inv_test_a.jpg")) return new Response(JPEG(1), { status: 200 });
  if (url.endsWith("/inv_misc_questionmark.jpg")) return new Response(JPEG(9), { status: 200 });
  if (url.endsWith("/inv_not_jpeg.jpg")) return new Response("<html>", { status: 200 });
  return new Response("", { status: 403 });
};
const opts = (now = 0) => ({ dir, cdn: CDN, fetch: fake, now });

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-icons-"));
  asked = [];
  up = true;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("item icons", () => {
  it("fetches a new icon once, then serves it from disk", async () => {
    expect(await itemIcon("INV_Test_A", opts())).toEqual(JPEG(1));
    expect(existsSync(path.join(dir, "inv_test_a.jpg"))).toBe(true);
    up = false;
    expect(await itemIcon("inv_test_a", opts())).toEqual(JPEG(1));
    expect(asked).toEqual(["https://cdn.test/icons/56/inv_test_a.jpg"]);
  });

  it("many requests for a new icon fetch it once", async () => {
    const all = await Promise.all([1, 2, 3].map(() => itemIcon("inv_test_a", opts())));
    expect(all).toEqual([JPEG(1), JPEG(1), JPEG(1)]);
    expect(asked).toHaveLength(1);
  });

  it("a name the CDN doesn't have, or not a JPEG: the question mark, asked again after a week", async () => {
    expect(await itemIcon("inv_unknown", opts())).toEqual(JPEG(9));
    expect(await itemIcon("inv_not_jpeg", opts())).toEqual(JPEG(9));
    asked = [];
    expect(await itemIcon("inv_unknown", opts(Date.now() + 3600_000))).toEqual(JPEG(9));
    expect(asked).toEqual([]);
    await itemIcon("inv_unknown", opts(Date.now() + 8 * 24 * 3600_000));
    expect(asked).toEqual(["https://cdn.test/icons/56/inv_unknown.jpg"]);
  });

  it("a CDN that is down: nothing stored, asked again next time", async () => {
    up = false;
    expect(await itemIcon("inv_test_a", opts())).toBeUndefined();
    up = true;
    expect(await itemIcon("inv_test_a", opts())).toEqual(JPEG(1));
  });

  it("only plain icon names reach the CDN", async () => {
    expect(iconName("../etc/passwd")).toBeUndefined();
    expect(iconName("a/b")).toBeUndefined();
    expect(iconName("INV_Misc_QuestionMark")).toBe("inv_misc_questionmark");
    expect(await itemIcon("../secret", opts())).toEqual(JPEG(9));
    expect(asked).toEqual(["https://cdn.test/icons/56/inv_misc_questionmark.jpg"]);
  });
});
