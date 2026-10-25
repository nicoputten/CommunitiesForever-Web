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
| Database | SQLite via `better-sqlite3` (+ `@types/better-sqlite3`), Drizzle ORM, `drizzle-kit` migrations | one file on a TrueNAS dataset, easy backup through snapshots |
| Tests | Vitest (unit, compat), Playwright (end to end) | |
| Lint/format | ESLint, Prettier | |
| Runtime | Node.js LTS, Docker image on GHCR | |
| Map, styling, animation | **decided in WEB-02** (design workshop) | depends on the design direction |

Every dependency beyond this list needs Nico's OK (CLAUDE.md rule 9).

Version pins (WEB-01): TypeScript `~6.0` and ESLint `^9`, because `typescript-eslint` (via `eslint-config-next`) supports TypeScript below 6.1 and `eslint-plugin-react` supports ESLint 9 at most. Lift them when those catch up.
npm's install-script allow-list (`allowScripts` in `package.json`): `unrs-resolver` denied (its postinstall only fetches a fallback binary); `better-sqlite3` approved (WEB-05: builds or fetches its native binding; npm pins the approved version, so an upgrade needs `npm install-scripts approve better-sqlite3` again). `esbuild` (via `drizzle-kit`) is left unapproved: its postinstall only checks the platform binary, which `drizzle-kit generate` does not need.
Type packages: `@types/better-sqlite3` (dev, WEB-05; the package ships no types).

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
1. **Parse:** our own parser for the Lua value subset SavedVariables uses (tables, strings, numbers, booleans, nil). Limits: 25 MiB file (`MAX_UPLOAD_BYTES`; larger uploads are refused and not stored), nesting depth 32, string length 64 Ki. No code execution.
2. **Normalize** (`src/core/normalize.ts`): reads `CommunitiesForeverDB.global` per its `schemaVersion` into one internal shape (`src/core/model.ts`, `docs/SOURCE-DATA.md`). A schema newer than the site knows is rejected with "update the site" (nothing is half-read). Friends known only through Battle.net presence become people without a record (`hasRecord: false`) whose GUIDs are character stubs (guid and owner only); a GUID seen only in `locations` is a stub without owner. A presence link decides a character's owner over the record that lists it (addon rule).
3. **Merge** (`src/core/merge.ts`): order-independent (`merge(a, b)` equals `merge(b, a)`). Per character GUID a record beats a stub and the copy with the highest `updatedAt` wins (same rule as the addon's `Merge.lua`). Locations: highest `seenAt` wins; presence: highest `lastSeen`. A character the addon lists under `removed` is hidden unless newer than the removal. The uploader's own record is the truth for their characters: one a newer own record no longer lists is removed at that record's `version`. Person fields come from the newer record.
4. **Sanitize** (`src/core/sanitize.ts`): every string loses WoW escape sequences (whole sequences: `|c...`, `|r`, `|T...|t`, `|H...|h` keeps the link text, `||` becomes `|`, any other `|` is removed); display names: own display name > BattleTag name part, capped at 24 characters (same as the addon).

## Storage
Schema: `src/server/db/schema.ts`; service: `src/server/uploads.ts` (WEB-05).
- `uploads`: id, uploadedAt, uploadedBy, sha256 (duplicate upload: no-op, returns the earlier result), size, raw (gzip blob), schemaVersion, status (ok / rejected + reason), summary (JSON: what the upload changed, `src/core/diff.ts`).
- Derived (rebuildable, rewritten in the upload's transaction): `people` (key, data JSON), `characters` (GUID key, owner, updatedAt, source upload, via, data JSON), `locations` (GUID, zone, seenAt, source upload), `presence` (GUID, BattleTag, lastSeen), `meta` (one row: schemaVersion, version, uploader, community). Together they are the merged `Dataset`.
- `rebuild()` re-reads every stored upload in upload order, rejected ones too (a file with a newer schema can become ok after a site update), and recomputes statuses, summaries and the derived tables.
- Migrations: `npm run db:generate -- --name <what>` writes `drizzle/NNNN_<what>.sql`; `openDatabase` applies them on open. Released migration files are never edited (CLAUDE.md rule 5).
- Sessions per Auth.js adapter or JWT (decided in WEB-06).
- Data directory: `DATA_DIR` (`.env.example`; `./data` locally, `/data` in the container), file `communitiesforever.sqlite`, a TrueNAS dataset on the host.

## Access
- Battle.net OAuth (region EU). Allowed: BattleTags on an allow-list; admin: `ADMIN_BATTLETAG`. Details in WEB-06.
- Later (WEB-12): an API token for an automatic uploader, admin scope, upload only.

## Hosting
- TrueNAS SCALE 25.10, Custom App (Docker Compose): image from GHCR, `/data` on a dataset, port 3000 on the LAN only.
- The existing nginx reverse proxy terminates TLS for `wow.vestras.nl` and proxies to the app. `client_max_body_size` above the upload limit.
- DNS at Hostnet: `wow` record to the home IP.
- Deploy: tag `v*` on `main` → GitHub Actions builds and pushes `ghcr.io/nicoputten/communitiesforever-web:<tag>` and `:latest` → update the app on TrueNAS.
