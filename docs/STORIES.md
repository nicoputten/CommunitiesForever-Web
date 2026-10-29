# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order (2026-10-29): E9, the live test of 29 Oct: WEB-65 (site fixes) and WEB-66 (rules and bot images) side by side, with the bot's BOT-20 on WEB-66's contract (WEB-66: Nico's brief parts 2 and 5; no designer notes or legends in any image or text). Doomsday (E8, `docs/STORIES-COMPLETED.md`) is done and waits for the release.

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
- Uploader "What's new" page (`/uploader/changes`, one section per kept version from the feed's release notes, an anchor per version), then `notesUrl` in `GET updates/status` points to it (UP-10 proposal; left out of WEB-35b).
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
- Dungeon catalogue: every dungeon with who cleared it, the group's first clear as a feat (Nico, 2026-10-28: brainstorm after E8 Doomsday, then designs).
- The class per name in recap cards (award winners, the cards' characters), so the bot can put its class icon before them (bot BOT-11 left the recap without icons for lack of it).

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

### WEB-66 Live-test data rules and bot images
Agreed with Nico (2026-10-29). Boards: `bot-visual-recap`, `bot-visual-daily`, `bot-visual-feats`. The contract is in `docs/BOT-API.md` ("Visual posts (WEB-66)"), written first so the bot (BOT-20) builds against it. Where the addon's `docs/DOOMSDAY.md` changes (the PvP Virgin rule, the day label, the goal count, the short labels), a small addon docs PR goes with it.

**Rules (brief part 2, bugs 1, 2, 4 and 5), each with a unit test:**
- **PvP Virgin:** a friend stays a PvP Virgin only with 0 all-time PvP points across all characters, duel points included, **and** no honorable kill ever (Nico: "no points and no kill"). Any PvP point or any kill ends it, everywhere: the roster, the Doomsday board, the ladder, the bot (`pvpVirgin`, `pvp: null`).
- **Rank title:** a character without a rank shows "Conscientious Objector" only while its friend is a PvP Virgin (the rule above). Otherwise "No rank yet · N kills" (N: the character's honorable kills).
- **Goal count:** "N of M done" counts exactly the goals on the grid: the 3 PvE dailies, the Hunt and/or the Skirmish (6 on a day with both), and the Duel slot, done after its first duel. The same count goes to the bot (`doneCount`, new `goalCount`).
- **The day label follows the reset:** a Doomsday day runs from reset to reset and is named after its start, the weekday plus the part of the day of the reset hour: 05–11 "morning", 12–16 "afternoon", 17–22 "evening", 23–04 "night" (Nico). With the default reset that is "Wed evening", with the span "Wed 19:00 → Thu 19:00". Times after midnight carry their weekday ("done Thu 00:04"), and the countdown reads "resets Thu 19:00 · in 6 h 51 m". These are stored as UTC and shown in each player's own time: the site in the viewer's time zone (as WEB-59), the addon on the PC clock (Nico, 2026-10-29: "save UTC but display local time"). Only the bot, one message for everyone, uses realm time. One core helper in `src/core/doomsday/rules.ts` makes the name and the span for the site and the bot alike.

**Images (brief part 5), drawn by the existing card renderer (`src/server/cards`, Satori), same fonts, night background, gold frame, footer "wow.vestras.nl":**
- **Daily board, 800 × 560** (`BV2Daily`):
  - header: the emblem, "DOOMSDAY", then "Wed evening · <state>" (just started, the time of the last change, or final)
  - one column per daily goal with its `shortLabel` under PvE or PvP
  - one row per friend with Doomsday data: the name (30 px, struck through when all PvE dailies are done, the crown after the first to finish), 44 px boxes (PvE done green with a check, PvP done red, open as a dark outline), "PvP Virgin" across the PvP columns while the rule above holds, "Today" as PvE · PvP points, the streak with a flame
  - footer: "resets Thu 19:00" at the start, "resets in 5 h 50 m" during the day, "Mira first at 23:13 · 14 goals done" when final
  - Friends without Doomsday data are left out of the image.
- **`shortLabel`** on every goal of the catalogue, the addon's own (`Doomsday.SHORT_LABELS`, addon PR #123, `DOOMSDAY.md` "Short labels (CF-61)"; at most 10 characters, the Hunt "Hunt"), in `src/core/doomsday/rules.ts`. A test checks the length and that every goal has one.
- **The board picture's id changes only when the picture does** (`doomsday-<day>-<hash>`), so the bot re-attaches it only then, at most every 5 minutes.
- **The board's news line**, one sentence, made by the site:
  - at the reset: the goals in full and "5 points each"
  - during the day: who finished first and who is 1 away ("Mira finished all dailies first (23:13). Ada and Tok are 1 away.")
  - final: "Day over: 14 goals done. Mira first at 23:13, longest streak Tok with 7. New board at 19:00."
  - "2 friends without addon data" when there are any
- **For the screens (WEB-65), agreed with its worker:** `PvpDetails.characters[].hk` (lifetime honorable kills), weekly `progress` for every weekly the engine can tell (with `detail`, e.g. the dungeon's name), `FeatRecord.character.level`, and a core `gridCount` for "N of M done", used by the site and the bot alike.
- **Feat cards** (`BV3Feats`): every feat gets a card.
  - Big, 800 × 400 (the existing feat card): PvP rank 6 and up, level 60, epic items, mounts, the watch list's items, 1,000+ honorable kills, and any feat that is "First in the group".
  - Strip, 800 × 240 (new): every other feat. The recap icon at 140 px on the left, "FEAT UNLOCKED", the title (Marcellus SC 46 px), the character in class colour and one line, the "First in the group" badge top right when it applies.
  - Several feats in one upload: one card, the most special one. Big beats strip, then "First in the group", then the rarer kind.
  - Every feat gets a `headline` ("Stone Guard") and a `line` (one finished sentence) for the bot.
  - New characters are never a feat or a card: the bot makes one line per upload, "+3 new characters: Grosh Bonechewer 60, …", from the character's level.
- **Recap images** (`BV1Recap`):
  - the award header, 1200 × 400, with the winner's class disc
  - the zone crop, 800 × 450, with "Map: Syrio, CC BY-SA 4.0", for Zone of the week and Bloodbath zone
  - the recap's icon thumbnails and their colours are the bot's (the 128 px set lives in the bot repo); the strip feat card draws the same icon, so the site gets that set too (from Nico's `doombot-recap-icons`, in `src/server/cards/icons/`)
  - the award gets the winner's class (`classFile`) for its colour
  - the header's six numbers: honorable kills, battlegrounds, levels, friends played, dungeon runs, feats
  - "The full week ↗" goes to the Doomsday page's Week tab (Nico): the recap's `url`
- If an image can't be drawn, its id answers 404 and the bot posts without it.

**Tests:**
- unit: the PvP Virgin rule (only duel points ends it; a kill without points ends it), the rank title, the goal count (5, 6 with Hunt and Skirmish, the duel slot), the day label (each part of the day, a time after midnight, the countdown), `shortLabel` length, the news line, big or strip per feat kind and the "most special" pick
- server: each new card id renders a PNG of the right size; the bot API carries the new fields; a friend with only duel points is no Virgin in the board event
- No designer notes or legends in any image or text.

**Manual:** with BOT-20 deployed, a test recap, test board and test feat from the Discord page's buttons, into the test channel, look like the boards on Discord desktop and on a phone.
