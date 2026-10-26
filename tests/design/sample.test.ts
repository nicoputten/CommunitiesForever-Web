import { describe, expect, it } from "vitest";
import { checkFile } from "@/core/access";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import { ADMIN, sampleSavedVariables } from "./sample";

// The design checks' sample upload must stay a file the site accepts from the admin.
describe("design sample data", () => {
  it("parses, normalizes and is the admin's own file", () => {
    const data = normalize(parseLua(sampleSavedVariables()));
    expect(checkFile(ADMIN, data, undefined, ADMIN)).toBeUndefined();
    expect(data.community.name).toBe("Doombringers");
    const named = Object.values(data.characters).filter((c) => c.hasRecord);
    expect(named.map((c) => c.name).sort()).toEqual([
      "Bob Example",
      "Grom Ashfeller",
      "Kel Dawnhammer",
      "Lia Thornwhisper",
      "Mira Sunstrider",
      "Ruk Bloodhoof",
      "Sela Moonbrook",
      "Tok Ironhide",
      "Ves Doombringer",
      "Zul Kazrek",
    ]);
    expect(data.characters["Player-1-0000A001"]?.mainTreeName).toBe("Destruction");
  });
});
