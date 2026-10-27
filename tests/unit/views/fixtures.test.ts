import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diff } from "@/core/diff";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import { characterPage, professions, rollCall, roster, siteName, uploadReport } from "@/core/views";

// Every view model reads every addon release's fixture and the real beta file (CLAUDE.md rule 4).

const root = new URL("../../fixtures/", import.meta.url);
const files = [
  ...readdirSync(new URL("addon/", root)).map((release) => `addon/${release}/savedvariables.lua`),
  ...readdirSync(new URL("real/", root)).map((file) => `real/${file}`),
];
const load = (file: string) => normalize(parseLua(readFileSync(new URL(file, root), "utf8")));

describe.each(files)("view models on %s", (file) => {
  const d = load(file);
  const now = Math.max(...Object.values(d.locations).map((s) => s.seenAt), d.version ?? 0);

  it("builds every view without throwing", () => {
    const summary = diff(undefined, d);
    expect(() => {
      rollCall(d, now);
      roster(d, now);
      professions(d, now);
      uploadReport(summary, now);
      for (const guid of Object.keys(d.characters)) characterPage(d, guid, now);
    }).not.toThrow();
    expect(
      siteName([{ uploadedBy: d.uploader ?? "", uploadedAt: now, communityName: d.community.name }], d.uploader ?? ""),
    ).toBe("Test Friends");
  });

  it("locates every sighted character", () => {
    const call = rollCall(d, now);
    expect(call.located).toBe(Object.keys(d.locations).length);
    expect(call.located + call.unknown.length).toBe(call.total);
  });
});

describe("the real beta file", () => {
  const d = load("real/beta-2026-10.lua");
  const now = 1792615003;

  it("shows the uploader's character and the sighted stubs of friends without the addon", () => {
    const call = rollCall(d, now);
    expect([call.located, call.total]).toEqual([3, 3]);
    expect(
      [...call.live, ...call.earlier].map((r) => [r.character.name ?? "?", r.person?.displayName, r.sighting.zone]),
    ).toEqual([
      ["Ada Example", "Ada", "durotar"],
      ["?", "Cleo", "mulgore"],
      ["?", "Cleo", "durotar"],
    ]);
    expect(call.noAddon.map((p) => p.displayName)).toEqual(["Bob", "Cleo", "Dax", "Esme", "Finn"]);
  });

  it("reads the character page from real fields (mainTree index, autoRole, quests)", () => {
    const page = characterPage(d, "Player-6842-0000A001", now)!;
    expect(page.character).toMatchObject({ level: 6, className: "Warlock", role: "dps", ruleset: "PvP", ilvl: 1 });
    expect(page.talents).toMatchObject({ available: 0, spent: 1, mainTreeName: "Affliction" });
    expect(page.talents.trees.map((t) => t.main)).toEqual([true, false, false]);
    expect(page.character.quests).toHaveLength(12);
    expect(page.levelsToMax).toBe(54);
    expect(page.dungeonFit).toBeUndefined();
  });

  it("rates the group's professions and lists one character in the roster", () => {
    const view = professions(d, now);
    expect(view.professions.filter((p) => p.entries.length > 0).map((p) => [p.name, p.best, p.status])).toEqual([
      ["Mining", 3, "gap"],
      ["Cooking", 1, "gap"],
    ]);
    const r = roster(d, now);
    expect(r.counts).toEqual({ people: 6, characters: 1 });
    expect(r.friends.map((f) => f.person.displayName)).toEqual(["Ada"]);
    expect(r.spread.bands).toEqual([]);
  });
});
