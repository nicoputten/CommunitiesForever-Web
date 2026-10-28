import { describe, expect, it } from "vitest";
import { readFeeds } from "@/core/feed";
import { parseLua } from "@/core/lua";

// WEB-41: the addon's activity feed (CF-22, CF-23) as the recap reads it.

const file = (body: string) => parseLua(`return { schemaVersion = 1, ${body} }`);

describe("readFeeds", () => {
  it("reads the uploader's and friends' days per character", () => {
    const feeds = readFeeds(
      file(`
        self = { battleTag = "Ada#1001", feed = { [20744] = { ["G-1"] = {
          name = "Ada |cffff0000Example|r", classFile = "MAGE", at = 1060, levelFrom = 20, levelTo = 21,
          quests = { ["Elwynn Forest"] = 3, Bad = "x" }, ranks = { Tailoring = 75 }, learned = { Alchemy = true },
          runs = { { name = "The Deadmines", kind = "party", bosses = 5, won = false, with = { "G-2", 7 } } },
        } } } },
        people = {
          ["Bob#2002"] = { feed = false },
          ["Cid#3003"] = { version = 1 },
          ["Dee#4004"] = { feed = { [3] = { ["G-9"] = { at = 1 } }, [20745] = { ["G-4"] = { levelTo = 9 } } } },
        },
      `),
    );
    expect(feeds).toEqual([
      {
        owner: "Ada#1001",
        shared: true,
        days: {
          20744: {
            "G-1": {
              name: "Ada Example",
              classFile: "MAGE",
              at: 1060,
              levelFrom: 20,
              levelTo: 21,
              quests: { "Elwynn Forest": 3 },
              ranks: { Tailoring: 75 },
              learned: ["Alchemy"],
              runs: [{ name: "The Deadmines", kind: "party", bosses: 5, won: false, with: ["G-2"] }],
            },
          },
        },
      },
      { owner: "Bob#2002", shared: false, days: {} },
      // Day 3 (1970) is no realm day the addon writes: left out.
      {
        owner: "Dee#4004",
        shared: true,
        days: { 20745: { "G-4": { levelTo: 9, quests: {}, ranks: {}, learned: [], runs: [] } } },
      },
    ]);
  });

  it("has nothing for a file without the addon's table", () => {
    expect(readFeeds(parseLua("x = 1"))).toEqual([]);
  });
});
