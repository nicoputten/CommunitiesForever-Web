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

### WEB-37 Keep dependencies fresh
- Goal: no deprecated packages and no stale versions, without hand work (Nico, 2026-10-27).
- **Dependabot** (GitHub's own, no new dependency): `.github/dependabot.yml` for npm and GitHub Actions, weekly, minor and patch updates grouped into one PR, majors one PR each. CI already decides whether an update is safe; screenshot changes still need Nico's OK.
- **Today's state** (`npm ci`, `npm outdated`, 2026-10-27):
  - `@esbuild-kit/core-utils` and `@esbuild-kit/esm-loader` are deprecated ("merged into tsx"). Both come from `drizzle-kit` 0.31.11, the latest. Check for a drizzle-kit release without them, or another way to run `drizzle-kit generate`; otherwise document it as upstream.
  - ESLint 9.39 is "no longer supported", but ESLint 10 is blocked: `eslint-plugin-react` (in `eslint-config-next`) allows ESLint up to 9. Check whether `eslint-config-next` or the plugin moved on; until then the pin stays, documented in ARCHITECTURE (Version pins).
  - TypeScript 7 is out, but `typescript-eslint` allows up to 6.0. Same: lift the pin when it allows 7.
  - `@types/node` stays on 24 on purpose (it follows the Node LTS of `.nvmrc`). Dependabot ignores its majors.
  - `next-auth` is on `5.0.0-beta.32`. npm's "latest" (4.x) is the old line; follow the v5 betas until v5 is stable.
- **A CI step** that lists deprecation warnings from `npm ci` in the job summary, so new ones get noticed. It doesn't fail the build, because the upstream ones above can't be fixed here.
- Done when: Dependabot is on, the docs say why each remaining pin or deprecation exists and when it can go, and anything that can be updated now is updated with green CI.

## E7 Discord bot and planned runs
The bot lives in its own public repo, [CommunitiesForever-Discord](https://github.com/nicoputten/CommunitiesForever-Discord) (BOT-01..07). The site is its only data source: it decides milestones, runs, the recap and who is linked; the bot formats and posts (decided with Nico, 2026-10-27). Design: the canvas's §12 "Discord bot" and the planned-runs boards (`design/README.md`; the flow: `runs-flow`).

**Planned runs** (decided with Nico, 2026-10-27): two kinds of group. *Ask now* lives in the game (addon CF-27) and is answered within minutes; with "Also post on Discord" it reaches the site after a `/reload` and the bot posts it. A *planned run* is owned by the site, posted and answered in Discord, reaches the game through the uploader (`Runs.lua`) and friends' addons, and ends in an invite in the game at start time. The in-game calendar is out of the flow. Times are stored in UTC and shown in each viewer's own time zone. Any linked friend can plan; organisers edit and delete their own runs, the admin can delete any run (one admin, `ADMIN_BATTLETAG`; the board's "Admins: Nico, Mira" is not built). Reminders mention only those who answered I'm in or Maybe.

Order: WEB-38, WEB-39b, WEB-40, WEB-42, WEB-43, WEB-44, WEB-45. In the other repos: addon CF-45 first (ships the empty runs file), then uploader UP-12 and bot BOT-04 once WEB-44 and WEB-38 are in, then addon CF-46..48.

### WEB-38 Bot API
- `/api/bot/v1/` with one Bearer bot token (stored hashed, like the uploader tokens; created and revoked by the admin, shown once). Session cookies are not accepted there, the bot token nowhere else (CLAUDE.md rule 6 gets this endpoint).
- `GET settings`; `GET events?after=<cursor>` as a **long poll** (answers at once when there are events, otherwise holds up to about 30 s), so new events reach the bot within about a second without an open port on the bot; `POST events/<id>/posted` with the Discord message id (an event is handed out until acknowledged, never posted twice).
- Events: milestones per accepted upload (every 10 levels, level 60, a profession at its cap, a new character; grouped per upload), run created, changed (time, note, answers), cancelled, reminder due, starting now, done or didn't happen, ask now from the game, ping from the game.
- Run actions for the bot: create (`/plan`, `/ask`), answer (buttons; Pick my character lists the asker's characters in range), edit and cancel (`/run`; own runs, the admin any).
- The contract in `docs/BOT-API.md` (fields, errors, versioning: only optional fields within v1), as `docs/UPLOADER-API.md` is for the uploader.
- Tests: the token check, the long poll, the cursor and acknowledgement, milestone events from sample uploads, run rights.

### WEB-39b Look-ups for the bot
Split from WEB-39 (Nico, 2026-10-27); after WEB-38, whose bot token check it uses.
- `GET lookup/...` endpoints for the bot's commands (`/whereis`, `/who`, `/whocancraft`, `/character` with autocomplete, `/alts`, `/me`, `/runs`), answered for a Discord user id only when it is linked to a member or guest (`linkForDiscordUser`, `src/server/discord.ts`, then the role as for a session).
- WEB-38's bot API adds the bot token card and the bot's status to the Discord page, and the bot reports its server's channels and roles so the page's dropdowns and test posts work.

### WEB-40 Runs
- Boards: `runs`, `run-detail`, `run-create`, `runs-phone`. "Runs" in the top bar with the number of upcoming runs you can join.
- Model (own database, forward-only migration): run (dungeon or wing, start in UTC, note, organiser and their character, source website / Discord / game, state open, full, started, done, didn't happen, cancelled), five role slots (tank, healer, three damage) filled from the role the addon knows per character (from talents or set by the player), answers (I'm in / Maybe / Can't, character, where it came from and when).
- Runs page: this week, later, past; filters "Runs I can join" (one of your characters fits), Mine, All; your answers; "Where runs show up". Run detail: slots, answers with their source, who could join, the organiser's edit and delete, the admin's delete; times as "19:30 your time · 20:30 for Nico". Plan a run: dungeon (filled in when coming from a dungeon page or a roster band), lead as, day, time in your time zone ("everyone sees it in their own time"), note, the Discord preview, the time-passed and no-character-fits states.
- Full run: when someone drops out, the first Maybe whose character fits the free role moves up automatically and gets a quiet notice (Nico, 2026-10-27).
- Phone: answer buttons 44 px at the bottom; empty, loading and error states; an answer that didn't go through is kept on the phone and retried.
- Tests: rights (own, admin), slots from roles, moving up from Maybe, time zones around daylight saving.

### WEB-42 Dungeon page
- Board: `dungeon-page`. A page per dungeon (`/dungeons/<id>`), Scarlet Monastery as its four wings (WEB-32), each with its own range: who fits per role, runs planned here and in the other wings, "Ran here" (WEB-43), Plan a run.
- The map's dungeon markers get a badge with the number of planned runs; their popover has Plan a run and Dungeon page.

### WEB-43 Runs from uploads
- The addon (CF-47, CF-48) writes runs planned, answers given, asks with "Also post on Discord" and Discord pings made in game into its saved file; the site reads them from each upload (parser and compat fixtures, CLAUDE.md rule 4) and turns them into runs, answers and events. Each item carries an id from the addon, so a file uploaded twice changes nothing.
- An ask now from the game expires 10 minutes after it was made in game, and is only posted while it hasn't.
- Done: when an upload's run log (addon CF-23: dungeon, time, community members in the group) shows the dungeon within the run's window, the run becomes "Ran it · N of M signed-up came" and counts for the recap (WEB-41). No such upload within 4 hours of the start: "didn't happen".
- The session report and the uploader's summary show "N run answers".

### WEB-44 Runs for the uploader
- `GET /api/uploader/v1/runs`: the upcoming runs (next 14 days) of the uploader's community, with slots, answers, the organiser's time zone offset and `updatedAt`; documented in `docs/UPLOADER-API.md` (an optional addition; the uploader's v1 stays valid).
- Tests: only the token's community, only upcoming runs, the shape the uploader writes into `Runs.lua` (UP-12).

### WEB-45 Runs on the roster and the map
- Board: `roster-cards-runs`. The "Next run" card on the roster; a dungeon band opens a popover with who fits, planned runs, Plan a run and Dungeon page; the Role filter.
- After WEB-32, which builds the level spread itself.

### WEB-41 Weekly recap and card images
Decided with Nico, 2026-10-27. The catalogue (48 cards), rotation rules and example weeks are on the bot repo's `bot-recap` board.
- **When:** every Sunday 13:00 in the admin's time zone (Europe/Amsterdam; the board says 20:00, a deviation in the bot repo's `docs/DESIGN-NOTES.md`). Stored and computed in UTC, so daylight saving moves nothing. A week runs from the previous recap moment to this one; an upload after it counts for the next week.
- **History:** the addon's feed covers only the last 7 days, so the site stores the feed per realm day per character from every accepted upload (the newest upload wins for a day). Snapshot cards (item level, talents, professions, quest logs) compare the characters at the start and end of the week. Friends without "Share my activity" or without the addon only appear in snapshot cards.
- **Cards are pure functions** in `src/core/recap/`: week facts in, `{ eligible, score, facts }` out. The score is relative to earlier weeks (a rare event beats a usual one). Each card has its threshold from the board (e.g. Gear jump ≥ 5 item levels).
- **Rotation:** 4 cards (one stat, one progress, one social, one fun), the award and the challenge as on the board: eligible only above the threshold and not used in the last 4 weeks; the highest score per slot; ties broken with the week number as seed; at most one card per friend and the award winner excluded from the other cards; quiet weeks (under 3 levels in total) get the short recap.
- **Text from templates:** every card, headline (10) and challenge (12) has several phrasings (3 to 5, plus closing lines), filled with the facts. **A phrasing is not used again until all phrasings of that card have been used** (a cycle per card, stored with the recap history, the order seeded by the week number), so the same sentence doesn't come back soon.
- **No pronouns** in any template ("Somebody pay a visit.", not the board's "Somebody visit her."). Full character names, display names for friends, never BattleTags.
- **Who am I?:** a riddle generated from the character's facts (class, race, zone, profession, level), the answer in a Discord spoiler.
- **Later, not in this story:** the weak cards A7 Social butterfly, S11 Biggest group night, F5 Road trip, F7 Night owl and F8 Early bird (the addon records group members only inside instances and one time per character per day); they wait for an addon story. AI-written closing lines are an open option (it would send names to an outside API; Nico decides).
- **Re-runs are identical:** the recap is computed once and stored (cards, phrasings, facts); the admin preview shows the coming one, `/recap` the last one.
- **Card images** rendered by the site (`GET cards/<id>.png`: level 60, recap header, map crops), with the map's CC BY-SA attribution where the map shows.
- Tests: every card function on sample weeks (eligible, not eligible, score), the rotation (cooldown, one card per friend, quiet week, seed), the phrasing cycle (no repeat before all are used), the week window around daylight saving.

### Backlog (unordered, not yet stories)
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
