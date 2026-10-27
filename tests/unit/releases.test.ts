import { describe, expect, it } from "vitest";
import {
  aboutSize,
  checkRelease,
  compareVersions,
  isSafeName,
  mergeFeed,
  parseFeed,
  type ReleaseAsset,
  releaseFileKind,
} from "@/core/releases";

// WEB-35: which files a release may have, the feed, versions and what the site keeps.

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

describe("release files", () => {
  it("accepts only plain names of Velopack's files", () => {
    expect(releaseFileKind("releases.win.json")).toBe("feed");
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

  it("takes the newest version's packages", () => {
    const r = checkRelease([setup, full], feed(asset("1.0.0"), asset("1.1.0")), "1.0.0");
    expect(r.version).toBe("1.1.0");
    expect(r.assets.map((a) => a.Version)).toEqual(["1.1.0"]);
    expect(r.setup).toBe(setup);
  });

  it("refuses a missing, wrong or old release", () => {
    expect(() => checkRelease([full], feed(asset("1.1.0")), undefined)).toThrow("Setup");
    expect(() => checkRelease([setup], feed(asset("1.1.0")), undefined)).toThrow("missing");
    expect(() => checkRelease([setup, { ...full, size: 11 }], feed(asset("1.1.0")), undefined)).toThrow("SHA256");
    expect(() => checkRelease([setup, { ...full, sha256: "b".repeat(64) }], feed(asset("1.1.0")), undefined)).toThrow();
    expect(() => checkRelease([setup, full], feed(asset("1.1.0")), "1.1.0")).toThrow("not newer");
  });
});

describe("mergeFeed", () => {
  it("keeps the newest three versions", () => {
    const kept = mergeFeed([asset("1.0.0"), asset("1.1.0"), asset("1.2.0")], [asset("1.3.0")]);
    expect(kept.map((a) => a.Version)).toEqual(["1.1.0", "1.2.0", "1.3.0"]);
  });
});

it("says about how big the installer is", () => {
  expect(aboutSize(64 * 1024 * 1024 + 300_000)).toBe("about 64 MB");
  expect(aboutSize(1000)).toBe("about 1 MB");
});
