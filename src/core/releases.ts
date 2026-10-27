// The uploader's releases (WEB-35, docs/UPLOADER-API.md "Installer and updates"): the Velopack files the release
// workflow publishes, the feed the app reads and which versions the site keeps. Pure: files come in as names, sizes
// and hashes.

/** Velopack's feed for the `win` channel: what the app reads first. */
export const FEED_NAME = "releases.win.json";
/** Versions kept on the site; older packages are deleted. */
export const KEEP_VERSIONS = 3;
/** The installer's name for the person downloading it. */
export const SETUP_DOWNLOAD_NAME = "CommunitiesForever-Uploader-Setup.exe";

/** One package in Velopack's feed (`VelopackAsset`); other fields Velopack writes are kept as they are. */
export interface ReleaseAsset {
  PackageId: string;
  Version: string;
  Type: "Full" | "Delta";
  FileName: string;
  SHA256: string;
  Size: number;
  [other: string]: unknown;
}

/** What the uploader page and the download know about the newest release. */
export interface CurrentRelease {
  version: string;
  /** The installer's file name in the releases folder. */
  setup: string;
  /** The installer's size in bytes. */
  size: number;
  /** Unix seconds. */
  publishedAt: number;
}

export type ReleaseFileKind = "setup" | "full" | "delta" | "feed";

/** Plain file names only: no folders, no "..", nothing a path could be built from. */
export function isSafeName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(name) && !name.includes("..");
}

/** The kind of a file the release workflow may send; undefined for anything else (refused). */
export function releaseFileKind(name: string): ReleaseFileKind | undefined {
  if (!isSafeName(name)) return undefined;
  if (name === FEED_NAME) return "feed";
  if (name.endsWith("-Setup.exe")) return "setup";
  if (name.endsWith("-full.nupkg")) return "full";
  if (name.endsWith("-delta.nupkg")) return "delta";
  return undefined;
}

export class ReleaseError extends Error {
  constructor(
    readonly code: "invalid_release" | "not_newer",
    message: string,
  ) {
    super(message);
    this.name = "ReleaseError";
  }
}

/** Velopack's `releases.win.json` (`{ Assets: [...] }`); throws ReleaseError when it isn't one. */
export function parseFeed(text: string): ReleaseAsset[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ReleaseError("invalid_release", `${FEED_NAME} is not JSON.`);
  }
  const assets = (json as { Assets?: unknown } | null)?.Assets;
  if (!Array.isArray(assets)) throw new ReleaseError("invalid_release", `${FEED_NAME} has no Assets.`);
  return assets.map((a: unknown) => {
    const asset = a as Partial<ReleaseAsset> | null;
    if (
      typeof asset?.PackageId !== "string" ||
      typeof asset.Version !== "string" ||
      parseVersion(asset.Version) === undefined ||
      (asset.Type !== "Full" && asset.Type !== "Delta") ||
      typeof asset.FileName !== "string" ||
      releaseFileKind(asset.FileName) !== (asset.Type === "Full" ? "full" : "delta") ||
      typeof asset.SHA256 !== "string" ||
      !/^[0-9a-fA-F]{64}$/.test(asset.SHA256) ||
      typeof asset.Size !== "number"
    ) {
      throw new ReleaseError("invalid_release", `${FEED_NAME} has an asset Velopack wouldn't write.`);
    }
    return asset as ReleaseAsset;
  });
}

type Version = { nums: number[]; pre: string };

/** "1.2.3" or "1.2.3-beta.1"; undefined for anything else. */
export function parseVersion(text: string): Version | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(text);
  if (m === null) return undefined;
  return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? "" };
}

/** SemVer order, simplified: numbers, then a release above its prereleases, prereleases compared as text. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (x === undefined || y === undefined) return a.localeCompare(b);
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i]! - y.nums[i]!;
  if (x.pre === y.pre) return 0;
  if (x.pre === "") return 1;
  if (y.pre === "") return -1;
  return x.pre < y.pre ? -1 : 1;
}

export interface SentFile {
  name: string;
  size: number;
  sha256: string;
}

export interface CheckedRelease {
  version: string;
  setup: SentFile;
  /** The new version's packages, as the feed names them. */
  assets: ReleaseAsset[];
}

/**
 * Checks what the release workflow sent: one installer, the feed, and every package of the new (newest) version the
 * feed names, each with its exact size and SHA-256. Packages of older versions in the feed are ignored (the site
 * keeps its own). The version must be newer than `current`.
 */
export function checkRelease(files: SentFile[], feedText: string, current: string | undefined): CheckedRelease {
  const setups = files.filter((f) => releaseFileKind(f.name) === "setup");
  if (setups.length !== 1) throw new ReleaseError("invalid_release", "Send exactly one *-Setup.exe.");
  const feed = parseFeed(feedText);
  const version = feed
    .map((a) => a.Version)
    .sort(compareVersions)
    .at(-1);
  if (version === undefined) throw new ReleaseError("invalid_release", `${FEED_NAME} lists no packages.`);
  const assets = feed.filter((a) => a.Version === version);
  if (!assets.some((a) => a.Type === "Full")) throw new ReleaseError("invalid_release", "No full package.");
  for (const asset of assets) {
    const file = files.find((f) => f.name === asset.FileName);
    if (file === undefined) throw new ReleaseError("invalid_release", `${asset.FileName} is missing.`);
    if (file.size !== asset.Size || file.sha256.toLowerCase() !== asset.SHA256.toLowerCase()) {
      throw new ReleaseError("invalid_release", `${asset.FileName} doesn't match its size or SHA256.`);
    }
  }
  if (current !== undefined && compareVersions(version, current) <= 0) {
    throw new ReleaseError("not_newer", `${version} is not newer than ${current}.`);
  }
  return { version, setup: setups[0]!, assets };
}

/** The feed after a release: the new packages and those of the newest earlier versions, `keep` versions in all. */
export function mergeFeed(existing: ReleaseAsset[], added: ReleaseAsset[], keep = KEEP_VERSIONS): ReleaseAsset[] {
  const all = [...existing.filter((a) => !added.some((b) => b.FileName === a.FileName)), ...added];
  const versions = [...new Set(all.map((a) => a.Version))].sort(compareVersions).slice(-keep);
  return all.filter((a) => versions.includes(a.Version));
}

/** "about 64 MB" (uploader-page board: "about [size]"). */
export function aboutSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? "about 1 MB" : `about ${Math.round(mb)} MB`;
}
