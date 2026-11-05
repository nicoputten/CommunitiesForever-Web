import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { readFeeds } from "@/core/feed";
import { membersOf, readRoster } from "@/core/members";
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

// WEB-85: no released addon writes `members` (the roster, addon CF-89), so a file of theirs makes only its uploader a
// member on a site that had no uploads before WEB-85.
describe("every release without a roster", () => {
  it.each([...releases, ...real])("%s", (path) => {
    const chunk = parseLua(readFileSync(new URL(path, root), "utf8"));
    expect(readRoster(chunk)).toBeUndefined();
    const data = normalize(chunk);
    const self = data.uploader !== undefined ? data.people[data.uploader]?.battleTag : undefined;
    expect(membersOf(data, undefined, "self")).toEqual(self !== undefined ? [self] : []);
  });
});
