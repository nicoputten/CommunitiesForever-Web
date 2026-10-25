# CommunitiesForever Web

A private website (`wow.vestras.nl`) for a small friend group playing **World of Warcraft: Forever**. Nico uploads the SavedVariables file of the [CommunitiesForever](https://github.com/nicoputten/CommunitiesForever) addon; the site shows the group's characters out of game: alts per friend, professions, and a map with where characters were last seen.

## Read first
- `docs/ARCHITECTURE.md`: core rules, layering, stack, data flow, storage, hosting
- `docs/SOURCE-DATA.md`: the SavedVariables file we read, field by field, and what each addon release writes
- `docs/STORIES.md`: open stories with acceptance criteria, in build order (done ones: `docs/STORIES-COMPLETED.md`)
- The addon repo's `docs/ARCHITECTURE.md` "Data model" is the source of truth for the uploaded data. When it and `docs/SOURCE-DATA.md` disagree, the addon wins and this repo gets fixed.

## Platform facts
- The uploaded file is `WTF/Account/<ACCOUNT>/SavedVariables/CommunitiesForever.lua`: a Lua table literal assigning `CommunitiesForeverDB` (AceDB: the data is in `.global`).
- Character names contain a space (first + last name), e.g. "Ves Doombringer". Realm names change at launch; never hardcode them.
- Zones are stored as the client's zone name text (English client), not as IDs. A zone can also be a dungeon name.

## Hard rules
1. `src/core/*` is pure TypeScript: no React, no Next.js, no Node APIs, no database, no I/O. All input via function arguments. Fully unit tested with Vitest.
2. Uploaded files are untrusted input. Never `eval` or execute them; parse with our own parser, enforce size and depth limits, strip WoW escape sequences (`|`) from every string, render as text only (no `dangerouslySetInnerHTML`).
3. GUID is the character key. Never parse or split character names.
4. **Backwards compatible with every addon release.** The site must read SavedVariables of every released addon version, because the addon's schema evolves. The addon's golden fixtures are copied to `tests/fixtures/addon/<release>/` and never edited; `tests/compat` must keep passing on all of them. Code reading uploaded data handles missing fields (undefined) everywhere.
5. **Own database: forward-only migrations.** Every schema change is a new migration file; released migrations are never edited.
6. Every page and API route requires login, except the login page and the auth callback. Uploading requires the admin role.
7. No secrets in the repo. Configuration via environment variables, documented in `.env.example`.
8. English strings, hardcoded. No localization system.
9. No dependencies beyond those listed in `docs/ARCHITECTURE.md` without asking.
10. Never invent game data (zone positions, class colors, profession IDs). Every table of game data names its source in a comment.

## Commands
(Filled in by WEB-01.)

## Branches
Gitflow: `feature/web-XX-<slug>` off `develop`, PRs into `develop`. `main` receives releases.

## Releases
- A tag `v*` on `main` builds the Docker image and pushes it to GHCR. TrueNAS pulls it. Pushing a tag deploys to the live site: only on Nico's explicit go-ahead per tag.
- Every user-facing change goes under `## Unreleased` in `CHANGELOG.md` in its own PR. When releasing, rename that heading to `## <tag> (<date>)`.

## Definition of done (per story)
- All acceptance criteria met
- `npm run lint`, `npm test` and `npm run build` pass
- UI stories: Playwright test for the main flow, screenshots (desktop and phone width) in the PR
- Manual steps that only Nico can do (Battle.net app, TrueNAS, DNS, a real upload) are written in the story's PR under "Manual"

## Working with Nico
- Experienced software developer, knows React. Be technical and concise.
- Ask clarifying questions before assuming anything ambiguous. He strongly prefers questions over rework.
- One story per branch and PR. Conventional commits.
