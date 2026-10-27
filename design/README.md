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
| `discord-settings` | `BotAdmin.dc.html` | Discord page: link your Discord, admin settings for the bot (WEB-39; from the Discord bot workshop) |
| `discord-settings-runs` | `BotAdmin-runs.dc.html` | Discord page with the runs section: runs channel, reminder time, ask now from the game, mark runs done (WEB-39, WEB-40) |
| `runs` | `SiteRuns.dc.html` | Runs page: this week, later, past, "runs I can join", your answers (WEB-40) |
| `run-detail` | `SiteRunDetail.dc.html` | Run detail: slots, answers with where they came from, who could join, organiser and admin actions (WEB-40) |
| `run-create` | `SiteRunCreate.dc.html` | Plan a run: dungeon, lead as, day, time in your time zone, note, Discord preview, form states (WEB-40) |
| `runs-phone` | `SiteRunsPhone.dc.html` | Runs on a phone; empty, loading and error states (WEB-40) |
| `dungeon-page` | `SiteDungeon.dc.html` | Dungeon page with its wings, who fits, planned runs, Plan a run (WEB-42) |
| `roster-cards-runs` | `Roster-runs.dc.html` | Roster cards with the next run, dots-only level spread, Scarlet Monastery wings, band popover with Plan a run (WEB-32, WEB-45) |
| `runs-flow` | `RunsFlow.dc.html` | Runs, how it travels: game, uploader, site and Discord, where a /reload is needed and the delays (overview for all run stories) |
| `runs-v2-findings` | `RunsFindings.dc.html` | Runs v2: 15 findings from testing the live site, each with the fix (WEB-47..50, WEB-45) |
| `runs-v2-picker` | `RunsPicker.dc.html` | Runs v2: character and role picker, level fit rules, roles per class (WEB-47, WEB-49) |
| `runs-v2-run-detail` | `RunDetailV2.dc.html` | Runs v2: run detail for the organiser: lead bar, slots with the move menu, could fill, answers (WEB-49) |
| `runs-v2-plan` | `RunsPlanV2.dc.html` | Runs v2: Plan a run, the dropdown component spec, the dungeon dropdown, roster bands v2 (WEB-48, WEB-50, WEB-45) |

The planned-runs boards (2026-10-27, from `docs/DESIGN-PROMPT-PLANNED-RUNS.md` in the Discord repo) are copies of earlier boards with the runs added; the earlier boards stay as they were. Where they overlap, the runs board is the newer design: `roster-cards-runs` over `roster-cards`, `discord-settings-runs` over `discord-settings`. The Runs v2 boards (2026-10-27, after testing the live site) are newer again: `runs-v2-*` over `runs`, `run-detail`, `run-create` and the bands of `roster-cards-runs`. Their account names (BattleTags, friends) are made up; the character names are from the live site (Nico: fine).
