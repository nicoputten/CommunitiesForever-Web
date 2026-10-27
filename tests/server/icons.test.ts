import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { manifestFor, NIGHT } from "@/app/manifest";
import { ICONS, isPublic } from "@/proxy";

// WEB-36: Nico's icon set wired up the App Router way, the manifest from the site name and the tokens, open without a
// session.

const root = path.join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(path.join(root, ...p));

describe("icons", () => {
  it("are Nico's originals, unchanged", () => {
    const pairs: [string, string][] = [
      ["src/app/favicon.ico", "favicon.ico"],
      ["src/app/icon.svg", "icon.svg"],
      ["src/app/apple-icon.png", "apple-touch-icon.png"],
      ["public/icon-192.png", "icon-192.png"],
      ["public/icon-512.png", "icon-512.png"],
      ["public/icon-maskable-512.png", "icon-maskable-512.png"],
    ];
    for (const [shipped, original] of pairs) {
      expect(read(shipped).equals(read("design", "favicons", original)), shipped).toBe(true);
    }
  });

  it("are open without a session, like sign-in", () => {
    for (const p of ICONS) expect(isPublic(p)).toBe(true);
    expect(isPublic("/icon.svg/x")).toBe(false);
    expect(isPublic("/icons")).toBe(false);
  });
});

describe("manifest", () => {
  it("carries the site name, the icons and the night colour of the tokens", () => {
    const m = manifestFor("Doombringers");
    expect([m.name, m.short_name, m.start_url, m.display]).toEqual(["Doombringers", "Doombringers", "/", "standalone"]);
    expect(m.icons?.map((i) => [i.src, i.purpose])).toEqual([
      ["/icon-192.png", undefined],
      ["/icon-512.png", undefined],
      ["/icon-maskable-512.png", "maskable"],
    ]);
    const tokens = read("src", "styles", "tokens.css").toString("utf8");
    const night = /--bg-night:\s*(#[0-9a-fA-F]{6})/.exec(tokens)?.[1];
    expect(night?.toLowerCase()).toBe(NIGHT);
    expect([m.theme_color, m.background_color]).toEqual([NIGHT, NIGHT]);
    for (const icon of m.icons ?? []) expect(ICONS).toContain(icon.src);
  });
});
