import { describe, expect, it } from "vitest";
import {
  isRollCallFiltered,
  parseRollCallQuery,
  rollCall,
  rollCallFilter,
  rollCallParams,
  worldMap,
} from "@/core/views";
import { NOW, sample } from "./sample";

describe("roll call query (WEB-27)", () => {
  it("reads the filters from the URL and ignores anything unknown", () => {
    expect(parseRollCallQuery({ friend: "Bob#2002", new: "1", faction: "Horde", level: "30-39" })).toEqual({
      friend: "Bob#2002",
      liveOnly: true,
      faction: "Horde",
      level: "30-39",
    });
    expect(parseRollCallQuery({ friend: "", new: "yes", faction: "scourge", level: "31-35" })).toEqual({
      liveOnly: false,
    });
    expect(parseRollCallQuery({ friend: ["Mira#1188", "Bob#2002"] }).friend).toBe("Mira#1188");
    expect(parseRollCallQuery({ friend: "x".repeat(65) }).friend).toBeUndefined();
  });

  it("writes the same query back", () => {
    const q = parseRollCallQuery({ friend: "Bob#2002", new: "1", faction: "alliance", level: "60" });
    expect(rollCallParams(q)).toEqual({ friend: "Bob#2002", new: "1", faction: "alliance", level: "60" });
    expect(rollCallParams({ liveOnly: false })).toEqual({
      friend: undefined,
      new: undefined,
      faction: undefined,
      level: undefined,
    });
    expect(isRollCallFiltered({ liveOnly: false })).toBe(false);
    expect(isRollCallFiltered(q)).toBe(true);
  });

  it("turns the level range into the view model's filter", () => {
    expect(rollCallFilter({ liveOnly: true, level: "30-39", faction: "Horde", friend: "Bob#2002" })).toEqual({
      person: "Bob#2002",
      liveOnly: true,
      faction: "Horde",
      minLevel: 30,
      maxLevel: 39,
    });
    expect(rollCallFilter({ liveOnly: false })).toEqual({});
  });

  it("filters the map to the roll call's characters", () => {
    const d = sample();
    const call = rollCall(d, NOW, rollCallFilter({ friend: "Bob#2002", liveOnly: false }));
    const only = new Set(call.live.concat(call.earlier).map((r) => r.character.guid));
    const guids = worldMap(d, NOW, only).places.flatMap((p) => p.markers.map((m) => m.guid));
    expect(guids.sort()).toEqual([...only].sort());
    expect(worldMap(d, NOW).places.flatMap((p) => p.markers)).toHaveLength(9);
  });
});
