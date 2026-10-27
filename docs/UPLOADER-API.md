# Uploader API

The contract between this site and the Windows uploader ([CommunitiesForever-Upload](https://github.com/nicoputten/CommunitiesForever-Upload)). This repo owns it: WEB-33 built it, the uploader follows it.

Status: **v1, final** (WEB-33, 2026-10-27). From now on changes are **additive only** (new optional fields, new endpoints, new error or rejection codes the app treats as unknown); a breaking change gets `/v2/` and `v1` keeps working until every friend has updated (CLAUDE.md compatibility spirit). The examples below marked `<!-- example: … -->` are checked against the real routes by `tests/server/uploader.test.ts`: same keys, same value types.

## Principles
- The uploader never parses the addon file. Everything it shows about the content comes from these responses.
- One token per installed app ("device"), upload-only: it can upload, read its own identity and revoke itself (and, WEB-35, read the update feed). It cannot read the site's pages or data: the site accepts session cookies everywhere else and tokens only under `/api/uploader/v1/`.
- Uploads with a token go through exactly the same checks and storage as manual uploads (WEB-06: may upload, own file, same community). They show in the same history and get the same session report. The upload records which device sent it.
- **Several uploaders at once.** Friends' files arrive out of sync: each holds its owner's newest own data and older copies of everyone else's. The site merges per character GUID and the newest `updatedAt` wins (locations: newest `seenAt`), independent of upload order, so older data never overwrites newer. An upload's response describes only what *that* upload changed; one with nothing newer is `nothing_new`.
- Tokens are long random secrets, stored only as their SHA-256 on the site, shown once.
- All endpoints are under `/api/uploader/v1/`, JSON, HTTPS. Times are Unix seconds. Errors: `{ "error": "<code>", "message": "<text for logs>" }`; the app acts on `error` only.

<!-- example: error -->
```json
{ "error": "token_revoked", "message": "Unknown or revoked token." }
```

## Pairing (browser approval)
1. `POST /api/uploader/v1/pairings` (no auth), body `{ "deviceName": "DESKTOP-NICO", "appVersion": "1.0.0" }` (`deviceName` required, at most 64 characters; `appVersion` optional) → `201`:

   <!-- example: pairing-start -->
   ```json
   {
     "pairingId": "kq3V0dXyPZ8m1nR2c9WbTg",
     "userCode": "KXRT-7QMN",
     "verifyUrl": "https://wow.vestras.nl/uploader?code=KXRT-7QMN",
     "pollSeconds": 2,
     "expiresAt": 1793000600
   }
   ```
   - `pairingId` is random and unguessable: whoever polls it collects the token. Keep it in memory only.
   - The code has 8 characters from `ACDEFGHJKMNPQRTWXY34679` (no look-alikes), shown as `XXXX-XXXX`; the site also accepts it in lower case or without the dash. It expires after 10 minutes.
   - `400 bad_request` without a device name; `429 rate_limited` (with `Retry-After`) after 10 starts per 10 minutes per IP, or when 50 pairings are waiting.
2. The app opens `verifyUrl`. The signed-in user sees "Connect an uploader?" with the device name and the code, and Allow / Deny (WEB-34). Only someone who may upload can allow; at most 5 active uploaders per person.
3. `GET /api/uploader/v1/pairings/{pairingId}` (no auth), at most once per `pollSeconds`:
   - `202 { "status": "pending" }`
   - `200`, once: the token is made at this moment and never shown again.

     <!-- example: pairing-approved -->
     ```json
     { "status": "approved", "token": "cfu_3q2-7wEXAMPLEexampleEXAMPLEexampleEXAMPLExy", "battleTag": "Nico#2201", "siteName": "Doombringers" }
     ```
   - `403 { "status": "denied" }` (denied, or the user lost upload rights before the app collected the token)
   - `410 { "status": "expired" }`: expired, already collected, or an unknown id
   - `429 rate_limited` when polled faster than once a second

A token can also be created by hand on the uploader page ("Create a token by hand", WEB-34) and pasted into the app.

### Tokens
- Format: `cfu_` and 43 base64url characters (32 random bytes). Send as `Authorization: Bearer <token>`.
- No expiry. One per device: pairing the same device name again replaces the user's older token for it.
- Revoked by the user (uploader page), by the app (`DELETE /me`), or when the admin blocks the user (unblocking needs pairing again). A user who loses "may upload" keeps the token but gets `403 may_not_upload` until the right comes back.

## Uploading
`POST /api/uploader/v1/uploads` with `Authorization: Bearer <token>`, `Content-Type: application/octet-stream`, body = the raw `CommunitiesForever.lua` bytes (max 25 MiB). Optional headers: `X-Uploader-Version` (stored as the device's app version), `X-File-Saved-At` (Unix seconds of the file's write time; accepted and ignored in v1).

`200` for every stored upload, accepted or not:

<!-- example: upload-ok -->
```json
{
  "uploadId": 42,
  "uploadedAt": 1793000000,
  "status": "ok",
  "rejection": null,
  "schemaVersion": null,
  "summaryLine": "5 levels gained · 4 skill gains · 1 new character",
  "highlights": ["Ves Doombringer 37 → 39", "Ves Doombringer: Tailoring 150 → 187", "Zul Kazrek is new"],
  "counts": { "characters": 10, "friends": 5 },
  "reportUrl": "https://wow.vestras.nl/upload/42"
}
```

<!-- example: upload-rejected -->
```json
{
  "uploadId": 43,
  "uploadedAt": 1793000100,
  "status": "rejected",
  "rejection": "newer_format",
  "schemaVersion": 3,
  "summaryLine": "Newer addon: format 3",
  "highlights": [],
  "counts": null,
  "reportUrl": "https://wow.vestras.nl/upload/43"
}
```

- `status`: `ok` (something in it was newer), `nothing_new` (the same file again, or nothing in it newer than what the site has), `rejected`.
- `rejection` (only with `rejected`): `wrong_file` (another addon's file), `damaged`, `newer_format` (the site doesn't read this addon version yet; `schemaVersion` names it; retry after a site update), `not_your_file`, `other_community`, `no_community_yet` (before the admin's first upload). Treat an unknown code as "not uploaded".
- `summaryLine`: the line the upload history shows: up to three counts, "First upload · N characters", "Nothing new", or the short reason of a rejection.
- `highlights`: at most 3 lines about what changed (level ups, then skill gains, then new characters), full character names; `[]` for the first upload, `nothing_new` and rejections.
- `counts`: characters with a record in the uploaded file, and the friends who own them; `null` when the file can't be read.
- `reportUrl`: the session report (it also explains a rejection); opening it needs a sign-in.

Errors: `400 empty_file`, `401 token_revoked` (missing, unknown or revoked token: the app shows "Reconnect"), `403 may_not_upload` (the user lost upload rights), `413 too_large`, `429 rate_limited` with `Retry-After` (more than 60 uploads per hour per token).

## Identity and disconnect
- `GET /api/uploader/v1/me` (Bearer), "Test connection" in the app's settings. Errors as for uploads (`401`, `403`).

  <!-- example: me -->
  ```json
  { "battleTag": "Nico#2201", "siteName": "Doombringers", "deviceName": "DESKTOP-NICO", "appVersion": "1.0.0", "createdAt": 1793000000, "lastUploadAt": null }
  ```
  `appVersion` and `lastUploadAt` may be `null`.
- `DELETE /api/uploader/v1/me` (Bearer) → `204`: revokes this token ("Disconnect").

## Installer and updates (WEB-35)
- `GET /uploader/download`: the current installer, for signed-in users (the uploader page's "Download for Windows").
- `GET /api/uploader/v1/updates/<velopack feed files>` (Bearer): the Velopack update feed for the app.
- `POST /api/uploader/v1/releases` (deploy secret, used only by the uploader repo's release workflow): publishes a new installer and its update packages.

## On the site (WEB-34)
- Page `/uploader` (board `site-uploader-page`): what the app does, download, the three steps, the pairing approval when `?code=` is present, "Your uploaders" (device, connected date, last upload, active, Revoke), "Create a token by hand". Built on `src/server/uploader.ts` (`findPairing`, `decidePairing`, `createToken`, `activeTokens`, `revokeToken`); uploads store the device in `uploads.device_id` for the history's "via DESKTOP-NICO".
- The top bar's "Upload" becomes "Uploader"; the manual upload page stays and is reached by a small "Upload manually" link on the uploader page (decided with Nico).
