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
### WEB-29 Empty site, loading and stale data
- Boards: `empty-site`, `loading`.
- Before the first upload: "The map is still empty", "Upload the first file" for admin and members; for guests: "Nico hasn't uploaded any data yet. Check back after the next session."; the guest list shown in the roll call.
- Loading: zones paint at once, markers fade in, a thin gold line only after 300 ms; skeletons that keep the layout still.
- Stale: the site-wide banner (last upload 7 days or more), a friend's amber badge after 7 days.
- Decided with Nico (2026-10-27):
  - Only the admin gets "Upload the first file" (before the admin's first upload nobody else can upload, WEB-19); everyone else reads "<admin> hasn't uploaded any data yet. Check back after the next session.", the admin named by the part of `ADMIN_BATTLETAG` before the `#`. Map, roster and professions say it alike (`FirstUploadState`).
  - The roll call before the first upload: "0 located" and the guest list (the admin, then the guests) with dashed discs; members only come with uploads. Desktop: the panel at the roll call's place. Phone: card and list follow under the map (no sheet yet).
  - The thin gold line: one line under the top bar while a navigation from the shell's links is pending, visible after 300 ms; none without motion (as on the board). No route `loading.tsx` for it, so a page's 404 keeps its status. Markers fade in (400 ms).
  - Skeletons stay per screen (roster, table, professions, character, report have theirs).
  - Stale data: the banner (WEB-15) and the amber badge (WEB-21) were already built; their look is in the component gallery's baselines.

### WEB-32 Known bugs
One story for the known bugs, fixed together (Nico, 2026-10-27). No longer on hold: the `roster-cards-runs` board now draws the fixed level spread (dots only, names on hover or tap, characters within 2 levels merge into a number, a gold ring for your own characters, bands that count who fits without names, the Scarlet Monastery wings as separate bands); build the roster parts to it, without its run parts (those are WEB-45). Do it before WEB-45 (Nico, 2026-10-27). Add each one here with where it shows; each fix gets a test.
- **Roster level spread: which dot is whom isn't clear** (`/roster`, "Who is around which level", WEB-21). The names stack in rows above the track, so with several characters close together it isn't clear which name belongs to which dot; two characters at the same level show one dot under two names (seen: two yellow names, one dot). Fix: the track shows only the dots; a name shows on hover and keyboard focus (tooltip). Characters at the same level get one dot with a count, and its tooltip lists them. Changes the approved WEB-21 layout: record in `docs/DESIGN.md` §11 (Nico, 2026-10-27).
- **Dungeon bands never show character names** (same place). A band reads "Scarlet Monastery 26–45 · fits Khrono Wolfhowl, Ginji Shadowstep, …"; it must only name the dungeon and its level range. Who fits may show on hover, like the dots (Nico, 2026-10-27).
- **Scarlet Monastery is four dungeons** (`src/core/gamedata/dungeons.ts`, roster bands, character page fit). It is one entry with 26–45; Graveyard, Library, Armory and Cathedral each have their own level range. Split it into four wings with sourced ranges (`docs/WOW-FOREVER.md`, CLAUDE.md rule 10; check whether Forever changed them). The addon's zone text is "Scarlet Monastery" for every wing, so the map and zone aliases keep one place (Nico, 2026-10-27).
- **Flaky e2e test** `tests/e2e/atmosphere.spec.ts` "the map page is alive, data pages are calm": in CI it sometimes finds animations still running on `/roster` (24 on PR #40's first run, twice in a row), passes on a rerun and locally. Find what runs there (likely skeleton shimmer or a transition right after navigation) and wait for it properly.
- Decided with Nico (2026-10-27): phone as desktop (dots, names on tap; the names list under the track goes), but merging within 4 levels so the dots stay 24 px apart (axe `target-size`); bands keep WEB-21's neutral style with the gold best band and only count (no names on hover; WEB-45's popover and the dungeon page name them); a short hint "Hover or tap a dot for names · gold ring: your characters · bands show typical levels" instead of the board's row of notes. Merged dots: each character at most 2 levels above the one before (37, 39, 41 make one dot "around level 39", at the middle of the lowest and highest level).
- Done: `RUNNABLE_DUNGEONS` in `src/core/gamedata/dungeons.ts` (every dungeon once, Scarlet Monastery as its four wings `sm-graveyard` … `sm-cathedral`; ranges from the addon's `Dungeons.STATIC`), used by `levelSpread` (roster bands) and the character page's fit; `spreadDots` in `src/core/views/spreadLayout.ts` (replaces the label rows); `src/components/roster/SpreadTrack.tsx` (dots and tooltips) in `LevelSpread`. The flaky test waited for the "Roster" heading, which the loading page has too: its 24 skeletons shimmer until React swaps in the streamed page, sometimes after the load event. It now waits for the level spread and no `aria-busy`.

### WEB-38 Bot API
- `/api/bot/v1/` with one Bearer bot token (stored hashed, like the uploader tokens; created and revoked by the admin, shown once). Session cookies are not accepted there, the bot token nowhere else (CLAUDE.md rule 6 gets this endpoint).
- `GET settings`; `GET events?after=<cursor>` as a **long poll** (answers at once when there are events, otherwise holds up to about 30 s), so new events reach the bot within about a second without an open port on the bot; `POST events/<id>/posted` with the Discord message id (an event is handed out until acknowledged, never posted twice).
- Events: milestones per accepted upload (every 10 levels, level 60, a profession at its cap, a new character; grouped per upload), run created, changed (time, note, answers), cancelled, reminder due, starting now, done or didn't happen, ask now from the game, ping from the game.
- Run actions for the bot: create (`/plan`, `/ask`), answer (buttons; Pick my character lists the asker's characters in range), edit and cancel (`/run`; own runs, the admin any).
- The contract in `docs/BOT-API.md` (fields, errors, versioning: only optional fields within v1), as `docs/UPLOADER-API.md` is for the uploader.
- Tests: the token check, the long poll, the cursor and acknowledgement, milestone events from sample uploads, run rights.
- Decided with Nico (2026-10-27): until WEB-39 the admin makes and revokes the token with an admin-only route (`/api/admin/bot-token`, from the browser console), no UI; the site's first accepted upload makes no milestones, every later one does (a newcomer's first data too); a level up crossing several marks is one milestone for the highest, 60 is its own kind; a profession counts only when its rank rises to the cap of its training rank, never when the cap is raised; events not posted within 7 days expire.
- Done (milestones only): `src/core/bot.ts` (token format, cursor, `milestones`), `src/server/bot.ts` (token, events, acknowledging, long poll), the routes under `src/app/api/bot/v1/` and `src/app/api/admin/bot-token`, migration `0005_bot`, the contract `docs/BOT-API.md`. Run events and run actions are drafted in `docs/BOT-API.md` and built with WEB-40 and later; their tests (run rights) move there.

### WEB-28 Phone map
- Boards: `phone-map`, `phone-character`, `phone-roll-call`. Bottom sheet: peek → half → full (built without `vaul`, see `docs/ARCHITECTURE.md`).
- Peek: the first roll call rows; edge hint "4 in Kalimdor". Tapping a marker zooms in and opens the character half sheet (level, seen, player, item level, role, spec, talents, professions, "Open character", next character in the zone). The full sheet is the roll call with its filters.
- Bug (found in WEB-27, Nico 2026-10-27): on a phone, `?continent=eastern-kingdoms` framed the continent and sprang back to the whole world about 120 ms later. Fixed: a continent frames at 1.25× at least and the phone map fills the screen (`map-continent-phone` shows the continent again).
- Decided with Nico (2026-10-27, all 12 proposals): the sheet below 1024 px; snap points 136 / 400 px above the tab bar and 96 px from the top; full names in the peek and the next button; `?character=` as a history entry (Back closes); the WEB-27 filters in the full sheet; the approved phone app bar plus Filters; the edge hint on either side; 120 ms fade without motion. Deviations in `docs/DESIGN.md` §11.
- Done (PR #35).

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
- Done (PR #36, #37).

### WEB-34 Uploader page
- Board `uploader-page` (copied from the uploader repo). Page `/uploader` for everyone who may upload.
- Intro, "Download for Windows" (WEB-35) with version and size, the three steps, "Your uploaders" (device, connected, last upload, active, Revoke), "Create a token by hand" (shown once, copy button), the note that uploader uploads count like manual ones.
- Pairing approval: with `?code=` the page shows "Connect an uploader?" with the device name and code, Allow / Deny; a wrong or expired code says so.
- Top bar: "Upload" becomes "Uploader". The manual upload page stays and is reached by a small "Upload manually" link on the uploader page (decided with Nico).
- Every UI story criteria, design checks.
- Decided with Nico (2026-10-27, all 13 proposals; 3 became WEB-33b, the OAuth 2.0 device flow): Allow / Deny as server actions that redirect to `?notice=` (allowed, denied, bad-code, too-many, too-many-tries); no field to type a code; 10 wrong codes per 10 minutes per user (links opened count too); "● active" = used in the last 7 days; one device icon; Revoke asks inline; a token by hand needs a name and lives only in the form's state; "via" in both history lists; the download button disabled until WEB-35. Deviations in `docs/DESIGN.md` §11.
- "Upload history" (Nico, 2026-10-27, board `uploader-page` revised with it; all 5 proposals): the viewer's own uploads, app and manual, by Today / This week / Earlier; filters All, each device, Manual, Problems (`?show=`); pills from the summary line; Done, Nothing new, Rejected; 20 at a time with "Show older uploads" (`?older=`); every row opens its report.
- Done (PR #38).

### WEB-35 Installer hosting and update feed
- The repos are private, so the site hosts the uploader: `/uploader/download` (signed-in users) and the Velopack update feed for the app (Bearer token), from a folder on the data volume (`/data/uploader`).
- `POST /api/uploader/v1/releases` with a deploy secret (env var), used by the uploader repo's release workflow to publish a new version (installer, packages, feed files). Only the newest few versions are kept.
- Tests for access (no download without sign-in, no feed without a valid token, no publish without the secret).
- Manual: set the deploy secret in the TrueNAS app config and as a GitHub secret in the uploader repo.
- Decided with Nico (2026-10-27, all 12 proposals): files in `DATA_DIR/uploader/`; one multipart publish streamed to disk and checked against the feed (size, SHA256, newer version, else 409), switched in with the feed and `current.json` last; `UPLOADER_DEPLOY_SECRET` (off without it); full packages first, deltas accepted; newest 3 versions kept; the feed for any active token, file names only from the feed; the download for those who may upload; "Download for Windows" with version and size once released. nginx stays at 30 MB: a publish must fit (Nico: the app is small). Later: nginx allows 200 MB, since the app became self-contained (Nico, WEB-35b).
- Done (PR #42).

### WEB-39 Link Discord, the Discord page and time zones
- Board: `discord-settings-runs` (the newer one; `discord-settings` is the same page without the runs section).
- A "Discord" page in the top bar and account menu: link and unlink your Discord account (Discord OAuth2, `identify` scope only), your link status. Stored: Discord user id and name with the BattleTag; never shown to others except in the admin's linked-friends list, never in posts.
- **Your time zone:** taken from the browser on first sign-in, changeable on this page. Used for `/plan` times in Discord (Discord doesn't tell a bot the user's time zone) and shown wherever a time is typed. Without one, the admin's time zone.
- Admin: the bot token (WEB-38), bot status, channel for posts, recap channel, toggles per post type (milestones, runs, recap), recap time (default Sunday 13:00, WEB-41), mention role on new runs, a test post, a recap preview, the linked friends (n of m). Runs section: runs channel, reminder time (15 min, 30 min, 1 hour, 2 hours; default 30 min, also used by the in-game toast), "Starting now" (always on), ask now from the game (on or off), mark runs done from uploads (on or off). "Can delete any run" shows the one admin, not the board's two.
- ~~`GET lookup/...` endpoints for the bot's commands (`/whereis`, `/who`, `/whocancraft`, `/character` with autocomplete, `/alts`, `/me`, `/runs`), answered for a Discord user id only when it is linked to a member or guest.~~ Moved to WEB-39b (Nico, 2026-10-27).
- Manual: Nico creates the Discord application's OAuth2 redirect for the site (secrets only in TrueNAS env).
- Decided with Nico (2026-10-27): linking is our own OAuth route (authorization code with PKCE and state, `identify` only, the Discord token revoked right away and never stored), env `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`, redirect `<AUTH_URL>/api/discord/callback`; the bot reports channels and roles (WEB-38), until then those dropdowns are disabled; time zone and token cards as deviations (DESIGN.md §11).
- Done (PR #53): migration `0006_discord` (`discord_links`, `user_prefs`, `bot_settings`), `src/core/discord.ts`, `src/server/discord.ts` (`getBotSettings`, `linkForDiscordUser`, `effectiveTimeZone` for WEB-38/40/41), `src/server/discordLink.ts` and `/api/discord/callback`, the page `/discord` with its actions, `TimeZoneSync` in the site layout. A Discord account linked to another BattleTag is refused ("taken"), not moved. After WEB-38 merged: `GET /api/bot/v1/settings` carries the settings (optional fields, `docs/BOT-API.md`) and the Milestones switch off makes no milestone events. Then (assigned by Nico): the "Bot token" card on WEB-38's token functions (the console route `/api/admin/bot-token` is gone), the status pill from the token's last call ("online" within a minute), "Send a test post" as a `test` event (`enqueueBotEvent`). The channels and roles are WEB-46; "Send a test run post" is WEB-40.

### WEB-35b Signed update feed, owned by the release workflow
Nico, 2026-10-27: "the ideal route", the Velopack way. The uploader's UP-10 signs the feed; the site's WEB-35 merged and rewrote the feed, which broke the signature.
- `POST /api/uploader/v1/releases` requires `releases.win.json.sig` next to the feed and keeps both exactly as uploaded: no `mergeFeed`; exactly the packages the new feed lists are kept, every older one it lists must already be on the site with the same size and SHA256.
- `updates/[file]` serves the feed and the signature byte for byte, `no-store`.
- `GET /api/uploader/v1/updates/status` (UP-10 proposal): latest, releasedAt, minimumVersion (`UPLOADER_MINIMUM_VERSION`), notesUrl (null until a "What's new" page, backlog).
- The workflow pulls the feed and the newest full package before `vpk pack` with `GET /api/uploader/v1/releases/<file>` and the deploy secret (`vpk download http` can't send a Bearer token), trims the pulled feed to the last 2 earlier versions, packs, signs and publishes (uploader repo).
- `docs/UPLOADER-API.md` (additive within v1), nginx 200 MB.
- Done (PR #55; the workflow: uploader repo).

### WEB-36 Favicons and app icons
- Nico's icon set (2026-10-27) is in `design/favicons/` (originals, unchanged): `favicon.ico`, `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, a `site.webmanifest` and `favicon-preview.png` (the preview, not shipped).
- Wire them up the Next.js App Router way: `src/app/favicon.ico`, `icon.svg`, `apple-icon.png` (from `apple-touch-icon.png`), and the PNGs for the manifest. Browsers, iOS home screen and Android get the right one.
- The web app manifest is generated by `src/app/manifest.ts`, not the static file: its `name` and `short_name` come from the site name in the data (CLAUDE.md rule 11: the site name is never hardcoded), falling back to "CommunitiesForever". Colours from the tokens (`--bg-night`), icons as in the supplied manifest, the maskable one marked `maskable`.
- The shield emblem: the same mark as the top bar's brand? If they differ, ask Nico which one is the final emblem (`docs/DESIGN.md` §10 open item).
- Tests: the icon routes answer (200, right type), the manifest has the data's site name. Manual: the tab icon in Chrome and Firefox, "Add to home screen" on a phone.
- Done (PR #56): `src/app/favicon.ico`, `icon.svg`, `apple-icon.png` and the manifest PNGs in `public/`, byte for byte Nico's originals; `src/app/manifest.ts` (`/manifest.webmanifest`, the site name per request, `--bg-night`). The shield is the top bar's mark (same paths; filled and in `--gold-bright` for small sizes), so no question was needed. The icons and the manifest are open without a session (`ICONS` in `src/proxy.ts`, CLAUDE.md rule 6): sign-in needs them and browsers fetch the manifest without cookies; they carry only the site name, which sign-in shows anyway. Tests: originals unchanged, the manifest, the open routes and their types (e2e).

### WEB-40 Runs
- Boards: `runs`, `run-detail`, `run-create`, `runs-phone`. "Runs" in the top bar with the number of upcoming runs you can join.
- Model (own database, forward-only migration): run (dungeon or wing, start in UTC, note, organiser and their character, source website / Discord / game, state open, full, started, done, didn't happen, cancelled), five role slots (tank, healer, three damage) filled from the role the addon knows per character (from talents or set by the player), answers (I'm in / Maybe / Can't, character, where it came from and when).
- Runs page: this week, later, past; filters "Runs I can join" (one of your characters fits), Mine, All; your answers; "Where runs show up". Run detail: slots, answers with their source, who could join, the organiser's edit and delete, the admin's delete; times as "19:30 your time · 20:30 for Nico". Plan a run: dungeon (filled in when coming from a dungeon page or a roster band), lead as, day, time in your time zone ("everyone sees it in their own time"), note, the Discord preview, the time-passed and no-character-fits states.
- Full run: when someone drops out, the first Maybe whose character fits the free role moves up automatically and gets a quiet notice (Nico, 2026-10-27).
- Phone: answer buttons 44 px at the bottom; empty, loading and error states; an answer that didn't go through is kept on the phone and retried.
- Bot API (from WEB-38): the run events and run actions drafted in `docs/BOT-API.md` (create, answer, edit, cancel for a linked Discord user; created, changed, cancelled, reminder, starting, ended), with tests for run rights through the bot.
- Tests: rights (own, admin), slots from roles, moving up from Maybe, time zones around daylight saving.
- The Discord page's "Send a test run post" (disabled since WEB-39) posts a sample run in the runs channel (Nico, 2026-10-27).
- Decided with Nico (2026-10-27): past runs without an outcome until WEB-43; I'm in on a full role is kept as Maybe, first in line, and moves up when that role frees in a full run; an unknown role counts as damage; reminders and "starting now" are written when the bot polls (no scheduler); Past 2 hours after start; Edit run changes day, time and note only; the badge counts upcoming runs you can join and haven't answered; "Where runs show up" has the Discord line only until WEB-44; one answer per friend per run; Runs as a fourth phone tab with a calendar icon. Deviations in `docs/DESIGN.md` §11.
- Done: `src/core/runs.ts` (slots, answers, moving up, rights), `src/core/runTime.ts` (time zones, daylight saving), `src/core/views/runs.ts` (the pages), `src/server/runs.ts` and `botRuns.ts` (storage, bot events, the bot's run actions), migration `0008_runs`, the pages under `src/app/(site)/runs/`, `/api/runs/<id>/answer`, the bot's `/api/bot/v1/runs*` and `dungeons`, the "Send a test run post" button on the Discord page, `docs/BOT-API.md` (run events and actions).

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
- Done (PR #62): `.github/dependabot.yml` (npm and Actions, weekly, minor and patch grouped, into `develop`; ignored: `@types/node` majors, ESLint majors, TypeScript minors and majors, and `@playwright/test` and `better-sqlite3`, which are bumped by hand), the CI step "npm ci (deprecations in the job summary)", the lockfile refreshed within the ranges (20 packages). Checked 2026-10-27: nothing moved upstream (`eslint-plugin-react` 7.37 still ESLint ≤ 9, `typescript-eslint` 8.72 still TypeScript < 6.1, `drizzle-kit` 0.31.11 still `@esbuild-kit`, `next-auth` 5.0.0-beta.32 still the newest beta). Each pin and deprecation with its reason and exit: `docs/ARCHITECTURE.md` "Version pins".

### WEB-46 Channels and roles from the bot
Assigned 2026-10-27 (Nico): the Discord page's channel and role dropdowns, disabled since WEB-39, get their options from the bot.
- `POST /api/bot/v1/guild` with `{ channels: [{ id, name }], roles: [{ id, name }] }` (text channels the bot may post in, mentionable roles): the bot sends it when it connects and when its server's channels or roles change. Stored in its own table (forward-only migration), replaced whole on every report; ids are Discord snowflakes as text, names are untrusted text (CLAUDE.md rule 2).
- The contract in `docs/BOT-API.md` (an optional new endpoint within v1; an older site answers 404 and the bot carries on).
- The page lists them as "# name" and "@name"; a picked channel or role that's gone shows as "(removed)" until the admin picks another.
- Bot repo: BOT-08 reports them.
- Tests: the token check, replacing the list, untrusted names, a removed pick.
- Done (PR #63): migration `0007_guild` (`guild_items`, `guild_reports`), `src/core/guild.ts` (`parseGuildReport`, `guildOptions`), `src/server/guild.ts`, `POST /api/bot/v1/guild`, the Discord page's four channel and role dropdowns ("Not set", "# name" / "@name" in the bot's order, "(removed: # old-name)", "From the bot, 5 min ago"), `docs/BOT-API.md` "Guild". Defaults sent to Nico: the bot's order, no categories; the last name of a removed pick; the bot chooses which channels and roles; disabled until the first report.

### WEB-44 Runs for the uploader
- `GET /api/uploader/v1/runs`: the upcoming runs (next 14 days) of the uploader's community, with slots, answers, the organiser's time zone offset and `updatedAt`; documented in `docs/UPLOADER-API.md` (an optional addition; the uploader's v1 stays valid).
- Tests: only the token's community, only upcoming runs, the shape the uploader writes into `Runs.lua` (UP-12).
- Decided with Nico (2026-10-27): the answer is the addon's `CF_RUNS` field for field; `dungeon` is the addon's id (`smarm`, `lbrs`, `lfg1984`) where it has one, else the site's, with an optional `dungeonName`; a cancelled run stays, as `cancelled`, until its start. "Only the token's community": the site serves one community, so every run is the token's.
- Done: `src/core/uploaderRuns.ts`, `addonId` in `src/core/gamedata/dungeons.ts`, `GET /api/uploader/v1/runs`, `docs/UPLOADER-API.md` "Runs" (an example checked against the route). `updatedAt` is when the list last changed, so asking again without a change gives the same answer and the uploader writes nothing.

### WEB-43 Runs from uploads
- The addon (CF-47, CF-48) writes runs planned, answers given, asks with "Also post on Discord" and Discord pings made in game into its saved file; the site reads them from each upload (parser and compat fixtures, CLAUDE.md rule 4) and turns them into runs, answers and events. Each item carries an id from the addon, so a file uploaded twice changes nothing.
- An ask now from the game expires 10 minutes after it was made in game, and is only posted while it hasn't.
- Done: when an upload's run log (addon CF-23: dungeon, time, community members in the group) shows the dungeon within the run's window, the run becomes "Ran it · N of M signed-up came" and counts for the recap (WEB-41). No such upload within 4 hours of the start: "didn't happen".
- The session report and the uploader's summary show "N run answers".
- Decided with Nico (2026-10-27): built on the addon's sample of `pending` (CF-47/48 not released yet), its golden fixture joining `tests/fixtures/addon/` with the release; "Ran it" = the run log shows the instance on the run's realm day with at least two who said I'm in ("N of M signed-up came"), an addon story can add a start time later; a plan whose start has passed when it arrives is dropped (and still marked received); "N run answers" in the session report's header line and the summary line, not a fifth tile.
- Done: schema 2 (`SUPPORTED_SCHEMA` = 2), `src/core/gameItems.ts` (reading `pending`), `src/core/runOutcome.ts`, `src/server/gameItems.ts` (apply once by id, `received`, Ran it), "didn't happen" when the bot polls and on the Runs pages, migration `0012_game_items`, `received` in `GET /api/uploader/v1/runs`, `runEnded` / `askNow` / `ping` in `docs/BOT-API.md`, past runs "Ran it · 3 of 5 signed-up came" and "Didn't happen · no upload showed it". The recap (WEB-41) can count runs by `runs.outcome`.
- Runs v2 (WEB-47): answers and plans from the game carry a role when the addon sends one (`heal` and `dps` become healer and damage); without it the character's current role, as before.
- Release order: the site with WEB-43 before the addon release with CF-47 (schema 2), or uploads of the new addon are rejected as "newer format".

### WEB-47 Runs v2: level fit, roles and reserve
- **One rule for level fit** in `src/core`: `levelFit(level, min, max)` gives `{ kind, label }`, used everywhere a fit shows (runs list, run detail, Plan and Edit, the Discord run post data, "could join", the roster bands; today the same character is "too low" on one page and "16 levels short" on another):

  | kind | rule | label | can pick | suggested ("could fill") |
  |---|---|---|---|---|
  | fits | min ≤ level ≤ max | `fits` | yes | yes |
  | over | 1–9 above max | `+N over` | yes | yes |
  | carry | 10+ above max | `carry · +N` | yes, with a one-line XP note | no |
  | low | 1–5 below min | `N below` | yes, with a "tough" note | no |
  | tooLow | 6+ below min | `N below` | listed, can only answer Maybe | no |

  "Runs I can join" means a character that fits or is over.
- **Roles per class** in `src/core`: `rolesFor(class)`: Warrior tank and damage; Paladin and Druid tank, healer and damage; Priest and Shaman healer and damage; Mage, Warlock, Hunter and Rogue damage. The default is the role the addon reports (talents or set by the player); a choice here is per run and never changes the addon.
- **Data** (forward-only migration): a sign-up stores the character and the role apart (no longer derived from the character); existing sign-ups get the character's current role. A new answer state **reserve**: I'm in for a full role becomes reserve, and when a slot of that role frees up the oldest reserve moves up (next to WEB-40's moving up from Maybe). The organiser's own entry has a role and can change character and role.
- **API:** answering takes `{ characterId, role, answer }`; a new organiser and admin endpoint moves a sign-up to another role, to reserve, or removes it, and the moved person gets a quiet Discord notice (a bot event, no channel ping). Server checks: the role is in `rolesFor`, a tooLow character can only answer Maybe, only the organiser or the admin moves or removes.
- **Compatible additions** (rule 5 and the API contracts): `docs/BOT-API.md` (answer with role, the move action, the quiet notice event, role and fit per sign-up in run events), WEB-44's runs feed (role, fit and reserve per answer, so the uploader writes them into `Runs.lua`) all as optional fields within v1. Older bots and uploaders keep working; the bot's BOT-04 and the addon pick them up.
- Tests: `levelFit` at every boundary, `rolesFor` for every class, reserve promotion (oldest first, per role), the move endpoint's rights (organiser, admin, anyone else), the migration on existing sign-ups.
- Decided with Nico (2026-10-27): WEB-40's "Maybe, first in line" sign-ups become reserve (migration `0011_reserve`); a freed slot of a full role goes to the oldest reserve of that role, else the first Maybe that may join; a removed friend may answer again.
- Done: `levelFit` (`src/core/levelFit.ts`) and `rolesFor` (`src/core/gamedata/classes.ts`); the role chosen per sign-up and reserve in `src/core/runs.ts` (`giveAnswer`, `moveSignUp`); the move endpoint for the site (`POST /api/runs/<id>/move`) and the bot (`POST /api/bot/v1/runs/<id>/move`) with the quiet `runMoved` notice; answering with `{ characterId, role, answer }`; `guid`, `fit` and `reserve` per answer in `docs/BOT-API.md` and the uploader's runs feed (`docs/UPLOADER-API.md`), a reserve sent as Maybe for older bots and addons. The pages use the fit labels; the picker and the move menu come with WEB-49.

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
- Decided with Nico (2026-10-27, all 7 proposals):
  - four PRs, merged in order: a) history and the week window, b) the card functions and rotation, c) the recap job, the bot event and the preview, d) card images;
  - the recap is started by a check every minute inside the site process, which computes it once and catches up after downtime;
  - the sighting history is stored (zones per day for Tourist, Zone of the week, Map coverage, First footsteps, Homebody, Ghost town);
  - images with Next's built-in `next/og`: map crops from `zones.json`, the zone header with its map crop, the award header with the winner's class disc;
  - the admin's preview is a page `/discord/recap` (its screenshots need Nico's look);
  - the award is "<site name> of the week", the site name from the data;
  - week 1 is the first recap after launch; Then vs now, Season stats and Hall of fame count from there.
- Nico's card image references (2026-10-27): level 60, new character at 60, profession 300, the recap headers (award, zone), zone of the week and /whereis; all seven go into WEB-41d's renderer (BOT-03 and BOT-06 use them later).
- WEB-41a done (PR #68): `readFeeds` (`src/core/feed.ts`, compat snapshots for every release), the history tables `feed_days`, `feed_sharing`, `sightings` (migration `0009_history`, written with every accepted upload and by `rebuild()`), the recap moment in UTC (`src/core/recap/week.ts`: the latest weekday and time in a time zone, daylight saving, the week `[start, end)`).
- WEB-41b done (PR #72): `src/core/recap/` (pure). `cards.ts`: the 43 cards; `recap.ts`: the rotation, the quiet week, the headline (10 kinds) and challenge (12) choice; `texts.ts`: 3 phrasings per card, headline and challenge, closing lines, no pronouns (a test checks); `phrasing.ts`: the cycle per key, seeded by the week number. Choices made while building:
  - Slots: social are Duo of the week, Shared quest jackpot, Ghost town and Group suggestion; fun are First footsteps, Homebody, Most loyal alt, Longest streak, Fresh face and Who am I?.
  - Awards have no cooldown (the board's 10-week plan repeats The Grinder within 4 weeks); the rotating cards and the challenge do.
  - A character new this week counts no levels gained (its levels came before the site knew it); Fresh face is about it.
  - Thresholds where the board names none: The Grinder 2 levels, Tourist 3 zones, Altoholic 2 characters, Crafter 10 skill points, Quest machine 5 quests, Dungeon diver 2 runs, The Comeback 14 days away, Most improved and Gear jump 5 item levels, Zone of the week 2 friends, Busiest evening 3 friends, Top dungeon 2 runs, Quest log hoarder 15 quests, Gap alert below 175, Crafting race within 10 points, Ghost town 14 days, Most loyal alt 4 days, Longest streak 3 days, Group suggestion 3 friends, Shared quest jackpot 5 quests.
- WEB-41c done (PR #73): migration `0010_recaps` (`recaps`, `recap_start`), `src/server/recap.ts` (the schedule from the Discord page and the admin's time zone, the week's input from the history, `runDueRecap`, `previewRecap`), the check every minute in `src/instrumentation.ts`, the `recap` bot event and `GET /api/bot/v1/recap/latest` (`docs/BOT-API.md`), the admin's preview `/discord/recap` (DESIGN.md §11) linked from the Discord page. Sightings count by map zone (a dungeon's zone; battlegrounds and unknown places don't count); a recap is computed even while the Weekly recap is off (the history stays whole) but only posted while it is on.
- WEB-41d done (PR #77): `GET /api/bot/v1/cards/<id>.png` (`docs/BOT-API.md` "Card images") for all seven of Nico's references, `src/core/cards/` (what each card shows, map crops from `zones.json`, the token palette), `src/server/cards/` (the ids, `next/og` rendering), the site's fonts bundled (SIL OFL, Nico 2026-10-28). Deviations from the references in DESIGN.md §11.

### WEB-39b Look-ups for the bot
Split from WEB-39 (Nico, 2026-10-27); after WEB-38, whose bot token check it uses.
- `GET lookup/...` endpoints for the bot's commands (`/whereis`, `/who`, `/whocancraft`, `/character` with autocomplete, `/alts`, `/me`, `/runs`), answered for a Discord user id only when it is linked to a member or guest (`linkForDiscordUser`, `src/server/discord.ts`, then the role as for a session).
- Done (PR #79): `GET /api/bot/v1/lookup/<what>` (`names`, `professions`, `whereis`, `who`, `whocancraft`, `character`, `alts`, `me`; `docs/BOT-API.md` "Look-ups"), `src/core/lookup.ts`, `src/server/lookup.ts`. `/runs` was already answered by WEB-40's `GET runs`. Decided with Nico (2026-10-28): no linked check on the look-ups, only friends are in the server (as for `/recap`); only `me` needs a link (WEB-40's `botFriend`), to know whose characters to show.

### WEB-48 Dropdown, date and time components
- Board: `runs-v2-plan` (the dropdown spec) and the design system. One styled **dropdown** replaces every native `<select>` on the site (Runs, Discord page and the rest). Trigger 44 px, `#0B1220`, 1 px line, gold caret; states default, placeholder, open and focus (gold border and 3 px gold glow), disabled. Menu: surface `#0E1626` with a gold line, 12 px radius, group headers in caps; an option has a name, dim meta and a right-side hint; the selected one a gold check, the keyboard highlight a gold wash; disabled options stay visible with a reason; a search field from 8 options; arrows, Enter, Esc and type-to-jump; under 640 px a bottom sheet. Existing tokens only; values not in `tokens.css` yet are added as tokens (rule 12).
- Built in house with the ARIA listbox and combobox patterns (no headless library in the project, no new dependency).
- **Date and time:** a styled date popover behind a 44×44 calendar button and a styled time input, so no native date or time input is left (no OS icons).
- `html { scrollbar-gutter: stable; }` (finding 9: Plan a run jumps sideways when the scrollbar appears).
- Design checks for every state at desktop and phone; Playwright keyboard tests (open, search, pick, Esc), axe clean.
- Done (PR #78). Built: `Dropdown`, `DateField`, `TimeField` in `src/components/ui` with their rules in `src/core/controls.ts` (search, time parsing, month grid; unit tested). Swapped one for one, same options (Nico, 2026-10-28: whether WEB-49/50 can drop criteria is decided later): Plan and Edit (dungeon, Lead as, Other date, Time), the answer's character, the Discord page's time zone (grouped by region, `timeZoneOptions`) and settings (compact). Tokens `--surface-menu`, `--line-menu`, `--shadow-menu`, `--ring-field-open`, `--tint-option`, `--text-disabled`, `--r-menu`, `--size-menu-list`. `scrollbar-gutter: stable` on `html`. Design checks in `tests/design/controls.spec.ts` on `/dev/components` (values, keyboard, sheet, date, time, axe open and closed, touch targets, motion, screenshots); e2e and design tests pick through `tests/e2e/dropdown.ts`.

### WEB-49 Runs v2: picker, run detail, Plan and Edit, runs list
WEB-50 merged into this story (Nico, 2026-10-28); WEB-48 already did the styled dropdown, the date and time controls and the scrollbar gutter. Two PRs: A (picker, run detail, Lead as), B (Plan and Edit, runs list, copy). Boards: `runs-v2-picker`, `runs-v2-run-detail`, `runs-v2-plan`, `runs-v2-findings`. Needs WEB-47 and WEB-48. Decided with Nico (2026-10-28, 17 proposals):
- **The picker** (replaces the character select on the run page and Lead as in Plan): one panel with three parts, all visible: every character of the user with its level fit tag, nothing hidden (a listbox); the role (a radiogroup, segmented), roles the class can't play disabled with a reason ("not for priests"), each with its state ("open", "3 open", "full → reserve"), starting at the addon's role; the answer (I'm in, Maybe, Can't; a tooLow character only Maybe) with "You join as Kaz Coldbrew · Healer", the fit note and Save answer. On the run page the answer card is an Answer button, or after answering "You're in as … · Role · Change" (reserve: "Damage is full · you'd be reserve as …"); it opens the picker as a popover on desktop and a bottom sheet under 640 px, a modal dialog (focus kept inside, Esc closes, focus back on the button). The runs list keeps its quick answer buttons. "· Discord updated" only when the run has a Discord post.
- **Lead as** in Plan: the picker inline, character and role, no answer step (the form sends `leadRole`). Edit run keeps day, time and note; the organiser changes character or role on the run page.
- **Run detail:** the organiser's bar "You lead as … · Tank" with Change character or role (and Join again when benched or out) instead of the answer card; Edit and Delete in the hero; "Only the organiser can edit" not shown to the organiser. The time as large as the title with the countdown next to it (computed when the page loads). A filled slot shows a disc, the role, the character on its own line, level · class · friend and the fit tag; an open slot only "Open" and one fact ("1 left", "No healer in range · Kaz Coldbrew is 4 below"), never a list of names (finding 1). "Could fill" under the group (up to 3 characters that fit or are over and haven't answered, for the open roles), then a row each for Maybe and Reserve. The answers table gets Role ("(usually tank)" when it differs) and Fit columns, and "When · where" has the day ("Wed 09:12 · Discord").
- **The ⋯ menu** (the WEB-48 menu look, `role="menu"`) on every filled slot, the organiser's own too, for the organiser and the admin: move to another role ("open", "current", or "Swap with … " when taken, both trading places; roles the class can't play disabled), Move to reserve (on their own slot: bench yourself), Remove from run in red (on their own slot: Leave the group, still organiser). No confirm step; a status line says what happened. Moved friends get the quiet Discord notice, the organiser moving themselves doesn't. The move route takes `swapWith`.
- **Plan and Edit:** the dungeon starts empty ("Pick a dungeon") unless the user came from a dungeon page or roster band, or exactly one dungeon has a character of the user that fits (finding 6). The dungeon dropdown: "Fits your characters" (fits or over) first, then "All dungeons by level" with the Forever dungeons mixed in by level ("Forever" as meta); each row its range and the user's best fit as hint ("Vesgar 27 fits", "Twinkle 5 below", "no fit"); while searching, a group with the other wings of the same dungeon. Day: one row of chips (Today and the next 6 days) and the calendar button, never wrapping (sideways scroll on a phone); a date picked beyond them shows as its own chip. Time: chips 19:00, 19:30, 20:00, 20:30, 21:00 and "Other…" for the time input (Edit opens on Other… for another time).
- **Runs list:** the summary "1 in · 4 open · no healer in range" (finding 11); the 5-part slot bar with role letters (T, H, D), an `aria-label` and a styled tooltip on hover and focus; "Your answers" shows character and role ("Graveyard · organiser as Vesgar · Tank").
- **Copy** (finding 12): "Organiser takes a slot"; "Website · Tue 23:24" with the day; the "posted once the admin picks a channel" hint only for the admin.
- Tests: picker flows at desktop and phone (pick, change, reserve, tooLow only Maybe), the move menu (swap, bench, leave, rights), Plan with `leadRole`, the dungeon dropdown's groups and search, the day and time chips; design checks for the picker (popover and sheet), run detail as organiser and as friend, the menu open; a site-wide test that fails on a native `<select>`, date or time input.
- Part A done (PR #82): `PickerFields`, `AnswerPicker` (popover or sheet) and `SlotMenu` in `src/components/runs`; `runDetail` v2 in `src/core/views/runs.ts` (picker, summary, the organiser's bar, slots with fit and ⋯ menu, one fact per open slot, Could fill, Maybe, Reserve, answers with role, fit and day); `moveSignUp` swaps (`swapWith`, refusal `not_in_role`), no notice to the organiser moving themselves; Lead as in Plan through the picker with `leadRole`; `tests/design/native-controls.test.ts`.
- Done (PR #84), part B: Plan and Edit start without a dungeon unless one is given or exactly one fits; the dungeon dropdown's groups ("Fits your characters", "All dungeons by level"), "Forever" meta, best-fit hint and "Other … wings" while searching (`family` in `filterOptions`/`Dropdown`); day chips with `DateField buttonOnly`, time chips with Other…; the runs list summary, slot bar letters and tooltip, Your answers with character and role; the admin-only channel hint. `forever` and `wingOf` on the dungeons.

### WEB-51 Asks on the site and from Discord
Decided with Nico (2026-10-28): BOT-04 found that `/ask` and answering an ask in Discord need asks to exist on the site; today an "Ask now" from the game is only passed through as an `askNow` event (WEB-43).
- **Model** (forward-only migration): an ask is a short group call: dungeon, the asker and their character and role, note, made at, expires at (10 minutes after it was made), where it came from (game or Discord), and its answers (I'm in, Maybe, Can't, with character and role, as for runs since WEB-47, and where each came from). An ask from an upload (WEB-43) is stored as one; the same id twice changes nothing.
- **Bot API** (optional additions within v1, `docs/BOT-API.md`): create an ask for a Discord user (`/ask`: dungeon and note; the asker's character and role as for `/plan`), answer an ask (the post's buttons, Pick my character), and events `askNow` (now with the stored ask's id), `askChanged` (answers) and `askExpired`. An answer after `expiresAt` is refused ("This ask has expired"). The admin's "Ask now from the game" setting keeps covering asks from the game only.
- **On the site:** open asks show on the Runs page above the runs, with their answers and a countdown; an expired ask disappears. No separate page.
- **To the game:** open asks go into the uploader's runs feed (WEB-44, an optional `asks` list), so a friend whose game reloads within the 10 minutes sees it; the addon side is a later addon story.
- Tests: an ask from an upload and from the bot, answers before and after expiry, the same upload twice, the events.
- Decided with Nico (2026-10-28): an ask is stored as a run with `kind` ask (migration `0013_asks`), without slots or reserve; an ask from the game is stored even with "Ask now from the game" off (the setting only decides whether Discord gets it); the "Asking now" block on the Runs page waits for its board (prompt: `docs/DESIGN-PROMPT-ASKS.md`).
- Done so far (PR #83): the model, `askFor` / `answerAskFor` / `openAsks` and the ask events in `src/server/runs.ts`, asks from uploads, the bot API (`asks`, `asks/<id>`, `asks/<id>/answers`, `asks/<id>/characters`; `askNow`, `askChanged`, `askExpired`), and the uploader feed's `asks`.
- Decided with Nico (2026-10-28, boards `asks-now`, `asks-now-phone`, `asks-now-states`): the site is dark only (no light board); I'm in uses the best character by `levelFit` (fits, over, 1–5 below; a carry only when nothing else), "none fit" only when every character is too low; "change ▾" opens the v2 picker without slot states; the countdown in whole minutes, seconds and amber in the last minute, the card folds away at 0; your own ask has a "Your ask" tag and "Form the group in game" (text, no button); three, then "and N more" in place; the block below the filter chips, a live dot and fresh-green left edges.
- Done (PR #85): "Asking now" on the Runs page (`AsksNow` in `src/components/runs`, `asks` and `askCountdown` in `src/core/views/runs.ts`, the open asks through `runsInput`), `POST /api/asks/<id>/answer` for the site, the states on `/dev/asks` with their design checks (`tests/design/asks.spec.ts`). The page refreshes every 30 s while an ask is open.

### WEB-45 Runs on the roster and the map
- Board: `roster-cards-runs`. The "Next run" card on the roster; a dungeon band opens a popover with who fits, planned runs, Plan a run and Dungeon page; the Role filter.
- After WEB-32, which builds the level spread itself.
- Runs v2 (board `runs-v2-plan`, "Roster bands v2"; findings 13 and 14): at most 4 rows of bands, sorted by how many fit and packed without overlap, with "Show all N"; the full name where the band is wide enough, otherwise a short one ("SM Graveyard") with the full name on hover, never cut mid-word; a click opens the popover (name, range, how many fit, missing roles, planned runs, Plan a run and View run). The dot tooltip flips below the dot when there is no room above, one row per character without wrapping. Fit from WEB-47's `levelFit`.
- Decided with Nico (2026-10-28): a band counts only who fits (`levelFit` kind `fits`), and the general rule "recommend, never restrict" (DESIGN.md §8); the Next run card shows the next upcoming run overall and is hidden when nothing is planned; a band popover lists up to 3 planned runs (each a link, "View run" when there is one); on a phone the popover is a bottom sheet; labels: the full name where it fits, else the short name, else only the range and count, measured in the browser.
- Done (PR #86): `bandLayout` (`src/core/views/spreadLayout.ts`: most fits first, at most 4 rows, the rest counted for "Show all"), `missing` roles per band (`src/core/views/roster.ts`), `rosterRuns` (`src/core/views/runs.ts`: the Next run card and each dungeon's runs), `DungeonBands` (the band buttons, measured labels, popover, phone sheet, Show all) and `NextRun` in `src/components/roster`, the dot tooltip below the dot when there is no room above and one line per character (finding 14). The Role filter was already there (WEB-21). The popover's "Dungeon page" link waited for WEB-42, which turned it on (PR #87); the map part of the title is WEB-42's.

### WEB-42 Dungeon page
- Board: `dungeon-page`. A page per dungeon (`/dungeons/<id>`), Scarlet Monastery as its four wings (WEB-32), each with its own range: who fits per role, runs planned here and in the other wings, "Ran here" (WEB-43), Plan a run.
- The map's dungeon markers get a badge with the number of planned runs; their popover has Plan a run and Dungeon page.
- Decided with Nico (2026-10-28, 9 proposals): `/dungeons/<id>` with the ids Plan's `?dungeon=` takes (`/dungeons/sm` goes to Graveyard; Blackrock Spire one page; raids none); the hero over the map around the entrance; who fits per role by the role the addon knows, fits or over at any data age, carries left out (they can still sign up), "Nobody in range." with the closest character below whose class can play the role; Planned here with the other wings' runs; Ran here the last 5 "Ran it"; entrances as buttons with a count badge, shown from a continent on, the popover in the bottom sheet on a phone, Scarlet Monastery's listing its wings; "Also on the map" left out; the link from a run's page waits for WEB-45 or after WEB-49.
- Done (PR #87): `src/core/views/dungeon.ts` (`dungeonPage`, `dungeonPageId`, `whoFits`, `plannedSummary`, `mapDungeons`), `entranceMap` in `src/core/views/map.ts`, the route `src/app/(site)/dungeons/[id]` (page, loading, error), `EntranceMap` and `Dungeon.module.css` in `src/components/dungeon`, `DungeonEntrance` (button, badge, popover, sheet) in `src/components/map`; the Map tab is current on dungeon pages; the roster band popover's "Dungeon page" link (WEB-45) is on, through `dungeonHref`. Tests: `tests/unit/views/dungeon.test.ts`, `tests/e2e/dungeon.spec.ts`, `tests/design/dungeon.spec.ts`.

### WEB-52 Any level may answer I'm in
- Nico (2026-10-28, after testing v0.4.0; the rule "recommend, never restrict", DESIGN.md §8): a character 6 or more levels below a dungeon (`levelFit` kind `tooLow`) may answer I'm in and lead, with its "N below" and a "tough" note; it is still never suggested, counted in a band or "could fill".
- Done (PR #90): `levelFit` gives every character `canPick` (and the note for `tooLow`); the plan form's and an ask's "None of your characters fit" is advice and no longer blocks; the run page says "You can still say I'm in; it will be tough."; the bot API's `characters` lists every character and `out_of_range` / `lead_out_of_range` are no longer given (`docs/BOT-API.md`).

### WEB-53 Carried asks and in-game ask answers
Decided with Nico (2026-10-28): an in-game ask with "Also post on Discord" reached the site only from the asker's own file (after their `/reload`, within 10 minutes). From now on friends' files carry it too (addon CF-51), and answers given in game reach the site.
- An `ask` item of another member (its `guid`'s owner, else its optional `battleTag`, is not the uploader) is taken from a friend's file within the ask's 10 minutes when the asker is in the community's data (else `not_member`). It is created once by its item id (the asker's; `game_items` primary key) and is the asker's ask, on Discord too. Every carrier is kept for the audit (`game_item_carriers`, migration `0014_carried_asks`). Plans, answers and pings stay own-file only.
- A new item kind `askAnswer { id, at, ask, answer, guid, name, role }` from the answerer's own file answers the ask as a Discord answer would (source "game", `askChanged`); an unknown ask (`unknown_ask`) or an expired one (`expired`) is logged with its result and ignored.
- `received` (the uploader's runs feed) also returns the carried ids, so every carrier's game forgets them.
- Compat: optional additions only (`battleTag` on an ask, the new kind); files from before CF-51 behave as before. Tests: four carriers, one ask, one post; expired; an asker outside the community; an answer to an unknown ask; the parser.
- Done (PR #91): `src/core/gameItems.ts` (`askAnswer`, the ask's `battleTag`), `src/server/gameItems.ts` (`askerOf`, carriers, `askAnswer`, `receivedIds`), `docs/SOURCE-DATA.md`, `docs/UPLOADER-API.md`.

### WEB-54 Band names on narrow roster bands (bug)
Found by Nico (2026-10-28): on the roster's dungeon bands (`DungeonBands`), a narrow band such as Ragefire Chasm shows only "13–18 · 2". The name is dropped (`data-fit="count"`), so you can't tell which dungeon it is. The name always comes first.
- The label never drops the name. Order of fallback: full name, then short name, then the short name cut with an ellipsis ("Ragef… 13–18 · 2"), keeping at least 3 letters before the "…".
- The range and count stay whole. Only when 3 letters + "…" and the rest still don't fit, the range goes before the name is cut further ("Rag… · 2"); the count always stays.
- Cuts happen on the name text only, never in the middle of the range or count; the `title` and `aria-label` keep the full name and range.
- Test: a band narrow enough to hit each fallback (full, short, cut name, cut name without range) at 1440 px, with a screenshot baseline; the phone list is unchanged (always the full name).
- Cause: a dungeon without a short name (Ragefire Chasm, The Drowned City) rendered no short-name span, so the "short" step showed only the range and count.
- Agreed with Nico (2026-10-28): once the range has gone, the name gets the freed room back (whole short name, else the longest cut that fits), so "Rag… · 2" is the narrowest label; " · 1 run" stays with the count.
- Done (PR #94): `DungeonBands` (`fitLabel`: full, short, cut, bare; each band observed for its own width), `nameCuts` in `src/core/views/text.ts`, `LevelSpread.module.css`; tests: `tests/unit/text.test.ts`, design check "band names on narrow bands" with the `roster-bands-narrow` baseline, e2e roster.

### WEB-57 New recap cards, awards, headlines and challenges
After WEB-55. The dailies' A15 and F23 are not built: the Doomsday section (WEB-58) covers them.
Each card keeps the existing rules: a threshold, a score against earlier weeks, 3 phrasings, a 4-week cooldown, at most one card per friend. IDs continue the catalogue.
- Awards:
  - A11 Warmonger: most honorable kills, at least 10
  - A12 Battlemaster: most battleground wins, at least 2
  - A13 Loot goblin: most rare and epic items, at least 5
  - A14 Duelist: most duel wins, at least 3
  - A7 Social butterfly: in a group with the most different friends, at least 3
- Stat cards:
  - S13 Bloodbath zone: the zone with the most honorable kills, at least 10
  - S14 Battleground of the week: the most played battleground, with wins and losses, at least 2 games
  - S15 Deadliest zone: the zone with the most deaths, at least 3
  - S11 Biggest group night: the evening with the most friends in groups together, at least 3
- Progress cards: P14 Rank race, two friends' characters one PvP rank apart, or the same rank with honor within 10 %.
- Social cards:
  - F14 Revenge: died to players most, then got the most kills, at least 3 of each
  - F15 Duel rivals: the pair that duelled each other most, with the score, at least 3 duels
- Fun cards:
  - F16 Most deaths: at least 5
  - F17 Fell to their death: a `fall` death
  - F18 Died by fire: a `fire` death ("the campfire won")
  - F19 Untouchable: the most levels gained with 0 deaths, at least 3 levels
  - F20 Big spender: the biggest gold spent; text without amounts ("someone bought something shiny")
  - F21 Purple rain: epic items received, at least 1
  - F22 Marathon: the longest session, at least 3 hours
  - F7 Night owl: played after 01:00 the most
  - F8 Early bird: played before 08:00 the most (both in each friend's own saved time zone; without one, the site's)
- Headlines: `pvp` (a week with many kills), `danger` (a week with many deaths).
- Challenges:
  - "Win 3 battlegrounds as a group"
  - "Each of you gets 25 honorable kills"
  - "Take back Tarren Mill" (kills in Hillsbrad Foothills)
  - "Duel every friend once"
  - "A week without dying"
- `docs/RECAP.md` lists every new card with its threshold. Tests per card: shows above the threshold, not below it, and not without the data.
- Decided with Nico (2026-10-29): the thresholds are the boards' "Shows when" (`bot-recap-v2-cards`), not the ones above: awards Warmonger 25, Battlemaster 3, Loot goblin 4, Duelist 5, Social butterfly 3 (redefined: grouped with the most different friends); Bloodbath zone 20, Battleground of the week 3 games, Deadliest zone 5, Biggest group night 4 friends; Rank race same rank with this week's honor within 10%; Revenge 3 deaths to players then 10 kills; Duel rivals 4 duels; Most deaths 6; Untouchable 5 levels; Big spender 50 gold in one day ("Hooves were heard", no amount); Marathon 5 hours; Night owl after 01:00; Early bird before 07:00; headlines PvP (200 kills, one zone at least 40%) and danger (25 deaths, at least 1.5 times the 4-week average); "Take back Tarren Mill" when Hillsbrad Foothills is in the top 3 kill zones.
- Done (PR #116): `src/core/recap/cardsV2.ts` (the 21 cards), headlines and challenges in `recap.ts`, texts in `texts.ts` (3 phrasings each), each friend's time zone and the PvP rank in the recap's input; `docs/RECAP.md`; tests `tests/unit/recap/v2.test.ts`.
