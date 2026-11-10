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
| `roster-cards` | `Roster.dc.html` | **Superseded** by `roster-cards-doomsday` (cards), `runs-v2-plan` (bands). Roster cards grouped by friend, level spread, quick answers |
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
| `uploader-changes` | `SA01Changes.dc.html` | Uploader: What’s new (`/uploader/changes`), one box per kept version, the linked one highlighted; The app · What’s new tabs and the link on the uploader page (WEB-73) |
| `uploader-changes-states` | `SA02ChangesStates.dc.html` | Uploader What’s new: a long bullet, no versions yet (WEB-73) |
| `mission-pool` | `MP01Pool.dc.html` | Mission pool (`/admin/missions`, owner only): counts, the next 14 days and 2 weeks, the pool with stats and How often, desktop and 375 px (WEB-79) |
| `mission-pool-steering` | `MP02Edit.dc.html` | Mission pool: editing a free day (pin, Reroll, Pick…, Reroll day, Back to normal draw), the Pick… list (WEB-79) |
| `mission-pool-states` | `MP03States.dc.html` | Mission pool states: a locked day, a friend who saw the normal draw, switching a mission off, a changed week, the Admin changes log (WEB-79) |
| `mission-pool-admin-entry` | `MP04Entry.dc.html` | Admin page: the owner-only Doomsday missions box (WEB-79) |
| `mission-pool-v2-overview` | `MP05Overview.dc.html` | Mission pool v2: recipe bar, Today's quarry, 6-line days, the pool as nine theme cards with one open, desktop and 375 px (WEB-109) |
| `mission-pool-v2-hunt` | `MP06Hunt.dc.html` | Mission pool v2: Hunt targets, races × classes weighted by Everloot's census, desktop and 375 px (WEB-109) |
| `mission-pool-v2-pvp` | `MP07PvP.dc.html` | Mission pool v2: the 50 new PvP dailies by group, easy or check (WEB-109) |
| `discord-settings` | `BotAdmin.dc.html` | **Superseded** by `discord-page*` and `discord-page-coadmins`. Discord page: link your Discord, admin settings for the bot (WEB-39; from the Discord bot workshop) |
| `discord-settings-runs` | `BotAdmin-runs.dc.html` | **Superseded** by `discord-page*` and `discord-page-coadmins`. Discord page with the runs section: runs channel, reminder time, ask now from the game, mark runs done (WEB-39, WEB-40) |
| `runs` | `SiteRuns.dc.html` | **Superseded** by `asks-now` and the `runs-v2-*` boards. Runs page: this week, later, past, "runs I can join", your answers (WEB-40) |
| `run-detail` | `SiteRunDetail.dc.html` | **Superseded** by `runs-v2-run-detail`. Run detail: slots, answers with where they came from, who could join, organiser and admin actions (WEB-40) |
| `run-create` | `SiteRunCreate.dc.html` | **Superseded** by `runs-v2-plan`. Plan a run: dungeon, lead as, day, time in your time zone, note, Discord preview, form states (WEB-40) |
| `runs-phone` | `SiteRunsPhone.dc.html` | Runs on a phone; empty, loading and error states (WEB-40) |
| `dungeon-page` | `SiteDungeon.dc.html` | Dungeon page with its wings, who fits, planned runs, Plan a run (WEB-42) |
| `dungeon-quests` | `SA03Quests.dc.html` | Dungeon page: the Quests box, who has which quest for the dungeon, the +N overflow and the empty box (WEB-76) |
| `dungeon-bosses-loot` | `DL04Site.dc.html` | Dungeon page: Bosses & loot (every boss, its loot in two columns, Show N more, Quest and Nobody knows it tags, Usable by, Classic data), the Bosses jump list, Planned here with boss progress, Ran here's Last cleared, the recipe drop's tooltip; desktop and 375 px (WEB-102, WEB-97) |
| `run-boss-progress` | `DL05Run.dc.html` | Run page: the Bosses box once a run started (3 of 6, as of the last upload) and once cleared (Cleared, an optional boss skipped), Dungeon page › (WEB-97) |
| `reagent-sources` | `WB98Reagents.dc.html` | Recipe drawer (440 px) and phone sheet: where to get each reagent, at most 3 sources (vendor with the "limited stock" tag, crafted with a link to its recipe, skinning, herbalism, mining, drop with chances), "No known source" with ⓘ (WEB-98) |
| `item-sets` | `WB99Sets.dc.html` | Item tooltip: the set block (set name with "(0/N)" in gold, the pieces, the "(2) Set: …" bonuses, nothing worn), a 3-piece and an 8-piece set, desktop on a loot row and the 375 px sheet (WEB-99). Trimmed to this board's own artboard and style rules |
| `talent-tooltips` | `WB100Talents.dc.html` | **Superseded** by `talent-tooltips-v2`. Character page: a talent tree's tooltip: A (tree name, points, a line about the tree), B (the talents with rank and text), B+ (with a grid) (WEB-100) |
| `talent-tooltips-v2` | `WB101Talents.dc.html` | Talents v2, closer to the game (WEB-100): the tree tooltip on hovering a tree row (small tree, ranked talents), the tree as the game's talent frame (icons in the game's states, rank boxes, prerequisite arrows), the talent tooltip (Rank 2/5, Next rank, red Requires); 375 px: the tree in a sheet, a tapped talent's tooltip under it |
| `roster-cards-runs` | `Roster-runs.dc.html` | **Superseded** by `roster-cards-doomsday` (cards), `runs-v2-plan` (bands). Roster cards with the next run, dots-only level spread, Scarlet Monastery wings, band popover with Plan a run (WEB-32, WEB-45) |
| `runs-flow` | `RunsFlow.dc.html` | Runs, how it travels: game, uploader, site and Discord, where a /reload is needed and the delays (overview for all run stories) |
| `runs-v2-findings` | `RunsFindings.dc.html` | Runs v2: 15 findings from testing the live site, each with the fix (WEB-47..50, WEB-45) |
| `runs-v2-picker` | `RunsPicker.dc.html` | Runs v2: character and role picker, level fit rules, roles per class (WEB-47, WEB-49) |
| `runs-v2-run-detail` | `RunDetailV2.dc.html` | Runs v2: run detail for the organiser: lead bar, slots with the move menu, could fill, answers (WEB-49) |
| `runs-v2-plan` | `RunsPlanV2.dc.html` | Runs v2: Plan a run, the dropdown component spec, the dungeon dropdown, roster bands v2 (WEB-48, WEB-50, WEB-45) |
| `asks-now` | `SiteRuns-asknow.dc.html` | Asking now: the Runs page with the open asks above This week, as a friend sees it (WEB-51) |
| `asks-now-phone` | `SiteRunsPhone-asknow.dc.html` | Asking now on 375 px phones: full-width cards, 44 px buttons at the bottom (WEB-51) |
| `asks-now-states` | `AskNowStates.dc.html` | Asking now: every state (answered, last minute, none fit, didn't go through, your own ask, and N more) and the answers to the brief (WEB-51) |
| `doomsday-names` | `DD01Names.dc.html` | Doomsday, step 1: five names for the feature and the emblem (sun rising over a shield). Nico picked **Doomsday**, `/doomsday` with the alias `/doom` (E8) |
| `doomsday-rules` | `DD02Rules.dc.html` | Doomsday rules and catalogue: two tracks, schedule, points, the kill table, first to finish (A and B), streak and swaps, labels and tone, the PvP rank titles, the feats (E8). The board says 09:00; the reset is 19:00 (`DOOMSDAY.md`). |
| `doomsday-today` | `DD03SiteToday.dc.html` | Doomsday page, desktop: header with points and streak, Today (your goals, the Duel slot), Today so far, the Board (friends × goals, struck through), the 12-week heatmap (WEB-59). The board says 09:00; the reset is 19:00 (`DOOMSDAY.md`). |
| `doomsday-ladder` | `DD04SiteLadder.dc.html` | Doomsday page: the ladder (this week and all time, PvE and PvP apart, rows open per character, movement, PvP Virgin) and the PvP details (kills by zone, rank titles, duel grid and Elo, battlegrounds apart) (WEB-60). The board says 09:00; the reset is 19:00 (`DOOMSDAY.md`). |
| `doomsday-feats` | `DD05SiteFeats.dc.html` | Doomsday page: feats per friend and for the group, First in the group, rank titles, the feat states (WEB-60). The board says 09:00; the reset is 19:00 (`DOOMSDAY.md`). |
| `doomsday-phone` | `DD06SitePhone.dc.html` | Doomsday on a 375 px phone; empty (first day), loading and only-one-friend states (WEB-61). The board says 09:00; the reset is 19:00 (`DOOMSDAY.md`). |
| `roster-cards-doomsday` | `Roster-doomsday.dc.html` | Roster cards with Doomsday chips: PvE and PvP points this week and the streak (a copy of `roster-cards-runs` with only the chips added) (WEB-61) |
| `doomsday-feat-cards` | `DD12FeatCards.dc.html` | The 800 × 400 feat card images the site renders for the bot: PvP rank (from 6, special 14), 10,000 kills, first epic, epic mount, Jack of all trades, the watch-list items (WEB-56) |
| `discord-page` | `DiscordPageV3.dc.html` | The Discord page reorganised, admin view: For you (Your Discord, Your time zone) and For the group (admin only): The bot, Feats and Weekly recap, Runs, Doomsday, Linked friends; one switch, channel picker and test button per kind of post; section shortcuts that stay visible (WEB-58) |
| `discord-page-map` | `DiscordPageMap.dc.html` | Where every setting went: the 20 settings of the old page plus the Doomsday ones, each with its old and new place, tagged moved, renamed, split or new (WEB-58) |
| `discord-page-friend` | `DiscordPageFriend.dc.html` | The Discord page as a friend (not the admin) sees it (WEB-58) |
| `discord-page-states` | `DiscordPageStates.dc.html` | Discord page states: no bot token yet, a token just created, channels not reported yet, a reset change waiting ("From the next reset", with Undo), a friend without a time zone (WEB-58) |
| `discord-page-phone` | `DiscordPagePhone.dc.html` | The Discord page at 375 px: a friend's view, the top of the admin page, the admin page at Runs and Doomsday; every control 44 px (WEB-58) |
| `admin-coadmins` | `Admin-coadmins.dc.html` | Admin page, owner view: the Admins box (owner with crown, Make/Remove admin), Members, Guests, Blocked, the owner-only uploader devices and Danger zone, the Admin changes log (WEB-64) |
| `admin-as-admin` | `AdminAsAdmin.dc.html` | Admin page as an admin sees it: the "You're an admin" line, a read-only Admins box, no owner-only boxes, the same log (WEB-64) |
| `admin-coadmin-states` | `CoAdminStates.dc.html` | Co-admin confirm dialogs and states: Make/Remove admin, no admins yet, removing an online admin, "Only the owner can do this", the server refusing an outdated button, the safety rules (WEB-64) |
| `admin-phone` | `AdminPhone-coadmins.dc.html` | The Admins box and log at 375 px, owner and admin view, the Make admin confirm as a bottom sheet (WEB-64) |
| `discord-page-coadmins` | `DiscordPage-coadmins.dc.html` | The reorganised Discord page as an admin sees it: post settings usable, the bot card without token controls ("The bot token is managed by the owner.") (WEB-64) |
| `live-test-findings` | `LT01Findings.dc.html` | Live test of 29 Oct: every finding (leaked design notes, 7 bugs, UX, phone) with its decision (WEB-65) |
| `live-test-site-fixes` | `LT02SiteFixes.dc.html` | Live test fixes on desktop, before and after: tooltips instead of notes, avatar menu, roster, map, Doomsday week, duel grid (WEB-65) |
| `live-test-phone` | `LT03Phone.dc.html` | Live test fixes at 375 px: map header, Doomsday sub-tab chips, roster Filters bottom sheet, avatar menu (WEB-65) |
| `bot-visual-recap` | `BV1Recap.dc.html` | DoomBot weekly recap as real Discord embeds: header with fields, award image, map crop, icon thumbnails, Doomsday, challenge, link buttons (WEB-66, bot BOT-20) |
| `bot-visual-daily` | `BV2Daily.dc.html` | DoomBot daily Doomsday board as an 800 × 560 image in one embed, edited during the day (WEB-66, bot BOT-20) |
| `bot-visual-feats` | `BV3Feats.dc.html` | DoomBot feat posts: every feat a card, big 800 × 400 or the new strip 800 × 240, grouped per upload (WEB-66, bot BOT-20) |

Superseded boards stay as they were, marked in the table with the board that replaces them (WEB-63, 2026-10-29); build from the newer one.

The planned-runs boards (2026-10-27, from `docs/DESIGN-PROMPT-PLANNED-RUNS.md` in the Discord repo) are copies of earlier boards with the runs added; the earlier boards stay as they were. Where they overlap, the runs board is the newer design: `roster-cards-runs` over `roster-cards`, `discord-settings-runs` over `discord-settings`. The Runs v2 boards (2026-10-27, after testing the live site) are newer again: `runs-v2-*` over `runs`, `run-detail`, `run-create` and the bands of `roster-cards-runs`. Their account names (BattleTags, friends) are made up; the character names are from the live site (Nico: fine).

The Doomsday boards (2026-10-28, from `docs/DESIGN-PROMPT-DOOMSDAY.md`) are one feature: daily and weekly goals, points per track, feats and a ladder. The rules are the addon repo's `docs/DOOMSDAY.md`, which wins over the boards on three points: the reset is **19:00** realm time (a setting), not 09:00; the goals are computed by the addon and the site, not delivered; and the crown gives no points (version B of `doomsday-rules`). The Discord boards for Doomsday are in the bot repo, the addon's in the addon repo's `docs/design/doomsday-2026-10/`. All names on them are made up; there are no BattleTags or Discord IDs.

The `discord-page*` boards (2026-10-28, from the web engine's prompt for WEB-58) reorganise the Discord page and add the Doomsday settings. They replace `discord-settings` and `discord-settings-runs` for the page's layout; those two stay as they were. Their BattleTags (only in Linked friends) are the same made-up ones as on `discord-settings-runs`. The Doomsday reset default on them is 19:00, as `docs/DOOMSDAY.md` says; the 09:00 on the `doomsday-*` boards is the outdated one.

The co-admin boards (2026-10-29, from `docs/DESIGN-PROMPT-ADMINS.md`) are new boards: no admin-page board existed, so `admin-coadmins` follows the live /admin page. Its Danger zone shows WEB-62's box as built. All BattleTags on them are made up.

The live-test boards (2026-10-29, canvas "Doombringers v2", section "Live test · 29 Oct") come with Nico's brief `docs/DESIGN-BRIEF-LIVE-TEST.md`, which says what to change. One real account name on `live-test-findings` was replaced by a made-up one before committing.

The Mission pool boards (2026-11-03) show example missions; the page lists the real pool (`docs/STORIES.md` E10). All names on them are made up.
| `recipes-character` | `RC01Character.dc.html` | Recipes: the character page's Professions box with a recipe line per crafting profession, "as of", "Recipes not scanned" (WEB-92) |
| `recipes-search` | `RC02Search.dc.html` | Recipes: the existing Professions page with the live search ("Who can craft…?") and a recipe line per crafting card, desktop and 375 px (WEB-92) |
| `recipes-page` | `RC03Page.dc.html` | Recipes: the profession page `/professions/<slug>` with tabs, filters, the grouped table and the drawer (WEB-92) |
| `recipes-drawer` | `RC04Drawer.dc.html` | Recipes: the item tooltip and the recipe drawer at real size (WEB-92) |
| `recipes-phone` | `RC05Phone.dc.html` | Recipes: the profession page on a 375 px phone, the drawer and the tooltip as sheets (WEB-92) |
| `recipes-states` | `RC06States.dc.html` | Recipes: Nobody has, one character, no results, not scanned, loading (WEB-92) |
