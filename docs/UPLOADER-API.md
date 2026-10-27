# Uploader API

The contract between this site and the Windows uploader ([CommunitiesForever-Upload](https://github.com/nicoputten/CommunitiesForever-Upload)). This repo owns it: WEB-33 built it, the uploader follows it.

Status: **v1, final** (WEB-33, 2026-10-27; connecting and disconnecting moved to the OAuth 2.0 standards in WEB-33b before any release, decided with Nico). From now on changes are **additive only** (new optional fields, new endpoints, new error or rejection codes the app treats as unknown); a breaking change gets `/v2/` and `v1` keeps working until every friend has updated (CLAUDE.md compatibility spirit). The examples below marked `<!-- example: … -->` are checked against the real routes by `tests/server/uploader.test.ts`: same keys, same value types.

## Standards
The app is a **public OAuth 2.0 client** without a secret, `client_id=communitiesforever-uploader`, and uses a standard OAuth client library (on .NET: `Duende.IdentityModel`, `RequestDeviceAuthorizationAsync`, `RequestDeviceTokenAsync`, `RevokeTokenAsync`) rather than its own HTTP code for connecting:
- [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628) Device Authorization Grant: connecting through the browser.
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750) Bearer tokens: `Authorization: Bearer <access_token>` on every call.
- [RFC 7009](https://www.rfc-editor.org/rfc/rfc7009) Token revocation: "Disconnect".

The site implements these endpoints itself (small and tested; no OAuth server package fits Next.js route handlers, CLAUDE.md rule 9). There is no discovery document: the app knows the endpoint paths below.

## Principles
- The uploader never parses the addon file. Everything it shows about the content comes from these responses.
- One access token per installed app ("device"), upload-only: it can upload, read its own identity and revoke itself (and, WEB-35, read the update feed). It cannot read the site's pages or data: the site accepts session cookies everywhere else and tokens only under `/api/uploader/v1/`.
- Uploads with a token go through exactly the same checks and storage as manual uploads (WEB-06: may upload, own file, same community). They show in the same history and get the same session report. The upload records which device sent it.
- **Several uploaders at once.** Friends' files arrive out of sync: each holds its owner's newest own data and older copies of everyone else's. The site merges per character GUID and the newest `updatedAt` wins (locations: newest `seenAt`), independent of upload order, so older data never overwrites newer. An upload's response describes only what *that* upload changed; one with nothing newer is `nothing_new`.
- Access tokens are long random secrets, stored only as their SHA-256 on the site, handed out once. They don't expire; they are revoked (decided with Nico: no refresh tokens).
- All endpoints are under `/api/uploader/v1/`, HTTPS, answers in JSON with `Cache-Control: no-store` on errors and tokens. Requests to `device_authorization`, `token` and `revoke` are forms (`application/x-www-form-urlencoded`), as OAuth prescribes. Times are Unix seconds.
- Errors are OAuth style (RFC 6749 §5.2): `{ "error": "<code>", "error_description": "<text for logs>" }`; the app acts on `error` only.

<!-- example: error -->
```json
{ "error": "invalid_token", "error_description": "Unknown or revoked token." }
```

## Connecting (RFC 8628)
1. **Device authorization request.** `POST /api/uploader/v1/device_authorization` (no auth), form `client_id=communitiesforever-uploader&device_name=DESKTOP-NICO&app_version=1.0.0` (`device_name` required, at most 64 characters; `app_version` optional; both are our extensions) → `200`:

   <!-- example: device-authorization -->
   ```json
   {
     "device_code": "kq3V0dXyPZ8m1nR2c9WbTg",
     "user_code": "KXRT-7QMN",
     "verification_uri": "https://wow.vestras.nl/uploader",
     "verification_uri_complete": "https://wow.vestras.nl/uploader?code=KXRT-7QMN",
     "expires_in": 600,
     "interval": 5
   }
   ```
   - `device_code` is random and unguessable: whoever holds it collects the token. Keep it in memory only.
   - `user_code` has 8 characters from `ACDEFGHJKMNPQRTWXY34679` (no look-alikes), shown as `XXXX-XXXX`; the site also accepts it in lower case or without the dash.
   - Errors: `400 invalid_request` (not a form, no device name), `401 invalid_client` (wrong `client_id`), `429 rate_limited` with `Retry-After` (more than 10 per 10 minutes per IP, or 50 connections waiting).
2. **User approval.** The app opens `verification_uri_complete`. The signed-in user sees "Connect an uploader?" with the device name and the code, and Allow / Deny (WEB-34). Only someone who may upload can allow; at most 5 active uploaders per person.
3. **Device access token request.** `POST /api/uploader/v1/token` (no auth), form `grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=…&client_id=communitiesforever-uploader`, every `interval` seconds:
   - `200`, once: the token is made at this moment and never shown again.

     <!-- example: token -->
     ```json
     { "access_token": "cfu_3q2-7wEXAMPLEexampleEXAMPLEexampleEXAMPLExy", "token_type": "Bearer" }
     ```
   - `400` with `error`:
     - `authorization_pending`: not allowed yet, keep polling;
     - `slow_down`: polled faster than `interval`, add 5 seconds to it (RFC 8628 §3.5);
     - `access_denied`: denied, or the user lost upload rights before the app collected the token;
     - `expired_token`: expired, already collected, or an unknown `device_code`;
     - `unsupported_grant_type`, `invalid_request`.
   - `401 invalid_client`: wrong `client_id`.

   After `200` the app calls `GET /me` for the BattleTag and site name it shows.

A token can also be created by hand on the uploader page ("Create a token by hand", WEB-34) and pasted into the app.

### Access tokens
- Format: `cfu_` and 43 base64url characters (32 random bytes). Send as `Authorization: Bearer <access_token>` (RFC 6750 §2.1).
- No expiry, no refresh token. One per device: connecting the same device name again replaces the user's older token for it.
- Revoked by the user (uploader page), by the app (`/revoke`), or when the admin blocks the user (unblocking needs connecting again). A user who loses "may upload" keeps the token but gets `403 may_not_upload` until the right comes back.
- Bearer errors (RFC 6750 §3), on every Bearer endpoint:
  - no `Authorization: Bearer` header: `401 invalid_request` with `WWW-Authenticate: Bearer realm="uploader"`;
  - an unknown or revoked token: `401 invalid_token` with `WWW-Authenticate: Bearer realm="uploader", error="invalid_token"`. The app shows "Reconnect";
  - the user may not upload: `403 may_not_upload`.

## Uploading
`POST /api/uploader/v1/uploads` with `Authorization: Bearer <access_token>`, `Content-Type: application/octet-stream`, body = the raw `CommunitiesForever.lua` bytes (max 25 MiB). Optional headers: `X-Uploader-Version` (stored as the device's app version), `X-File-Saved-At` (Unix seconds of the file's write time; accepted and ignored in v1).

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

Errors: the Bearer errors above, `400 empty_file`, `413 too_large`, `429 rate_limited` with `Retry-After` (more than 60 uploads per hour per token).

## Identity
`GET /api/uploader/v1/me` (Bearer): "Test connection" in the app's settings, and the name and site it shows after connecting. Bearer errors as above.

<!-- example: me -->
```json
{ "battleTag": "Nico#2201", "siteName": "Doombringers", "deviceName": "DESKTOP-NICO", "appVersion": "1.0.0", "createdAt": 1793000000, "lastUploadAt": null }
```
`appVersion` and `lastUploadAt` may be `null`.

## Runs (WEB-44)
`GET /api/uploader/v1/runs` (Bearer, any active upload token): the upcoming runs the app writes into the game as `Interface\AddOns\CommunitiesForever\Data\Runs.lua` (UP-12). The answer is the addon's planned runs file `CF_RUNS` field for field (CommunitiesForever `docs/ARCHITECTURE.md` "Planned runs file"), so the app only turns it into Lua data: every string escaped and length-capped, never code.

<!-- example: runs -->
```json
{
  "v": 1,
  "updatedAt": 1793120000,
  "reminderMinutes": 30,
  "received": ["k3f9c0a7e21b-1793120000-1"],
  "runs": [
    {
      "id": "r-102",
      "dungeon": "smarm",
      "dungeonName": "Scarlet Monastery: Armory",
      "startsAt": 1793210400,
      "state": "open",
      "source": "site",
      "note": "Bring water",
      "url": "https://wow.vestras.nl/runs/102",
      "organiser": { "battleTag": "Nico#2201", "guid": "Player-1-0000A001", "name": "Ves Doombringer", "utcOffset": 3600 },
      "answers": [
        { "battleTag": "Nico#2201", "guid": "Player-1-0000A001", "name": "Ves Doombringer", "answer": "in", "role": "dps", "source": "site", "at": 1793100000, "fit": "fits" }
      ]
    }
  ]
}
```
- Which runs: those starting within 14 days and not yet past (2 hours after start), at most 50, by start. A cancelled run stays, as `"cancelled"`, until its start, so the game can say it was cancelled (decided with Nico, 2026-10-27).
- `updatedAt`: when the list last changed (a run planned, answered, edited or cancelled; one coming into the 14 days, starting or leaving). Asking again without a change gives the same value, so the app writes the file only when something changed.
- `dungeon`: the addon's dungeon id (`smarm`, `lbrs`, `lfg1984` for a Forever dungeon the Group Finder lists); for a dungeon the addon has no id for, the site's id. `dungeonName` (optional for the addon) names it either way.
- `state`: `open`, `full`, `started` or `cancelled`. `source` and an answer's `source`: `site`, `discord` or `game`. `role`: `tank`, `heal` or `dps` (the slot the site gave it). `answers`: one per friend, oldest first, at most 40. `note` is optional; `guid` and `name` are missing for a friend who answered without a character (Maybe or Can't). `organiser.utcOffset`: seconds east of UTC in the organiser's own time zone at the start ("20:30 for Nico").
- `received` (WEB-43, addon CF-47): ids of the token owner's own items from the game (runs planned, answers, asks, pings in their saved file's `pending`) that the site has, newest first, at most 200. The addon forgets them; until then it sends them again, which changes nothing.
- WEB-47 (optional, within v1): an answer's `fit` is how the character's level fits the run ("fits", "+3 over", "carry · +12", "4 below"; one rule, `levelFit`), and `reserve: true` marks an I'm in that waits for a full role. A reserve is sent as `"answer": "maybe"`, so older addons, which read only `in`, `maybe` and `cant`, show it as Maybe. `role` is the role chosen for that run (`tank`, `heal`, `dps`), no longer always the character's.
- Bearer errors as above. Additive within v1: the app writes the fields the addon knows and may drop the rest.

## Disconnecting (RFC 7009)
`POST /api/uploader/v1/revoke` (no auth: holding the token is the proof), form `token=<access_token>&token_type_hint=access_token&client_id=communitiesforever-uploader` → `200` with an empty body, also for an unknown or already revoked token. Errors: `400 invalid_request` (no token), `401 invalid_client`.

## Installer and updates (WEB-35)
The repos are private, so the site hosts the app. Velopack (`vpk pack`) makes the files. Since WEB-35b the release workflow owns the feed, the Velopack way: it pulls the site's feed and newest full package, packs (so Velopack builds the delta and the whole feed), signs the feed and publishes. The site keeps the feed and its signature byte for byte, exactly the packages the feed lists, and the newest installer, in `DATA_DIR/uploader/releases/`.

- **Update feed.** `GET /api/uploader/v1/updates/<file>` (Bearer: any active access token, also one whose user may no longer upload). The app points Velopack's `SimpleWebSource` at `https://wow.vestras.nl/api/uploader/v1/updates/` (channel `win`) with an `IFileDownloader` that adds the `Authorization` header. Files: `releases.win.json` (`Cache-Control: no-store`; query parameters such as `?localVersion=` are ignored), its signature `releases.win.json.sig` (WEB-35b; `no-store`; DER ECDSA P-256 / SHA-256 over the feed's exact bytes, checked by the app with the key it ships, UP-10) and the packages the feed lists (`*-full.nupkg`, `*-delta.nupkg`; immutable). Both are served exactly as the workflow sent them. Anything else: `404 not_found`. Bearer errors as above.
- **Update status** (WEB-35b, UP-10). `GET /api/uploader/v1/updates/status` (Bearer: any active access token, like the feed; `no-store`): `{ "latest": "1.1.0", "releasedAt": 1793000000, "minimumVersion": null, "notesUrl": null }`. `latest` and `releasedAt` (Unix seconds) are the newest publish. `minimumVersion` is the oldest uploader the site still accepts (`UPLOADER_MINIMUM_VERSION`, X.Y.Z; `null` when unset): an older app holds its uploads and asks to update. Raise it only when an old uploader really can't talk to the site any more. `notesUrl` is `null` until the site has a "What's new" page. `404 not_found` before the first release.
- **Download.** `GET /uploader/download`: the newest installer as `CommunitiesForever-Uploader-Setup.exe`, for signed-in users who may upload (the uploader page's "Download for Windows"); `404` for others and before the first release.
- **Publish.** `POST /api/uploader/v1/releases` with `Authorization: Bearer <UPLOADER_DEPLOY_SECRET>`, used only by the uploader repo's release workflow: `multipart/form-data` with one file part per file (any field name), from `vpk pack`'s output folder: one `*-Setup.exe`, `releases.win.json`, `releases.win.json.sig` (required since WEB-35b) and the packages of the new version (its `*-full.nupkg`, and a `*-delta.nupkg` if made). At most 8 files and 500 MB; nginx allows 200 MB per request (the app is self-contained since UP-10, about 125 MB per publish). A bigger release gets `413` from nginx; raise `client_max_body_size` then. Example with curl: `curl -fsS -H "Authorization: Bearer $SECRET" -F f1=@Releases/CommunitiesForever.Upload-win-Setup.exe -F f2=@Releases/CommunitiesForever.Upload-1.1.0-full.nupkg -F f3=@Releases/CommunitiesForever.Upload-1.1.0-delta.nupkg -F f4=@Releases/releases.win.json -F f5=@Releases/releases.win.json.sig https://wow.vestras.nl/api/uploader/v1/releases`.
  - The newest version in `releases.win.json` is the new release; each of its packages must arrive with the size and SHA256 the feed names. The feed is the whole feed: every older package it lists must already be on the site with the same size and SHA256 (the workflow pulled them, see below). The site keeps exactly the packages the feed lists and deletes the others, so the workflow decides how many versions stay (it keeps 3). The site doesn't check the signature (it has no key); the app does.
  - **Pull before pack.** `GET /api/uploader/v1/releases/<file>` with the same deploy secret serves the files of the update feed read only (`releases.win.json`, its signature, the packages it lists; `no-store`), because `vpk download http` can't send a Bearer token. `404 not_found` before the first release (nothing to pull) and for any other name; `404` without a configured secret; `401 invalid_token` for a wrong one.
  - `201`:

    <!-- example: release -->
    ```json
    { "version": "1.0.0", "setup": "CommunitiesForever.Upload-win-Setup.exe", "size": 67108864, "publishedAt": 1793000000 }
    ```
  - Errors: `401 invalid_token` (wrong secret), `400 invalid_release` (a file that isn't one of these, a package missing or not matching the feed, an older package the site doesn't have or has with another SHA256, no installer, no signature, not a form), `409 not_newer` (the version is not newer than the current one), `413 too_large`. Nothing changes on an error. `404` when the site has no deploy secret configured.

## On the site (WEB-34)
- Page `/uploader` (board `site-uploader-page`): what the app does, download, the three steps, the approval when `?code=` is present, "Your uploaders" (device, connected date, last upload, active, Revoke), "Create a token by hand". Built on `src/server/uploader.ts` (`findPairing`, `decidePairing`, `createToken`, `activeTokens`, `revokeToken`); uploads store the device in `uploads.device_id` for the history's "via DESKTOP-NICO".
- The top bar's "Upload" becomes "Uploader"; the manual upload page stays and is reached by a small "Upload manually" link on the uploader page (decided with Nico).
