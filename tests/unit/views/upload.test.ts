import { describe, expect, it } from "vitest";
import { diff, type UploadSummary } from "@/core/diff";
import { parseLua } from "@/core/lua";
import { normalize, SUPPORTED_SCHEMA } from "@/core/normalize";
import {
  checkBeforeUpload,
  clockTime,
  clockTimeAt,
  historyLine,
  ledgerCounts,
  ledgerCountsText,
  MAX_UPLOAD_BYTES,
  rejectionLine,
  shownFileName,
  summaryLine,
  type StoredUpload,
  storedOutcome,
  type UploadResponse,
  uploadOutcome,
} from "@/core/views";

const data = (body: string) => normalize(parseLua(`return { schemaVersion = 1, ${body} }`));

const before = data(
  `self = { battleTag = "Nico#2201", version = 1, chars = { V = { name = "Ves Doombringer", level = 37 } } }`,
);
const after = data(`self = { battleTag = "Nico#2201", version = 2, chars = {
  V = { name = "Ves Doombringer", level = 39 }, Z = { name = "Zul Kazrek", level = 15 } } },
  locations = { V = { zone = "Durotar", seenAt = 5 } }`);
const changed: UploadSummary = diff(before, after);
const unchanged: UploadSummary = diff(before, before);

const ok = (extra: Partial<UploadResponse> = {}): UploadResponse => ({
  id: 7,
  uploadedAt: 1000,
  status: "ok",
  duplicate: false,
  summary: changed,
  ...extra,
});
const rejected = (extra: Partial<UploadResponse>): UploadResponse => ({
  id: 8,
  uploadedAt: 1000,
  status: "rejected",
  duplicate: false,
  ...extra,
});
const LEDGER = "CommunitiesForever.lua";

describe("uploadOutcome", () => {
  it("goes on to the report after an accepted upload with changes", () => {
    expect(uploadOutcome(200, ok(), LEDGER)).toEqual({ kind: "done", id: 7 });
  });

  it("says nothing new for the same file again, with the earlier upload's time", () => {
    expect(uploadOutcome(200, ok({ duplicate: true, uploadedAt: 500 }), LEDGER)).toEqual({
      kind: "nothing-new",
      since: 500,
    });
  });

  it("says nothing new for a new file that changes nothing, with the uploader's previous upload", () => {
    expect(uploadOutcome(200, ok({ summary: unchanged, previousUploadAt: 400 }), LEDGER)).toEqual({
      kind: "nothing-new",
      since: 400,
    });
    expect(uploadOutcome(200, ok({ summary: unchanged }), LEDGER)).toEqual({ kind: "nothing-new" });
  });

  it("names another addon's file from its name", () => {
    expect(uploadOutcome(200, rejected({ unreadable: "not-ledger" }), "Questie.lua")).toEqual({
      kind: "wrong-file",
      fileName: "Questie.lua",
    });
    // A broken file under another name is another addon's file too.
    expect(uploadOutcome(200, rejected({ unreadable: "damaged" }), "C:\\fakepath\\notes.txt")).toEqual({
      kind: "wrong-file",
      fileName: "notes.txt",
    });
  });

  it("tells a wrong file named like ours from a damaged one", () => {
    expect(uploadOutcome(200, rejected({ unreadable: "not-ledger" }), LEDGER)).toEqual({ kind: "wrong-file" });
    expect(uploadOutcome(200, rejected({ unreadable: "damaged" }), "communitiesforever.LUA")).toEqual({
      kind: "damaged",
    });
  });

  it("gives the file's format and the one the site reads for a newer addon", () => {
    expect(uploadOutcome(200, rejected({ unreadable: "newer-format", schemaVersion: 3 }), LEDGER)).toEqual({
      kind: "newer-format",
      format: 3,
      supported: SUPPORTED_SCHEMA,
    });
    expect(uploadOutcome(200, rejected({ unreadable: "newer-format" }), LEDGER)).toEqual({
      kind: "newer-format",
      supported: SUPPORTED_SCHEMA,
    });
  });

  it("maps the WEB-06 refusals", () => {
    const owner = rejected({ rejection: { code: "not-your-file", owner: "Bob#2002" } });
    expect(uploadOutcome(200, owner, LEDGER)).toEqual({ kind: "not-your-file", owner: "Bob#2002" });
    expect(uploadOutcome(200, rejected({ rejection: { code: "not-your-file" } }), LEDGER)).toEqual({
      kind: "not-your-file",
    });
    expect(uploadOutcome(200, rejected({ rejection: { code: "other-community" } }), LEDGER)).toEqual({
      kind: "other-community",
    });
    expect(uploadOutcome(200, rejected({ rejection: { code: "no-community-yet" } }), LEDGER)).toEqual({
      kind: "no-community-yet",
    });
  });

  it("says the same about an earlier rejected file sent again", () => {
    const again = rejected({ duplicate: true, rejection: { code: "other-community" } });
    expect(uploadOutcome(200, again, LEDGER)).toEqual({ kind: "other-community" });
  });

  it("never passes on raw errors: too large, refused, broken answers and unknown reasons", () => {
    expect(uploadOutcome(413, { error: "The file is larger than 26214400 bytes." }, LEDGER)).toEqual({
      kind: "too-large",
    });
    expect(uploadOutcome(403, { error: "You may not upload." }, LEDGER)).toEqual({ kind: "failed" });
    expect(uploadOutcome(500, undefined, LEDGER)).toEqual({ kind: "failed" });
    expect(uploadOutcome(200, { id: "7" }, LEDGER)).toEqual({ kind: "failed" });
    expect(uploadOutcome(200, null, LEDGER)).toEqual({ kind: "failed" });
    expect(uploadOutcome(200, rejected({}), LEDGER)).toEqual({ kind: "failed" });
  });
});

describe("before the upload", () => {
  it("refuses a file over 25 MiB in the browser", () => {
    expect(checkBeforeUpload(MAX_UPLOAD_BYTES)).toBeUndefined();
    expect(checkBeforeUpload(MAX_UPLOAD_BYTES + 1)).toEqual({ kind: "too-large" });
  });

  it("shows only the file's own name, shortened", () => {
    expect(shownFileName("C:/WTF/Account/X/SavedVariables/Questie.lua")).toBe("Questie.lua");
    expect(shownFileName(`${"a".repeat(70)}.lua`)).toHaveLength(60);
  });

  it("counts characters with a record and the friends who own them", () => {
    const file =
      data(`self = { battleTag = "Nico#2201", chars = { V = { name = "Ves Doombringer" }, W = { name = "Wes Alt" } } },
      people = { ["Bob#2002"] = { chars = { T = { name = "Tok Ironhide" } } } },
      presence = { S = { battleTag = "Sanne#5150", lastSeen = 1 } }`);
    expect(ledgerCounts(file)).toEqual({ characters: 3, friends: 2 });
    expect(ledgerCountsText({ characters: 10, friends: 5 })).toBe("10 characters from 5 friends");
    expect(ledgerCountsText({ characters: 1, friends: 1 })).toBe("1 character from 1 friend");
  });
});

describe("history", () => {
  it("summarises a first upload by its characters", () => {
    expect(summaryLine(diff(undefined, after), true)).toBe("First upload · 2 characters");
  });

  it("lists up to three counts in order, leaving out zeros", () => {
    expect(summaryLine(changed, false)).toBe("2 levels gained · 1 new character · 1 sighting");
    const many = {
      ...changed,
      counts: { ...changed.counts, levelsGained: 5, skillGains: 4, newCharacters: 1, sightings: 9 },
    };
    expect(summaryLine(many, false)).toBe("5 levels gained · 4 skill gains · 1 new character");
    const one = { ...changed, counts: { ...unchanged.counts, levelsGained: 1, itemLevelGains: 2 } };
    expect(summaryLine(one, false)).toBe("1 level gained · 2 item level gains");
    expect(summaryLine(unchanged, false)).toBe("Nothing new");
  });

  it("gives each rejection a short reason", () => {
    expect(rejectionLine({ unreadable: "not-ledger" })).toBe("Wrong file: another addon's data");
    expect(rejectionLine({ unreadable: "damaged" })).toBe("Damaged file");
    expect(rejectionLine({ unreadable: "newer-format", schemaVersion: 3 })).toBe("Newer addon: format 3");
    expect(rejectionLine({ rejection: "not-your-file" })).toBe("Not your file");
    expect(rejectionLine({ rejection: "other-community" })).toBe("Another community");
    expect(rejectionLine({ rejection: "no-community-yet" })).toBe("Before the admin's first upload");
    expect(rejectionLine({})).toBe("Couldn't be read");
  });

  it("names the uploader by display name, else by the BattleTag's name", () => {
    const u: StoredUpload = {
      id: 3,
      uploadedAt: 9,
      uploadedBy: "Nico#2201",
      status: "ok",
      summary: changed,
      first: false,
    };
    expect(historyLine(u, new Map([["nico#2201", "Nico the Great"]]))).toEqual({
      id: 3,
      uploadedAt: 9,
      uploader: "Nico the Great",
      status: "done",
      text: "2 levels gained · 1 new character · 1 sighting",
    });
    const refused: StoredUpload = { ...u, status: "rejected", rejection: "not-your-file", summary: undefined };
    expect(historyLine(refused, new Map())).toMatchObject({
      uploader: "Nico",
      status: "rejected",
      text: "Not your file",
    });
  });
});

describe("clockTime", () => {
  // Mon 26 Oct 2026, 21:14 in Amsterdam (CET, UTC+1: summer time ended on Sunday the 25th).
  const now = Date.UTC(2026, 9, 26, 20, 14) / 1000;
  const zone = "Europe/Amsterdam";

  it("says today and yesterday with a 24-hour time", () => {
    expect(clockTime(now, now, zone)).toBe("today 21:14");
    expect(clockTime(Date.UTC(2026, 9, 25, 21, 5) / 1000, now, zone)).toBe("yesterday 22:05");
  });

  it("goes by the calendar day in the zone, not 24 hours", () => {
    // 23:30 UTC on the 25th is 00:30 on the 26th in Amsterdam.
    expect(clockTime(Date.UTC(2026, 9, 25, 23, 30) / 1000, now, zone)).toBe("today 00:30");
    expect(clockTime(Date.UTC(2026, 9, 25, 23, 30) / 1000, now, "UTC")).toBe("yesterday 23:30");
  });

  it("names weekday, day and month for older times, with the year when it isn't this year", () => {
    expect(clockTime(Date.UTC(2026, 9, 23, 21, 40) / 1000, now, zone)).toBe("Fri 23 Oct, 23:40");
    expect(clockTime(Date.UTC(2025, 11, 31, 12, 0) / 1000, now, zone)).toBe("Wed 31 Dec 2025, 13:00");
  });

  it("reads as a phrase after 'uploaded' (WEB-20)", () => {
    expect(clockTimeAt(now, now, zone)).toBe("today at 21:14");
    expect(clockTimeAt(Date.UTC(2026, 9, 25, 21, 5) / 1000, now, zone)).toBe("yesterday at 22:05");
    expect(clockTimeAt(Date.UTC(2026, 9, 23, 21, 40) / 1000, now, zone)).toBe("on Fri 23 Oct at 23:40");
    expect(clockTimeAt(Date.UTC(2025, 11, 31, 12, 0) / 1000, now, zone)).toBe("on Wed 31 Dec 2025 at 13:00");
  });
});

describe("storedOutcome (report page, WEB-20)", () => {
  const at = { uploadedAt: 1000 };
  it("has a report for an accepted upload that changed something", () => {
    expect(storedOutcome({ ...at, status: "ok", summary: changed })).toBeUndefined();
  });
  it("is nothing new for an accepted upload that changed nothing", () => {
    expect(storedOutcome({ ...at, status: "ok", summary: unchanged })).toEqual({ kind: "nothing-new" });
    expect(storedOutcome({ ...at, status: "ok" })).toEqual({ kind: "nothing-new" });
  });
  it("names the rejection as the upload screen does", () => {
    const of = (u: Partial<StoredUpload>) => storedOutcome({ ...at, status: "rejected", ...u })?.kind;
    expect(of({ unreadable: "not-ledger" })).toBe("wrong-file");
    expect(of({ unreadable: "damaged" })).toBe("damaged");
    expect(storedOutcome({ ...at, status: "rejected", unreadable: "newer-format", schemaVersion: 9 })).toEqual({
      kind: "newer-format",
      format: 9,
      supported: SUPPORTED_SCHEMA,
    });
    expect(of({ rejection: "not-your-file" })).toBe("not-your-file");
    expect(of({ rejection: "other-community" })).toBe("other-community");
    expect(of({ rejection: "no-community-yet" })).toBe("no-community-yet");
  });
});
