# CommunitiesForever Web

A private website (`wow.vestras.nl`) for a small friend group playing **World of Warcraft: Forever**. Nico and the members of his in-game community upload the SavedVariables file of the [CommunitiesForever](https://github.com/nicoputten/CommunitiesForever) addon; the site shows the group out of game: a living map of where characters were last seen, the roster of alts per friend, professions, character details and a session report of what changed.

## Read first
- `docs/ARCHITECTURE.md`: core rules, layering, stack, data flow, storage, hosting
- `docs/SOURCE-DATA.md`: the SavedVariables file we read, field by field, and what each addon release writes
- `docs/WOW-FOREVER.md`: how WoW: Forever differs from Vanilla (races, professions, zones, dungeons, raids, rulesets), with sources and what is confirmed
- `docs/DESIGN.md`: the design decisions (tokens, data age scale, map, motion, components). `design/boards/`: the Claude Design boards per screen (`design/README.md`, `npm run design` to view)
- `docs/STORIES.md`: open stories with acceptance criteria, in build order (done ones: `docs/STORIES-COMPLETED.md`)
- The addon repo's `docs/ARCHITECTURE.md` "Data model" is the source of truth for the uploaded data. When it and `docs/SOURCE-DATA.md` disagree, the addon wins and this repo gets fixed.

## Platform facts
- The uploaded file is `WTF/Account/<ACCOUNT>/SavedVariables/CommunitiesForever.lua`: a Lua table literal assigning `CommunitiesForeverDB` (AceDB: the data is in `.global`).
- Character names contain a space (first + last name), e.g. "Ves Doombringer".
- Forever has no classic realms: one mega-realm per ruleset per region. The group plays PvP; the site shows PvP or PvE. Realm names change at launch; never hardcode or parse them, map them through the rulesets table (`src/core/gamedata`).
- Zones are stored as the client's zone name text (English client), not as IDs. A zone can also be a dungeon name.

## Hard rules
1. `src/core/*` is pure TypeScript: no React, no Next.js, no Node APIs, no database, no I/O. All input via function arguments. Fully unit tested with Vitest.
2. Uploaded files are untrusted input. Never `eval` or execute them; parse with our own parser, enforce size and depth limits, strip WoW escape sequences (`|`) from every string, render as text only (no `dangerouslySetInnerHTML`).
3. GUID is the character key. Never parse or split character names.
4. **Backwards compatible with every addon release.** The site must read SavedVariables of every released addon version, because the addon's schema evolves. The addon's golden fixtures are copied to `tests/fixtures/addon/<release>/` and never edited; `tests/compat` must keep passing on all of them. Code reading uploaded data handles missing fields (undefined) everywhere.
5. **Own database: forward-only migrations.** Every schema change is a new migration file; released migrations are never edited.
6. Every page and API route requires login, except the login page and the auth callback. Roles (admin, member, guest; `docs/ARCHITECTURE.md` Access) are checked on the server: uploading needs admin, member or a guest with "may upload", and only the uploader's own file of the same community is accepted; the admin page needs admin. The admin can never be blocked.
7. No secrets in the repo. Configuration via environment variables, documented in `.env.example`.
8. English strings, hardcoded. No localization system.
9. No dependencies beyond those listed in `docs/ARCHITECTURE.md` without asking.
10. Never invent game data (zone positions, class colors, profession IDs, dungeon levels). Every table of game data names its source in a comment. `docs/WOW-FOREVER.md` is the reference for what Forever changes from Vanilla: check it first, and update it (with sources) when a table changes.
11. **Always follow the design system.** Every screen uses the tokens (`src/styles/tokens.css`), type scale, components, data age scale and motion of `docs/DESIGN.md`, and matches its board in `design/boards/`. No raw colours, font sizes, spacing, radii, shadows or durations outside `tokens.css`; no new component when a design system one fits. The boards are a visual reference only: never copy their markup or runtime. Accessible (semantic HTML, focus states, 44 px touch targets, reduced motion) and working at 375 px. The site name comes from the data, never hardcoded.
12. **Deviating from the design only when Nico says so.** If something can't be built as designed, or seems better another way, ask first. An approved deviation is written in `docs/DESIGN.md` "Deviations" (what, why, date) in the same PR. The design checks (`npm run test:design`, WEB-30) must pass; a changed screenshot baseline is only committed after Nico approved the new look.

## Commands
- Node.js 24 LTS (`.nvmrc`). Shells started before the install need `C:\Program Files\nodejs` on PATH (Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`).
- `npm run lint`: ESLint (incl. the `src/core` layering rule), Prettier check (code only, Markdown is excluded), `tsc --noEmit`
- `npm test`: Vitest (`tests/unit`, `tests/compat`, `tests/server` on a temporary SQLite file)
- `npm run db:generate -- --name <what>`: a new Drizzle migration in `drizzle/` after a schema change
- `npm run build`, then `npm run test:e2e`: Playwright on the production build, desktop and phone
- `npm run format`: Prettier write
- `npm run design`: serves the design boards at http://localhost:4400
- `npm run test:design`: design checks (WEB-30): token lint, computed-style and accessibility checks, screenshot baselines
- Map data: `tools/map/README.md` (Python venv; rebuild only when the map should change)

## Branches
Gitflow: `feature/web-XX-<slug>` off `develop`, PRs into `develop`. `main` receives releases.

## Releases
- A tag `v*` on `main` builds the Docker image and pushes it to GHCR. TrueNAS pulls it. Pushing a tag deploys to the live site: only on Nico's explicit go-ahead per tag.
- Every user-facing change goes under `## Unreleased` in `CHANGELOG.md` in its own PR. When releasing, rename that heading to `## <tag> (<date>)`.

## Definition of done (per story)
- All acceptance criteria met
- `npm run lint`, `npm test` and `npm run build` pass
- UI stories: the "Every UI story" criteria in `docs/STORIES.md`; Playwright test for the main flow; design checks pass; screenshots (desktop and phone width) in the PR next to the board; any deviation approved by Nico and recorded in `docs/DESIGN.md`
- Manual steps that only Nico can do (Battle.net app, TrueNAS, DNS, a real upload) are written in the story's PR under "Manual"

## Working with Nico
- Experienced software developer, knows React. Be technical and concise.
- Ask clarifying questions before assuming anything ambiguous. He strongly prefers questions over rework.
- One story per branch and PR. Conventional commits.
