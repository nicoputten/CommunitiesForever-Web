import { describe, expect, it } from "vitest";
import {
  aboutSize,
  checkRelease,
  compareVersions,
  isSafeName,
  minimumVersion,
  parseFeed,
  type ReleaseAsset,
  releaseFileKind,
  updateStatus,
} from "@/core/releases";

// WEB-35: which files a release may have, the feed and versions. WEB-35b: the signed feed, kept as sent, and the
// update status.

const SHA = "a".repeat(64);
const asset = (version: string, over: Partial<ReleaseAsset> = {}): ReleaseAsset => ({
  PackageId: "CommunitiesForever.Upload",
  Version: version,
  Type: "Full",
  FileName: `CommunitiesForever.Upload-${version}-full.nupkg`,
  SHA256: SHA,
  Size: 10,
  ...over,
});
const feed = (...assets: ReleaseAsset[]) => JSON.stringify({ Assets: assets });
const setup = { name: "CommunitiesForever.Upload-win-Setup.exe", size: 20, sha256: SHA };
const sig = { name: "releases.win.json.sig", size: 71, sha256: SHA };

describe("release files", () => {
  it("accepts only plain names of Velopack's files", () => {
    expect(releaseFileKind("releases.win.json")).toBe("feed");
    expect(releaseFileKind("releases.win.json.sig")).toBe("signature");
    expect(releaseFileKind("CommunitiesForever.Upload-win-Setup.exe")).toBe("setup");
    expect(releaseFileKind("CommunitiesForever.Upload-1.0.0-full.nupkg")).toBe("full");
    expect(releaseFileKind("CommunitiesForever.Upload-1.0.1-delta.nupkg")).toBe("delta");
    expect(releaseFileKind("RELEASES")).toBeUndefined();
    expect(releaseFileKind("x-Portable.zip")).toBeUndefined();
    expect(releaseFileKind("../x-full.nupkg")).toBeUndefined();
    expect(isSafeName("a..b-full.nupkg")).toBe(false);
    expect(isSafeName("dir/x")).toBe(false);
  });

  it("reads Velopack's feed and refuses anything else", () => {
    expect(parseFeed(feed(asset("1.0.0", { NotesMarkdown: "Hi" })))[0]).toMatchObject({
      Version: "1.0.0",
      NotesMarkdown: "Hi",
    });
    expect(() => parseFeed("nope")).toThrow("not JSON");
    expect(() => parseFeed("{}")).toThrow("no Assets");
    expect(() => parseFeed(feed(asset("1.0.0", { FileName: "../evil-full.nupkg" })))).toThrow();
    expect(() => parseFeed(feed(asset("1.0.0", { Type: "Delta" })))).toThrow();
    expect(() => parseFeed(feed(asset("one")))).toThrow();
  });

  it("orders versions", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
  });
});

describe("checkRelease", () => {
  const full = { name: asset("1.1.0").FileName, size: 10, sha256: SHA };
  const old = asset("1.0.0", { SHA256: "c".repeat(64) });

  it("takes the newest version as the release and keeps every package the feed lists", () => {
    const r = checkRelease([setup, sig, full], feed(old, asset("1.1.0")), "1.0.0", [old]);
    expect(r.version).toBe("1.1.0");
    expect(r.assets.map((a) => a.Version)).toEqual(["1.0.0", "1.1.0"]);
    expect(r.sent.map((a) => a.Version)).toEqual(["1.1.0"]);
    expect(r.setup).toBe(setup);
  });

  it("needs the signature", () => {
    expect(() => checkRelease([setup, full], feed(asset("1.1.0")), undefined)).toThrow("releases.win.json.sig");
    expect(() => checkRelease([setup, { ...sig, size: 0 }, full], feed(asset("1.1.0")), undefined)).toThrow(
      "not a signature",
    );
    expect(() => checkRelease([setup, { ...sig, size: 5000 }, full], feed(asset("1.1.0")), undefined)).toThrow(
      "not a signature",
    );
  });

  it("refuses a missing, wrong or old release", () => {
    expect(() => checkRelease([sig, full], feed(asset("1.1.0")), undefined)).toThrow("Setup");
    expect(() => checkRelease([setup, sig], feed(asset("1.1.0")), undefined)).toThrow("missing");
    expect(() => checkRelease([setup, sig, { ...full, size: 11 }], feed(asset("1.1.0")), undefined)).toThrow("SHA256");
    expect(() =>
      checkRelease([setup, sig, { ...full, sha256: "b".repeat(64) }], feed(asset("1.1.0")), undefined),
    ).toThrow();
    expect(() => checkRelease([setup, sig, full], feed(asset("1.1.0")), "1.1.0")).toThrow("not newer");
    expect(() => checkRelease([setup, sig, full], feed(asset("1.1.0"), asset("1.1.0")), undefined)).toThrow("twice");
  });

  it("refuses an older package that is neither sent nor the same as the one on the site", () => {
    expect(() => checkRelease([setup, sig, full], feed(old, asset("1.1.0")), "1.0.0", [])).toThrow(
      "neither sent nor on the site",
    );
    expect(() => checkRelease([setup, sig, full], feed(old, asset("1.1.0")), "1.0.0", [asset("1.0.0")])).toThrow(
      "differs from the one on the site",
    );
  });
});

describe("update status", () => {
  it("takes a plain minimum version only", () => {
    expect(minimumVersion("1.2.0")).toBe("1.2.0");
    expect(minimumVersion(" 1.2.0 ")).toBe("1.2.0");
    expect(minimumVersion(undefined)).toBeNull();
    expect(minimumVersion("")).toBeNull();
    expect(minimumVersion("1.2")).toBeNull();
    expect(minimumVersion("1.2.0-beta")).toBeNull();
  });

  it("answers the newest release", () => {
    expect(updateStatus({ version: "1.1.0", setup: "x", size: 1, publishedAt: 1793000000 }, null)).toEqual({
      latest: "1.1.0",
      releasedAt: 1793000000,
      minimumVersion: null,
      notesUrl: null,
    });
  });
});

it("says about how big the installer is", () => {
  expect(aboutSize(64 * 1024 * 1024 + 300_000)).toBe("about 64 MB");
  expect(aboutSize(1000)).toBe("about 1 MB");
});
