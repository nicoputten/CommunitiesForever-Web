import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cardSize } from "@/core/cards/models";
import { sampleCard, testImages, type TestKind } from "@/core/cards/samples";
import { renderCard } from "@/server/cards/render";

// WEB-68: the test posts' images, drawn like the real ones with the bot's made-up sample names. CARDS_OUT=<dir>
// writes them out to look at.

const HOST = "wow.example.test";
const KINDS: TestKind[] = ["posts", "feats", "recap", "doomsday"];

describe("test images", () => {
  it("names only images the site can draw, for every test kind but the plain post", () => {
    expect(testImages("posts")).toBeUndefined();
    for (const kind of KINDS) {
      for (const id of Object.values(testImages(kind) ?? {})) {
        expect(id, `${kind}: ${id}`).toMatch(/^sample-[a-z-]+$/);
        expect(sampleCard(id.slice("sample-".length), HOST), id).toBeDefined();
      }
    }
    expect(Object.keys(testImages("doomsday")!)).toEqual(["board"]);
    expect(Object.keys(testImages("feats")!)).toEqual(["feat", "strip"]);
    expect(Object.keys(testImages("recap")!)).toEqual(["award", "zone"]);
    expect(sampleCard("nope", HOST)).toBeUndefined();
    expect(sampleCard("constructor", HOST)).toBeUndefined();
  });

  it.each(["board", "feat-big", "feat-strip", "recap-header", "recap-zone"])(
    "sample-%s renders a PNG of its size, never a BattleTag",
    async (name) => {
      const spec = sampleCard(name, HOST)!;
      expect(JSON.stringify(spec)).not.toMatch(/#\d/);
      const res = await renderCard(spec);
      const png = Buffer.from(await res.arrayBuffer());
      const size = cardSize(spec);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size.width, size.height]);
      if (process.env.CARDS_OUT) {
        mkdirSync(process.env.CARDS_OUT, { recursive: true });
        writeFileSync(path.join(process.env.CARDS_OUT, `sample-${name}.png`), png);
      }
    },
    30_000,
  );
});
