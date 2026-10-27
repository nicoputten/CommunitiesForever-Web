# Uploader API

The contract between this site and the Windows uploader ([CommunitiesForever-Upload](https://github.com/nicoputten/CommunitiesForever-Upload)). This repo owns it: WEB-33 builds it, the uploader follows it. Changes are additive within `v1` (new optional fields, new endpoints); a breaking change gets a new version and the old one keeps working until every friend has updated (CLAUDE.md compatibility spirit).

Status: **draft**, finalised in WEB-33. Field names below are the intent; WEB-33 may refine them with Nico's OK and updates this file in the same PR.

## Principles
- The uploader never parses the addon file. Everything it shows about the content comes from these responses.
- One token per installed app ("device"), upload-only: it can upload, read its own identity, revoke itself and read the update feed. It cannot read the site's pages or data.
- Uploads with a token go through exactly the same checks and storage as manual uploads (WEB-06: may upload, own file, same community). They show in the same history and get the same session report.
- Tokens are long random secrets, stored only hashed on the site; shown once.
- All endpoints are under `/api/uploader/v1/`, JSON, HTTPS. Errors: `{ "error": "<code>", "message": "<text for logs>" }`.

## Pairing (browser approval, board `site-uploader-page` and the app's `setup`)
1. `POST /api/uploader/v1/pairings` (no auth), body `{ "deviceName": "DESKTOP-NICO", "appVersion": "1.0.0" }` →
   `201 { "pairingId", "userCode": "KXRT-7Q2M", "verifyUrl": "https://wow.vestras.nl/uploader?code=KXRT-7Q2M", "pollSeconds": 2, "expiresAt" }`.
   Rate-limited per IP; codes expire after 10 minutes; codes avoid look-alike characters.
2. The app opens `verifyUrl`. The signed-in user sees "Connect an uploader?" with the device name and the code, and Allow / Deny. Only someone who may upload can allow.
3. `GET /api/uploader/v1/pairings/{pairingId}` (no auth) →
   - `202 { "status": "pending" }`
   - `200 { "status": "approved", "token": "<shown once>", "battleTag": "Nico#2201", "siteName": "Doombringers" }` (the token is handed out once; later polls return `410`)
   - `403 { "status": "denied" }`, `410 { "status": "expired" }`

A token can also be created by hand on the uploader page ("Create a token by hand") and pasted into the app.

## Uploading
`POST /api/uploader/v1/uploads` with `Authorization: Bearer <token>`, `Content-Type: application/octet-stream`, body = the raw `CommunitiesForever.lua` bytes (max 25 MiB, `MAX_UPLOAD_BYTES`), headers `X-Uploader-Version`, `X-File-Saved-At` (Unix seconds, the file's write time) →
- `200` with the same upload result the site's upload page gets (WEB-19/20), plus for the app:
  `{ "uploadId", "status": "ok" | "nothing_new" | "rejected", "rejection": "<code>" | null, "summaryLine": "5 levels gained · 4 skill gains · 1 new character", "highlights": ["Ves 37 → 39", "Tailoring 150 → 187", "Zul Kazrek is new"], "counts": { "characters": 10, "friends": 5 }, "reportUrl": "https://wow.vestras.nl/upload/42" }`.
  Rejection codes are the upload page's: `not_ours` (wrong file), `newer_format`, `not_your_file`, `other_community`, `no_community_yet`, `damaged`.
- `401 { "error": "token_revoked" }` (revoked or unknown token): the app shows "Reconnect".
- `403 { "error": "may_not_upload" }` (the user lost upload rights or was blocked).
- `413 { "error": "too_large" }`, `429 { "error": "rate_limited" }` with `Retry-After`.

## Identity and disconnect
- `GET /api/uploader/v1/me` (Bearer) → `{ "battleTag", "siteName", "deviceName", "createdAt", "lastUploadAt" }` ("Test connection" in the app's settings).
- `DELETE /api/uploader/v1/me` (Bearer) → `204`: revokes this token ("Disconnect").

## Installer and updates (WEB-35)
- `GET /uploader/download`: the current installer, for signed-in users (the uploader page's "Download for Windows").
- `GET /api/uploader/v1/updates/<velopack feed files>` (Bearer): the Velopack update feed for the app.
- `POST /api/uploader/v1/releases` (deploy secret, used only by the uploader repo's release workflow): publishes a new installer and its update packages.

## On the site (WEB-34)
- Page `/uploader` (board `site-uploader-page`): what the app does, download, the three steps, the pairing approval when `?code=` is present, "Your uploaders" (device, connected date, last upload, active, Revoke), "Create a token by hand".
- The top bar's "Upload" becomes "Uploader"; the manual upload page stays and is reached by a small "Upload manually" link on the uploader page (decided with Nico).
