import { describe, expect, it } from "vitest";
import { parseLua } from "@/core/lua";
import { normalize } from "@/core/normalize";
import { dataTime, viaName } from "@/core/people";

const upload = (body: string) => normalize(parseLua(`return { schemaVersion = 1, ${body} }`));

describe("people", () => {
  const d =
    upload(`self = { battleTag = "Ada#1001", version = 50, chars = { A = { name = "Ada Example", updatedAt = 40 } } },
    people = {
      ["Bob#2002"] = { version = 30, receivedAt = 35, chars = {} },
      ["Cid#3003"] = { receivedAt = 25, chars = {} },
      ["Dee#4004"] = { chars = { D1 = { updatedAt = 12 }, D2 = { updatedAt = 18 } } },
      ["Eve#5005"] = { chars = {} },
      ["aid:abc"] = { displayName = "Fay", chars = { F = { name = "Fay Example" } } },
    },
    presence = { G = { battleTag = "Gus#7007", lastSeen = 1 } }`);

  it("dates a person's data by version, then receivedAt, then their newest character", () => {
    expect(dataTime(d, d.people["Ada#1001"]!)).toBe(50);
    expect(dataTime(d, d.people["Bob#2002"]!)).toBe(30);
    expect(dataTime(d, d.people["Cid#3003"]!)).toBe(25);
    expect(dataTime(d, d.people["Dee#4004"]!)).toBe(18);
    expect(dataTime(d, d.people["Eve#5005"]!)).toBeUndefined();
    expect(dataTime(d, d.people["Gus#7007"]!)).toBeUndefined();
  });

  it("names the friend who relayed a record", () => {
    expect(viaName(d, "Bob#2002")).toBe("Bob");
    expect(viaName(d, "Zed#9009")).toBe("Zed");
    expect(viaName(d, "member:F")).toBe("Fay Example");
    expect(viaName(d, "member:G")).toBe("Gus");
    expect(viaName(d, "member:nobody")).toBe("a community member");
    expect(viaName(d, "constructor")).toBe("constructor");
  });
});
