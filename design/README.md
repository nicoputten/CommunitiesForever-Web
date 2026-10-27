# Design boards

Exports from the Claude Design workshop (WEB-02), direction A "Night over Azeroth". Decisions and tokens: `docs/DESIGN.md`.

The boards are **visual references only**, never production code: replicate their values (colour, type, spacing, radii, shadows, layout) in our own components with the tokens. Each folder is one export, unzipped unchanged; replace the whole folder when a board is re-exported. `support.js` and `vendor/` are the tool's runtime that renders the board, not part of the design. `assets/*.json` is the same file as `src/core/map/zones.json`.

Where a board and `docs/DESIGN.md` disagree, `docs/DESIGN.md` wins (for example the stale-site banner: 7 days, the `loading` board still says 3).

View them: `npm run design`, then open http://localhost:4400.

| Folder | Board | Screen |
|---|---|---|
| `map` | `Main.dc.html` | World map, desktop: top bar, continent switch, markers, clusters, hover card, roll call |
| `map-states` | `MapStates.dc.html` | Marker freshness, clusters, zone states, zoom levels, motion table |
| `phone-map` | `PhoneMap.dc.html` | Phone map with the roll call peeking |
| `phone-character` | `PhoneCharacter.dc.html` | Phone: tapped character (half sheet, zoomed map) |
| `phone-roll-call` | `PhoneRoll.dc.html` | Phone: roll call as a full sheet |
| `roster-cards` | `Roster.dc.html` | Roster cards grouped by friend, level spread, quick answers |
| `roster-table` | `RosterTable.dc.html` | Roster compact sortable table |
| `professions` | `Professions.dc.html` | Covered / thin / gap, cards per profession, matrix, recipe search placeholder |
| `character` | `Character.dc.html` | Character detail |
| `upload` | `Upload.dc.html` | Upload: dropzone and history (admin) |
| `upload-report` | `UploadResult.dc.html` | Upload: session report (what changed) |
| `upload-states` | `UploadStates.dc.html` | Upload: dragging, reading, wrong file, newer format, nothing new |
| `sign-in` | `SignIn.dc.html` | Sign in with Battle.net |
| `sign-in-states` | `SignInStates.dc.html` | Sign in: not on the list, Battle.net error, signing in |
| `empty-site` | `EmptyMap.dc.html` | Before the first upload |
| `loading` | `Loading.dc.html` | Skeletons, stale site banner, old friend data |
| `design-system` | `DesignSystem.dc.html` | Tokens and components |
| `uploader-page` | `SiteUploader.dc.html` | Uploader page: download, steps, pairing approval, your uploaders and tokens, your upload history (WEB-34; from the uploader workshop, history added 2026-10-27) |
