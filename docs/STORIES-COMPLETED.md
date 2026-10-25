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
