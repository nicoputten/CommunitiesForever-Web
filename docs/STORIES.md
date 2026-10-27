# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order: WEB-06, WEB-15, WEB-30, WEB-16, WEB-07, then the screens WEB-17..29 in number order, then the uploader's server side WEB-33, WEB-34, WEB-35, then WEB-36 (favicons). WEB-12 was replaced by WEB-33..35 and the uploader repo (2026-10-27).
WEB-08..11 (the first rough view stories) were replaced by WEB-15..29 after the design workshop.

## Every UI story
- Build the screen in our Next.js app with the tokens from `src/styles/tokens.css` and real data through the view models. The board in `design/boards/` is a **visual reference only**: match its spacing, type and colours, never copy its markup or runtime.
- Always the design system (CLAUDE.md rules 11 and 12): no raw values outside the tokens, design system components first. A deviation only after Nico said so, recorded in `docs/DESIGN.md` "Deviations".
- The screen gets its design checks (WEB-30): computed-style checks for its key elements, accessibility scan, screenshot baselines at desktop and phone size.
- Accessible: semantic HTML, visible focus states, keyboard use, 44 px touch targets, contrast as in `docs/DESIGN.md`, `prefers-reduced-motion` honoured.
- Works at 375 px (phone) and 1440 px (desktop canvas); page max-width 1280.
- Empty, loading and error states of the screen are part of the story.
- Playwright test for the main flow at desktop and phone size; screenshots of both in the PR next to the board.

## E3 Access and hosting

## E4 Design foundations

## E5 Screens

### WEB-28 Phone map
- Boards: `phone-map`, `phone-character`, `phone-roll-call`. Bottom sheet: peek → half → full (built without `vaul`, see `docs/ARCHITECTURE.md`).
- Peek: the first roll call rows; edge hint "4 in Kalimdor". Tapping a marker zooms in and opens the character half sheet (level, seen, player, item level, role, spec, talents, professions, "Open character", next character in the zone). The full sheet is the roll call with its filters.
- Bug (found in WEB-27, Nico 2026-10-27): on a phone, `?continent=eastern-kingdoms` framed the continent and sprang back to the whole world about 120 ms later. Fixed: a continent frames at 1.25× at least and the phone map fills the screen (`map-continent-phone` shows the continent again).
- Decided with Nico (2026-10-27, all 12 proposals): the sheet below 1024 px; snap points 136 / 400 px above the tab bar and 96 px from the top; full names in the peek and the next button; `?character=` as a history entry (Back closes); the WEB-27 filters in the full sheet; the approved phone app bar plus Filters; the edge hint on either side; 120 ms fade without motion. Deviations in `docs/DESIGN.md` §11.

## E6 Later

### WEB-33 Uploader API
- Goal: the server side of the Windows uploader (repo `CommunitiesForever-Upload`), as `docs/UPLOADER-API.md` describes. Finalise that contract in this story (it is a draft) and keep it in sync.
- Pairing: start (device name, app version), short user code without look-alike characters, 10-minute expiry, poll (pending, approved with the token once, denied, expired), rate limit per IP.
- Upload tokens: one per device, upload-only, long random secret stored hashed; created by pairing approval or by hand; revoked by the user, by the app ("Disconnect") or when the user is blocked. A new Drizzle migration (forward-only, rule 5).
- `POST /api/uploader/v1/uploads` with a Bearer token, raw bytes: the same checks and storage as manual uploads (WEB-06, WEB-19), plus `summaryLine`, `highlights`, `counts` and `reportUrl` for the app (from the WEB-14/20 report view models). `401 token_revoked`, `403 may_not_upload`, `413`, `429`.
- `GET` and `DELETE /api/uploader/v1/me`.
- Uploads made with a token record which device sent them (`uploads.device_id`); WEB-34 shows it in the history ("via DESKTOP-NICO").
- Several uploaders at once (Nico, 2026-10-27): files arrive out of sync; only newer data changes the state, in any order, and the response names only what that upload changed (`nothing_new` otherwise). Server tests with three uploaders in every order.
- Tests: unit tests for codes, tokens and hashing; route tests for every status code; a contract test that checks responses against `docs/UPLOADER-API.md` examples.
- The uploader repo builds against this; changes to the contract are additive (new optional fields) once v1 is released.
- WEB-33b (Nico, 2026-10-27): connecting and disconnecting follow the OAuth 2.0 standards so the app can use a standard OAuth client library: RFC 8628 device flow (`device_authorization`, `token` with `authorization_pending` / `slow_down` / `access_denied` / `expired_token`), RFC 6750 Bearer errors with `WWW-Authenticate`, RFC 7009 `revoke` instead of `DELETE /me`, OAuth-style `{ error, error_description }`. Long-lived access tokens without refresh tokens. Changed in place in v1: nothing was released yet.
- Decided with Nico (2026-10-27, all 16 proposals): the app's own response shape and snake_case codes; `cfu_` tokens stored as SHA-256, max 5 per person; 8-character codes; in-memory rate limits; `tokenGuard`; the pairing approval UI and "via" in WEB-34 on top of `src/server/uploader.ts`; CLAUDE.md rule 6 names the uploader API; the contract is v1 final.

### WEB-34 Uploader page
- Board `uploader-page` (copied from the uploader repo). Page `/uploader` for everyone who may upload.
- Intro, "Download for Windows" (WEB-35) with version and size, the three steps, "Your uploaders" (device, connected, last upload, active, Revoke), "Create a token by hand" (shown once, copy button), the note that uploader uploads count like manual ones.
- Pairing approval: with `?code=` the page shows "Connect an uploader?" with the device name and code, Allow / Deny; a wrong or expired code says so.
- Top bar: "Upload" becomes "Uploader". The manual upload page stays and is reached by a small "Upload manually" link on the uploader page (decided with Nico).
- Every UI story criteria, design checks.
- Decided with Nico (2026-10-27, all 13 proposals; 3 became WEB-33b, the OAuth 2.0 device flow): Allow / Deny as server actions that redirect to `?notice=` (allowed, denied, bad-code, too-many, too-many-tries); no field to type a code; 10 wrong codes per 10 minutes per user (links opened count too); "● active" = used in the last 7 days; one device icon; Revoke asks inline; a token by hand needs a name and lives only in the form's state; "via" in both history lists; the download button disabled until WEB-35. Deviations in `docs/DESIGN.md` §11.
- "Upload history" (Nico, 2026-10-27, board `uploader-page` revised with it; all 5 proposals): the viewer's own uploads, app and manual, by Today / This week / Earlier; filters All, each device, Manual, Problems (`?show=`); pills from the summary line; Done, Nothing new, Rejected; 20 at a time with "Show older uploads" (`?older=`); every row opens its report.

### WEB-35 Installer hosting and update feed
- The repos are private, so the site hosts the uploader: `/uploader/download` (signed-in users) and the Velopack update feed for the app (Bearer token), from a folder on the data volume (`/data/uploader`).
- `POST /api/uploader/v1/releases` with a deploy secret (env var), used by the uploader repo's release workflow to publish a new version (installer, packages, feed files). Only the newest few versions are kept.
- Tests for access (no download without sign-in, no feed without a valid token, no publish without the secret).
- Manual: set the deploy secret in the TrueNAS app config and as a GitHub secret in the uploader repo.
- Decided with Nico (2026-10-27, all 12 proposals): files in `DATA_DIR/uploader/`; one multipart publish streamed to disk and checked against the feed (size, SHA256, newer version, else 409), switched in with the feed and `current.json` last; `UPLOADER_DEPLOY_SECRET` (off without it); full packages first, deltas accepted; newest 3 versions kept; the feed for any active token, file names only from the feed; the download for those who may upload; "Download for Windows" with version and size once released. nginx stays at 30 MB: a publish must fit (Nico: the app is small).

### WEB-36 Favicons and app icons
- Nico's icon set (2026-10-27) is in `design/favicons/` (originals, unchanged): `favicon.ico`, `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, a `site.webmanifest` and `favicon-preview.png` (the preview, not shipped).
- Wire them up the Next.js App Router way: `src/app/favicon.ico`, `icon.svg`, `apple-icon.png` (from `apple-touch-icon.png`), and the PNGs for the manifest. Browsers, iOS home screen and Android get the right one.
- The web app manifest is generated by `src/app/manifest.ts`, not the static file: its `name` and `short_name` come from the site name in the data (CLAUDE.md rule 11: the site name is never hardcoded), falling back to "CommunitiesForever". Colours from the tokens (`--bg-night`), icons as in the supplied manifest, the maskable one marked `maskable`.
- The shield emblem: the same mark as the top bar's brand? If they differ, ask Nico which one is the final emblem (`docs/DESIGN.md` §10 open item).
- Tests: the icon routes answer (200, right type), the manifest has the data's site name. Manual: the tab icon in Chrome and Firefox, "Add to home screen" on a phone.

### WEB-32 Known bugs
- **On hold** until Nico has tested everything (decided 2026-10-27).
One story for the known bugs, fixed together (Nico, 2026-10-27). Add each one here with where it shows; each fix gets a test.

### Backlog (unordered, not yet stories)
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
