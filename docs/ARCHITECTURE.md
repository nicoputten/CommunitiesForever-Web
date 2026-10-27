# Architecture

## Core rules
- Raw uploads are the source of truth. Everything shown is derived from them and can be rebuilt (`rebuild` after a parser or merge fix), so no upload is ever lost to a bug.
- Uploaders: Nico (admin) and every member of his in-game community; viewers also include guests from the admin's guest list. Everyone signs in with Battle.net (see Access).
- The site never talks to the game or to Blizzard's game data APIs; it only shows what the addon recorded.
- Desktop first, fully usable on a phone (responsive, touch-friendly map).
- The look is fixed by the design workshop: `docs/DESIGN.md` (decisions, tokens) and `design/boards/` (visual references).

## Stack
| Part | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | |
| Framework | Next.js (App Router), React | React is known; one app for UI and API; standalone output runs in a small container |
| Auth | Auth.js (`next-auth` v5) with the Battle.net provider, JWT sessions | built-in provider, gives the BattleTag |
| Database | SQLite via `better-sqlite3` (+ `@types/better-sqlite3`), Drizzle ORM, `drizzle-kit` migrations | one file on a TrueNAS dataset, easy backup through snapshots |
| Tests | Vitest (unit, compat), Playwright (end to end, design checks: WEB-30), `@axe-core/playwright` (accessibility, WEB-30) | |
| Lint/format | ESLint, Prettier | |
| Runtime | Node.js LTS, Docker image on GHCR | |
| Styling | CSS custom properties (`src/styles/tokens.css`) + CSS Modules | tokens from `docs/DESIGN.md`; no runtime CSS-in-JS |
| Fonts | `next/font/google`: Marcellus SC, Marcellus, Inter | self-hosted at build, no layout shift |
| Map | inline SVG rendered on the server from `src/core/map/zones.json`, HTML overlay for markers | no tiles, no WebGL |
| Pan, zoom, pinch | `react-zoom-pan-pinch` | map (WEB-26) |
| Popovers | `@floating-ui/react` | marker cards, filter menus |
| Bottom sheet | own component (`BottomSheet`), no library | phone map (WEB-28): `vaul` was approved but not used, its Drawer always opens Radix's modal Dialog (hides the page from screen readers, traps focus, blocks the map), also with `modal={false}` |
| Motion | CSS keyframes and transitions; `motion` only if the sheet drag or cluster fan need physics (ask first) | |

Every dependency beyond this list needs Nico's OK (CLAUDE.md rule 9).

Version pins and known deprecations (WEB-01, reviewed in WEB-37 on 2026-10-27). Dependabot (`.github/dependabot.yml`) opens a weekly PR with the minor and patch updates of npm and GitHub Actions, and one per major; CI's job summary lists npm's deprecation warnings. What stays behind, and when it can go:
- TypeScript `~6.0`: `typescript-eslint` (via `eslint-config-next`) supports TypeScript below 6.1 (8.72 still says `<6.1.0`). Dependabot ignores its minors and majors; lift when `typescript-eslint` allows 7.
- ESLint `^9` (npm says 9.x is "no longer supported"): `eslint-plugin-react` 7.37 (in `eslint-config-next` 16.4) allows ESLint 9 at most. Dependabot ignores its majors; lift when the plugin allows 10.
- `@esbuild-kit/core-utils` and `@esbuild-kit/esm-loader` (deprecated, "merged into tsx"; `npm audit` reports their old esbuild, moderate): from `drizzle-kit` 0.31.11, the latest stable. Dev only, used by `npm run db:generate` on a developer's machine, never in the image. drizzle-kit 1.0 (release candidates now) drops them but needs drizzle-orm 1.0; move to both once 1.0 is stable.
- `@types/node` `^24`: follows the Node LTS of `.nvmrc`; Dependabot ignores its majors. Raise with `.nvmrc` and the Docker base image.
- `@playwright/test` and `better-sqlite3`: Dependabot leaves them alone. Playwright is bumped by hand together with the design job's image tag (`.github/workflows/ci.yml`); better-sqlite3 by hand with `npm install-scripts approve better-sqlite3` (the approval names the exact version).
npm's install-script allow-list (`allowScripts` in `package.json`): `unrs-resolver` denied (its postinstall only fetches a fallback binary); `better-sqlite3` approved (WEB-05: builds or fetches its native binding; npm pins the approved version, so an upgrade needs `npm install-scripts approve better-sqlite3` again). `esbuild` (via `drizzle-kit`) is left unapproved: its postinstall only checks the platform binary, which `drizzle-kit generate` does not need.
Type packages: `@types/better-sqlite3` (dev, WEB-05; the package ships no types).
`next-auth` is pinned exactly at `5.0.0-beta.32` (WEB-06): v5 is the App Router version of Auth.js (`AUTH_*` variables, `auth()`, proxy support) and has stayed on the `beta` tag; the stable 4.x line is the Pages Router API. An upgrade is a deliberate bump with the e2e sign-in test. It adds no install scripts.
Locally on Windows without Visual Studio, `npm ci --ignore-scripts` is needed: npm runs `node-gyp rebuild` for the approved `better-sqlite3`, which fails there, while the package ships prebuilt binaries in `prebuilds/` that it loads anyway.

## Layering
```
src/core/          pure TS: Lua literal parser, schema normalize, merge, diff, view models, access rules
src/core/gamedata/ sourced game data tables: classes, races, professions, rulesets, dungeons, levels, zone aliases (WEB-13)
src/core/views/    view models (WEB-14): data age, site name, roll call, roster, character, professions, session report
src/core/map/      zones.json (built by tools/map, CC BY-SA 4.0) and map helpers
src/server/        database (Drizzle schema, migrations, queries), upload service, auth config
src/app/           Next.js routes: pages (React) and route handlers (API)
src/proxy.ts       Next.js proxy: a session and a role for every route (WEB-06)
src/components/    React UI components (CSS Modules)
src/styles/        tokens.css, global styles
design/            Claude Design board exports: visual reference only, never imported (design/README.md)
tools/map/         build_zones.py and its source SVGs: rebuilds src/core/map/zones.json
tests/             unit (core), compat (addon fixtures), server (temporary SQLite), e2e (Playwright)
                   e2e runs on a fresh database: `empty` checks first, then `seed` uploads the sample (WEB-21)
                   fixtures/sample: SavedVariables files to upload by hand (README there)
```
- `core` imports nothing from the other layers (enforced by ESLint `no-restricted-imports`).
- `server` calls `core`; pages and route handlers call `server`. Components get view models as props and never touch the database.

## Data flow
```
upload (.lua) ──▶ store raw (gzip, sha256) ──▶ core.parseLua ──▶ core.normalize(schemaVersion)
                                                                      │
              pages ◀── core.viewModels ◀── derived tables ◀── core.merge(current, upload)
```
1. **Parse:** our own parser for the Lua value subset SavedVariables uses (tables, strings, numbers, booleans, nil). Limits: 25 MiB file (`MAX_UPLOAD_BYTES` in `src/core/views/upload.ts`; larger uploads are refused and not stored, and the upload page checks it before sending), nesting depth 32, string length 64 Ki. No code execution.
2. **Normalize** (`src/core/normalize.ts`): reads `CommunitiesForeverDB.global` per its `schemaVersion` into one internal shape (`src/core/model.ts`, `docs/SOURCE-DATA.md`). A schema newer than the site knows is rejected with "update the site" (nothing is half-read). Friends known only through Battle.net presence become people without a record (`hasRecord: false`) whose GUIDs are character stubs (guid and owner only); a GUID seen only in `locations` is a stub without owner. A presence link decides a character's owner over the record that lists it (addon rule).
3. **Merge** (`src/core/merge.ts`): order-independent (`merge(a, b)` equals `merge(b, a)`). Per character GUID a record beats a stub and the copy with the highest `updatedAt` wins (same rule as the addon's `Merge.lua`). Locations: highest `seenAt` wins; presence: highest `lastSeen`. A character the addon lists under `removed` is hidden unless newer than the removal. The uploader's own record is the truth for their characters: one a newer own record no longer lists is removed at that record's `version`. Person fields come from the newer record.
4. **Sanitize** (`src/core/sanitize.ts`): every string loses WoW escape sequences (whole sequences: `|c...`, `|r`, `|T...|t`, `|H...|h` keeps the link text, `||` becomes `|`, any other `|` is removed); display names: own display name > BattleTag name part, capped at 24 characters (same as the addon).

## Storage
Schema: `src/server/db/schema.ts`; service: `src/server/uploads.ts` (WEB-05).
- `uploads`: id, uploadedAt, uploadedBy (the signed-in BattleTag), sha256, size, raw (gzip blob), schemaVersion, community (the file's `settings.clubId`), status (ok / rejected + reason), rejection (`not-your-file`, `other-community`, `no-community-yet`; null for unreadable files), unreadable (`not-ledger`, `damaged`, `newer-format`: why a file could not be read, WEB-19; null for readable files), summary (JSON: what the upload changed, `src/core/diff.ts`). The same file again from the same uploader (sha256 + uploadedBy, WEB-06) is a no-op that returns the earlier result, except after a community rejection, which depends on the admin's uploads: then the new attempt replaces the earlier one and is checked again.
- Derived (rebuildable, rewritten in the upload's transaction): `people` (key, data JSON), `characters` (GUID key, owner, updatedAt, source upload, via, data JSON), `locations` (GUID, zone, seenAt, source upload), `presence` (GUID, BattleTag, lastSeen), `meta` (one row: schemaVersion, version, uploader, community). Together they are the merged `Dataset`.
- `members` (WEB-06, derived): key, BattleTag, first upload that named it. Every BattleTag of an accepted upload (`self`, `people`, `presence`); rewritten with the upload and by `rebuild()`.
- Kept by the admin page, never derived: `guests` (key, BattleTag, may upload, added at, added by) and `blocks` (key, BattleTag, blocked at, blocked by). `rebuild()` does not touch them, so it never lifts a block. Keys are the BattleTag in lower case (`battleTagKey`): BattleTags are compared without case.
- `uploader_tokens` and `uploader_pairings` (WEB-33, `src/server/uploader.ts`): device tokens (owner, device name, app version, token SHA-256, pairing or by hand, created / last used / last upload / revoked at; revoked ones are kept so history can name the device) and short-lived pairings (code, device, status, who decided, expiry; expired ones are deleted when a new one starts). `uploads.device_id`: the token that sent an upload, null from the upload page. Not derived.
- `bot_tokens` and `bot_events` (WEB-38, `src/server/bot.ts`, contract `docs/BOT-API.md`): the Discord bot's token (SHA-256 only, one active, made and revoked by the admin, revoked ones kept) and what the bot posts (type, JSON payload, created at, the upload that made it, posted at and the Discord message id). Events are written in the transaction of an accepted upload and are not derived: a rebuild never makes or removes them, so nothing is posted twice.
- The bot's Discord server (WEB-46, `src/server/guild.ts`), not derived: `guild_items` (kind channel or role, Discord id, name, position in the report, present) and `guild_reports` (one row: when the bot last reported). A report replaces the lists; items gone from it stay, marked not present, only while a setting of the Discord page names them.
- Discord (WEB-39, `src/server/discord.ts`), not derived: `discord_links` (key, BattleTag, Discord user id (unique), Discord username, linked at; no Discord token is ever stored), `user_prefs` (key, BattleTag, IANA time zone, set from the browser or picked, updated at) and `bot_settings` (one row: what the bot posts and where, the recap day and time in the admin's time zone, reminders, ask now, mark done; defaults in `src/core/discord.ts` until the admin changes something). The bot token is WEB-38's.
- Runs (WEB-40, `src/server/runs.ts`), not derived: `runs` (dungeon or Scarlet Monastery wing id, start in UTC, note, organiser's BattleTag, source website / Discord / game, created / updated / cancelled at and by, when the reminder and "starting now" events were written) and `run_answers` (one per friend per run: BattleTag, character GUID, I'm in / Maybe / Can't, slot role, source, answered at, waitlisted, moved up). The rules are pure (`src/core/runs.ts`); times are shown in each viewer's zone (`src/core/runTime.ts`, Intl). Every change writes a bot event when the admin's Runs switch is on; reminders are written by the bot's long poll (`writeDueRunEvents`), not by a scheduler.
- Uploader releases (WEB-35, `src/server/releases.ts`), files, not the database: `DATA_DIR/uploader/releases/` (the Velopack feed `releases.win.json` and its signature, both byte for byte as the release workflow sent them (WEB-35b), the packages the feed lists, the newest installer) and `current.json` (version, installer, size, published at). A publish is staged in `uploader/staging-*` and moved in with the signature, the feed and `current.json` last.
- `last_seen` (WEB-18): key, BattleTag, seen at. When each signed-in BattleTag last opened the site, for the admin page; `src/proxy.ts` writes it at most once an hour per BattleTag. Not derived.
- Recap history (WEB-41, `src/server/history.ts`), derived from the uploads and rebuilt with them: `feed_days` (realm day, GUID, owner, `at`, source upload, the day as JSON; the copy with the latest activity wins, an equal one from a later upload too), `feed_sharing` (per person: shares their activity, from the newest record seen) and `sightings` (every `locations` entry of every accepted upload, once per GUID and time; `locations` keeps only the newest).
- The weekly recap (WEB-41c, `src/server/recap.ts`), not derived (a rebuild leaves it alone): `recaps` (week number, start, end, computed at, the recap as posted with what later recaps need, the characters at its end as the next week's start) and `recap_start` (when the site started keeping recaps; the first recap is the first moment after it). `src/instrumentation.ts` checks every minute (and at start) whether the latest recap moment has a recap; after downtime one recap covers everything since the last. The recap is computed by `src/core/recap/` from the history and stored once, then posted as a `recap` bot event when the Weekly recap is on.
- Card images (WEB-41d, `src/server/cards/`): drawn per request from stored data (recaps, `milestones` events, sightings) with Next's built-in `next/og` (Satori and resvg), no new dependency. What each shows is pure (`src/core/cards/`); colours and sizes are tokens (`src/core/cards/palette.ts` mirrors them, a test keeps them equal to `tokens.css`); the site's fonts are bundled under `src/server/cards/fonts/` (SIL OFL, decided with Nico 2026-10-28) and traced into the standalone build (`outputFileTracingIncludes` in `next.config.ts`).
- `rebuild()` re-reads every stored upload in upload order, rejected ones too (a file with a newer schema can become ok after a site update), applies the own-file and community checks (not "may upload": that was checked when the file was stored) and recomputes statuses, summaries, members and the derived tables.
- Migrations: `npm run db:generate -- --name <what>` writes `drizzle/NNNN_<what>.sql`; `openDatabase` applies them on open, and the server opens the database at start (`src/instrumentation.ts`, WEB-07). Released migration files are never edited (CLAUDE.md rule 5).
- Sessions: JWT cookies (Auth.js, no session table) holding only the BattleTag; the role is read from the database on every request (see Access).
- Data directory: `DATA_DIR` (`.env.example`; locally `../CommunitiesForever-Web-data`, outside the repo because `next dev` watches the project folder and a database inside it reloads the page on every write; `/data` in the container), file `communitiesforever.sqlite`, a TrueNAS dataset on the host.

## Access
Battle.net OAuth (region EU, OpenID issuer `https://eu.battle.net/oauth`, scope `openid`) only gives the BattleTag; it cannot tell who is in an in-game community. Membership therefore comes from the data (WEB-06). The rules are pure functions in `src/core/access.ts`; `src/server/access.ts` reads the access list from the database.

| Role | Who | Sign in | Upload | Admin page |
|---|---|---|---|---|
| admin | `ADMIN_BATTLETAG` | yes | yes | yes |
| member | a BattleTag in the community data (`self`, `people`, `presence`) of an accepted upload | yes, unless blocked | yes | no |
| guest | a BattleTag on the guest list (admin page) | yes | only if "may upload" is ticked | no |
| anyone else | | "not on the list" | no | no |

- An upload is accepted only from someone who may upload, only for **their own file** (the file's `self.battleTag` equals the signed-in BattleTag) and only for **the same community** (the file's `settings.clubId` equals that of the admin's uploads; before the admin's first upload only the admin can upload).
- Every accepted upload adds its BattleTags as members. Membership never ends automatically; the admin can block a member (the admin can't be blocked). Blocks are stored apart from the derived members, so `rebuild()` never lifts one.
- A file without `self.battleTag` is "not your file"; one without `settings.clubId` is "other community" (every released addon writes both). The admin's own file is not held to the community: the community is that of the admin's newest accepted upload that names one.
- Roles are checked on the server for every route (CLAUDE.md rule 6):
  - Sessions are JWT cookies with only the BattleTag (Auth.js, 30 days). The role is never in the cookie: `src/proxy.ts` reads it from the database on every request, so a block or a guest list removal takes effect at once, without a session table or adapter.
  - `src/proxy.ts`: open are only `/signin`, `/not-on-list` (where a refused sign-in lands), the icons and the manifest (`ICONS`, WEB-36: browsers fetch them on the sign-in page, the manifest without cookies; they carry only the site name), Auth.js's `/api/auth/*` (the Battle.net callback among them) and `/api/health` (WEB-07: ok and the version, nothing about the data). Without a session pages redirect to `/signin`, API routes answer 401; someone not on the list (or blocked) goes to `/not-on-list`, or 403.
  - Route handlers that need more call `guard(req, "upload" | "admin")` (`src/server/session.ts`): 401 / 403 again on the server. `upload()` itself refuses someone who may not upload (`UploadForbiddenError`) and stores nothing.
  - The Auth.js `signIn` callback refuses anyone not on the list. It leaves the refused BattleTag in a 10-minute httpOnly cookie (`src/server/refused.ts`, WEB-17) so "not on the list" can name it; the cookie is text to show only, never part of an access decision.
  - The open sign-in pages show the site name (from the data) and the admin's name (the part of `ADMIN_BATTLETAG` before the `#`), nothing else from the data; the map behind them is decoration (WEB-17).
- Pages for uploaders only (404 for others, WEB-19): `/upload`, `/uploader` (WEB-34: connect, list and revoke uploaders, a token by hand; server actions in `src/app/(site)/uploader/actions.ts` check upload rights again). An upload's session report `/upload/<id>` is open to every signed-in viewer (WEB-20: it shows nothing the map and roster don't); "Upload another" shows only to uploaders.
- Routes (WEB-06): `POST /api/uploads` (multipart field `file`; upload role; answers the upload's result, which the upload page maps to its states with `uploadOutcome`, `src/core/views/upload.ts`), `GET/PUT/DELETE /api/admin/guests` and `/api/admin/blocks` (admin; for scripts). The admin page (`/admin`, WEB-18) uses server actions that check the admin again.
- Discord linking (WEB-39): our own OAuth 2.0 authorization code flow with PKCE, not Auth.js (its JWT sessions without a database adapter can't link a second account; a Discord sign-in would replace the Battle.net session). "Link Discord" (a server action, so Next.js's Origin check applies) sets a 10-minute httpOnly cookie with a random state and the PKCE verifier, path `/api/discord/callback` only, and sends the browser to Discord for the `identify` scope. `GET /api/discord/callback` needs the session like every route, checks the state against the cookie (constant time; the cookie is used once), exchanges the code with `DISCORD_CLIENT_SECRET`, reads `/users/@me`, revokes the access token and stores only the user id and username for the session's BattleTag (`src/server/discordLink.ts`). A Discord account linked to another BattleTag stays there ("taken"). Unlinking is a server action. The admin's settings are server actions that check the admin again.
- The bot's look-ups (WEB-39b, `GET /api/bot/v1/lookup/<what>`): the bot token, then the Discord user must be linked to someone on the list (`botFriend`, as for runs); the answers come from `src/core/lookup.ts` (pure) over the merged data, `/me`'s week from the feed history (`src/server/lookup.ts`).
- Tests never call Battle.net: they mint the session cookie with the test `AUTH_SECRET` (`tests/server/routes.test.ts`, `tests/e2e/session.ts`).
- The Windows uploader (WEB-33, contract `docs/UPLOADER-API.md`): `/api/uploader/v1/*` passes the proxy without a cookie and each route checks a Bearer token with `tokenGuard(req)` (`src/server/session.ts`): unknown or revoked → 401, someone who may not upload → 403, the same `roleOf` / `mayUpload` as `guard`, per request. Tokens (`cfu_` + 32 random bytes) are stored only as SHA-256, one per device, at most 5 active per person, revoked by the user, by the app or by a block. Connecting is the OAuth 2.0 device flow (RFC 8628; WEB-33b): `device_authorization` and `token` are open, the random `device_code` (the pairing id) is the secret, and the token is made when the app collects an approved pairing, so it is never stored in plain text. Bearer errors follow RFC 6750, "Disconnect" is RFC 7009 `revoke`. The endpoints are our own code (no OAuth server package fits Next.js route handlers); the app uses a standard OAuth client library. Token uploads call the same `upload()` with the device's id. Releases (WEB-35): the update feed `/api/uploader/v1/updates/*` needs any active token (`tokenGuard(req, false)`, no upload right); `/uploader/download` needs a session that may upload; `POST /api/uploader/v1/releases` and the workflow's pull `GET /api/uploader/v1/releases/<file>` (WEB-35b) need `UPLOADER_DEPLOY_SECRET` (constant-time compare; off without it); `GET /api/uploader/v1/updates/status` needs any active token. Release files are streamed to disk by a small multipart reader of our own (`src/server/multipart.ts`). Rate limits are in-memory fixed windows (`RateLimiter`, `src/core/uploader.ts`; the client IP is the rightmost `X-Forwarded-For` from nginx).
- The Discord bot (WEB-38, contract `docs/BOT-API.md`): `/api/bot/v1/*` passes the proxy without a cookie and each route checks the one bot token with `botGuard(req)` (`src/server/session.ts`): only the active `cfb_` token, never a session cookie or an uploader token; the bot token works nowhere else. The admin makes, replaces and revokes it on the Discord page (server actions that check the admin, WEB-39); "Send a test post" writes a `test` event (`enqueueBotEvent`). The event feed is a long poll: `waitForEvents` answers at once when there are unacknowledged events after the cursor, otherwise waits up to 30 s for an upload to wake it (in-process waiters on `globalThis`, plus a look every 5 s), or for the request to be aborted.

## UI
- Screens follow the boards in `design/boards/` (index: `design/README.md`); `docs/DESIGN.md` is the source of truth for tokens, data age scale, map layers, zoom levels, motion and components. The boards are references only: no markup or runtime is copied.
- Data age scale (one everywhere): live < 6 h, today 6–24 h, days 1–6 d, week+ ≥ 7 d, unknown. A friend's data turns amber at 7 days; the site-wide banner shows when the last upload is 7 days old or more.
- Site name: the community name (`settings.clubName`) of the newest admin upload, never hardcoded.
- Ruleset instead of realm: Forever has one mega-realm per ruleset per region. The group plays PvP, so the site shows PvP or PvE: the rulesets table (WEB-13) lists the PvP realm name(s), every other realm is PvE.
- Motion: ambient on the map and sign-in, calm on data pages; `prefers-reduced-motion` and a "Motion" toggle (`localStorage`) turn it off.
- The design system is binding (CLAUDE.md rules 11 and 12): deviations only with Nico's OK, listed in `docs/DESIGN.md` "Deviations". The design checks (WEB-30) enforce it: token lint, computed styles, touch targets, accessibility, reduced motion, screenshot baselines. Each screen story adds its own; how: `tests/design/README.md`. They run on a fresh database seeded with the design prompt's invented friends and a fixed "now" (`FIXED_NOW`, tests only); screenshot baselines are made on Linux in the Playwright image (CI job `design`).

## Hosting
Step by step: `deploy/README.md` (WEB-07).
- TrueNAS SCALE 25.10, Custom App installed from `deploy/compose.yaml`: image from GHCR, `/data` on the dataset `/mnt/<pool>/apps/cf` (owned by `apps`, 568:568; the container runs as that user), port 3000 on the LAN only, `restart: unless-stopped`.
- nginx, an app on the same TrueNAS, terminates TLS for `wow.vestras.nl` (Let's Encrypt) and proxies to `<truenas-ip>:3000`: `client_max_body_size 200m` (uploads ≤ 25 MiB are limited by the site; 200 MB for publishing an uploader release, about 125 MB since the app is self-contained, UP-10), 120 s timeouts, `Host` / `X-Forwarded-*` headers. Auth.js runs with `trustHost: true` and `AUTH_URL=https://wow.vestras.nl`. Reference server block: `deploy/nginx/wow.vestras.nl.conf`.
- DNS at Hostnet: `wow` A record to the home IP; the router forwards 80/443 to nginx, never 3000.
- Image (`Dockerfile`): multi-stage on `node:24-slim`. The build stage runs `npm ci` (with python3/make/g++ for better-sqlite3's approved `node-gyp rebuild`) and `next build`; the runtime stage holds only the standalone server, static files, `drizzle/` and the whole `better-sqlite3` package (its prebuilt binding is picked at run time). User `node`, `DATA_DIR=/data` as a volume, `HOSTNAME=0.0.0.0`, `APP_VERSION` from the build arg, `HEALTHCHECK` on `/api/health`. `.dockerignore` is an allow-list: no `design/`, `tools/`, `tests/`, docs or `.env*`.
- Start: `src/instrumentation.ts` opens the database when the server starts, which applies pending migrations (Storage); a database that can't be opened fails the start.
- Health: `GET /api/health` is open without a session (the one exception to CLAUDE.md rule 6) and answers only `{ ok, version }`, 503 when the database doesn't open.
- Deploy: tag `v*` on `main` (only on Nico's go-ahead) → `.github/workflows/release.yml` checks the tag is on `main`, builds and pushes `ghcr.io/nicoputten/communitiesforever-web:<tag>` and `:latest` (GITHUB_TOKEN, `packages: write`, `org.opencontainers.image.source` label) → set the tag in the TrueNAS app. A manual run rebuilds an existing tag. The package is public, so TrueNAS pulls without credentials.
- CI builds the image on every PR without pushing and checks that it starts, migrates a fresh `/data` and answers the health check.
- Backup: periodic ZFS snapshots of the dataset, and one before every update (migrations only go forward, so a rollback is snapshot plus old tag).
