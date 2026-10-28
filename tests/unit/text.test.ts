import { describe, expect, it } from "vitest";
import { nameCuts } from "@/core/views/text";

describe("nameCuts (WEB-54)", () => {
  it("cuts the name at every length that keeps 3 letters, longest first", () => {
    const cuts = nameCuts("Ragefire Chasm");
    expect(cuts[0]).toBe("Ragefire Chas…");
    expect(cuts).toContain("Ragef…");
    expect(cuts.at(-1)).toBe("Rag…");
  });

  it("never ends in a space or colon before the ellipsis, and keeps each cut once", () => {
    const cuts = nameCuts("SM Graveyard");
    expect(cuts).toEqual([
      "SM Graveyar…",
      "SM Graveya…",
      "SM Gravey…",
      "SM Grave…",
      "SM Grav…",
      "SM Gra…",
      "SM Gr…",
      "SM G…",
    ]);
    expect(nameCuts("Maraudon: Orange")).toContain("Maraudon…");
    expect(nameCuts("Maraudon: Orange").filter((c) => c === "Maraudon…")).toHaveLength(1);
  });

  it("leaves a name of 3 letters or fewer whole", () => {
    expect(nameCuts("UBRS")).toEqual(["UBR…"]);
    expect(nameCuts("BRD")).toEqual(["BRD"]);
  });
});
