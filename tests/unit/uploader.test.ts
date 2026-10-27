import { describe, expect, it } from "vitest";
import type { UploadSummary } from "@/core/diff";
import {
  base64url,
  bearerToken,
  CODE_ALPHABET,
  cleanLabel,
  formatToken,
  normalizeUserCode,
  RateLimiter,
  uploaderUploadResponse,
  type UploaderUploadInput,
  userCode,
} from "@/core/uploader";

// WEB-33: codes, tokens, rate limits and the app's upload response (docs/UPLOADER-API.md).

describe("user codes", () => {
  it("uses no look-alike characters", () => {
    for (const c of "0O1IL2Z5S8BUV") expect(CODE_ALPHABET).not.toContain(c);
    expect(new Set(CODE_ALPHABET).size).toBe(23);
  });

  it("formats 8 symbols as XXXX-XXXX and skips biased bytes", () => {
    const bytes = Uint8Array.from([255, 254, 253, 0, 1, 2, 3, 4, 5, 6, 252]);
    expect(userCode(bytes)).toBe("ACDE-FGH9");
    expect(userCode(Uint8Array.from([0, 1, 2]))).toBeUndefined();
  });

  it("takes a code as typed", () => {
    expect(normalizeUserCode("kxrt 7qmn")).toBe("KXRT-7QMN");
    expect(normalizeUserCode("KXRT-7QMN")).toBe("KXRT-7QMN");
    expect(normalizeUserCode("KXRT-7QM0")).toBeUndefined();
    expect(normalizeUserCode("KXRT")).toBeUndefined();
  });
});

describe("tokens", () => {
  it("is cfu_ and 43 base64url characters", () => {
    const token = formatToken(new Uint8Array(32).fill(251));
    expect(token).toMatch(/^cfu_[A-Za-z0-9_-]{43}$/);
    expect(base64url(Uint8Array.from([0xfb, 0xff]))).toBe("-_8");
    expect(base64url(new TextEncoder().encode("Man"))).toBe("TWFu");
  });

  it("reads only a well-formed Bearer header", () => {
    const token = formatToken(new Uint8Array(32));
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(`bearer  ${token} `)).toBe(token);
    expect(bearerToken(token)).toBeUndefined();
    expect(bearerToken("Bearer cfu_short")).toBeUndefined();
    expect(bearerToken(null)).toBeUndefined();
  });

  it("cleans device names", () => {
    expect(cleanLabel("  DESKTOP-NICO \n")).toBe("DESKTOP-NICO");
    expect(cleanLabel("|cffff0000Red|r")).toBe("cffff0000Redr");
    expect(cleanLabel("x".repeat(100))).toHaveLength(64);
    expect(cleanLabel("  ")).toBeUndefined();
    expect(cleanLabel(42)).toBeUndefined();
  });
});

describe("rate limiter", () => {
  it("counts per key and window and says how long to wait", () => {
    const limit = new RateLimiter(2, 60);
    expect(limit.hit("a", 0)).toBeUndefined();
    expect(limit.hit("a", 10)).toBeUndefined();
    expect(limit.hit("a", 20)).toBe(40);
    expect(limit.hit("b", 20)).toBeUndefined();
    expect(limit.hit("a", 60)).toBeUndefined();
  });

  it("stays bounded", () => {
    const limit = new RateLimiter(1, 60, 2);
    limit.hit("a", 0);
    limit.hit("b", 0);
    expect(limit.hit("c", 10)).toBe(60);
    expect(limit.hit("c", 60)).toBeUndefined();
  });
});

const summary = (over: Partial<UploadSummary> = {}): UploadSummary => ({
  newPeople: [],
  newCharacters: [],
  removedCharacters: [],
  levelUps: [],
  professionGains: [],
  itemLevelGains: [],
  sightings: [],
  senders: [],
  counts: { levelsGained: 0, skillGains: 0, itemLevelGains: 0, newCharacters: 0, sightings: 0, peopleWithNewData: 0 },
  ...over,
});

const input = (over: Partial<UploaderUploadInput> = {}): UploaderUploadInput => ({
  id: 42,
  uploadedAt: 1000,
  status: "ok",
  duplicate: false,
  first: false,
  ...over,
});

const SITE = "https://wow.vestras.nl";

describe("upload response", () => {
  it("names what this upload changed", () => {
    const s = summary({
      levelUps: [
        { guid: "a", name: "Ves Doombringer", from: 37, to: 39 },
        { guid: "b", name: "Zul Kazrek", from: 10, to: 11 },
      ],
      professionGains: [
        {
          guid: "a",
          name: "Ves Doombringer",
          skillLine: "197",
          profession: "Tailoring",
          from: 150,
          to: 187,
          capReached: false,
        },
      ],
      newCharacters: [{ guid: "c", name: "Mira Dawn", hasRecord: true }],
      counts: {
        levelsGained: 3,
        skillGains: 1,
        itemLevelGains: 0,
        newCharacters: 1,
        sightings: 0,
        peopleWithNewData: 1,
      },
    });
    expect(uploaderUploadResponse(input({ summary: s, counts: { characters: 4, friends: 2 } }), SITE)).toEqual({
      uploadId: 42,
      uploadedAt: 1000,
      status: "ok",
      rejection: null,
      schemaVersion: null,
      summaryLine: "3 levels gained · 1 skill gain · 1 new character",
      highlights: ["Ves Doombringer 37 → 39", "Zul Kazrek 10 → 11", "Ves Doombringer: Tailoring 150 → 187"],
      counts: { characters: 4, friends: 2 },
      reportUrl: "https://wow.vestras.nl/upload/42",
    });
  });

  it("is nothing_new for a duplicate or an upload with nothing newer", () => {
    const changed = summary({ levelUps: [{ guid: "a", name: "Ves Doombringer", from: 1, to: 2 }] });
    for (const u of [input({ duplicate: true, summary: changed }), input({ summary: summary() })]) {
      expect(uploaderUploadResponse(u, SITE)).toMatchObject({
        status: "nothing_new",
        summaryLine: "Nothing new",
        highlights: [],
      });
    }
  });

  it("says First upload without highlights", () => {
    const s = summary({
      newCharacters: [{ guid: "c", name: "Mira Dawn", hasRecord: true }],
      counts: {
        levelsGained: 0,
        skillGains: 0,
        itemLevelGains: 0,
        newCharacters: 1,
        sightings: 0,
        peopleWithNewData: 1,
      },
    });
    expect(uploaderUploadResponse(input({ summary: s, first: true }), SITE)).toMatchObject({
      status: "ok",
      summaryLine: "First upload · 1 character",
      highlights: [],
    });
  });

  it("maps every rejection to the API's codes", () => {
    const cases: [Partial<UploaderUploadInput>, string, string][] = [
      [{ unreadable: "not-ledger" }, "wrong_file", "Wrong file: another addon's data"],
      [{ unreadable: "damaged" }, "damaged", "Damaged file"],
      [{ unreadable: "newer-format", schemaVersion: 3 }, "newer_format", "Newer addon: format 3"],
      [{ rejection: { code: "not-your-file" } }, "not_your_file", "Not your file"],
      [{ rejection: { code: "other-community" } }, "other_community", "Another community"],
      [{ rejection: { code: "no-community-yet" } }, "no_community_yet", "Before the admin's first upload"],
    ];
    for (const [over, rejection, line] of cases) {
      const r = uploaderUploadResponse(
        input({ status: "rejected", counts: { characters: 1, friends: 1 }, ...over }),
        SITE,
      );
      expect(r).toMatchObject({ status: "rejected", rejection, summaryLine: line, highlights: [] });
      expect(r.schemaVersion).toBe(rejection === "newer_format" ? 3 : null);
      expect(r.counts).toEqual(over.unreadable === undefined ? { characters: 1, friends: 1 } : null);
    }
  });
});
