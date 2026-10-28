import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { readFeeds } from "@/core/feed";
import { normalize } from "@/core/normalize";

// CLAUDE.md rule 4: the SavedVariables of every addon release (and every real file we keep) must normalize.
// A snapshot change is a change in what the site reads from released data: review it as such.
const root = new URL("../fixtures/", import.meta.url);
const releases = readdirSync(new URL("addon/", root)).map((release) => `addon/${release}/savedvariables.lua`);
const real = readdirSync(new URL("real/", root)).map((file) => `real/${file}`);

describe("every fixture normalizes", () => {
  it.each([...releases, ...real])("%s", (path) => {
    const data = normalize(parseLua(readFileSync(new URL(path, root), "utf8")));
    expect(data.schemaVersion).toBe(1);
    expect(Object.keys(data.characters).length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(data))).toMatchSnapshot();
  });

  // WEB-41: the activity feed of every release, for the weekly recap.
  it.each([...releases, ...real])("%s: its feeds", (path) => {
    const feeds = readFeeds(parseLua(readFileSync(new URL(path, root), "utf8")));
    expect(JSON.parse(JSON.stringify(feeds))).toMatchSnapshot();
  });

  it("covers every addon release", () => {
    expect(releases).toEqual(["addon/v0.3/savedvariables.lua", "addon/v0.4/savedvariables.lua"]);
  });
});
