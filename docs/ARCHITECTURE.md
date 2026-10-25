# Architecture

## Core rules
- Raw uploads are the source of truth. Everything shown is derived from them and can be rebuilt (`rebuild` after a parser or merge fix), so no upload is ever lost to a bug.
- One uploader (Nico, admin role). Viewers: the friend group, logged in with Battle.net.
- The site never talks to the game or to Blizzard's game data APIs; it only shows what the addon recorded.
- Desktop first, fully usable on a phone (responsive, touch-friendly map).

## Stack
| Part | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | |
| Framework | Next.js (App Router), React | React is known; one app for UI and API; standalone output runs in a small container |
| Auth | Auth.js (`next-auth`) with the Battle.net provider | built-in provider, gives the BattleTag |
| Database | SQLite via `better-sqlite3`, Drizzle ORM, `drizzle-kit` migrations | one file on a TrueNAS dataset, easy backup through snapshots |
| Tests | Vitest (unit, compat), Playwright (end to end) | |
| Lint/format | ESLint, Prettier | |
| Runtime | Node.js LTS, Docker image on GHCR | |
| Map, styling, animation | **decided in WEB-02** (design workshop) | depends on the design direction |

Every dependency beyond this list needs Nico's OK (CLAUDE.md rule 9).

## Layering
```
src/core/        pure TS: Lua literal parser, schema normalize, merge, view models, game data tables
src/server/      database (Drizzle schema, migrations, queries), upload service, auth config
src/app/         Next.js routes: pages (React) and route handlers (API)
src/components/  React UI components
tests/           unit (core), compat (addon fixtures), e2e (Playwright)
```
- `core` imports nothing from the other layers (enforced by ESLint `no-restricted-imports`).
- `server` calls `core`; pages and route handlers call `server`. Components get view models as props and never touch the database.

## Data flow
```
upload (.lua) ──▶ store raw (gzip, sha256) ──▶ core.parseLua ──▶ core.normalize(schemaVersion)
                                                                      │
              pages ◀── core.viewModels ◀── derived tables ◀── core.merge(current, upload)
```
1. **Parse:** our own parser for the Lua value subset SavedVariables uses (tables, strings, numbers, booleans, nil). Limits: file size, nesting depth, string length. No code execution.
2. **Normalize:** reads `CommunitiesForeverDB.global` per its `schemaVersion` into one internal shape (`docs/SOURCE-DATA.md`). A schema newer than the site knows is rejected with "update the site" (nothing is half-read).
3. **Merge:** per character GUID the copy with the highest `updatedAt` wins (same rule as the addon's `Merge.lua`). Locations: highest `seenAt` wins. A character the addon lists under `removed` is hidden. People without the addon (no record) are not invented.
4. **Sanitize:** every string loses WoW escape sequences (`|`); display names capped at 24 characters (same as the addon).

## Storage
- `uploads`: id, uploadedAt, uploadedBy, sha256 (duplicate upload: no-op), size, raw (gzip blob), schemaVersion, status (ok / rejected + reason).
- Derived (rebuildable): `people`, `characters` (GUID key, data JSON, updatedAt, source upload, via), `locations`.
- Sessions per Auth.js adapter or JWT (decided in WEB-06).
- Data directory `/data` in the container (SQLite file), a TrueNAS dataset on the host.

## Access
- Battle.net OAuth (region EU). Allowed: BattleTags on an allow-list; admin: `ADMIN_BATTLETAG`. Details in WEB-06.
- Later (WEB-12): an API token for an automatic uploader, admin scope, upload only.

## Hosting
- TrueNAS SCALE 25.10, Custom App (Docker Compose): image from GHCR, `/data` on a dataset, port 3000 on the LAN only.
- The existing nginx reverse proxy terminates TLS for `wow.vestras.nl` and proxies to the app. `client_max_body_size` above the upload limit.
- DNS at Hostnet: `wow` record to the home IP.
- Deploy: tag `v*` on `main` → GitHub Actions builds and pushes `ghcr.io/nicoputten/communitiesforever-web:<tag>` and `:latest` → update the app on TrueNAS.
