import { createHash } from "node:crypto";
import { type APIRequestContext, expect } from "@playwright/test";
import { E2E } from "../../playwright.config";

// The Windows uploader's side of connecting (RFC 8628, docs/UPLOADER-API.md), for the uploader page tests (WEB-34).

const CLIENT_ID = "communitiesforever-uploader";

/** A made-up client IP per request: the device authorization request is rate-limited per IP. */
const someIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}`;

export interface Started {
  device_code: string;
  user_code: string;
}

/** The app clicks Connect: a pairing waits for approval on `/uploader?code=…`. */
export async function startPairing(request: APIRequestContext, deviceName: string): Promise<Started> {
  const response = await request.post("/api/uploader/v1/device_authorization", {
    form: { client_id: CLIENT_ID, device_name: deviceName, app_version: "1.0.0" },
    headers: { "x-forwarded-for": someIp() },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as Started;
}

/** The app's poll of the token endpoint: the access token, or the OAuth error. */
export async function pollToken(
  request: APIRequestContext,
  deviceCode: string,
): Promise<{ access_token?: string; error?: string }> {
  const response = await request.post("/api/uploader/v1/token", {
    form: { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: deviceCode, client_id: CLIENT_ID },
  });
  return (await response.json()) as { access_token?: string; error?: string };
}

const PACKAGE_ID = "CommunitiesForever.Upload";

/**
 * The uploader's release workflow publishes (WEB-35): an installer, the feed with a full package per version (with
 * its release notes, Velopack's `NotesMarkdown`) and the feed's signature. Returns the status: 201, or 409 when the
 * site already has the newest version (another project published it).
 */
export async function publishRelease(
  request: APIRequestContext,
  versions: { version: string; notes?: string }[],
): Promise<number> {
  const multipart: Record<string, { name: string; mimeType: string; buffer: Buffer }> = {};
  const assets = versions.map(({ version, notes }, i) => {
    const pkg = Buffer.from(`package ${version}`);
    const FileName = `${PACKAGE_ID}-${version}-full.nupkg`;
    multipart[`full${i}`] = { name: FileName, mimeType: "application/octet-stream", buffer: pkg };
    return {
      PackageId: PACKAGE_ID,
      Version: version,
      Type: "Full",
      FileName,
      SHA256: createHash("sha256").update(pkg).digest("hex"),
      Size: pkg.length,
      ...(notes !== undefined ? { NotesMarkdown: notes } : {}),
    };
  });
  const feed = Buffer.from(JSON.stringify({ Assets: assets }));
  multipart.setup = {
    name: `${PACKAGE_ID}-win-Setup.exe`,
    mimeType: "application/octet-stream",
    buffer: Buffer.from("setup"),
  };
  multipart.feed = { name: "releases.win.json", mimeType: "application/json", buffer: feed };
  // WEB-35b: the signature is required; the site doesn't check it (the app does).
  multipart.signature = {
    name: "releases.win.json.sig",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("sig"),
  };
  const published = await request.post("/api/uploader/v1/releases", {
    headers: { authorization: `Bearer ${E2E.deploySecret}` },
    multipart,
  });
  return published.status();
}
