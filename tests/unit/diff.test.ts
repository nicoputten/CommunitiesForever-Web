import { describe, expect, it } from "vitest";
import { diff } from "@/core/diff";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";

const upload = (body: string) => normalize(parseLua(`return { schemaVersion = 1, ${body} }`));

describe("diff", () => {
  it("lists everything as new when nothing was stored", () => {
    const after =
      upload(`self = { battleTag = "Ada#1001", chars = { A = { name = "Ada Example", level = 3, classFile = "MAGE" } } },
                          locations = { A = { zone = "Durotar", seenAt = 5 } }`);
    expect(diff(undefined, after)).toEqual({
      newPeople: [{ key: "Ada#1001", displayName: "Ada" }],
      newCharacters: [
        { guid: "A", owner: "Ada#1001", name: "Ada Example", hasRecord: true, level: 3, classFile: "MAGE" },
      ],
      removedCharacters: [],
      levelUps: [],
      professionGains: [],
      itemLevelGains: [],
      sightings: [{ guid: "A", owner: "Ada#1001", name: "Ada Example", zone: "Durotar", seenAt: 5 }],
      senders: [{ key: "Ada#1001", displayName: "Ada", isUploader: true, status: "newer" }],
      counts: {
        levelsGained: 0,
        skillGains: 0,
        itemLevelGains: 0,
        newCharacters: 1,
        sightings: 1,
        peopleWithNewData: 1,
      },
    });
  });

  it("is empty between equal states", () => {
    const d = upload('self = { battleTag = "Ada#1001", chars = { A = { level = 3 } } }');
    const { senders, counts, runAnswers, ...lists } = diff(d, d);
    expect(runAnswers).toBeUndefined();
    expect(Object.values(lists).every((list) => list.length === 0)).toBe(true);
    expect(senders).toEqual([{ key: "Ada#1001", displayName: "Ada", isUploader: true, status: "unchanged" }]);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });

  it("lists a stub that got a record as a new character", () => {
    const before = upload('presence = { B = { battleTag = "Bob#2002", lastSeen = 1 } }');
    const after = upload(`presence = { B = { battleTag = "Bob#2002", lastSeen = 1 } },
                          people = { ["Bob#2002"] = { chars = { B = { name = "Bob Example", level = 9 } } } }`);
    expect(diff(before, after).newCharacters).toEqual([
      { guid: "B", owner: "Bob#2002", name: "Bob Example", hasRecord: true, level: 9 },
    ]);
  });

  it("does not report a lower level or rank, an unknown rank, or an older sighting", () => {
    const before = upload(`self = { battleTag = "A#1", chars = { A = { level = 10,
      professions = { [186] = { rank = 50 }, [185] = { name = "Cooking" } } } } },
      locations = { A = { zone = "Durotar", seenAt = 10 } }`);
    const after = upload(`self = { battleTag = "A#1", chars = { A = { level = 9,
      professions = { [186] = { rank = 40 }, [185] = { rank = 5 }, [171] = { name = "Alchemy" } } } } },
      locations = { A = { zone = "Mulgore", seenAt = 10 } }`);
    const summary = diff(before, after);
    expect(summary.levelUps).toEqual([]);
    expect(summary.professionGains).toEqual([]);
    expect(summary.sightings).toEqual([]);
  });

  it("sorts profession gains by GUID, then skill line number", () => {
    const before = upload('self = { battleTag = "A#1", chars = { A = {}, B = {} } }');
    const after = upload(`self = { battleTag = "A#1", chars = {
      A = { professions = { [393] = { rank = 1 }, [40] = { rank = 1 } } }, B = { professions = { [7] = { rank = 1 } } } } }`);
    expect(diff(before, after).professionGains.map((g) => `${g.guid}:${g.skillLine}`)).toEqual([
      "A:40",
      "A:393",
      "B:7",
    ]);
  });
});
