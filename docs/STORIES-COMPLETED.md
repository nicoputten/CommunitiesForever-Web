# Done stories

### WEB-01 Repo skeleton and CI
- Next.js (App Router) + TypeScript strict, ESLint, Prettier, Vitest, Playwright, per `docs/ARCHITECTURE.md` Stack and Layering.
- ESLint forbids imports from `src/server`, `src/app`, `src/components`, React and Node built-ins inside `src/core`.
- Scripts: `npm run dev`, `lint`, `test`, `test:e2e`, `build`. CLAUDE.md "Commands" filled in.
- GitHub Actions on PRs and `develop`: lint, test, build.
- `CHANGELOG.md` with `## Unreleased`, `.env.example`, `README.md` with local setup.
- Done when: a placeholder page renders, one core unit test and one Playwright smoke test pass in CI.

### WEB-03 SavedVariables parser (core)
- `parseLua(text)`: parses a SavedVariables file (`Name = { ... }` assignments, also the fixtures' `return { ... }`) into plain JS values. Supports what the game writes: tables with `["key"] =` and `[n] =` keys, array parts, strings with escapes, numbers (incl. negative, float, exponent), booleans, nil, `--` comments.
- Never executes anything. Limits: 5 MB file, depth 32, clear errors with line and column.
- Copy the addon's fixtures to `tests/fixtures/addon/v0.3`, `v0.4` (unchanged) and a real file from Nico (wrapped as the game writes it, anonymized).
- Unit tests: every construct above, errors, limits, all fixtures parse.
- Done: `src/core/lua.ts` (`parseLua`), fixtures in `tests/fixtures/addon/` and `tests/fixtures/real/beta-2026-10.lua`, tests in `tests/unit/lua*.test.ts`.

### WEB-04 Normalize and merge (core)
- `normalize(db)`: `CommunitiesForeverDB.global` per `schemaVersion` into the internal shape (`docs/SOURCE-DATA.md`). Unknown newer schema: rejected with the version in the message.
- Sanitize: strip `|` escapes from every string, display names capped at 24.
- `merge(current, incoming)`: per GUID newest `updatedAt` wins; locations newest `seenAt`; `removed` hides a character; person display name: own `displayName` > BattleTag name part (addon rule).
- `tests/compat`: every addon fixture normalizes; snapshot of the result.
- Unit tests: missing fields everywhere, merge order independence, removed characters.
- Decided with Nico: friends seen only through presence are people with stub characters; a GUID only in `locations` is a stub without owner; the uploader's character that a newer own record no longer lists is removed at that record's version; sanitize drops whole WoW escape sequences.
- Done: `src/core/model.ts`, `normalize.ts`, `merge.ts`, `sanitize.ts`; tests in `tests/unit/{normalize,merge,sanitize}.test.ts` and `tests/compat/fixtures.test.ts` (snapshots).

### WEB-05 Storage and upload service
- Drizzle schema and first migration for `uploads` and the derived tables (`docs/ARCHITECTURE.md` Storage).
- `upload(file, user)`: store raw (gzip, sha256; same file again is a no-op), parse, normalize, merge into derived tables in one transaction; a rejected file is stored with its reason and changes nothing.
- `rebuild()`: recompute derived tables from all ok uploads in order.
- Diff of an upload against the previous state (new characters, level ups, profession gains) for the upload result screen.
- Tests against a temporary SQLite file.
- Decided with Nico: derived state in tables; the diff is saved on the upload row; `rebuild()` retries rejected uploads; upload limit 25 MiB (parser limit raised to match), larger files refused and not stored. `@types/better-sqlite3` added.
- Done: `src/server/db/` (schema, `openDatabase`, `DATA_DIR`), `drizzle/0000_init.sql`, `src/server/uploads.ts` (`upload`, `rebuild`, `loadState`), `src/core/diff.ts`; tests in `tests/server/uploads.test.ts`, `tests/unit/diff.test.ts`.

### WEB-06 Battle.net sign-in and access rules
- Auth.js with the Battle.net provider (EU). Session cookie; JWT unless the guest list needs revocation at once (decide in the story).
- Who may sign in:
  - **admin**: `ADMIN_BATTLETAG` (Nico). Can never be blocked.
  - **members**: every BattleTag in the community data (`self`, `people`, `presence`) of an accepted upload from the community (see below).
  - **guests**: BattleTags on the guest list (admin page, WEB-18)
  - everyone else: "not on the list" (WEB-17)
- Who may upload: admin, members, and guests with "may upload" ticked. Other guests view only.
- An upload is accepted only when:
  - the uploader may upload
  - **it is the uploader's own file**: the file's `self.battleTag` equals the signed-in BattleTag, so nobody can upload someone else's or a made-up file under their name
  - **it is the same community**: its `settings.clubId` equals the community of the admin's uploads. Until the admin's first upload, only the admin can upload.
- Every accepted upload adds its BattleTags as members. Membership never ends automatically (someone gone from the data stays a member); the admin can block a member on the admin page, and a blocked BattleTag can't sign in.
- Every page and API route needs a session except sign-in and the callback (CLAUDE.md rule 6). Upload and admin routes check the role on the server.
- Storage: guest list table (BattleTag, may upload, added at, added by); members table (BattleTag, first seen in upload, blocked at/by); uploads already record `uploadedBy`. Members are derived from accepted uploads and rebuilt with them; blocks are kept apart so a rebuild never lifts one.
- Unit tests for the access rules (core): roles, own-file check, same-community check, blocked members, the admin never blocked. Route tests for 401/403.
- Manual: create the app at develop.battle.net with redirect URLs for localhost and `wow.vestras.nl`; client id and secret in `.env.local` and the TrueNAS app config.
- Decided: Auth.js v5 (`next-auth` 5.0.0-beta.32, pinned); JWT sessions with only the BattleTag, the role read from the database on every request (`src/proxy.ts`), so blocks and guest list removals take effect at once; BattleTags compared without case; blocks apply to members and guests; the community is that of the admin's newest upload, the admin's own file is not held to it; a file without `self.battleTag` is not your file, without `settings.clubId` another community; rejected-for-access files are stored as rejected (history), duplicates are per uploader, a community rejection is checked again on the next try; `rebuild()` re-applies the own-file and community checks but not "may upload".
- Done: `src/core/access.ts` (roles, permissions, `checkFile`, `battleTagsOf`), `src/server/access.ts` (access list, guest list, blocks, members), `src/server/auth.ts`, `src/server/session.ts` (`guard`), `src/proxy.ts`, `drizzle/0001_access.sql`, routes `/api/uploads`, `/api/admin/guests`, `/api/admin/blocks`, placeholder pages `/signin` and `/not-on-list`; tests in `tests/unit/access.test.ts`, `tests/server/access.test.ts`, `tests/server/routes.test.ts`, `tests/e2e/smoke.spec.ts`.

### WEB-07 Docker image and deploy to TrueNAS
- Multi-stage Dockerfile (Next.js standalone, non-root user), `/data` volume, health endpoint, migrations run at start.
- GitHub Actions on tag `v*` on `main`: build and push to GHCR (`:<tag>`, `:latest`).
- `deploy/` with the TrueNAS 25.10 Custom App compose YAML, the nginx server block for `wow.vestras.nl` (TLS, proxy headers, `client_max_body_size`), and a step-by-step `deploy/README.md`.
- Manual: DNS record at Hostnet, nginx config and certificate, dataset and app on TrueNAS, first sign-in, first upload.
- Decided with Nico: the image is public on GHCR; nginx runs as an app on TrueNAS and makes the certificates (the README covers Nginx Proxy Manager and plain nginx); `/data` is the dataset `/mnt/<pool>/apps/cf`, owned by `apps` (568:568), and the container runs as 568:568.
- `/api/health` is the one route open without a session besides sign-in (CLAUDE.md rule 6): `{ ok, version }` only, 503 when the database doesn't open.
- Done: `Dockerfile`, `.dockerignore`, `src/app/api/health/route.ts`, `src/instrumentation.ts` (opens the database at start, so migrations run then), `.github/workflows/release.yml`, the `image` job in `ci.yml` (builds the image on every PR and checks its health endpoint), `deploy/compose.yaml`, `deploy/nginx/wow.vestras.nl.conf`, `deploy/README.md`.

### WEB-13 Game data tables and map data
- Goal: every table of game data the screens need, sourced (CLAUDE.md rule 10), in `src/core/gamedata/`.
- Tables:
  - classes: `classFile` → name, colour token, text-colour token (values in `docs/DESIGN.md` §3)
  - races: `raceID` → name, faction
  - professions: skill line ID → name, primary or secondary; caps 75/150/225/300
  - rulesets: show **PvP** or **PvE**. The group plays on the PvP ruleset, so the table lists the PvP realm name(s) (the beta realm now, the launch name on launch day) and every other realm shows PvE. Never parse the realm name.
  - dungeons and raids: name, zone, typical level range (labelled "typical"), map position
  - zone aliases: the addon's zone text → `zones.json` zone id, also for cities ("Orgrimmar", "Stormwind City") and for dungeon names (→ the dungeon's zone). Unknown text: "elsewhere", never dropped.
- `tools/map/build_zones.py`: add every Vanilla dungeon and raid to `DUNGEONS` (positions placed by hand on our map, source of the level ranges named), and Alterac Mountains if the source SVG allows a separate shape (otherwise an alias to Hillsbrad). Rebuild `zones.json`.
- Unit tests: every zone in `zones.json` has an alias; every dungeon's zone exists; every class has its tokens.
- WoW: Forever's changes are researched in `docs/WOW-FOREVER.md` (with sources) and applied: Skyborne (raceIDs 95/96), nine new dungeons, only the announced raids (Onyxia's Lair, The Barrow Deeps, Hyjal Summit), Mount Hyjal on the Hyjal shape, new zones not on the map yet resolve to "elsewhere".
- Decided: Vanilla dungeon level ranges from the addon's planner table (`Dungeons.STATIC`), new ones from the beta Group Finder or else Blizzard; Blackrock Mountain and its instances in Burning Steppes, where the source map puts it; Alterac Mountains aliases to Hillsbrad (the source SVG has no shape for it); battlegrounds (incl. Darkspear Islands) resolve to "battleground" and other unknown text to "elsewhere" (both off the map); PvP realms: the beta realm and "Forever PvP" (launch).
- Done: `src/core/gamedata/` (`classes`, `races`, `professions`, `rulesets`, `dungeons`, `zones` with `resolveZone`); 30 dungeon and raid markers in `tools/map/build_zones.py` and `zones.json` (`--dungeons-only` rewrites just that list, so the outlines stay byte for byte); tests in `tests/unit/gamedata.test.ts`.

### WEB-31 Map: classic Thousand Needles and Forever's new zones
- Goal: the map looks like WoW: Forever, not Cataclysm, with a few small changes to `src/core/map/zones.json` and no rework of the rest.
- **Thousand Needles dry:** the source SVG's flooded lake (a sea inlet cut out of the zone, with the mesas as islands) is land again: the zone is one shape without water, holes or islands, and the coastline no longer runs into it.
- **Mount Hyjal** is a zone (`kind: "zone"`) instead of terrain, with the same id `hyjal`.
- **New zones** The Riverglades, Shen'dralas and Zephras Isle are drawn, placed by the sources in `docs/WOW-FOREVER.md`; each placement is marked confirmed or unverified there. Their shapes are defined in `tools/map/build_zones.py`, so a full rebuild reproduces them.
- **Resolving:** the new zones' names, Krol'dok Stronghold, The Barrow Deeps and Hyjal Summit resolve to real zones, not "elsewhere"; Krol'dok Stronghold gets a marker inside The Riverglades.
- **The rest unchanged:** every existing zone keeps its id; the `zones.json` diff only touches Thousand Needles, Mount Hyjal, the new zones, the zones a new zone borders or is carved from, and the coastlines next to them.
- Every approved look change is in `docs/DESIGN.md` §11 Deviations; §5 describes the new zones.
- Tests: every zone in `zones.json` has an alias; the new dungeon and raid zones resolve to their zone; the existing zone ids are all still there; every dungeon marker lies inside its zone.
- PR: before/after screenshots of the map board rendered with the new `zones.json`.
- Decided (Nico, 2026-10-25): shapes as hand-drawn polygons in `build_zones.py` (`EXTRA_ZONES`); The Riverglades as new land east of its four neighbours; Shen'dralas carved from northern Feralas over Lake Dumont; Zephras Isle (Skywall, not Azeroth) as an inset island between the continents (placed south of the Maelstrom, not at the gap's north end as first proposed, because the board's compass rose sits there; confirmed by Nico); no other classic changes (the terrain labels and other Cataclysm coasts stay).
- Done: `--forever-only` in `tools/map/build_zones.py` applies the changes to the committed `zones.json` (the full build applies them too); 46 shapes (43 zones + 3 terrain), Krol'dok Stronghold's marker in The Riverglades; aliases incl. "Riverglades"; tests in `tests/unit/gamedata.test.ts`.

### WEB-14 View models (core)
- Goal: everything the screens compute, pure and tested, so pages only render.
- Data age scale, one everywhere (`docs/DESIGN.md` §4): live < 6 h, today 6–24 h, days 1–6 d, week+ ≥ 7 d, unknown (no location). A friend's data turns amber at 7 days. The site-wide banner shows when the last upload is 7 days old or more.
- Site name: the community name (`settings.clubName`) of the newest admin upload; fallback "CommunitiesForever".
- Roll call: characters grouped by sighting age ("Last 24 hours", "Earlier"), "N of M located", the unknown-whereabouts list, friends without the addon ("Sanne has no addon data yet"), "via X" and "X's data is N days old".
- Roster: people with characters, sorted and filtered (class, role, level range, profession, last played); level spread 1–60 with dungeon bands and "fits Scarlet Monastery (26–45) with Lia, Tok and Bob"; quick answers (healers, tanks, level 30–40, level 60).
- Character: main tree name from `mainTree` (an index into `talents`), points spent (level − 9), bars out of 31; "N levels to 60"; dungeon fit with the group; who else was last seen in the same zone; the owner's other characters.
- Professions: per profession the best in the group and status covered (best ≥ 225), thin (175–224) or gap (< 175); character × profession matrix; "no professions yet".
- Upload summary (extends WEB-05's `diff`): item level gains, "cap reached" when a rank hits its max, who sent new data (per person: newer data, nothing new, no addon; "via X"), counts for the report header.
- Unit tests for every rule above, with the addon fixtures and the real beta file.
- Decided with Nico (2026-10-25):
  - sighted stubs (friends without the addon seen in a zone) are roll call rows and count in "N of M located"; the no-addon line still names them
  - level spread: a band for every dungeon (raids excluded) where at least two characters fit; the one with the most fits gets the "fits ..." line, ties go to the narrower range
  - character dungeon fit: other friends' characters in range (not the owner's alts), any data age; the dungeon with the most of them, ties go to the narrower range
  - views show full character names, never a first word (the boards' "Lia, Tok and Bob" become full names)
  - a person's data age is their record's `version` (set by the owner's addon), else `receivedAt`, else their newest character update
- Done: `src/core/views/` (`age`, `site`, `characters`, `rollCall`, `roster`, `character`, `professions`, `report`), `src/core/people.ts` (data time, "via" names), `src/core/gamedata/levels.ts` (level cap 60, talent points, 31-point trees); `diff` extended with `itemLevelGains`, `capReached`, `senders` and `counts`; tests in `tests/unit/views/` with the design prompt's sample group (`sample.ts`), the addon fixtures and the real beta file.

### WEB-15 Tokens, fonts and the app shell
- `src/styles/tokens.css` with every token of `docs/DESIGN.md` §3 (surfaces, sea and land, gold, text, status, class colours, type, space, radius, elevation, motion); CSS Modules for components, no runtime CSS-in-JS.
- Fonts with `next/font/google`: Marcellus SC, Marcellus, Inter (tabular numbers for data); type scale of §3.
- App shell per the boards: `TopBar` (brand with site name from data, Map / Roster / Professions, data age "Data uploaded just now", Upload for admin and members, user menu with sign out), phone `TabBar`, footer credit "Private fan site · not affiliated with Blizzard Entertainment · Zone outlines: Syrio, Wikimedia Commons (CC BY-SA 4.0), adapted".
- Shared components: `DataAgeBadge`, `FactionTag`, `FilterChip` and `Segmented` (`aria-pressed`), `Banner` (site data 7+ days old), `EmptyState`, `Skeleton`, class disc with initials and level badge.
- Design system board as reference: a `/dev/components` page (admin only) that shows every component in every state.
- Decided with Nico (2026-10-26): board values without a §3 token become derived tokens in `tokens.css` part 2 (DESIGN.md §3 "Derived from the boards"); Upload as icon + label on every page; on phone the data age sits in the app bar and Upload in the user menu; display initials on the class disc (CLAUDE.md rule 3 exception).
- Done: `src/styles/tokens.css`, `globals.css`, `fonts.ts` (next/font, `--font-*-face`); shell in `src/components/shell/` (`SiteShell`, `TopBar`, `UserMenu`, `TabBar`, `SiteFooter`) through `src/app/(site)/layout.tsx`, so pages outside the group (sign-in) have no shell; components in `src/components/ui/` (`ClassDisc`, `DataAgeBadge`, `FactionTag`, `FilterChip`, `Segmented`, `Banner`, `EmptyState`, `Skeleton`, `PageTitle`, icons); `/dev/components`; placeholder pages for Map, Roster, Professions and Upload; `timeAgo`, `initials` in `src/core/views`; Playwright `tests/e2e/shell.spec.ts` (phone project now 375 px wide).
- Wired to WEB-06: `src/app/viewer.ts` (`getViewer` from the session and the access list, role per request; `isAdmin` guards `/dev/components`), `src/app/actions.ts` (sign out to /signin), `src/app/site.ts` (site name uses the merged community name, as uploads do not store their own `clubName` yet).

### WEB-30 Design checks
- Goal: drifting from the design system fails the build, not a review.
- **Token lint** (Vitest, no new dependency): scans `src/**/*.module.css` and `src/**/*.tsx` and fails on raw colours (hex, `rgb()`, `hsl()`), font sizes, font families, radii, shadows and durations outside `src/styles/tokens.css`; a value that is really needed goes into the tokens. Allowed: `0`, `100%`, `1px` borders using a token colour.
- **Computed-style checks** (Playwright): per screen, its key elements use the design values, read with `getComputedStyle`. For example:
  - page title: Marcellus SC at the `display` size
  - character names: Marcellus, in their class `-text` colour
  - data in Inter with tabular numbers
  - page backgrounds: `--bg-abyss` on map pages, `--bg-night` on data pages
  - surfaces use the token blur
- **Touch targets:** every interactive element is at least 44 × 44 px at phone size.
- **Accessibility:** `@axe-core/playwright` scan of every screen at both sizes, no serious or critical violations (dev dependency approved by Nico).
- **Screenshot baselines:** `toHaveScreenshot` per screen at 1440 and 375 px with fixed sample data (the design prompt's invented friends) and motion off. Baselines live in the repo; updating one is a deliberate `npm run test:design -- --update-snapshots` that Nico approves in the PR.
- **Reduced motion:** with `prefers-reduced-motion`, no element has a running animation.
- `npm run test:design` runs all of the above, and CI runs it on every PR.
- Built right after WEB-15, so every screen story adds its checks from the start.
- Done: `tests/design/` (README with how a screen adds its checks): token lint (`token-lint.ts`, `tokens.test.ts`), helpers in `checks.ts` (`expectStyles` with `TYPE`, `DATA`, `characterName`, `SURFACE`; `expectBackground`, `expectTouchTargets`, `expectAccessible`, `expectNoMotion`, `expectScreenshot`), sample data (`sample.ts`) uploaded by `seed.setup.ts`, checks of the shell, placeholder screens and `/dev/components` in `shell.spec.ts`; `playwright.design.config.ts` (fresh database, `FIXED_NOW`); CI job `design` in the Playwright image, which writes changed screenshots into the `design-baselines` artifact. Fixed on the way: the build dropped the unprefixed `backdrop-filter` (no blur in Chrome), the account button's name did not contain its visible text, the map page now sits on `--bg-abyss`, the live disc glow's 45% became `--glow-disc-mix`. Sign-in and "not on the list" are unstyled placeholders until WEB-17, which adds their checks.

### WEB-16 Atmosphere
- `Atmosphere` component: drifting fog, light shafts, embers, animated sea (waves, surf, foam, Maelstrom, moonlight) with the loop times of `docs/DESIGN.md` §6.
- Alive on the map and sign-in pages; data pages are calm (same palette, no ambient motion).
- Reduced motion: everything off, static fog. A user toggle "Motion" in the user menu, stored in `localStorage` (default: follow the system).
- Performance: CSS and SVG only, no WebGL; no layout shift; animations pause when the tab is hidden.
- Decided with Nico (2026-10-26): the Motion switch follows the system until flipped, and an explicit On animates even under the system's reduced motion; layers exactly as the boards (desktop map: fog and light shafts, no embers; phone map: one fog bank; sign-in: drifting map, fog and embers, phone too; data pages: the static top glow only); loop times §6 does not list come from the boards as tokens.
- Done: `src/components/atmosphere/` (`Atmosphere` with variants map / signin / calm, `SeaLayers` as one SVG group for the map's 1440 × 900 viewBox, `DriftingMap` for sign-in, `motion.ts` with the head script that applies the stored setting before first paint, `AmbientMotion` for pausing while the tab is hidden); `wavePath` in `src/core/map/waves.ts`; Motion switch in `UserMenu`; tokens in `tokens.css` part 2; global reduced-motion rules in `globals.css` keyed on `<html data-motion>`; sea preview on `/dev/components`; Playwright `tests/e2e/atmosphere.spec.ts`. WEB-25 slots `SeaLayers` under its zone fills and keeps `<Atmosphere variant="map">`; WEB-17 builds the sign-in panel over the `signin` variant.

### WEB-25 World map
- Boards: `map`, `map-states`. The map page is the home page.
- Server-rendered SVG from `zones.json` with the layers of `docs/DESIGN.md` §5; HTML overlay for markers.
- Zone states: idle, occupied (gold tint by recency), hover (bright edge, name in the corner), terrain (no hover).
- Markers per freshness state (§4), hover/focus card (name, level, race, class, spec, zone, seen, player, item level, "Open character"), selected state.
- Clusters: count and class ring; 2–5 fan out (spring, 30 ms stagger), 6 or more open a list; dungeon badge.
- Continent switch (Azeroth, Kalimdor, Eastern Kingdoms) in the top bar.
- Decided with Nico (2026-10-26):
  - WEB-25 is the map at a fixed framing. Pan, zoom, the zoom-level rules and fly-to are WEB-26; the roll call WEB-27 (the map is full width until then); the phone sheets WEB-28; the empty-site panel and skeletons WEB-29 (before the first upload the map shows without markers).
  - Continent switch: Kalimdor and Eastern Kingdoms frame that continent's zones (Zephras Isle counts as Kalimdor) without animation, with the rest of the world (and its markers) around it; the choice is in the URL (`?continent=`), so Back works. Hidden on phone until WEB-28.
  - Occupied tint by the newest sighting in the zone: new 20%, recent 12%, days 7%, week+ 3%; zone label pale gold with a new sighting, light grey when occupied.
  - Age tag ("2d") on recent, days and week+ (amber); none on new.
  - A sighted friend without the addon: a neutral "?" marker; the card shows only zone, seen and player, no "Open character".
  - No progress bar in the card (the addon records no XP).
  - Clusters at the zone's anchor; the ring split evenly by class colour, pulsing when someone in it is new. 2–5 fan out above the hub on hover, focus or tap; 6 or more open a list of every name. A lone character in a dungeon gets the badge on their marker.
  - Selection: click or Enter; gold ring and the card stays; Escape or a click on the map clears it; in the URL (`?character=`) for WEB-26 and WEB-27.
  - The world is fitted to the space under the top bar; markers keep 30 px in a 44 px target and may overlap on phone until WEB-26 and WEB-28 (the phone accessibility check skips axe's `target-size` for that).
  - The sea is endless (Nico, after the first screenshots): the gradient pads out to deep sea and the waves repeat as a seamless tile (`WAVE_TILE`, `SeaLayers` `infinite`), so the world's edge never shows. Bounded, springy panning is for WEB-26.
  - Kept from the board: compass rose, "The Maelstrom" label, the vertical continent names. Battleground and "elsewhere" sightings have no marker (the roll call lists them).
- Done:
  - core: `worldMap` (places per zone, newest first, occupied tint) in `src/core/views/map.ts`; continents, marker types and labels in `mapMarkers.ts` (no zones.json, for client components).
  - Components `src/components/map/`: `WorldMap` (server SVG with `SeaLayers`, zone fills, grain, tint and borders, coast, capitals, labels), `MapStage` (zone hover, markers, card, selection), `CharacterMarker` and `ZoneCluster` (`Markers.tsx`), `CharacterCard`; `ClassDisc` size `card`; continent switch (`SegmentedNav`) in `TopBar`; map tokens in `tokens.css` part 2.
  - Page: `src/app/(site)/(map)/` with its `error.tsx`; the shell's main is full width on the map.
  - Tests: `tests/unit/views/map.test.ts`, Playwright `tests/e2e/map.spec.ts`, design checks `tests/design/map.spec.ts` (`expectAccessible` takes rules to skip).
### WEB-24 Professions
- Board: `professions`.
- Summary: covered / thin / gaps with the professions named.
- Cards per profession: best in the group, everyone's skill bars on the 300 scale with the cap shaded and ticks at 75/150/225, status badge; secondary professions marked.
- Character × profession matrix (brighter cell = higher skill); "No professions yet".
- Recipe search placeholder: "Recipe search arrives when the addon shares known recipes."
- Decided with Nico (2026-10-26):
  - A card for every profession of the table, also those nobody has ("Nobody has it yet", Gap); the gaps line names each best ("Alchemy 160", "… nobody").
  - No per-profession notes (the board's Engineering line is dropped).
  - Full names in the bars: the name column fits the longest name in the card (at most 140 px), cut off with "…"; on phone the name sits on its own line above the bar.
  - Without a recorded cap: no cap shading, the value alone ("160").
  - The best is gold (gold to pale gold at 300), the rest dim; ties all get ★. Old friend data (7+ days): only the bar fades to 80%.
  - Matrix: gold mixed in by skill (`--skill`, up to 55% at 300); text `--text-strong` from 225 (the board's dark text fails contrast). Column headings are the board's abbreviations in `<abbr title>`.
  - Order: primary A–Z, then secondary; matrix rows highest level first, "No professions yet" last.
  - Links: names open the character, card titles the roster filtered on the profession (`/roster?prof=…`); each card has the profession slug as `id` (WEB-23 "Compare with the group").
  - Phone: summary stacked, cards one column (two from 640 px, four from 1100 px), the matrix scrolls in its frame with a sticky Character column, the recipe field over its note.
  - States: before the first upload the roster's empty state ("No professions yet"); skeletons while loading; "Professions didn't load" / "Try again" on an error.
  - Recipe search placeholder: a disabled field, placeholder in `--text-faint`.
- Done:
  - core: `ProfessionEntry.old` in `professions.ts`.
  - Page: `/professions` with `loading.tsx`, `error.tsx` and `empty.tsx`.
  - Components: `ProfessionCard`, `SkillBar`, `StatusBadge`, `ProfessionSummaryBoxes`, `ProfessionMatrix`, `RecipeSearch` in `src/components/professions/`; professions tokens in `tokens.css` part 2.
  - Tests: unit test for `old`; Playwright `tests/e2e/professions.spec.ts` and `professions.empty.ts`; design checks in `tests/design/professions.spec.ts`.

### WEB-22 Roster: table
- Board: `roster-table`. Sortable (`aria-sort`) by character, player, level, race and class, role, talents, item level, last played, last seen; "Group by friend"; same filters as the cards.
- On a phone the table becomes the card list, and sort and filters move into a sheet.
- Decided with Nico (2026-10-26):
  - Reuses WEB-21's toolbar, filter menus, URL state and character rows; the toolbar navigates on the page it sits on, so Cards and Table keep the query.
  - The column headers are links (sorting works without script, Back undoes it); a second click reverses. New URL keys: `dir` (only when not the sort's default: numbers and times high first, text A–Z) and `group=friend`. Race · class sorts by class, then race; role tank, healer, damage; talents by main tree; last seen in by zone, unknown last; professions as WEB-21's profession sort. The cards ignore the table-only sorts.
  - Group by friend: a toggle chip; one row group per friend with name, BattleTag, count and data age badge, in the cards' friend order; the Player column is hidden.
  - Rows: the viewer's own characters tinted gold; old friends' discs and bars at 80% with "· 9 d old"; "· via Bob" when relayed; full zone text, "Location unknown" in faint text; "—" when missing. The name links to the character.
  - Table from 768 px; from 1200 px the headers stick to the window, narrower the frame scrolls sideways.
  - Phone: the card list (flat in the table's order, friend panels when grouped) and a "Filters & sort" bottom sheet (native `<dialog>`, no drag, no `vaul`): filters, sort with direction and grouping, applied at once.
- Done:
  - core: `talents` and `seen` sorts, sort direction (`defaultSortDir`), missing values last both ways; `TABLE_SORTS`, `dir` and `group` in `rosterQuery.ts`; `talentsText`.
  - Page: `/roster/table` with its `loading.tsx`; the shared empty state in `src/app/(site)/roster/empty.tsx`.
  - Components: `RosterTable`, `RosterSheet`; `RosterToolbar` gets `table`; `ClassDisc` size `xs` (26 px); table tokens in `tokens.css` part 2.
  - Tests: unit tests for the sorts and URL keys; Playwright `tests/e2e/roster-table.spec.ts`; design checks in `tests/design/roster-table.spec.ts`.

### WEB-21 Roster: cards
- Board: `roster-cards`.
- Header "6 friends · 10 characters · Sanne has no addon yet", Cards/Table switch, search, filters (class, role, level, profession), sort (last played).
- "Who is around which level": level spread with dungeon bands and fits.
- Quick answers: healers, tanks, level 30–40, level 60.
- Friend panels: avatar, name, BattleTag, character count, data age badge ("Data 2 days ago · via Bob").
- Character rows: class disc with level, name, race, class, main tree, role, faction tag, top professions, last played, last seen zone, item level ("ilvl —" when missing). A row opens the character.
- Decided with Nico (2026-10-26):
  - The dungeon bands stack in as many rows as they need, best band first in gold, the others neutral. Full names label the track in as many rows as they need, computed on the server per layout width.
  - On phone: dots only, the names in level order under the track, and the bands as a list.
  - Filter menus: class and role pick several; level ranges (1–19 … 60) and profession pick one. Sort: last played, level, name, item level, profession (by the chosen profession's skill, else the best rank).
  - Search covers character, friend and BattleTag. All state lives in the URL: filters and sort push a history entry, typing replaces it.
  - While filtering: "N of M characters" with "Clear filters", tag lines read "1 of 3 characters", panels without matches and no-addon panels are hidden, and "No characters match" shows when nothing is left.
  - Copy: the old-data note, the no-addon copy without a pronoun, and the empty and error states.
  - The Table link goes to a WEB-22 placeholder and keeps the query; rows link to a WEB-23 placeholder.
  - e2e: a fresh database per run, an `empty` step before `seed`.
  - Data ages come from the shared scale only (Nico's change of the thresholds lands separately, PR #19).
- Done:
  - core: `search` and the `profession` sort in `roster()`, `total` per friend; `rosterQuery.ts` (URL ↔ filter, level ranges, sorts, profession slugs); `spreadLayout.ts` (label rows, band rows); `joinNames`.
  - Page and states: `src/app/dataset.ts`; `/roster` with `loading.tsx` and `error.tsx`; `/roster/table` and `/character/[guid]` placeholders.
  - Components: `src/components/roster/` (`RosterToolbar`, `FilterMenu`, `LevelSpread`, `QuickAnswers`, `FriendPanel`, `CharacterRow`), `SegmentedNav` and `SearchIcon` in `src/components/ui/`, and roster tokens in `tokens.css` part 2.
  - Tests: Playwright `tests/e2e/roster.spec.ts`, `roster.empty.ts`, `seed.setup.ts`; design checks in `tests/design/roster.spec.ts`.
  - Sample files to upload by hand: `tests/fixtures/sample/` (three consecutive days, e2e admin or your own BattleTag), generated by `sampleSavedVariables({ self, now, day })`.

### WEB-19 Upload page and states
- Boards: `upload`, `upload-states`. Admin and members (WEB-06).
- Dropzone and "Choose file"; the whole page accepts a drop ("Let go to upload"); where to find the file (`WTF › Account › [ACCOUNT] › SavedVariables`, "/reload first").
- States:
  - **reading**: "Reading the ledger…", "10 characters from 5 friends"
  - **wrong file**: "That's not our ledger", naming the file if it is another addon's (e.g. `Questie.lua`); nothing changed
  - **newer addon version**: "This file is from a newer addon. It uses data format N; the site reads up to M"
  - **nothing new**: "Same data as your upload of today 21:14. Did the game save yet?"
  - **not your file**: the file belongs to another BattleTag ("This is Bob's ledger, sign in as Bob to upload it"); nothing changed
  - **other community**: the file's addon has another community selected ("This ledger is for another community"); nothing changed
- History: time, uploader, summary line ("5 levels gained · 4 skill gains · 1 new character"), Done / Rejected with reason; a line links to its session report.
- Decided with Nico (2026-10-26): the boards' motion stays as this page's small accents; history footnote reworded (members upload too); copy for the states without a board; everyone's uploads in the history with summary-line rules; clock times in the viewer's local time; the browser reads the file for the counts; the newer-format button opens the addon's GitHub releases (all in `docs/DESIGN.md` §8 and §11).
- Done: `src/app/(site)/upload/page.tsx` (`notFound` for anyone who may not upload), `src/components/upload/` (`Dropzone`: dropzone, whole-page drop, every state, `aria-live` status, focus to the state's action; `UploadHistory`), `LocalTime` in `src/components/ui`, a plain `/upload/<id>` that WEB-20 replaces; `src/core/views/upload.ts` (`uploadOutcome`, `checkBeforeUpload`, `ledgerCounts`, `summaryLine`, `historyLine`) and `clock.ts` (`clockTime`); the server returns `uploadedAt`, `unreadable`, `schemaVersion` and `previousUploadAt` and lists uploads (`listUploads`, `getUpload`, `displayNames`), with migration `0002_upload_unreadable`. Tests: `tests/unit/views/upload.test.ts`, `tests/server/uploads.test.ts`, Playwright `tests/e2e/upload.spec.ts` (per-project members, so parallel projects don't race on the admin's own record) and design checks `tests/design/upload.spec.ts` (states from canned answers, so the design database stays the same).

### WEB-20 Session report
- Board: `upload-report`. Shown after an upload and from the history.
- Header "Session report, uploaded today at 21:14 by Nico · new data from 4 friends"; counters (levels gained, skill gains, new characters, new sightings).
- Sections:
  - level ups ("LEVEL UP ×2", 37 → 39)
  - new face ("Femke's new Orc Warlock · level 15 · Durotar")
  - who sent data
  - skill gains with "CAP REACHED"
  - gear (item level 31 → 34)
  - new sightings, with "See them drop in on the map" (WEB-26)
- Motion: staggered rise, bars grow, LEVEL UP shine (§6); static with reduced motion. "Replay" and "Upload another".
- Decided with Nico (2026-10-26): class and race come from the current data (the stored summary has none), level and place from the summary; level bars out of 60, skill bars out of 300 (gold gradient for a reached cap), the bars grow with a transform; the hero's rays, halo, embers and the badge shine stay as this screen's accent, off without motion; zero counters dim, empty sections hidden; lists show 6 rows, then "Show N more"; "First upload by Nico · N characters from M friends"; removed characters and characters without a record named; "Uploaded today at 21:14" in the viewer's time zone; "who sent data" dots follow the data age scale; a rejected or nothing-new upload shows its upload screen state; every signed-in viewer may open a report ("Upload another" for uploaders only); phone layout in one column (all in `docs/DESIGN.md` §11).
- Done: `/upload/<id>` (`src/app/(site)/upload/[id]/`: page, `loading.tsx`, `error.tsx`), `src/components/report/` (`SessionReport`, `ReportControls`: "Show N more", "Replay"), `UploadStateCard` in `Dropzone.tsx`, `ClassDisc` size `report`, report tokens in `tokens.css` part 2; `sessionReport` and `shortAge` in `src/core/views/report.ts`, `storedOutcome` in `upload.ts`, `clockTimeAt` in `clock.ts`. Tests: `tests/unit/views/report.test.ts`, `upload.test.ts`, Playwright `tests/e2e/report.spec.ts`, design checks `tests/design/report.spec.ts` (the design seed now uploads the day before first, so upload 2 has a full report).

### WEB-23 Character detail
- Board: `character`.
- Header: name, level, race, class, faction, ruleset (WEB-13), played by, last played, data age and source ("own addon" / "via X").
- Level block with "21 levels to 60" and dungeon fit; at a glance (item level, role, main tree, faction, ruleset); talents bars; professions with "Compare with the group"; quest log (titles only, "as the addon recorded them 2 h ago"); last-seen mini map ("Lia is here too", "On the map"); the owner's other characters.
- Decided with Nico (2026-10-26): the mini map is built now from WEB-25's pieces (zones.json, the occupied tint, `CharacterMarker`), held still; "On the map" goes to `/?character=<guid>`; "Compare with the group" to `/professions#<slug>`; hero colours from the class tokens; pills "Played by", "Last played" (green when new, amber at 7 days), data age plus "· own addon" or "· via X"; quest titles in ID order; layout three, two and one column; the empty, not-found, loading and error states (all in `docs/DESIGN.md` §11).
- Done: `/character/<guid>` (`src/app/(site)/character/`: a layout that answers 404 before the page streams, `not-found.tsx`, and `[guid]/(detail)/` with the page, `loading.tsx`, `error.tsx`), `src/components/character/` (`CharacterHero`, `AtAGlance`, `TalentBars`, `ProfessionList`, `QuestLog`, `MiniMap`, `OtherCharacters`), `CharacterMarker` as a link or picture, `ClassDisc` size `avatar`, `DataAgeBadge` text helpers, the Roster tab current on a character page, character tokens in `tokens.css` part 2; `zoneViewBox` and `miniMap` in `src/core/views/map.ts`, `fanOffsets` moved to `mapMarkers.ts`, `miniWavePath` in `src/core/map/waves.ts`, `hereToo` in `character.ts`. The sample's Ves has the board's quest log. Tests: `tests/unit/views/map.test.ts`, `character.test.ts`, Playwright `tests/e2e/character.spec.ts`, design checks `tests/design/character.spec.ts`.

### WEB-17 Sign-in screens
- Boards: `sign-in`, `sign-in-states`.
- "Where is everyone in Azeroth tonight?", "Sign in with Battle.net" over the drifting map, "We only read your BattleTag, nothing else".
- States:
  - **not on the list**: "Stranger#1234 isn't on the Doombringers guest list. Send Nico your BattleTag and he can add you." Buttons: use another Battle.net account, sign out.
  - **Battle.net didn't answer**: try again
  - **signing in**: "Checking the guest list… Back from Battle.net as Femke#3307", then straight to the map
- Decided with Nico (2026-10-27): the site name comes from the data and the admin is named by the part of `ADMIN_BATTLETAG` before the `#` ("Vestras", also on the component gallery instead of "Nico"); the pings are decoration at the board's spots, not data; "not on the list" reads the refused BattleTag from a 10-minute cookie (text only, access never depends on it) and treats a block like not being on the list; "Use another Battle.net account" signs out of the site and of Battle.net (`eu.battle.net/login/logout?ref=…`, since Battle.net ignores `prompt=login`; tried by Nico) and lands back on sign-in; after Battle.net a welcome step shows "Checking the guest list…" for a second, then goes on; every state is on the drifting map; board values go into tokens; the footer is gone from every page (all in `docs/DESIGN.md` §11).
- Done: `/signin` (sign-in panel; any Auth.js error but a refusal is "Couldn't reach Battle.net" with "Try again"), `/signin/welcome` (signed in only, `GoOn` replaces it with `?to=`, a local path), `/not-on-list` (session BattleTag, else the refused one; sign out, another account); `src/components/signin/` (`SignInScene`, `SignInPanel`, `StatePanel` and its parts); the pings in `DriftingMap`; `src/server/refused.ts` (the cookie, `adminName`), set in the Auth.js `signIn` callback; `isBattleTag` and `battleTagName` in `src/core/access.ts`; sign-in tokens in `tokens.css` part 2; `SiteFooter` removed. Tests: `tests/unit/access.test.ts`, Playwright `tests/e2e/signin.spec.ts`, design checks `tests/design/signin.spec.ts`.

### WEB-18 Admin page: guest list
- Admin only. Members (from the data, with the upload that added them, block and unblock), guests (add by BattleTag, remove, "may upload"), who signed in last.
- Validation of BattleTag format; adding an existing member says so.
- Decided with Nico (2026-10-27, no board): `/admin` (404 for anyone but the admin), reached from an "Admin" item in the account menu; three panels in the upload history's style (Members wide on the left, Guests and Blocked on the right, one column below 1024 px); member rows with display name and BattleTag, "Added by Bob's upload" with its time (opens the report), "Last seen …" and Block / Unblock; the admin first with an "Admin" badge and no Block; guests with a "May upload" chip, Block and Remove; blocked members stay listed, dimmed, with a "Blocked" badge; no confirm dialogs (everything can be undone); "who signed in last" is "last seen", written by the proxy at most once an hour; the add-guest form refuses a non-BattleTag, a member, the admin and a listed guest (all in `docs/DESIGN.md` §11).
- Done: `/admin` (`src/app/(site)/admin/`: page, server actions that check the admin again, `loading.tsx`, `error.tsx`), `src/components/admin/` (`AdminPanel`, `RowButton`, `RowBadge`, `AddGuestForm`), `AdminIcon`, the account menu's Admin item; `adminView` in `src/core/views/admin.ts`, `loadAdminView` in `src/server/admin.ts`, `addGuest`, `touchLastSeen` and `listLastSeen` in `src/server/access.ts`, table `last_seen` (migration `0003_last_seen`); the admin API routes use `nowSeconds()`. Tests: `tests/unit/views/admin.test.ts`, `tests/server/access.test.ts`, Playwright `tests/e2e/admin.spec.ts`, design checks `tests/design/admin.spec.ts`.

### WEB-02 Design prompt for Claude Design
- Goal: a prompt Nico pastes into Claude Design to workshop the whole site's UX and look until it is close to ideal, and a record of what was decided.
- Deliverable `docs/DESIGN-PROMPT.md`, self-contained (Claude Design knows nothing about this project):
  - What the site is, who uses it (Nico uploads; 4-8 friends browse, mostly to plan play sessions and find crafters), when (not in game: at work, on the couch, on a phone).
  - **Visual direction:** Vanilla WoW (parchment, gold-trimmed frames, class colors, serif display type in the spirit of Friz Quadrata, Azeroth map art) made with modern techniques: drifting fog and volumetric light, parallax depth, subtle particle embers, smooth transitions, glass and blur layers. "Really cool looking" is the bar; it should feel like a premium fan site, not a spreadsheet. Respect `prefers-reduced-motion`.
  - **Screens, in priority order:**
    1. **World map (hero):** a big map of Azeroth (Eastern Kingdoms, Kalimdor) with small icons (class color, or portrait) of characters at their last known zone, region-level precision. Clustering when many sit in one zone, hover/tap for name, level, class, "seen 3 h ago", fading for old sightings, dungeon sightings shown at the dungeon's zone. Filters: person, online recently, faction.
    2. **Alts / roster:** per friend, their characters: class, race, level, item level, role, main talent tree, professions, last played. Sort and filter; compare across the group ("who has a level 60", "who is closest to 40").
    3. **Professions:** who has which profession at what skill (rank/max bars), gaps in the group ("nobody has Alchemy"), later recipes ("who can craft Bolt of Silk Cloth").
    4. **Character detail:** everything about one character.
    5. **Upload (admin):** drag and drop the `.lua` file, result summary (what changed: new characters, level ups, profession gains), upload history.
    6. **Login:** "Sign in with Battle.net", not-allowed state.
  - Shared states: data age per person ("data from 2 days ago, via Bob"), empty state before the first upload, a friend without the addon, a character with no location.
  - Real data shape and edge cases: names with a space ("Ves Doombringer"), 10+ alts for one person, realm names that change, item level missing, sample data generated from the addon fixtures (invented players).
  - Responsive: desktop first, map and tables that work with touch at 375 px wide.
  - Technical constraints for the output: React components, the libraries in `docs/ARCHITECTURE.md` plus the map/styling/animation choices the design proposes (listed as proposals, Nico decides), accessible contrast.
  - A list of open UX questions to work through in the workshop (navigation model, map interaction, how much motion, density of the roster, phone layout of the map).
- After the workshop: `docs/DESIGN.md` records decisions (tokens: colors, type, spacing; components; screen layouts; chosen map/styling/animation libraries) and links the Claude Design result. Those libraries get added to `docs/ARCHITECTURE.md`.
- Decided: **map art** is a custom illustrated Vanilla-style map, made in the workshop (Blizzard's in-game map textures are their copyright).
- Part 1 (done): `docs/DESIGN-PROMPT.md`.
- Part 2 (done): the workshop; decisions in `docs/DESIGN.md`, boards in `design/boards/`.

### WEB-26 Map zoom, pan and motion
- Pan, zoom and pinch (`react-zoom-pan-pinch`); zoom levels per §5: world 1× (capitals), continent 2× (towns, fans by default), zone 4× (dungeons, name tags on all markers, zone name in the top bar, other zones dimmed).
- Bounded, springy pan (Nico, 2026-10-26): the sea is endless (WEB-25), but the view stays near the world. Dragging past the edge gives resistance, and on release it springs back so some land stays in view (no spring with reduced motion).
- Fly to a character (600 ms pan + zoom; jump with reduced motion).
- New sightings after an upload: drop + one ripple (from the session report link).
- Decided with Nico (2026-10-26/27): proposals 1–8 (range 1–4×, + and − step 1 → 2 → 4; the continent switch as a fly that follows a pan; labels and markers keep their screen size; the zone in the centre named in the top bar at 4×; fly-to from `?character=` and `flyToCharacter` for WEB-27/28; the drop from `?drop=<upload id>`; 44 px buttons and keys; `react-zoom-pan-pinch` pinned). Azeroth centres the land; the centre leaves room for the roll call panel.
- Done: `src/components/map/MapStage.tsx` (zoom, levels, fly, drop, settle), `Zoom.module.css`, `flyTo.ts` (`flyToCharacter(guid)`: WEB-27 and WEB-28 call it); zoom helpers in `src/core/views/mapMarkers.ts` and `CONTINENT_SPLIT` in `map.ts`; towns, dungeons and name tags; the top bar's zone slot; the session report links to `/?drop=<id>`. WEB-27: give the roll call panel `data-map-panel` and move the zoom buttons left of it (the board's `right: 352px`).

### WEB-27 Roll call panel
- Board: `map`. Desktop panel next to the map: "Roll call · 9 of 10 located".
- Filters: everyone or one friend, New (under 32 h), faction, level range; legend (new, days, week+).
- Rows grouped by age with zone, owner, "via", age; picking one flies the map to the character.
- Unknown whereabouts tray and the no-addon line.
- Decided with Nico (2026-10-27): proposals 1–10. Legend: New < 32 h, Recent, Days, Week + (static). Row age short ("now", "N min", "N h", "N d"). Faction and level menus are the roster's `FilterMenu` (level: the roster's ranges). Friend chips: All plus everyone with the addon, uploader first. Filters live in the URL (`friend`, `new`, `faction`, `level`), Back undoes them, and the map shows only the matching characters. A row on the map flies there and selects it (`?character=`); a battleground or "elsewhere" row, and an unknown-whereabouts row, open the character. Sub-line "Zone · Owner, via X", or the amber "X's data is N days old". Panel from 1024 px; below, the phone sheet (WEB-28). No match: "No characters match" with "Clear filters".
- Done: `src/components/rollcall/` (`RollCallPanel` on the server, `RollCallFilters` and `PickRow` on the client), `data-map-panel` on the panel and the zoom buttons left of it; `rollCallQuery.ts` (URL), `rowAge` in `age.ts`, `onMap` and `ago` on the roll call rows, `worldMap(d, now, only)` and `isMapZone` in `map.ts`; Playwright `tests/e2e/rollcall.spec.ts`, design checks in `tests/design/map.spec.ts`.
