# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order (2026-10-27): WEB-44, then Runs v2 (WEB-47, WEB-48, WEB-49 with WEB-50 merged in), WEB-43, WEB-42 (done), WEB-45. The order across the repos is under E7.

## Every UI story
- Build the screen in our Next.js app with the tokens from `src/styles/tokens.css` and real data through the view models. The board in `design/boards/` is a **visual reference only**: match its spacing, type and colours, never copy its markup or runtime.
- Always the design system (CLAUDE.md rules 11 and 12): no raw values outside the tokens, design system components first. A deviation only after Nico said so, recorded in `docs/DESIGN.md` "Deviations".
- The screen gets its design checks (WEB-30): computed-style checks for its key elements, accessibility scan, screenshot baselines at desktop and phone size.
- Accessible: semantic HTML, visible focus states, keyboard use, 44 px touch targets, contrast as in `docs/DESIGN.md`, `prefers-reduced-motion` honoured.
- Works at 375 px (phone) and 1440 px (desktop canvas); page max-width 1280.
- Empty, loading and error states of the screen are part of the story.
- Playwright test for the main flow at desktop and phone size; screenshots of both in the PR next to the board.

## E3 Access and hosting

## E4 Design foundations

## E5 Screens

## E6 Later

## E7 Discord bot and planned runs
The bot lives in its own public repo, [CommunitiesForever-Discord](https://github.com/nicoputten/CommunitiesForever-Discord) (BOT-01..07). The site is its only data source: it decides milestones, runs, the recap and who is linked; the bot formats and posts (decided with Nico, 2026-10-27). Design: the canvas's §12 "Discord bot" and the planned-runs boards (`design/README.md`; the flow: `runs-flow`).

**Planned runs** (decided with Nico, 2026-10-27): two kinds of group. *Ask now* lives in the game (addon CF-27) and is answered within minutes; with "Also post on Discord" it reaches the site after a `/reload` and the bot posts it. A *planned run* is owned by the site, posted and answered in Discord, reaches the game through the uploader (`Runs.lua`) and friends' addons, and ends in an invite in the game at start time. The in-game calendar is out of the flow. Times are stored in UTC and shown in each viewer's own time zone. Any linked friend can plan; organisers edit and delete their own runs, the admin can delete any run (one admin, `ADMIN_BATTLETAG`; the board's "Admins: Nico, Mira" is not built). Reminders mention only those who answered I'm in or Maybe.

Order (2026-10-27; WEB-32, WEB-38, WEB-40 and WEB-46 are done): WEB-44, Runs v2 (WEB-47 first, then WEB-48, then WEB-49 with WEB-50 merged in), WEB-43, WEB-42, WEB-45. WEB-44 comes before WEB-43 because it is small and lets the uploader bring runs into the game (UP-12); WEB-41 before WEB-42 and WEB-45 so the site stores the week's history from launch. In the other repos: bot BOT-02 and BOT-03 now (WEB-38 is in), BOT-07 next so milestones post from launch, BOT-06 after WEB-39, BOT-04 after WEB-40 and WEB-43, BOT-05 after WEB-41; uploader UP-12 after WEB-44; the addon's CF-45..48 are done and wait for a release.

### Runs v2 (WEB-47 to WEB-49)
Nico tested Runs on the live site (27 Oct 2026) and the design came back as "Runs v2" (Nico, 2026-10-27): any character can join, the role is picked apart from the character, the organiser can move people, and styled dropdowns replace every native one. Boards: `runs-v2-findings` (the 15 issues, each with what was seen and the fix), `runs-v2-picker`, `runs-v2-run-detail`, `runs-v2-plan`. They are newer than `runs`, `run-detail` and `run-create` where they overlap. Done for all four when none of the 15 findings can be reproduced, at 1440 and 375 px. Decided with Nico: four stories, right after WEB-44 and before WEB-43; the dropdown is built in house (ARIA listbox and combobox, no new dependency); account names on the boards were replaced with made-up ones (characters are fine).


### Backlog (unordered, not yet stories)
- Uploader "What's new" page (`/uploader/changes`, one section per kept version from the feed's release notes, an anchor per version), then `notesUrl` in `GET updates/status` points to it (UP-10 proposal; left out of WEB-35b).
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
- Dungeon catalogue: every dungeon with who cleared it, the group's first clear as a feat (Nico, 2026-10-28: brainstorm after E8 Doomsday, then designs).
- The class per name in recap cards (award winners, the cards' characters), so the bot can put its class icon before them (bot BOT-11 left the recap without icons for lack of it).

## E8 Doomsday (decided with Nico, 2026-10-28)
Daily and weekly goals, points per track (PvE and PvP, never added together), a streak, a crown, feats and a ladder, in the game (addon E15), on the site and in Discord (bot "Doomsday"). **The rules are in the addon repo's `docs/DOOMSDAY.md`**, the one description for all three; read it first. It replaces the three workshop designs (milestones, PvP ladder, dailies and weeklies; their PRs were closed unmerged), and the recap v2 data and cards are part of it.

Boards (`design/README.md`, "Doomsday"):
- `doomsday-names`, `doomsday-rules`
- `doomsday-today`, `doomsday-ladder`, `doomsday-feats`, `doomsday-phone`
- `roster-cards-doomsday`, `doomsday-feat-cards`

The bot's boards are in its repo, the addon's in `docs/design/doomsday-2026-10/` there. Where a board and `DOOMSDAY.md` disagree, `DOOMSDAY.md` wins:
- the reset is **19:00** (a setting), not 09:00
- goals are computed, not delivered
- the crown gives no points (version B)

The design prompt is `docs/DESIGN-PROMPT-DOOMSDAY.md`.

Key decisions:
- **Single source of truth:** uploads stay it. The addon decides when a goal is done and sends the time (`goals`, CF-56), because the Doomsday day (19:00 to 19:00) doesn't line up with the feed's realm days. The site stores and counts. Kill points the site computes itself from the raw kills (`pvpKills`, CF-55), against the addon's golden file.
- **All-time totals** live only on the site and in the bot; the addon shows this week.
- Gold is never shown as an amount. No pronouns in texts. Names: friends by display name, characters by full name, never BattleTags or Discord IDs.

Compatibility: uploads from addons without CF-52 to CF-56 have none of the new fields. Each is optional everywhere. A card, feat or goal whose data is missing never shows, and friends without Doomsday data show "no Doomsday data yet", never 0 as if known.

Two workers (Nico, 2026-10-28):
- **Engine:** WEB-55, WEB-58, WEB-56, WEB-57, in that order.
- **Screens:** WEB-59, WEB-60, WEB-61. They start from view models with fixture data, so they don't wait for the engine, and agree the view-model shapes with the engine worker first.

The bot's stories need WEB-56 (feats) and WEB-58 (the Doomsday API).

### WEB-55 Store the new data from uploads
- Read the new character fields (`pvp`, `riding`) and the new feed fields from uploads into the derived data, kept per realm day like the activity feed. The feed fields:
  - CF-52: `kills`, `deaths` with `t`, `duels` with `t`
  - CF-53: `loot`, `notable`, `gold`, `sessions`, `groups`
  - CF-55: `pvpKills`
- Read `goals` (CF-56, own and friends' records in an upload):
  - per Doomsday day and week: `set`, `swapped`, `done`, `at`
  - `streak`, `best`, `pool`, `reset`
  - kept per friend for as long as the activity feed (not only the 7 days an upload holds)
  - the newer `at` wins, as the addon merges
  - no sharing switch (Nico, 2026-10-28: who doesn't want to share uninstalls the addon): `goals = false` or `feed = false` from older addons means nothing was sent, and stored data stays; `feed_sharing` goes
- A rebuild gives the same result. Validate and cap as the addon does: unknown death causes become `other`, goal ids at most 24 characters, 5 per day and 4 per week (the slots), numbers ≥ 0.
- `docs/ARCHITECTURE.md` and `docs/UPLOADER-API.md` (if the upload format is described there) updated. Tests on a fixture with every new field, one without them, and one with `goals = false`.

### WEB-58 The Doomsday engine and its API
After WEB-55 and the addon's CF-55 (its golden file).
- `src/core/doomsday/` implements `DOOMSDAY.md`:
  - the schedule (realm time zone, reset setting, day and week numbers)
  - the draw, pools and swaps; a catalogue of every goal id and title (an unknown id shows as "a goal from a newer version" and still counts)
  - points per track: goals from the stored `goals`, kill points and the Duel slot from the raw data
  - crossing out, the crown and the streak
  - the ladder per track (week, last week, all time, movement, the split per character)
  - the PvP details: kills by zone, solo and skulls, rank with our title, the duel grid and **Elo** (start 1000, K = 32, in time order, disputed duels left out), the battleground block, PvP Virgin
  - a 12-week heatmap per friend
  
  Where a victim field was unknown or guessed, the view model marks it so that screens can show "≈".
- Tests: the addon's `tests/fixtures/doomsday-cases.json`, copied with the addon commit it came from, passes unchanged. Plus all-time totals and Elo over more than 7 days, a reset setting change (from the next reset only), and friends without data.
- **The Discord page, reorganised** as the boards `discord-page`, `discord-page-map`, `discord-page-friend`, `discord-page-states` and `discord-page-phone` show (designed 2026-10-28): one box per kind of post, each with its own switch, channel picker and test button; Runs moves entirely into its box; "Milestones" becomes "Feats"; section shortcuts. `discord-page-map` lists where each of the 20 existing settings went; none may be lost.
- **Settings** on the Discord page (admin), as the other bot settings:
  - **Doomsday reset** (realm time, default 19:00)
  - **realm time zone** (default `Europe/Paris`)
  - a **Doomsday channel** (default: the posts channel)
  - switches for the **daily board post** and the **weekly ladder post**
  
  The reset setting goes into `GET uploader/v1/runs` for the uploader's `Runs.lua` (`doomsday = { reset, changedAt }`), as an optional field within v1 (`docs/UPLOADER-API.md`). Check with the uploader whether it writes unknown fields through, or needs a small story.
- **Bot API** (`docs/BOT-API.md`), optional within v1:
  - Event **`doomsdayBoard`**: at each reset, the new day's board (goals per track, every friend's row, the crown, the reset time). The bot posts it and acknowledges it with its message id. After each accepted upload that changes the day, an event **`doomsdayBoardUpdate`** for the same day carries the whole board again; the bot edits its message. At the next reset, a final `doomsdayBoardUpdate` with `final: true` and the day's summary (goals done, who won the Hunt race, the longest streak).
  - Event **`doomsdayLadder`**: at the weekly reset (Sunday at the reset time):
    - the week number
    - the top 5 per track with movement
    - the duel champion with rating, the most kills in one zone
    - the battleground block, the PvP Virgin of the week (if any)
  - Look-up **`doomsday`** with an optional `friend` (a display name) and the asker's linked Discord id. It returns:
    - that friend's goals today with progress
    - points this week and all time per track
    - the place on both ladders, the streak and best, the time to the reset
    
    It answers `404 no_data` before any Doomsday data.
  - Events only when the matching switch is on. A bot that doesn't know an event type skips and acknowledges it.
- **Recap (WEB-41):**
  - The Doomsday section of the recap: **Most devoted** (goals on the most days), **Perfect week** (every PvE daily, every day played, at least 4 days), and the points per track (top 3 each).
  - It replaces the dailies workshop's A15 and F23 and the ladder workshop's "Ladder of the week" line.
  - It comes through the `recap` event as an optional `doomsday` field.
  - `docs/RECAP.md` updated.

### WEB-56 Feats
After WEB-55. **Every milestone becomes a feat**: the existing kinds (`level`, `maxLevel`, `professionCap`, `newCharacter`) and the new ones below. The bot posts them as "Feat unlocked" (BOT-14). The event type stays `milestones` (bot API v1); only the words change. No points. The rank titles are also in `DOOMSDAY.md`.

**PvP and danger**
- `honorKills`: the first honorable kill, then 100, 1,000, 5,000 and 10,000 (lifetime kills from `pvp`). The first one has a playful text ("First blood: Ves Doombringer"). 10,000 gets a card image.
- `pvpRank`: a character's **new highest rank ever**, every rank 1 to 14. No post on decay or on regaining a rank held before (the site keeps the highest rank per character). Several characters ranking up after the weekly honor reset arrive together; that is fine. The post gives the official rank (per faction) followed by "a.k.a." our title, the same for both factions:

  | Rank | Horde / Alliance | Our title |
  |---|---|---|
  | 0 | none | Conscientious Objector (not posted; for the ladder and the rank race) |
  | 1 | Scout / Private | Fresh Meat |
  | 2 | Grunt / Corporal | Accidental Flagger |
  | 3 | Sergeant / Sergeant | Lowbie Botherer |
  | 4 | Senior Sergeant / Master Sergeant | Corpse Camper |
  | 5 | First Sergeant / Sergeant Major | Spirit Healer's Pen Pal |
  | 6 | Stone Guard / Knight | Mailbox Menace |
  | 7 | Blood Guard / Knight-Lieutenant | Flag Hugger |
  | 8 | Legionnaire / Knight-Captain | Honor Goblin |
  | 9 | Centurion / Knight-Champion | Queue Dweller |
  | 10 | Champion / Lieutenant Commander | Crossroads Landlord |
  | 11 | Lieutenant General / Commander | Hillsbrad Housing Crisis |
  | 12 | General / Marshal | Last Seen Questing at Launch |
  | 13 | Warlord / Field Marshal | Sleep Is for the Dishonorable |
  | 14 | High Warlord / Grand Marshal | Grass: Untouched |

  Card images from rank 6; rank 14 gets a special image.
- `duelWins`: 10, 50 and 100 duel wins (counted from the feed's `duels`, so from the day the character runs CF-52).
- `bgFirstWin`: the first win in each battleground (Warsong Gulch, Arathi Basin, Alterac Valley), from `runs`.
- `deaths100`: 100 deaths, "A spirit healer's best friend" (counted from the feed's `deaths`), once per character.

**Loot and mounts**
- `firstEpic`: only a character's first epic item; later epics go into the recap. The post shows the item name in epic purple, its slot and the level it was looted at (from CF-53's `loot.epic` entries). No Wowhead link. Card image.
- `mount`: riding 75, with the level and the place in the group ("the 3rd mount in the group").
- `epicMount`: riding 150, the same, with a card image.

**Professions and fishing** (no new kind for the caps: the existing Profession cap feat already covers Fishing, Cooking and First Aid at 75/150/225/300)
- At 300, the existing Profession cap post gets a flavour title: Cooking "Head Chef", First Aid "Field Medic", Fishing "Fish Whisperer".
- `firstCatch`: the Fishing rank goes above 1 (from `professions`/the feed's `ranks`).
- `jackOfAllTrades`: two primary professions plus Cooking, First Aid and Fishing all at 300. Card image.
- `notableItem`: the first time a character gets an item from the addon's watch list (CF-53's `notable`), each with its own text and card image:
  - Arcanite Reaper created
  - the first Arcanite transmute (Arcanite Bar created)
  - the first Mooncloth
  - Devilsaur Gauntlets or Leggings created (one feat for the set)
  - joined the Stranglethorn Fishing Extravaganza (Speckled Tastyfish looted)
  - won the Extravaganza (Arcanite Fishing Pole or Hook of the Master Angler received)

**First in the group**
- A "First in the group" badge on the post when no character in the group reached it before: the first honorable kill, the first rank 6, the first epic, the first mount, the first epic mount, the first to 60 (the existing Max level feat), every `notableItem` and Jack of all trades.

**Rules**
- No Discord pings. Reputation comes later.
- Same rules as now: the site's first upload makes none, and a rebuild never makes events again. A bot without BOT-14 skips kinds it doesn't know.
- Card images (as WEB-41d), as the board `doomsday-feat-cards` shows: `honorKills` 10,000, `pvpRank` 6 to 13 and the special 14, `firstEpic`, `epicMount`, `jackOfAllTrades` and each `notableItem`.
- `docs/RECAP.md` section 1 lists every new kind.

- The site keeps every character's feats (with the date and the "First in the group" mark) for the feats page (WEB-60) and the addon-independent history.

### WEB-57 New recap cards, awards, headlines and challenges
After WEB-55. The dailies' A15 and F23 are not built: the Doomsday section (WEB-58) covers them.
Each card keeps the existing rules: a threshold, a score against earlier weeks, 3 phrasings, a 4-week cooldown, at most one card per friend. IDs continue the catalogue.
- Awards:
  - A11 Warmonger: most honorable kills, at least 10
  - A12 Battlemaster: most battleground wins, at least 2
  - A13 Loot goblin: most rare and epic items, at least 5
  - A14 Duelist: most duel wins, at least 3
  - A7 Social butterfly: in a group with the most different friends, at least 3
- Stat cards:
  - S13 Bloodbath zone: the zone with the most honorable kills, at least 10
  - S14 Battleground of the week: the most played battleground, with wins and losses, at least 2 games
  - S15 Deadliest zone: the zone with the most deaths, at least 3
  - S11 Biggest group night: the evening with the most friends in groups together, at least 3
- Progress cards: P14 Rank race, two friends' characters one PvP rank apart, or the same rank with honor within 10 %.
- Social cards:
  - F14 Revenge: died to players most, then got the most kills, at least 3 of each
  - F15 Duel rivals: the pair that duelled each other most, with the score, at least 3 duels
- Fun cards:
  - F16 Most deaths: at least 5
  - F17 Fell to their death: a `fall` death
  - F18 Died by fire: a `fire` death ("the campfire won")
  - F19 Untouchable: the most levels gained with 0 deaths, at least 3 levels
  - F20 Big spender: the biggest gold spent; text without amounts ("someone bought something shiny")
  - F21 Purple rain: epic items received, at least 1
  - F22 Marathon: the longest session, at least 3 hours
  - F7 Night owl: played after 01:00 the most
  - F8 Early bird: played before 08:00 the most (both in each friend's own saved time zone; without one, the site's)
- Headlines: `pvp` (a week with many kills), `danger` (a week with many deaths).
- Challenges:
  - "Win 3 battlegrounds as a group"
  - "Each of you gets 25 honorable kills"
  - "Take back Tarren Mill" (kills in Hillsbrad Foothills)
  - "Duel every friend once"
  - "A week without dying"
- `docs/RECAP.md` lists every new card with its threshold. Tests per card: shows above the threshold, not below it, and not without the data.

### WEB-59 The Doomsday page: Today, Week, Board and heatmap
Boards `doomsday-today` (desktop) and `doomsday-rules` (labels, tone). Starts from view models with fixture data, agreed with the engine worker; switches to WEB-58's data when it lands.
- A page **Doomsday** (`/doomsday`, in the navigation after Runs) with a header:
  - today's and this week's points (PvE and PvP side by side), the streak and best
  - tabs: Today, Week, Board, Ladder, Feats, PvP
- **Today:**
  - your 5 goals with progress or a check and its time, the swap mark with the original in its tooltip
  - the Duel slot (who's done, who's open), the time to the reset
  - "Today so far" (the crown, who finished, who hasn't started, who has no addon)
- **Week:** the 3 weeklies and the Weekly bounty with progress, the time to Sunday's reset.
- **Board:** every friend × today's goals, struck through with the time when done. A friend's name is crossed out when the 3 PvE dailies are done. The crown, today's and this week's points, the streak.
- **The 12-week heatmap** per friend (goals done per day).
- "Goals are suggestions with points. Skip any of them; nothing is locked."
- As every UI story: design checks, 1440 px, Playwright (the phone in WEB-61).

### WEB-60 The Doomsday page: Ladder, PvP and Feats
Boards `doomsday-ladder` and `doomsday-feats`. Same fixture-first start as WEB-59.
- **Ladder:**
  - This week and All time, PvE and PvP side by side, each with its own ranking
  - rows expand to characters; movement (▲, ▼, new)
  - PvP Virgin shown and not ranked ("not ranked: no kills on any character, ever")
  - the time to the weekly reset
- **PvP:** the details for a selected friend:
  - kills this week (solo, skulls), rank with insignia and "a.k.a." title per character, kills by zone
  - the duel grid with wins–losses and the Elo rating (with movement)
  - the battleground block, apart from the week's kills, and first wins unlocked
  - "≈" where data was guessed
- **Feats:** per friend and the whole group's feats, newest first, with "First in the group", the rank titles table and the feat states from the board.
- As every UI story (1440 px; the phone in WEB-61).

### WEB-61 Doomsday on the phone, its states, and the roster
Boards `doomsday-phone` and `roster-cards-doomsday`.
- The Doomsday page at 375 px as the board shows.
- The states:
  - empty, on the first day ("Nobody has done anything yet")
  - loading
  - only one friend with data
  - friends without the addon or without Doomsday data
  - error
- The **roster** cards get each friend's PvE and PvP points this week and the streak as chips, as `roster-cards-doomsday` shows (a copy of `roster-cards-runs` with only those chips added).
- As every UI story (375 and 1440 px, Playwright, screenshots in the PR).

### WEB-62 Launch cut-off: start fresh from launch
Decided with Nico (2026-10-28). At launch (2026-11-04) every beta character is gone from the game. The beta and Forever are different clients, so every friend's SavedVariables start empty, and the addon needs no change. The site must forget the beta **without deleting anything**: uploads stay the single source of truth (Nico rejected a delete-style reset earlier for that reason). After the web engine's WEB-58; ready before launch, so Nico can press it on launch day.
- **The setting:** a **Danger zone** box at the bottom of the admin page, "Start fresh from launch".
  - It shows the cut-off moment, plus what's kept and what's hidden.
  - Typing `LAUNCH` confirms it; Undo removes the cut-off.
  - It's stored in one settings row (the moment in UTC, who set it, when).
- **Rebuild from the cut-off:** the rebuild ignores uploads received before the cut-off. Characters, people, members, locations, sightings, presence, the activity feed, Doomsday goals and points are derived only from uploads after it. Raw uploads are never deleted or changed.
- **No beta characters sneaking back:** a character whose `lastPlayed` (and `updatedAt`) is before the cut-off is ignored, even when a newer upload carries it. Belt and braces: the launch client's files are empty anyway.
- **Kept untouched:** accounts and sign-in access, guests and blocks, Discord links, time zones, bot settings and token, uploader devices and tokens, last-seen times.
  - Members are derived from uploads, so anyone allowed to sign in before the cut-off stays allowed until their first launch upload.
- **Hidden, not deleted** (shown nowhere, kept in the database):
  - planned runs and their answers
  - asks and game items
  - recaps
  - feats and Doomsday history from before the cut-off
- **Restarted:**
  - **Recap:** numbering restarts, so the first recap after the cut-off is week 1 (`recap_start` moves to the cut-off).
  - **Feats:** "First in the group" counts from the cut-off.
- **No posts about the reset.** The rebuild makes no feat events, as with the site's first upload today. Nothing is posted about the reset itself, and old beta posts stay in Discord.
- **Undo:** removing the cut-off and rebuilding brings everything back as it was.
- **Tests:**
  - a fixture with beta uploads before and launch uploads after the cut-off
  - a beta character carried in a launch-era upload is ignored
  - runs, recaps and feats are hidden and come back on Undo
  - kept tables are untouched
  - no events are made
- **Manual (in the PR):** on a copy of the live database, set the cut-off, check the roster is empty but sign-in, Discord links and settings work, then Undo.
- The mistaken account from earlier needs no script: the cut-off clears its beta data too, and the block list handles it after launch.

### WEB-64 Co-admins
Agreed with Nico (2026-10-29). The owner can make other friends admins, so others can help run the group, without anyone but the owner being able to break things. Board: from `docs/DESIGN-PROMPT-ADMINS.md` (not designed yet; build after the boards are in).

- **Two levels:**
  - **Owner:** the BattleTag in `ADMIN_BATTLETAG` (server setting), as now. Never demoted or removed through the site. No screen, action or API offers it, and the server refuses it.
  - **Admin:** friends the owner appoints.
- **Appointing:** only the owner appoints and removes admins; an admin can't make another admin.
  - **Where:** on the admin page, an **Admins** box lists the friends who have signed in, each with **Make admin** or **Remove admin** and a confirm dialog.
  - **The owner's row:** a crown and no button.
  - **Storage:** admins live in their own table (not derived, so a rebuild or the launch cut-off never touches them).
  - **Removing an admin** takes effect at their next request.
- **What an admin may do:** everything for the everyday running of the group:
  - the guest list (add, tick "may upload")
  - blocking and unblocking a BattleTag, except the owner's and other admins'
  - the Discord page's post settings (switches, channels, recap time, the Doomsday reset time and realm time zone)
  - deleting any run, marking runs done
  - test posts and previews
- **Owner only:**
  - **Start fresh from launch** (WEB-62), including Undo
  - the **bot token** (create, replace, revoke)
  - **appointing and removing admins**
  - **revoking other friends' uploader devices or tokens**
  - any server setting
  
  For admins these controls are hidden, and the server refuses the action too (403, not only a hidden button). Today's `mayAdmin` splits into "may admin" and "is owner", and every owner-only action and API route checks the latter.
- **Admin changes log:** a short list on the admin page: who changed what and when (admins appointed or removed, blocks, guest changes, Discord settings, run deletions, the cut-off, the token). Owner and admins see it; it's the one place BattleTags show, as on the admin page now.
- **The bot:** `isAdmin` in the bot API look-ups (cancel and move any run) is true for owner and admins.
- **Tests:**
  - every owner-only action refused for an admin (UI and server)
  - the owner can't be removed or blocked, by anyone
  - an admin can't appoint
  - removing an admin takes effect at once
  - the log entries
  - the cut-off and the token are refused for admins
- As every UI story: design checks, 375 and 1440 px, Playwright, screenshots in the PR.
