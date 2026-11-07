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

### WEB-95 Item tooltips: Use texts with durations and totals
Nico (2026-11-07): Elixir of Minor Defense and Minor Arcane Elixir show only their name and "Max Stack: 20", on hover
and in the recipe drawer. The import dropped every Use/Equip line with a token it couldn't fill, and almost every
consumable has `$d` (duration). Now the import also reads SpellMisc, SpellDuration, SpellRadius, SpellAuraOptions and
SpellTargetRestrictions and fills `$d`, `$o`, `$t`, `$a`, `$h`, `$n`, `$u`, `$i`, `$q`, `$x`, `$s` ranges, `$M`,
`${...}` arithmetic, `$/N;`, other spells' tokens and descriptions (`$12345s1`, `$@spelldesc12345`), `$l`/`$g` and
`$?` conditions (`src/core/recipes/spellText.ts`); a token still unfilled is dropped and the line kept. The stored item
shape is unchanged (only more `use`/`equip`/`chanceOnHit` lines); the owner re-runs "Import item data" after the
release. Done when: unit tests for an elixir, a healing potion's range, food and a bandage, a weapon proc and the
leftovers; lint, tests and build pass.

### WEB-94 Item import: fall back to the last known build
On 2026-11-07 the live "Import item data" failed with "wago.tools answered 503.": wago.tools' build list
(`/api/builds`) was down while its table exports still answered. Now, when the build list fails, the import uses the
last import's builds (`item_import`), else the pinned `KNOWN_BUILD` 1.60.1.70790 / `KNOWN_ERA` 1.15.9.70576, says so in
its step and marks the summary `fallback`; the admin line adds "build list unavailable, used the last known build".
A failing table download still fails the import. Tests: build list down (pinned builds), a newer last import's build
wins, no fallback mark when the list answers.

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

### WEB-87 The Doomsday board image shows everyone who played today, in pages (live, pairs with the bot)
Live v0.9.2 (Nico, 2026-11-06): the board image the bot posts each evening had at most 6 rows (`BOARD_ROWS`), while many more friends play. Nico's decisions:
- **Who is a row:** every friend who has done at least one goal today (`doneCount` > 0, the Duel slot included), in the board's order (most goals done first, then by name). Friends with addon data who did nothing today are not rows: one line "+N haven't started" on the last page. While nobody has a goal done yet (the reset post), everyone with addon data is a row at 0, paged the same (Nico, 2026-11-06). Friends without addon data stay in the news line ("2 friends without addon data") and are not counted in it.
- **Pages:** 8 rows per image, at most 10 images (Discord's limit per message). Beyond 80 rows the last page says "+N more" before "haven't started". With more than one page each image has a page marker ("1/3") at the top right. Every page has the footer (the site, "resets in …"): each image stands alone in Discord. An image is 800 × 560 up to 5 rows and grows by a row's height (64 px) for each row (and the extra line) beyond that (before, a 6th row ran into the footer).
- **The event:** `doomsdayBoard` and `doomsdayBoardUpdate` gain `images`, the ids of all pages in order; `image` stays page 1, so a bot that knows only `image` (v0.5.1) still posts page 1. Page n's id is `doomsday-<day>-<hash>-<n>` (n ≥ 2); the hash covers every page. The event's `friends` (the bot's text board) are unchanged.
- **No strike-through:** a friend who finished all PvE dailies no longer has the name struck through or muted, on the image and on the site's Doomsday board (table and phone cards). The crown and "finished all dailies first" stay; screen readers still hear "(all PvE dailies done)".
- Done when: unit tests (rows, the line, pages, the cap, the ids), a server test (each page's id answers its picture, an unknown page 404s, the event's `images`), `docs/BOT-API.md` updated; the design screenshot baselines change only after Nico's OK.

### WEB-88 Level spread: dots of at most 3 levels, dungeons one per row on the level line (live)
Live (Nico, 2026-11-06): on a roster with characters at nearly every level from 1 to 16, they all merged into one dot "23", because a dot kept growing while each next character was within 2 levels of the one before. And the three dungeon chips that fit (Ragefire Chasm 13–18, Hall of Thanes 13–20, Ruins of Lordaeron 15–22) stood side by side in a wrapping row.
- **Dots:** characters within 2 levels still merge, but one dot covers at most 3 levels (lowest to highest ≤ 2 apart, e.g. 7–9). Levels 1,1,1,3,4,5,7,7,7,8,8,8,8,9,9,9,10,10,12,12,14,15,16 make 5 dots: 1–3, 4–5, 7–9, 10–12, 14–16.
- **Phone:** characters within 4 levels merge and one dot covers at most 5 levels; dot middles stay at least 5 levels apart (24 px on the 375 px track, WCAG 2.5.8, WEB-32). A dot that would sit closer joins the dot before, even past 5 levels: the spacing wins over the cap.
- **Dungeons:** one per row under the track, lowest level first (by min, then max, then name), each a band from its min to its max level on the track's scale (as the dots and ticks), its width exactly that range. The text is inside the band, the name first (Nico, 2026-11-06: the dungeon's name is the most important): the name, range, how many fit and the runs where they fit; else the name alone (the short name, "SM Graveyard", where the full name doesn't fit); cut with "…" as a last resort; the full text on hover (`title`) and in the accessible name. Nico, 2026-11-06, after a first version as a plain list: "it makes sense if they are relative on that 1-60 line", and after text beside a narrow band: the text belongs inside, cut, with the rest on hover. The best band keeps its gold but no longer goes first. On a phone (375 px is too narrow for a scale) the bands stay a list, one full-width line each, lowest level first. Which dungeons show is unchanged (at least 2 characters in the range); the popover, "Show all N" (the same bands as before behind it) and the phone bottom sheet stay.
- Done when: unit tests (the live example, the cap, the phone's spacing, the order), e2e and design checks updated; screenshot baselines (roster, roster bands) change only after Nico's OK.

## E14 Doomsday pool version 3 (2026-11-06)

### WEB-89 The site's copy of pool version 3 (pairs with the addon's CF-99)
Nico (2026-11-06) chose pool version 3: 83 missions the addon now tracks (60 dailies, 22 weeklies from its CF-74, CF-75, CF-76, and the Skirmish `p.homeGuard`) join the draw (pools of 103 dailies, 49 weeklies, 4 Skirmish, 5 Bounty), and the honor rank goals leave it, because Forever has no readable PvP rank (`UnitPVPRank` is missing). The addon and the site must draw the same missions, so this ships in the same release as the addon's pool version 3. Pattern: WEB-80 part 4 (pool version 2).
- **The pool:** `POOL_VERSION = 3`; `since = 3` on the 83 missions of the addon's CF-99 (`d.reward`, `d.fishFriend`, `d.feedFriend` still wait for an in-game check); `retired = 3` on `p.ranked`, `p.rankUp`, `b.ranked5` and `b.rankUp` (they stay in the catalogue, with their texts, for days and weeks already recorded). The draw itself is unchanged: 3 PvE dailies of 3 categories, 3 weeklies of 3 categories, the Skirmish and the Bounty from version 3's lists.
- **Points:** each goal's own points, as from version 2. Days and weeks keep the pool version recorded with them, so a day of version 2 keeps its points and its draw.
- **Golden cases:** `doomsday-cases.json` is copied byte for byte from the addon's CF-99 commit: the pool-3 `pools`, the catalogue's `since`/`retired`, and the new pool-3 `draws` (and any `swaps`); the pool 1 and 2 cases pass unchanged.
- **Labels and texts** come from the pool (already in the catalogue since WEB-80); no text is typed twice.
- **Compatibility (rule 4):** an addon on pool version 2 (v1.3.2) keeps drawing and recording version 2 (`pool = 2` on its days and weeks); the site shows and scores those as version 2. Where the site draws itself (the Mission pool page, today before a friend's file recorded it), it uses version 3. A steered day of the Mission pool reaches an old addon only when all its ids are in version 2; otherwise that addon keeps its normal draw (its own rule, CF-68). The bot (v0.5.2) gets ids, texts and labels from the site, all already in the catalogue, so nothing changes for it.
- Done when: the golden cases pass unchanged; unit tests updated for the new pool sizes; the Mission pool page and the design sample follow; screenshot baselines change only after Nico's OK.

### WEB-101 The site's copy of pool version 4 (pairs with the addon's CF-104; released only on Nico's go)
Nico (2026-11-07): retire "Defend home" and add the flag missions, but hold the release. **Not on develop until Nico
says release:** a draft PR, so a site release in between (v0.11.2 with WEB-95) keeps pool 3.
- **The pool:** `POOL_VERSION = 4`; `retired = 4` on `p.homeGuard`; `since = 4` on `p.flagUp`, `p.flagHour`,
  `b.flagged3h`, and on `d.reward`, `d.fishFriend`, `d.feedFriend` only if the addon's CF-104 adds them.
- **Golden cases:** `doomsday-cases.json` copied byte for byte from the addon's CF-104 commit.
- **Labels and texts** from the pool; nothing typed twice.
- **Compatibility (rule 4):** an addon on pool 3 keeps drawing and recording pool 3; the site shows and scores those
  days as pool 3.
- Done when: the golden cases pass unchanged; unit tests for the new pool sizes; the Mission pool page and the
  design sample follow; screenshot baselines change only after Nico's OK.

## E15 Recipes (2026-11-06)
Design handoff: `docs/RECIPES-HANDOFF.md` (boards RC01–RC08; its "Amendments" win). Four parts, each shipping on its own: A the addon's scan (CF-38), B the item database and upload processing (WEB-90), C the site's pages, D DoomBot. B's schema is what C and D build on.
Findings of the launch probe (addon CF-105, Forever builds 70790 to 70862, 2026-11-07): the game gives no recipe
source text (`GetRecipeSourceText` missing), no "can make now" count and no cooldown, so "Learn from" and
`recipe_sources` stay on cmangos only, and a can-make count or cooldown is out of scope here and in `/craft`. The
addon's `recipeLines` (the recipe's profession, e.g. Cooking 185) is confirmed reliable: it stays the fallback for
recipes the item database lacks (`src/core/recipes/learned.ts`). The addon sends no skill-up colour: the difficulty
dots stay computed from the thresholds and the character's skill.

### WEB-90 Item database, import and learned recipes (Part B)
- **Import (B1):** `npm run import:items`, by hand once per patch, idempotent. The Forever client's DB2 tables from wago.tools (product `wowf`, build 1.60.1.70790), Classic Era's for what is Forever's own and what cmangos' spells teach, cmangos classic-db (GPL-3.0, attributed in `docs/SOURCE-DATA.md`) for where recipes are learned. Never Wowhead. Downloads stay outside the repo; the tests use invented fixtures. Removed and unobtainable recipes count nowhere.
- **Tables (B2):** `items`, `recipes` (four thresholds, green = (yellow + grey) / 2), `recipe_reagents`, `recipe_sources` (`is_rare` for drop and rep), `character_professions`, `character_recipes` (`first_seen_at`); Forever's own recipes and items are stored from the uploaded pairs.
- **Icon cache (B3):** fetched once from the CDN (config `ICON_CDN_URL`, Blizzard's render CDN by default), kept and served by the site, 56 px, the game's question mark when missing.
- **Upload processing (B4):** per character, new recipes inserted with `first_seen_at`, vanished ones removed, skill, link and `scanned_at` updated; the first scan of a character or profession is the baseline; new rare finds per character per upload collected in `recipe_finds` for Part D. Nothing is posted.
- **Compatibility (rule 4):** every released addon sends no recipes: nothing changes for them.
- Done when: unit tests for the import parsing (fixtures), the threshold maths, the diff and baseline rule, rare finds and Forever's own pairs; lint, tests and build pass.

### WEB-91 Item data from the admin page, public item icons (Nico, 2026-11-07)
Nico answered WEB-90's two questions: "Yes, both".
- **Import item data:** an owner-only box on the admin page runs the import of `npm run import:items` on the server (the image has no `scripts/`), in the background and one at a time: what it is doing while it runs, then the build, recipes and items, or a clear error. Owner only, like the other server settings (WEB-64). The newest Forever and Classic Era builds by default; the command line keeps working. A run that wrote new data is a line in Admin changes.
- **Public item icons:** `/api/item-icons/<name>` without a session, so Discord can load them for DoomBot; strict names, long cache headers; nothing else under `/api` loses its check. Also CLAUDE.md rule 6's list of open routes.
- Done when: tests for the import run (a fake wago.tools with a cut-off download, one at a time, the error); the open icon route with tests next to the closed ones; lint, tests and build pass; the admin page's screenshot baseline changes only after Nico's OK.
### WEB-92 Recipe pages (Part C, boards `recipes-*`)
Boards RC01–RC06 (`design/boards/recipes-character`, `recipes-search`, `recipes-page`, `recipes-drawer`, `recipes-phone`, `recipes-states`); the handoff's Part C (C1–C7) with its amendments. Builds on WEB-90's tables. Libraries (handoff): Radix UI Dialog, HoverCard, Tabs; Floating UI; TanStack Table and Virtual; MiniSearch; nuqs; exact versions.
- **Item tooltip (C1):** one shared `ItemTooltip` on every item icon and name: the game's look, our own item data, no sell price; 150 ms hover delay, flips at the screen's edges; on a phone a tap on the icon opens it as a sheet with "Open recipe". Icons from the icon cache (`/api/item-icons`), the question mark without one.
- **Character page (C2):** under each crafting profession (and Cooking, First Aid) "86 recipes ›" to `/professions/<slug>?char=<GUID>`; "as of 21 Oct" only when that profession's scan is older than 7 days; "Recipes not scanned" with an ⓘ without a scan.
- **Professions page (C3):** the live search in the placeholder's place (from 2 letters, typo-tolerant, "Can craft" at most 6 and "Nobody yet" at most 3, best quality first, ↑ ↓ Enter Esc, a pick opens the recipe's drawer; "All Tailoring recipes ›"); one line per crafting card, "**112** of 185 recipes ›". Nothing else on the page changes.
- **Profession page (C4):** `/professions/<slug>`: "← Professions", name and card badge, "112 of 185 recipes known", the card's crafter bars; tabs All / Known / Nobody has with counts; search, character, type and skill filters; everything in the URL (`?char=&type=&skill=&tab=&q=&recipe=`); a virtualised table grouped by item type, highest skill first; a row opens the non-modal drawer at `?recipe=` (Esc or ✕ closes; Copy link).
- **Phone (C5):** two-line rows; the drawer as a sheet (swipe down or ✕); an icon tap opens the tooltip sheet; filters scroll sideways.
- **States (C6):** Nobody has; one character (Known means "this character knows it", "as of" when stale); no results with Clear filters; "No recipes scanned yet" with "186 recipes to learn" and "See all recipes"; skeleton rows while loading.
- **Counting:** every character counts; only obtainable recipes count in "N of M" and Nobody has; Forever's own recipes (no name yet: "Item 279972", neutral icon) count in the totals but never as Nobody has while their source is unknown. Difficulty dots compare each character's skill with the four thresholds. Never gold, BattleTags or copy longer than the boards'.
- Done when: the handoff's C7 checklist; unit tests of the view models, e2e of the main flow (desktop and phone), design checks with baselines Nico approved; lint, tests and build pass.

### WEB-93 The bot's recipes: rare-find posts and /craft (Part D, site side; pairs with the bot's BOT-25)
Nico (2026-11-07) gave Part D to the WEB-90 worker. Board RC08; contract `docs/BOT-API.md` "Recipes".
- **Rare finds:** a `recipeFinds` bot event per character per accepted upload with new rare finds (WEB-90's `recipe_finds`: every source a drop or rep, never a first scan, never a trainer, vendor or quest recipe), in the upload's transaction, never on a rebuild; under the feats switch and in the feats channel. Acknowledging it marks the finds posted.
- **/craft:** `lookup/craftable` (autocomplete over what recipes make) and `lookup/craft` (the item and its quality colour, the profession and skill, every crafter with a difficulty colour, the reagents with counts, the recipe's drawer URL, where it is learned, the public icon path). 404 when no recipe makes it.
- Names only, never BattleTags or gold. WEB-92 owns the professions pages and the item tooltip: nothing of them changes here.
- Done when: tests that a first scan and a trainer recipe make no event, a drop recipe makes one that is never made again, and the three `/craft` answers; lint, tests and build pass.

## E16 More game data from the item import (2026-11-07)
Nico (2026-11-07): what else the item import can give, as stories. Checked on the Forever build 1.60.1.70790: it has
`DungeonEncounter` (bosses: name, map, order), `ItemSet`, `Talent` and `TalentTab`; it has **no** Adventure Guide
loot tables (`JournalEncounter`, `JournalEncounterItem`, `JournalInstance` answer 400). Loot comes from cmangos
(already imported for WEB-90). Builds on WEB-95's spell texts.
**Every story here needs a design first:** the designer makes its board(s) before a worker builds it; until then the
story waits. Each lists what the board has to show.

### WEB-96 Bosses and boss loot in the item import (data; the page is WEB-102)
Built (2026-11-07), docs/SOURCE-DATA.md "Dungeon bosses and their loot":
- **Import:** the Forever client's `DungeonEncounter` (base difficulties 0 and 1), its `MapID` matched to our
  dungeons by the client's map name; `ID` = `ENCOUNTER_END`'s `encounterID` (checked: `3353, Witherfang` in Ruins of
  Lordaeron). Bosses matched to cmangos `creature_template` by name per map (a summoned boss: the one spawned
  nowhere); loot from the boss's own `creature_loot_template` rows only, no reference tables; >= 1 % plus quest items
  and recipes at any chance, highest first, with item class/subclass, AllowableClass, the quest of a quest drop and
  the recipe a recipe item teaches. Forever's own dungeons: bosses without loot.
- **Hand-made** (`src/core/gamedata/bosses.ts`, cited from warcraft.wiki.gg): the final boss and the optional bosses
  per dungeon or wing, the wing of each Scarlet Monastery, Blackrock Spire, Stratholme and Dire Maul boss, encounters fought together (Mograine with
  Whitemane, The Lost Dwarves) and the few names the client and cmangos spell differently.
- **Tables:** `dungeon_bosses`, `boss_drops` (migration `0030_boss_loot`), written with the item import in one
  transaction. Read by `src/server/bossViews.ts`: `dungeonBossViews(db, dungeonId, wingId?)` (bosses in order with
  final and optional, each with its drops and the item's name, quality, icon and tooltip record) and
  `addonLootFile(db)`.
- **The addon's loot file:** `npm run export:addon-loot -- <out>` writes `Data\Loot.lua` (GPL-3.0, cmangos
  attribution, the build, generated notice), byte-identical for the same data. Sample: `tests/fixtures/addon-loot/`.
- Compatibility: no upload changes. The item data stays valid; one "Import item data" adds the bosses.
- Stratholme and Dire Maul are split into wings (Nico, 2026-11-07): `strat` live/undead (stratlive, final Balnazzar;
  stratud, Baron Rivendare), `dme` east/west/north (dmeast, Alzzin the Wildshaper; dmwest, Prince Tortheldrin;
  dmnorth, King Gordok), in `src/core/gamedata/dungeons.ts` as wings with their addon ids (Group Finder 816/1603 and
  813/814/815). They are not dungeons of their own on the site yet (no `wingsAreDungeons`): the dungeon pages story
  makes them so. The optional list holds only bosses the wiki calls optional, rare, summoned or a bonus boss.

### WEB-102 Dungeon page: bosses & loot (DL04)
Built (2026-11-07), board `design/boards/dungeon-bosses-loot` (DL04):
- **Bosses & loot** between Who fits and Quests (`src/components/dungeon/BossesLoot.tsx`, view model
  `src/core/views/dungeonLoot.ts` `bossesLoot`): every boss in the client's order, number + name, "optional" in grey;
  its drops (WEB-96's `boss_drops`) in two columns (one on a phone): icon with quality border, name in quality colour,
  type line ("Two-Hand · Mace", "Leather · Legs", "Quest item", "Recipe · Cooking", as the addon's
  `DungeonLoot.typeText`), drop % (highest first). At most 6, then "Show N more ▾" (`LOOT_SHOWN`), counted after the
  Usable switch. Tags "Quest" and "Nobody knows it"; a recipe drop's name links to its recipe drawer
  (`/professions/<slug>?recipe=<spell>`), its tooltip adds "Nobody knows it", who has the profession ("Can learn:
  Lia Thornwhisper · Cooking 150") and "Click to open the recipe ›" (`ItemTooltip`'s new `footer`). Every item has
  WEB-92's tooltip (phone: the sheet, with "Open recipe").
- **Usable by [character ▾]** with a switch: your characters, the most recently played first (the default); the
  pick and the switch are remembered in this browser (`localStorage` `cf.usableBy`). Off dims what the class can
  never use (icon at `--opacity-unusable`, text `--text-faint`), on hides it. The rule: `src/core/loot.ts` `usable`,
  checked against the addon's `loot-usable-cases.json`. One "Classic data ⓘ".
- **Bosses** jump list at the top of the side column (`BossJump.tsx`): sticky, the boss in view bold; left out under
  1024 px. The box and the list only show once an item import has bosses for the dungeon.
- **One fit rule** (Nico, 2026-11-07): `levelFit` fits from `min - 2` (`FIT_BELOW`; `dungeonFit` against the addon's
  `dungeon-fit-cases.json`): Who fits, Plan's suggestions, could fill, the roster's bands and the bot's run data.
- **Stratholme and Dire Maul wings are dungeons of their own** (`wingsAreDungeons`): `strat-live` (Main Gate, addon
  `stratlive`), `strat-undead` (Service Gate, `stratud`), `dme-east`, `dme-west`, `dme-north` (`dmeast`, `dmwest`,
  `dmnorth`), ranges from the client's Group Finder (813 East 54–60, 814 West 56–60, 815 North 56–60, 816 and 1603
  58–60). The old `strat` and `dme` (`LEGACY_DUNGEONS`, `whole`) stay readable: stored runs and older addons' plans
  keep them, `/dungeons/strat` goes to the first wing, they are never offered for a new run, and their run page lists
  every wing's bosses under the wing's name, cleared when any wing's final boss dies.
- Golden cases copied byte for byte to `tests/fixtures/addon-golden/` from the addon's `develop` after CF-106 (see its
  README), wing ranges included. Checked by `tests/unit/dungeonGolden.test.ts`.
- A recipe drop's tooltip says "Requires Cooking (75)" and "Can learn" lists only friends with the profession at that
  skill or higher (the drop's `skill` and `line`, WEB-96's follow-up).
- Deviations (approved by Nico, 2026-11-07, `docs/DESIGN.md` "Deviations"): the dimmed rows' faint text instead of
  45 % opacity (contrast), the dropdown's name not in its class colour, a phone's recipe name as text.

### WEB-97 Which bosses a run killed (DL05; pairs with the addon's CF-103)
Built (2026-11-07), board `design/boards/run-boss-progress` (DL05):
- **Uploads:** `src/core/bossKills.ts` reads every kill of a file: the records' `runs.*.bossKills = { [encounterID] =
  at }`, the uploader's runs in progress (`runs[guid].bosses`, schema 3; schema 2's `true` has no time and is left
  out) and friends' `liveKills`. Each (character, boss, time) once in `boss_kills` (migration `0032_boss_kills`),
  written with the history (rebuilt by a rebuild). The site now reads schema 3 (`SUPPORTED_SCHEMA`). Older addons send
  a count only: no kills, nothing changes for them (rule 4).
- **Progress** (`src/core/runProgress.ts`, the addon's `run-progress-cases.json`): kills of the dungeon's bosses by
  any character of the run's group (I'm in, Maybe, the organiser's lead) from 1 h before the start until the first
  daily reset after it (the Doomsday day boundary, as the addon's Runs tab); optional bosses don't count; cleared =
  the final boss died; an optional boss not killed on a cleared run is skipped.
- **Run page** (`src/core/views/bossProgress.ts` `runBosses`): a Bosses box at the top of the side column once the
  run has started: ✓ and the kill time per boss (hover: "Killed 20:31 · from Grom’s log"), "3 of 6" and a bar,
  "optional", "– skipped" once cleared, "Cleared · 21:24"; while going "as of 20:45 · Grom’s upload" (the newest
  upload of someone in the group). "cleared" next to the time once cleared. "Dungeon page ›" under the title, "Loot
  on the dungeon page ›" under the bosses. The bot doesn't change.
- **Dungeon page:** Planned here says "5 in · 3 of 6 bosses" once a run has a kill; Ran here says "Last cleared Tue"
  and the characters who killed the final boss then (kills of it within 10 minutes), when a kill log shows one.
- Deviation (approved by Nico, 2026-11-07): the board's "started 20:04" next to the time: the site doesn't know when
  a group entered (the feed has no start time), so the page keeps its "started N min ago".

### WEB-98 Where to get a recipe's reagents (needs a design)
- From the data already imported (cmangos `npc_vendor`, the loot tables, gathering nodes in
  `gameobject_loot_template`): per reagent in the recipe drawer, whether it is sold by a vendor (name, zone,
  limited stock), dropped (the top sources), gathered (herb, ore, skinning) or crafted (links to that recipe).
  At most 3 sources per reagent, best first.
- Same in `/craft`'s answer (`docs/BOT-API.md`, optional field), so DoomBot can show it later.
- **Design needed:** the sources under each reagent in the drawer and in the phone sheet.
- Done when: import tests (vendor, drop, gathered, crafted, none); view-model tests; design checks; lint, tests and
  build pass.

### WEB-99 Item sets in item tooltips (needs a design)
- **Import:** the Forever client's `ItemSet` (name, items) and its bonuses (`ItemSetSpell`: spell and threshold, texts
  through WEB-95's spell texts). Forever's own copies of sets (new item IDs) are sets of their own.
- **Tooltip:** a set item shows the set's name with the count, its items, and the bonuses (`(2) Set: ...`) the way
  the game does, with nobody's pieces marked (the site doesn't know gear).
- **Design needed:** the set block in the tooltip, desktop and phone sheet.
- Done when: import tests; tooltip view-model tests; design checks; lint, tests and build pass.

### WEB-100 Talent tooltips (needs a design)
- **Import:** the Forever client's `TalentTab` and `Talent` (tree, row, column, ranks, spell per rank), the texts
  through WEB-95's spell texts.
- The character page's talent bars (`TalentBars`) show each tree's talents on hover or tap: name, rank, text, as far
  as the synced talents tell which ones (check what the addon sends first; points per tree only means tree tooltips
  only).
- **Design needed:** the talent tooltip, and a talent tree view if the synced data allows one.
- Done when: import tests; view-model tests; design checks; lint, tests and build pass.

### WEB-103 Spike: Everloot as a boss loot source (investigation only)
Done (2026-11-07), report: [docs/research/everloot-loot-source.md](research/everloot-loot-source.md). Nico asked
whether [Everloot](https://everloot.app) (data CC BY-SA 4.0) can replace cmangos for boss loot, or fill in where it
has nothing. We don't gather drops with our own addon.
- **Access:** the drop rates and the public corpus answer 30 requests an hour per address without a key, 2,000 with
  Nico's free key. Our whole boss input is about 9 requests today.
- **Shape:** drops are keyed by creature ID, and encounters by the same encounter ID as `dungeon_bosses`.
- **Coverage today:** 4 of 183 classic bosses (Ragefire Chasm only) and 0 of Forever's 58. VanCleef, Mutanus and
  Arugal have nothing yet. Where Everloot has data, it shows Forever's new loot that cmangos can't know.
- **Licence:** CC BY-SA 4.0 may go into the addon's GPL-3.0 `Data\Loot.lua`, with the credit "Data from Everloot
  (https://everloot.app), CC BY-SA 4.0." in the file and next to the data on the site. No Everloot logo.
- **Outcome:** don't replace cmangos. Fill in later as a "Forever data" layer once Everloot covers a quarter of our
  bosses or any new Forever dungeon. The report sketches that story and its cost.

### WEB-104 Recipe drops: the link opens the recipe, the tooltip shows what it makes (fixes on WEB-102)
Nico tested v0.12.0 (2026-11-07) on a boss's pattern nobody knows ("Pattern: Dark Leather Tunic"):
- **The recipe link opens its drawer.** `/professions/<slug>?recipe=<spell>` (a boss's recipe drop, the bot's
  `/craft` and rare-find links, the Professions search) opens that recipe's drawer also when nobody opened the
  profession in game yet ("No recipes scanned yet"), over all recipes; recipes nobody knows are found too. Closing the
  drawer stays on all recipes (`?tab=all`), not the empty state. A link to a recipe the page doesn't list shows the
  page as before.
- **A recipe item's tooltip shows what it makes**, as in game: under the pattern's own lines, after an empty line,
  the created item's tooltip (name in its quality colour, its lines) and "Requires Heavy Leather (12), Fine Thread
  (2)" with the reagents, then the site's own footer ("Nobody knows it", "Can learn"). On every item tooltip of a
  recipe item (the dungeon page's loot, `/api/items/<id>`), desktop and phone sheet. A recipe that makes no item (an
  enchant) shows only its own lines.
- **Data:** which recipe a recipe item teaches comes from what the item import already stores (`boss_drops.recipe_id`,
  WEB-96), the created item and reagents from `recipes` and `recipe_reagents`. No new import, no migration; uploads,
  stored data and the bot API don't change.
- Done when: view-model and server tests (reagents line, created item from a boss drop or a known recipe, none for
  other items); e2e: a recipe link on an unscanned profession opens and closes its drawer, a recipe drop's hover
  tooltip names the created item; lint, tests, build and design checks pass (the recipe-drop tooltip's screenshot
  baseline changes: new baseline after Nico's OK).
