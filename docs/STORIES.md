# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order (2026-10-29): E9, the live test of 29 Oct: WEB-65 (site fixes) and WEB-66 (rules and bot images) side by side, with the bot's BOT-20 on WEB-66's contract (WEB-66: Nico's brief parts 2 and 5; no designer notes or legends in any image or text). Doomsday (E8, `docs/STORIES-COMPLETED.md`) is done and waits for the release. Next (2026-11-03): E10 Mission pool, WEB-78 then WEB-79, with the addon's CF-68 alongside WEB-78 (they share the schedule's shape and golden cases). Then (2026-11-03): E11 Doomsday mission catalogue, WEB-80 in four parts alongside the addon's CF-69, CF-78, CF-79 and CF-77, then WEB-81.

## Every UI story
- Build the screen in our Next.js app with the tokens from `src/styles/tokens.css` and real data through the view models. The board in `design/boards/` is a **visual reference only**: match its spacing, type and colours, never copy its markup or runtime.
- Always the design system (CLAUDE.md rules 11 and 12): no raw values outside the tokens, design system components first. A deviation only after Nico said so, recorded in `docs/DESIGN.md` "Deviations".
- The screen gets its design checks (WEB-30): computed-style checks for its key elements, accessibility scan, screenshot baselines at desktop and phone size.
- Accessible: semantic HTML, visible focus states, keyboard use, 44 px touch targets, contrast as in `docs/DESIGN.md`, `prefers-reduced-motion` honoured.
- Works at 375 px (phone) and 1440 px (desktop canvas); page max-width 1280.
- Empty, loading and error states of the screen are part of the story.
- Playwright test for the main flow at desktop and phone size; screenshots of both in the PR next to the board.
- **Player-facing copy only** (Nico, 2026-10-29, after the live test): every visible string is short copy for a player. No design notes, no legends, no explanations of how the system works or why. An explanation that helps a player goes into the ⓘ tooltip (WEB-65); otherwise it goes nowhere. Before each PR, check the rendered pages for sentences that explain rules or the design, and list every new visible string in the PR for Nico.

## E3 Access and hosting

## E4 Design foundations

## E5 Screens

## E6 Later

## E7 Discord bot and planned runs
The bot lives in its own public repo, [CommunitiesForever-Discord](https://github.com/nicoputten/CommunitiesForever-Discord) (BOT-01..07). The site is its only data source: it decides milestones, runs, the recap and who is linked; the bot formats and posts (decided with Nico, 2026-10-27). Design: the canvas's §12 "Discord bot" and the planned-runs boards (`design/README.md`; the flow: `runs-flow`).

**Planned runs** (decided with Nico, 2026-10-27): two kinds of group. *Ask now* lives in the game (addon CF-27) and is answered within minutes; with "Also post on Discord" it reaches the site after a `/reload` and the bot posts it. A *planned run* is owned by the site, posted and answered in Discord, reaches the game through the uploader (`Runs.lua`) and friends' addons, and ends in an invite in the game at start time. The in-game calendar is out of the flow. Times are stored in UTC and shown in each viewer's own time zone. Any linked friend can plan; organisers edit and delete their own runs, an admin can delete any run (the owner, `ADMIN_BATTLETAG`, and the admins the owner appoints, WEB-64). Reminders mention only those who answered I'm in or Maybe.

Order (2026-10-27; WEB-32, WEB-38, WEB-40 and WEB-46 are done): WEB-44, Runs v2 (WEB-47 first, then WEB-48, then WEB-49 with WEB-50 merged in), WEB-43, WEB-42, WEB-45. WEB-44 comes before WEB-43 because it is small and lets the uploader bring runs into the game (UP-12); WEB-41 before WEB-42 and WEB-45 so the site stores the week's history from launch. In the other repos: bot BOT-02 and BOT-03 now (WEB-38 is in), BOT-07 next so milestones post from launch, BOT-06 after WEB-39, BOT-04 after WEB-40 and WEB-43, BOT-05 after WEB-41; uploader UP-12 after WEB-44; the addon's CF-45..48 are done and wait for a release.

### Runs v2 (WEB-47 to WEB-49)
Nico tested Runs on the live site (27 Oct 2026) and the design came back as "Runs v2" (Nico, 2026-10-27): any character can join, the role is picked apart from the character, the organiser can move people, and styled dropdowns replace every native one. Boards: `runs-v2-findings` (the 15 issues, each with what was seen and the fix), `runs-v2-picker`, `runs-v2-run-detail`, `runs-v2-plan`. They are newer than `runs`, `run-detail` and `run-create` where they overlap. Done for all four when none of the 15 findings can be reproduced, at 1440 and 375 px. Decided with Nico: four stories, right after WEB-44 and before WEB-43; the dropdown is built in house (ARIA listbox and combobox, no new dependency); account names on the boards were replaced with made-up ones (characters are fine).


### Backlog (unordered, not yet stories)
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Final emblem and logo for the site.
- Map credit for Forever's maps (Nico, 2026-11-02: "no credit for now", later): since WEB-77 the coast and every zone border are traced from WoW: Forever's in-game continent maps (Blizzard's images); Syrio's SVGs only place them (the world frame). The Syrio CC BY-SA credit stays until this is decided (`tools/map/README.md` "Sources and licence"). Starting point for the credit: "Zone outlines: traced from World of Warcraft: Forever's maps (© Blizzard Entertainment), placed on Syrio's maps, Wikimedia Commons (CC BY-SA 4.0)"; `MAP_CREDIT` on the cards (`src/core/cards/mapCrop.ts`) to match.
- Dungeon catalogue: every dungeon with who cleared it, the group's first clear as a feat (Nico, 2026-10-28: brainstorm after E8 Doomsday, then designs).
- Doomsday across a clock change (bug hunt 2026-11-02, finding 6; before 28 Mar 2027): `scheduleAt` (`src/core/doomsday/engine.ts`) gives one UTC offset, today's, and `dayStart` and the kill scoring use it for past days too. After a DST change, days and kills from before it are placed 1 h off, and on the day of the change "resets … in" is 1 h off until the change. The addon does the same (the game clock's offset), so decide with the addon first. Fix: each day's offset from the realm time zone at that day (as `zonedToUtc` does for the recap), with a test across 28 Mar and 31 Oct 2027.

## E9 Live test fixes (2026-10-29)
Nico tested the live site read-only on 29 Oct 2026. The brief is `docs/DESIGN-BRIEF-LIVE-TEST.md`, with the boards `live-test-findings`, `live-test-site-fixes` and `live-test-phone` (the bot's are `bot-visual-*`). Where `docs/DOOMSDAY.md` disagrees on the PvP Virgin rule or the day label, the brief is newer and wins. Bugs 1, 2, 4 and 5 are data rules: the engine worker builds them, and WEB-65 shows the results. Nothing here changes live settings or data.

### WEB-65 Live-test site fixes
Boards `live-test-site-fixes` (desktop) and `live-test-phone` (375 px). Decided with Nico, 2026-10-29: the answers below.
- **Part 1: leaked notes and the tooltip.**
  - Every string in the brief's Part 1 table is removed, shortened or moved into a tooltip, as the table says.
  - The Professions recipe search is hidden until it works.
  - Beyond the table:
    - Doomsday loses "movement since last week", "Columns: 3 PvE dailies · Hunt · Skirmish", "Tap a friend for the split per character." and the rank table's subtitle.
    - The heatmap legend goes into a ⓘ.
    - The page subtitle becomes "Daily goals, feats and a ladder."
    - Day one becomes "Day one of Doomsday · Your first goals are below."
    - The Admin and Discord pages' explanatory lines move into ⓘ tooltips on their box titles; short status lines ("No guests.") stay.
  - **One tooltip component**, reused everywhere:
    - an 18 px gold-outlined ⓘ in a 44 × 44 tap area
    - opens on hover, focus or tap; closes on Esc, a tap outside or blur
    - panel at most 280 px wide
    - `aria-describedby`, `aria-label="More info"`, a visible focus ring
    - on a phone it opens below the icon, inside the screen
- **Part 2: bugs.**
  - The screens show the engine's results for bugs 1 (PvP Virgin only at 0 all-time PvP points), 2 (no rank yet: "No rank yet · N kills"; "Conscientious Objector" only for a PvP Virgin), 4 (the goal count matches the cards shown, the duel slot done after its first duel) and 5 (the day named by its start: "Wed evening", "Wed 19:00 → Thu 19:00", "done Thu 00:04", "resets Thu 19:00 · in 6 h 51 m").
  - The day name follows the reset hour: 05–11 morning, 12–16 afternoon, 17–22 evening, 23–04 night.
  - 3: "Past" is a start time before now. A cancelled run whose start is still ahead stays in its week group, struck through with CANCELLED, until its start time has passed.
  - 6: map markers show no age badge under 1 day. Older sightings stay faded on the data-age scale, and the tip says "here 6 d ago · seen 42 min ago". Zone labels never sit under a marker: they move aside or fade under it.
  - 7: the duel grid:
    - friends as rows and columns, "row vs column" in the corner
    - "—" on the diagonal, "·" for empty cells
    - scores never wrap; green when the row friend leads, red when behind
    - no scrollbar in the card up to 8 friends, its own scroll box beyond that
    - "Read across: Mira beat Tok 2–1" from the real data
- **Part 3: UX.**
  - **The avatar menu:**
    - the trigger shows your display name with ▾, never the BattleTag
    - items: Uploader, Discord, Admin (owner and admins, with an OWNER or ADMIN badge), and Sign out under a divider
    - every item 44 px; keyboard and Esc work
    - on desktop, Uploader and Discord also stay in the top bar
  - **Roster:**
    - no BattleTags on the friend cards; the subtitle is "3 characters"
    - the cards flow in CSS columns without holes
    - level-band chips show full dungeon names, wrap onto more rows, and are never cut off
  - **Map:** the Roll call has one scroll area, and "Unknown whereabouts" collapses into one row ("4 not sighted yet ▸").
  - **Doomsday Week:** every weekly has a progress bar and a number (with a detail such as "· Deadmines" where the engine gives one), and a line names who is closest ("Mira 5/5 done · Bob 4/5").
  - **Feats:** new characters are one grouped line per upload ("+4 new characters: Frida Snowmantle 41, …"), never a feat card and never counted as a feat.
- **Part 4: phone (375 px).**
  - The map's app bar shows the shield only.
  - The Doomsday tabs:
    - pill chips that scroll sideways without a scrollbar
    - a 48 px fade at the right edge
    - the active tab in view
  - The roster's filters become the search field plus one "Filters · N" button. It opens a bottom sheet with chip groups (Class, Role, Level, Profession), "Clear", and "Show N characters".
  - The avatar menu works the same on a phone.
- Done when:
  - none of the Part 1 strings (and the extra ones above) is on the site, checked in the templates and in the rendered HTML
  - unit tests cover the cancelled-run grouping, the goal count, the day label and the duel grid's lead colours
  - 375 px has no horizontal page scroll, and every control is at least 44 px
  - no BattleTag shows outside Admin and the owner/admin Linked friends list
  - every new visible string is listed in the PR
  - as every UI story: design checks, Playwright, screenshots after Nico's OK


## E10 Mission pool (2026-11-03)
An owner-only page for Doomsday's missions: every mission with its stats, the next 14 days and 2 weeks, and steering for days that aren't locked yet. Boards: `mission-pool` (the page), `mission-pool-steering` (editing a day), `mission-pool-states` (locked day, a friend who saw the normal draw, switching off, a changed week, the log) and `mission-pool-admin-entry` (the Admin page box).

**How it works** (decided with Nico, 2026-11-03):
- The normal draw stays as it is (addon `docs/DOOMSDAY.md` "The algorithm, exactly"), on both sides. The site sends only **changed** days and weeks: days whose set differs from the normal draw. Unchanged days need nothing, so a friend without fresh data still sees the right missions on them.
- The changes travel as a **schedule** in the runs answer (`doomsday.schedule`), through the uploader's `Runs.lua` (no uploader change: it passes the whole answer through) and from addon to addon (addon CF-68). An addon without the schedule, or older than CF-68, shows the normal draw.
- **Lock window:** today and tomorrow can't be changed; a week locks 24 h before it starts. The server refuses a change to a locked day or week, whatever the page shows. A day in progress keeps the set the addon recorded.
- The page reaches neither the addon nor Discord in any other way, and it changes no points: the site keeps scoring each friend from the set that friend's addon recorded.

**Where the boards are not the rules:**
- The missions on the boards are examples. The page lists the real pool (`POOL_VERSION`, addon `docs/DOOMSDAY.md`), grouped Daily PvE, Skirmish, Weekly, Bounty, and Hunt only once the Hunt is on (`HUNT_SINCE`). Until then the days show 3 dailies and the Skirmish, and there is no Hunt row or slot.
- The Duel slot shows "every day" and can't be changed.
- The zone of the day and of the week stay computed; they are not part of the schedule.

### WEB-78 Mission pool: schedule, steering and stats (no UI)
The data and rules behind the page; WEB-79 shows them.
- **Settings per mission** (owner only): on or off, and how often: Rare, Normal, Often. Stored with the change time; every mission starts on, Normal.
- **The site's plan for the next 14 days and the next 2 weeks:**
  - Start from the normal draw.
  - Every free (unlocked) day or week is redrawn where a setting asks for it: a mission that is off is replaced in its slot, and a mission set to Rare or Often is drawn less or more often than Normal (weights 1, 2, 4). The replacements follow the draw's rules: 3 different categories for the dailies, no mission on two days or weeks running, only missions that are on.
  - The owner's own changes win over that: **pin** a mission in a slot, **reroll** a slot, **reroll the day** (all its slots, pins kept), and **back to the normal draw** (removes the owner's changes for that day). A pin stays when the settings change; a reroll is random and is stored, so the plan never changes by itself.
  - A day or week whose plan equals the normal draw isn't stored as changed.
  - When a day or week enters the lock window, its plan is frozen as it is; later setting changes don't touch it.
  - Swaps stay the addon's, per friend, on top of the planned set.
- **The schedule in the runs answer:** `doomsday.schedule = { v, days = { ["<n>"] = { daily = { id, id, id }, skirmish = id, hunt = id }, … }, weeks = { ["<week>"] = { weekly = { id, id, id }, bounty = id }, … } }`, from yesterday to the last planned day and week, changed ones only. `v` is the server time of the last change to anything in it. Every field is optional; an empty schedule is left out. The exact shape and the slot rules are agreed with the addon in CF-68, and golden cases for them go into `doomsday-cases.json` on both sides.
- **Stats per mission, since the launch cut-off,** from the stored goal records (`doomsday_goals`):
  - **Came up:** the days or weeks it was in a set that at least one friend recorded. Days nobody played don't count.
  - **Swapped:** how often a friend got another mission instead of it.
  - **Done:** of the friends who had it, the share who finished it.
  - **Last:** when it last came up.
- **A friend who saw the normal draw:** for a changed day, which friends recorded a set (before swaps) that is the normal draw instead of the plan. Their points still count for the missions they had.
- **Admin changes:** every change is logged ("Ada pinned Run a dungeon with a friend on Fri 7", "Ada rerolled Daily 3 on Fri 7", "Ada switched off Explore a zone", "Ada set Earn 5 skill points to Often"), with the real mission names.
- **Owner only:** the server actions check `isOwner`; admins and friends get "Only the owner can do this".
- **Compatibility (rule 8):** new tables and settings only, empty at the start; an older addon ignores `doomsday.schedule`. The stats read existing goal records, older ones included.
- Done when:
  - unit tests: the plan for off, Rare and Often settings, pins, rerolls, back to normal, the lock window (today, tomorrow, a week 24 h before its start), never twice in a row and different categories in a redrawn day, the stats from a set of goal records, and "saw the normal draw"
  - the schedule's golden cases pass on the site and in the addon (CF-68)
  - a change to a locked day or week is refused by the server

### WEB-79 Mission pool page (boards `mission-pool*`)
The owner's page at `/admin/missions`, as on the boards, with WEB-78's data.
- **Admin page:** a new owner-only box "Doomsday missions" in the right column, under Uploader devices and above the Danger zone: the number of missions and changed days, today's day, and "Open mission pool". Admins never see it (`mission-pool-admin-entry`).
- **The page** (`mission-pool`):
  - the counts per kind and "Off"
  - **Next 14 days:** one tile per day with its missions' short labels; "today" and "tomorrow" locked; "changed" on a changed day; "1 changed" in the title; the ⓘ
  - **Next 2 weeks:** each week from its start, its weeklies and Bounty; "changed" and "Locks Sat 8 19:00" where they apply
  - **The pool:** per kind, each mission with Short, Points, Came up, Swapped, Done, Last, and How often (Rare · Normal · Often) or Off with the Discord page's toggle; the ⓘ
  - at 375 px the days scroll sideways and the pool becomes one line per mission ("Came up 18 · done 71% · last Mon") with "Show all"
- **Steering a day** (`mission-pool-steering`): a free day opens an editor under the days: its name and span ("Fri 7 Nov · evening", "Fri 19:00 → Sat 19:00"), per slot the mission with "pinned" or "rerolled", "Reroll" and "Pick…" (only missions of that kind that are on, with "also Wed 5" for one already in the next days), "Reroll day", "Back to normal draw", and a warning when a mission is also on the day before or after ("Finish 10 quests is also on Thu 6"). A week opens the same editor for its weeklies and Bounty.
- **States** (`mission-pool-states`): a locked day shows its set with the lock and no buttons; a changed day in the past shows "Bob saw the normal draw" with its ⓘ; switching a mission off asks first ("Switch off “Explore a zone”?", "Won’t come up from Thu 6.", Cancel, Switch off); the Admin changes log shows the page's changes.
- Times shown in the viewer's own time zone, as everywhere (the reset is realm time, shown local).
- Empty and error states: no goal records yet (stats "—"), the Hunt off (no Hunt row or slot).
- Done when: as every UI story (design checks, Playwright at both sizes, screenshots after Nico's OK); every visible string is listed in the PR; an admin who isn't the owner can't open the page or see the box.

## E11 Doomsday mission catalogue (2026-11-03)
The site's copy of the approved Doomsday catalogue and its rule changes, so that the site and the addon draw and score identically when the addon's pool version 2 ships (addon E18). The approved list is the addon repo's `docs/DOOMSDAY-CATALOGUE.md`: 118 PvE dailies in 15 categories, 50 weeklies (with `w.blueGear` in place of `w.ilvl3`) and 100 PvP missions (Skirmish and Bounty). The rules stay in the addon's `docs/DOOMSDAY.md`; the golden cases in `tests/fixtures/doomsday/doomsday-cases.json` pin both copies. The story was drafted in the addon repo (`docs/WEB-STORIES-DOOMSDAY-CATALOGUE.md`) so both sides were agreed in one review.

**Build order:** WEB-80 in four parts, one PR each, each merged once its addon counterpart is merged. Until part 4 the site's draw and scoring stay those of the addon's released pool version 1.

| Part | Pairs with | What |
|---|---|---|
| 1 | CF-69, CF-70 (merged) | every catalogue entry already in the addon (text, short label, category, points, `can`, `fallback`); points per goal by the pool version recorded with each day and week |
| 2 | CF-78 | only a real fight ends PvP Virgin |
| 3 | CF-79 | the weekly, Skirmish and Bounty entries; a retired goal leaves the pool only from its version on |
| 4 | CF-77 | pool version 2: the new `since` values, `POOL_VERSION = 2`, the weekly draw by category |

WEB-81 (the Mission pool page for every mission) follows part 1; its screenshot baselines need Nico's OK.

### WEB-80 The site's copy of the pool: catalogue, labels, points (pairs with CF-69, CF-70, CF-77, CF-78, CF-79)
- The TypeScript pool gets every catalogue mission with its id, slot, category (15 categories for the PvE dailies), text, short label and points. Missions without `since` are in the catalogue but never drawn, as today.
- **Points per goal** (CF-69): a day's and a week's points come from its `done` ids and the pool version recorded with them: the entry's own `pool`, else the friend's `goals.pool`, else 1. Days and weeks of pool version 1 keep 5 per daily, Skirmish and Hunt and 15 per weekly and Bounty; from pool version 2 each goal's own points (a goal without a size keeps the flat value; the Hunt stays 5). An unknown id (a newer pool) counts nothing, as today. Crown, crossing out and the streak are unchanged (they count goals).
- The site stores the pool version with each day and week as it receives it, so a friend's stored day keeps the points of the pool version recorded with it, whatever that friend's addon sends later.
- **Pool version 2** (CF-77) ships in the same release as the addon's: the draw with 15 categories, the new `since` values, `POOL_VERSION = 2`, and the weekly draw by category (3 different categories, as the dailies; weeks of pool version 1 keep the draw without categories).
- **Golden cases:** the new keys (`pools.catalogue`, `pointsPerGoal`, the PvP Virgin `ladder` cases, the pool-2 `draws`) are copied byte-identical from the addon's `doomsday-cases.json` and pass unchanged; the existing cases keep passing.
- Every place that shows points (the /dailies page, the roster, the ladder, the Mission pool page, Discord recaps through the bot's data) shows the per-goal totals. Points per track stay side by side, never added together.
- Labels and texts come from the pool, never typed twice.
- **PvP Virgin** (CF-78, Nico 2026-11-03): a friend stays a PvP Virgin until a real fight: an honorable kill, a duel or a finished battleground. PvP points from goals without a fight (emotes, the PvP flag) count on the PvP track but don't end it. The ladder, the roster and the bot's data use the same rule; golden `ladder` cases pin it.
- **Compatibility (rule 8):** every field read is optional: an entry without `pool` falls back to `goals.pool`, then 1; ids the site doesn't know keep counting nothing. Records stored before this story have no `pool` and score as pool version 1, which is what they were drawn in.
- Done when: every part's golden cases pass unchanged; unit tests for points per pool version (a stored day of version 1 next to one of version 2, a friend whose `goals.pool` changes after the day was stored); visible strings listed in each part's PR.

### WEB-81 The Mission pool page for every mission (pairs with WEB-78, WEB-79)
The page was built for 37 missions (14 PvE dailies). With every catalogue mission it needs:
- **Group and filter:** the pool table grouped by slot, then by category (15 for the dailies), each group folded open or shut with its count ("Cooking · 9"); filters for slot, category and state (in the pool / waiting for data / off); a search box on title, label and id.
- **Waiting missions shown:** a catalogue mission not yet in the pool (no `since` in the site's pool version) is listed greyed with "waiting for data" and the VERIFY number from the catalogue when known; it can't be scheduled or set to Often, and How often is disabled with that reason as its tooltip.
- **Points column** with each mission's points (1, 3, 5) in the pool version the page shows, and the day tiles show the day's PvE total.
- **Pick…** in the day editor: a searchable list with the category filter, only missions that can go in that slot (in the pool, category not taken that day); the refusal line stays for anything else.
- **Phone:** the groups start folded with their counts; "Show all N" works per group; the table never scrolls sideways.
- **Counts header:** "Daily PvE · 118" and so on per slot, and how many are in the pool now.
- Works with pool versions 1 and 2.
- Done when: as every UI story; screenshot baselines (desktop and phone) for the grouped table, a folded group, the filters, and Pick… with search, after Nico's OK.

## E12 Launch probe (2026-11-04)

### WEB-82 Download the friends' launch-probe results (owner only, pairs with the addon's hidden probe)
The addon runs a hidden probe of which game APIs work on Forever and keeps the compact results in `CommunitiesForeverDB.global.probe` (per client flavour, per item: `{ status, detail, at, build, ... }`, at most ~30 KB). They ride along in every upload; the owner downloads them to analyse them, so friends don't need the separate probe addon.
- **Admin page box "Probe results"** (owner only, in the side column): one line with how many friends have results and the newest upload time, and a **Download** button. Without results: "No probe results yet." and no button. Admins never see the box.
- **The download** (`GET /api/admin/probe`): a JSON file, one entry per friend: their newest accepted upload that has a probe section, with display name, BattleTag, upload time and the probe section as it is in the file.
- **Read from the stored raw uploads** with our Lua parser (rule 2): not in `normalize`, not in the derived tables, no new table. Whether an upload has a probe section is remembered per file hash in memory, so the page doesn't parse every upload on each view.
- **Owner only** (`isOwner`, checked on the server): admins and friends get 403, without a session 401.
- **Nowhere else:** no probe detail on any page, in the bot data or in logs. Only the box's count and time and the owner's download.
- **Compatibility (rule 4):** a file with a probe section normalizes exactly as the same file without it; files without one (every release so far) are unchanged.
- Done when: unit tests (reading, choosing the newest per friend, refusals), the design checks for the box, screenshot baselines after Nico's OK, every new visible string listed in the PR.

## E13 Launch on Forever (2026-11-05)

### WEB-83 Switch the community without hiding history (pairs with the addon's CF-83)
At launch no in-game community can be made on Forever (a Blizzard bug), so the addon lets the player pick their guild as "the community" (CF-83): its id lands in `settings.clubId` like a community's, and the site needs no change for that. When community creation works again the group may move to a real community with another `clubId`. Until now the only way to move was "Start fresh from launch" (WEB-62), which hides everything before it. Nico (2026-11-05): moving from the guild to a community keeps everything.
- **The control:** an owner-only **Community** box on the admin page (side column, above the Danger zone, not in it: nothing is destructive) with which community uploads count from and **Switch community…**, which asks first in a dialog. Admins don't see the box, and the server refuses the switch and its Undo to anyone but the owner (`OwnerOnlyError`), like the cut-off and the bot token. Both are lines in Admin changes.
- **The rule:** from the moment it's pressed the site's community is "not set"; the owner's next accepted upload sets the new `clubId`, as the first upload after the cut-off does (WEB-74). Until then friends' files get the existing "no community yet" rejection and are taken when sent again after it. After it, files from the old community are "another community".
- **History:** everything stays: earlier uploads, characters, sightings, Doomsday goals and points, feats, the activity feed, members and recap numbering. A rebuild keeps the uploads from before the switch as they were (the data is keyed by character and friend) and refuses the same files after it as the live check did.
- **Stored:** `community_switches` (the newest upload id when it was pressed, who, when), read by the upload check and the rebuild. A database without switches behaves exactly as before (rule 4).
- **Undo** while the owner hasn't uploaded since: the switch goes and a rebuild counts the files refused meanwhile. Once the owner has uploaded, a move back is another switch.
- **Texts:** the word "community" also for a guild (Nico). A friend refused as "no community yet" once the owner has uploaded before (after a switch, or a fresh start) reads that the site waits for the admin's next upload from the new community; before the owner's very first upload the text stays as it was. The app's code stays `no_community_yet`. Every new or changed string listed in the PR.
- Done when: server tests (guild A → switch → owner uploads community B → a friend on A is refused, one on B taken, A's history still there; rebuild; owner-only; Undo; a second switch; with the cut-off; a database without switches), the log lines' unit test, an e2e test up to the dialog, the design checks; the admin page's screenshot baselines (desktop and phone) change and need Nico's OK; the box's look recorded in `docs/DESIGN.md` "Deviations" once Nico approved it.

### WEB-84 No community, no Doomsday: leave the character out (launch bug)
On launch night (Thu 2026-11-05, 00:51) the bot's evening board "Doomsday · Wed evening" showed Nico's progress (Alt level done, 3·0 today, a streak of 1) while he was in no community at all: none could be made on Forever yet and he had never picked one in the addon. **Cause:** while the site's community is not set (before the admin's first upload after the launch cut-off, or after a community switch), `checkFile` took the admin's file without looking at its `settings.clubId`, so a file of no community was accepted; its goals went into `doomsday_goals`, the board read them, and because the file named no community it did not set one either (the friends' files kept waiting: "4 friends without addon data"). The Doomsday engine and the board only read what accepted uploads stored; the bot only reads the site's API. Nico (2026-11-05): without a community, the site and the bot leave the character out; the addon keeps tracking quietly, and once a community or guild is picked that day's progress counts right away.
- **The rule:** a file without `settings.clubId` is never taken, the admin's neither, whether the site's community is set or not. The whole file is refused, so its characters are off the map and roster too, not only Doomsday (Nico confirmed, 2026-11-05). It is the existing "other community" rejection (the app's code stays `other_community`) with its own text, so the friend knows what to do. Nothing of it reaches the site: no characters, members, sightings, feed, feats or Doomsday goals, so no board, ladder, lookup or recap shows it.
- **Same day:** the addon keeps the last 7 days of goals, so the first file that names the community brings the day's progress along and counts at once.
- **An old database:** at start the site looks for accepted uploads of no community after the launch cut-off (only an older version could store them) and, if there are any, rebuilds once with the rule above. Beta uploads before the cut-off are left as they were. A board already posted in Discord stays there; the next board and update leave the character out.
- **Texts (new):** the upload screen "This ledger has no community" / "The addon in this file has no community or guild picked. Pick one in the addon, /reload and upload again."; the stored reason "This file has no community: pick the community or guild in the addon, then upload again."; the history line and the app's summary line "No community picked".
- Done when: unit tests for the rule and the texts; server tests: no community (the admin's file before and after the community is set, a friend's): left out, no board; a community picked later the same day: that day counts; an old database: rebuilt once at start, not again, beta uploads left alone. No screenshot baseline changes.

### WEB-85 Members only: a character in the community or guild (access bug, pairs with the addon's CF-89)
Live v0.9.0 (Nico, 2026-11-05): `battleTagsOf` made every BattleTag in an accepted file's `people` and `presence` a member. The addon records every Battle.net friend it sees playing Forever and syncs with every friend who runs it, so Nico's Battle.net friends outside the group could sign in and showed on the map's roll call as "… have no addon data yet". Nico blocked two by hand. Nico (2026-11-05): a BattleTag becomes or stays a member only when at least one of its characters is in the in-game community or guild; the owner always counts, guests keep their own list. The site's members never come from Battle.net friendship.
- **Proof (addon CF-89):** `global.members = { [guid] = { name, seenAt } }`, the selected community's members as the uploader's client last saw them, replaced whole on every update. Only the GUID keys and the newest `seenAt` (how fresh the list is) are read; every field may be missing. An empty table, or one without any of the uploader's own characters (a list the game had not loaded), proves nothing. Stored per upload (`uploads.roster`, `roster_seen_at`).
- **What proves membership:** the owner's newest roster, plus every friend's roster that is newer than it (by `seenAt`). So any accepted file with `members` adds the BattleTags with a character on it, as people join over time (Nico: not only the owner's), and a friend's stale list never brings back someone who left. A friend's roster never removes anyone.
- **Before the owner's first roster** (Nico agreed, 2026-11-05): a file without `members` (every addon up to v1.2.1) makes nobody new a member except its uploader; the uploads the site had before this version keep the old rule (`members_before`, written by the migration), so existing members stay as they are. Rosters already prove new members then.
- **At intake, always:** the site keeps data (people, characters, presence links, sightings, feed, Doomsday goals, feats) only of the owner, admins, guests, members, and those a roster proves at that moment. Everything else in the file is dropped silently, so an older file uploaded later (any addon version) neither re-adds a Battle.net friend nor brings back their data.
- **The cleanup, automatic:** on the owner's first upload with `members` (Nico agreed), and again whenever the owner's roster drops a GUID the proof had, the site rebuilds every upload with the proof: members without a character on it stop being members, and their people, characters, presence links, sightings, feed days, Doomsday goals and feats go. The owner, admins, guests and blocks stay. Each member removed is a line in Admin changes ("removed member X: no character in the community"), by the owner whose upload it was; a blocked one is not named.
- **Everywhere:** the map, roll call ("no addon data yet"), roster, Doomsday board and ladder, recap, lookups and the bot's feed all read the merged data and history, so they follow. Recaps already stored and posts already in Discord stay as they were.
- Done when: unit tests (reading the roster, the rule, leaving data out), server tests (a new site; a site from before; a friend's roster before and after the owner's; a stale friend's roster; the owner's first roster with its cleanup and log; leaving and joining; an old file after the cleanup naming non-members: no access, no data; an untrustworthy roster; a rebuild coming to the same), every released addon fixture without a roster (`tests/compat`), no screenshot baseline changes (the design sample carries a roster with everyone).

### WEB-86 Guild members known only through the guild: a name and their BattleTag (live bug, pairs with the addon's CF-90)
Live v0.9.1 (Nico, 2026-11-05): a guild member who runs the addon but isn't the uploader's Battle.net friend is stored as `people["aid:<accountId>"]` (addon CF-28), without a display name or BattleTag. The character page said "Played by Unknown player", and such a person could never become a member: there is no BattleTag to sign in with.
- **A name:** a person without an own display name and without a BattleTag shows the name of their first character by name, as the addon does (its Linker also puts online characters first; the site has no online state). "Unknown player" only when no character name is known. It is the resolved `displayName`, so the character page, roster, roll call, map, Doomsday board and ladder, recaps, the upload report and the bot's payloads all follow.
- **Linking:** whenever the merged data holds a BattleTag with the person's account ID (their own upload's `self.battleTag` with `self.accountId`, or a record keyed by BattleTag carrying `aid`: what the addon's CF-90 sends over the guild), the `aid:` person is merged into the BattleTag, as the addon's `Merge.absorb`: characters move over, the newer record's fields win, removals are kept. An older file keyed by `aid:` afterwards changes nothing. Their feed days, feats and Doomsday goals (the newer copy per day or week) move to the BattleTag. The upload report doesn't list them as a new person.
- **Members (WEB-85 unchanged):** an `aid:` person gets no access. Once linked, the BattleTag with a character on the roster becomes a member by the existing rule.
- Done when: unit tests (the name, linking in one file, across uploads in either order, by the own upload, the newer fields and removals, not new in the report); a server test (shown by character name, linked by a later file with history moved, a member, an older file and a rebuild changing nothing); every released addon fixture (`tests/compat`); no migration; no screenshot baseline changes.

### WEB-88 Level spread: dots of at most 3 levels, dungeons one per line (live)
Live (Nico, 2026-11-06): on a roster with characters at nearly every level from 1 to 16, they all merged into one dot "23", because a dot kept growing while each next character was within 2 levels of the one before. And the three dungeon chips that fit (Ragefire Chasm 13–18, Hall of Thanes 13–20, Ruins of Lordaeron 15–22) stood side by side in a wrapping row.
- **Dots:** characters within 2 levels still merge, but one dot covers at most 3 levels (lowest to highest ≤ 2 apart, e.g. 7–9). Levels 1,1,1,3,4,5,7,7,7,8,8,8,8,9,9,9,10,10,12,12,14,15,16 make 5 dots: 1–3, 4–5, 7–9, 10–12, 14–16.
- **Phone:** characters within 4 levels merge and one dot covers at most 5 levels; dot middles stay at least 5 levels apart (24 px on the 375 px track, WCAG 2.5.8, WEB-32). A dot that would sit closer joins the dot before, even past 5 levels: the spacing wins over the cap.
- **Dungeons:** one per line under the track, lowest level first (by min, then max, then name), each showing the name, range, how many fit and the runs as before. The best band keeps its gold but no longer goes first. Which dungeons show is unchanged (at least 2 characters in the range); the popover, "Show all N" (the same bands as before behind it) and the phone bottom sheet stay.
- Done when: unit tests (the live example, the cap, the phone's spacing, the order), e2e and design checks updated; screenshot baselines (roster, roster bands) change only after Nico's OK.

