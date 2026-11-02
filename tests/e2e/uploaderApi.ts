import { createHash } from "node:crypto";
import { type APIRequestContext, type APIResponse, expect } from "@playwright/test";

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

const busy = async (response: APIResponse) =>
  response.status() === 400 &&
  ((await response.json()) as { error_description?: string }).error_description === "Another publish is running.";

/** A made-up release of the app: its version and the notes the release workflow puts in the feed (WEB-73). */
export interface TestRelease {
  version: string;
  notes?: string;
}

/**
 * Publishes `releases` in order, as the release workflow would (WEB-35): each feed lists every version so far, the
 * packages already on the site are not sent again. Returns each publish's status (201, or 409 when it isn't newer).
 */
export async function publishReleases(
  request: APIRequestContext,
  deploySecret: string,
  releases: readonly TestRelease[],
): Promise<number[]> {
  const assets: Record<string, unknown>[] = [];
  const statuses: number[] = [];
  for (const { version, notes } of releases) {
    const fileName = `${PACKAGE_ID}-${version}-full.nupkg`;
    const pkg = Buffer.from(`package ${version}`);
    assets.push({
      PackageId: PACKAGE_ID,
      Version: version,
      Type: "Full",
      FileName: fileName,
      SHA256: createHash("sha256").update(pkg).digest("hex"),
      Size: pkg.length,
      ...(notes !== undefined ? { NotesMarkdown: notes } : {}),
    });
    const send = () =>
      request.post("/api/uploader/v1/releases", {
        headers: { authorization: `Bearer ${deploySecret}` },
        multipart: {
          setup: {
            name: `${PACKAGE_ID}-win-Setup.exe`,
            mimeType: "application/octet-stream",
            buffer: Buffer.from("setup"),
          },
          full: { name: fileName, mimeType: "application/octet-stream", buffer: pkg },
          feed: {
            name: "releases.win.json",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify({ Assets: assets })),
          },
          // WEB-35b: the signature is required; the site doesn't check it (the app does).
          signature: {
            name: "releases.win.json.sig",
            mimeType: "application/octet-stream",
            buffer: Buffer.from("sig"),
          },
        },
      });
    // One publish at a time on the site: another test's publish answers 400 "Another publish is running".
    let response = await send();
    for (let tries = 0; tries < 20 && (await busy(response)); tries++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      response = await send();
    }
    statuses.push(response.status());
  }
  return statuses;
}
