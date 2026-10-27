import { type APIRequestContext, expect } from "@playwright/test";

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
