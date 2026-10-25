# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order: WEB-01, WEB-02 (design workshop runs alongside WEB-03..07), WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, then the views WEB-08..11 once the design is settled, WEB-12 (uploader) last.

## E1 Foundation

### WEB-01 Repo skeleton and CI
- Next.js (App Router) + TypeScript strict, ESLint, Prettier, Vitest, Playwright, per `docs/ARCHITECTURE.md` Stack and Layering.
- ESLint forbids imports from `src/server`, `src/app`, `src/components`, React and Node built-ins inside `src/core`.
- Scripts: `npm run dev`, `lint`, `test`, `test:e2e`, `build`. CLAUDE.md "Commands" filled in.
- GitHub Actions on PRs and `develop`: lint, test, build.
- `CHANGELOG.md` with `## Unreleased`, `.env.example`, `README.md` with local setup.
- Done when: a placeholder page renders, one core unit test and one Playwright smoke test pass in CI.

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
- Part 2: Nico runs the workshop; `docs/DESIGN.md` records the decisions.
- Done when: `docs/DESIGN.md` holds the decisions.

## E2 Data

### WEB-03 SavedVariables parser (core)
- `parseLua(text)`: parses a SavedVariables file (`Name = { ... }` assignments, also the fixtures' `return { ... }`) into plain JS values. Supports what the game writes: tables with `["key"] =` and `[n] =` keys, array parts, strings with escapes, numbers (incl. negative, float, exponent), booleans, nil, `--` comments.
- Never executes anything. Limits: 5 MB file, depth 32, clear errors with line and column.
- Copy the addon's fixtures to `tests/fixtures/addon/v0.3`, `v0.4` (unchanged) and a real file from Nico (wrapped as the game writes it, anonymized if he wants).
- Unit tests: every construct above, errors, limits, all fixtures parse.

### WEB-04 Normalize and merge (core)
- `normalize(db)`: `CommunitiesForeverDB.global` per `schemaVersion` into the internal shape (`docs/SOURCE-DATA.md`). Unknown newer schema: rejected with the version in the message.
- Sanitize: strip `|` escapes from every string, display names capped at 24.
- `merge(current, incoming)`: per GUID newest `updatedAt` wins; locations newest `seenAt`; `removed` hides a character; person display name: own `displayName` > BattleTag name part (addon rule).
- `tests/compat`: every addon fixture normalizes; snapshot of the result.
- Unit tests: missing fields everywhere, merge order independence, removed characters.

### WEB-05 Storage and upload service
- Drizzle schema and first migration for `uploads` and the derived tables (`docs/ARCHITECTURE.md` Storage).
- `upload(file, user)`: store raw (gzip, sha256; same file again is a no-op), parse, normalize, merge into derived tables in one transaction; a rejected file is stored with its reason and changes nothing.
- `rebuild()`: recompute derived tables from all ok uploads in order.
- Diff of an upload against the previous state (new characters, level ups, profession gains) for the upload result screen.
- Tests against a temporary SQLite file.

## E3 Access and hosting

### WEB-06 Battle.net login
- Auth.js with the Battle.net provider (EU). Allow-list of BattleTags; `ADMIN_BATTLETAG` gets the admin role.
- Every page and API route needs a session except login and callback (CLAUDE.md rule 6); upload needs admin.
- Open questions: allow-list from an env var, or managed on an admin page? Also allow every BattleTag that appears in the uploaded data automatically? Session: JWT or database?
- Manual: create the app at develop.battle.net with the redirect URL for localhost and `wow.vestras.nl`, put the client id and secret in the TrueNAS app config.

### WEB-07 Docker image and deploy to TrueNAS
- Multi-stage Dockerfile (Next.js standalone, non-root user), `/data` volume, health endpoint, migrations run at start.
- GitHub Actions on tag `v*` on `main`: build and push to GHCR (`:<tag>`, `:latest`).
- `deploy/` with the TrueNAS Custom App compose YAML, the nginx server block for `wow.vestras.nl` (TLS, proxy headers, `client_max_body_size`), and a step-by-step `deploy/README.md`.
- Manual: Hostnet DNS record, nginx config and certificate, dataset and app on TrueNAS, first login, first upload.

## E4 Views (after WEB-02's workshop)

### WEB-08 Upload page
- Per `docs/DESIGN.md`: drag and drop, result summary from WEB-05's diff, history list. Admin only.

### WEB-09 Alts and roster
- Per `docs/DESIGN.md`: people with their characters, sort and filter, character detail page.

### WEB-10 Professions
- Per `docs/DESIGN.md`: matrix of people/characters by profession with skill bars, group gaps. Profession IDs and names from a sourced table (rule 10).

### WEB-11 World map
- Per `docs/DESIGN.md`: last known location per character on the map of Azeroth.
- Core: a zone name → map position table (Vanilla zones and dungeons, sourced, rule 10); unknown zones are listed in an "elsewhere" tray instead of being dropped; age of each sighting.

## E5 Later

### WEB-12 Automatic uploader
- A small program on Nico's PC that watches the SavedVariables file and uploads it after the game writes it, with an admin-scoped API token (new API route). Language and packaging decided in the story.

### Backlog (unordered, not yet stories)
- Activity feed (level ups, profession gains, dungeon runs per day).
- Recipes, once addon CF-38 ships ("who can craft X").
- Dungeons: who has which dungeon quests.
