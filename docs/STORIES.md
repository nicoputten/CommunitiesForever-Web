# Backlog

Open stories only, in build order. Done stories move to `docs/STORIES-COMPLETED.md`.
Each story: criteria are testable. "Manual" items are steps only Nico can do; they go in the PR.

Build order: WEB-06, WEB-15, WEB-30, WEB-16, WEB-07, then the screens WEB-17..29 in number order, WEB-12 last.
WEB-08..11 (the first rough view stories) were replaced by WEB-15..29 after the design workshop.

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

### WEB-17 Sign-in screens
- Boards: `sign-in`, `sign-in-states`.
- "Where is everyone in Azeroth tonight?", "Sign in with Battle.net" over the drifting map, "We only read your BattleTag, nothing else".
- States:
  - **not on the list**: "Stranger#1234 isn't on the Doombringers guest list. Send Nico your BattleTag and he can add you." Buttons: use another Battle.net account, sign out.
  - **Battle.net didn't answer**: try again
  - **signing in**: "Checking the guest list… Back from Battle.net as Femke#3307", then straight to the map

### WEB-18 Admin page: guest list
- Admin only. Members (from the data, with the upload that added them, block and unblock), guests (add by BattleTag, remove, "may upload"), who signed in last.
- Validation of BattleTag format; adding an existing member says so.

### WEB-19 Upload page and states
- Boards: `upload`, `upload-states`. Admin and members (WEB-06).
- Dropzone and "Choose file"; the whole page accepts a drop ("Let go to upload"); where to find the file (`WTF › Account › [ACCOUNT] › SavedVariables`, "/reload first").
- States:
  - **reading**: "Reading the ledger…", "10 characters from 5 friends"
  - **wrong file**: "That's not our ledger", naming the file if it is another addon's (e.g. `Questie.lua`); nothing changed
  - **newer addon version**: "This file is from a newer addon. It uses data format N; the site reads up to M"
  - **nothing new**: "Same data as your upload of today 21:14. Did the game save yet?"
  - **not your file**: the file belongs to another BattleTag ("This is Bob's ledger, sign in as Bob to upload it"); nothing changed
  - **other community**: the file's addon has another community selected ("This ledger is for another community"); nothing changed
- History: time, uploader, summary line ("5 levels gained · 4 skill gains · 1 new character"), Done / Rejected with reason; a line links to its session report.

### WEB-20 Session report
- Board: `upload-report`. Shown after an upload and from the history.
- Header "Session report, uploaded today at 21:14 by Nico · new data from 4 friends"; counters (levels gained, skill gains, new characters, new sightings).
- Sections:
  - level ups ("LEVEL UP ×2", 37 → 39)
  - new face ("Femke's new Orc Warlock · level 15 · Durotar")
  - who sent data
  - skill gains with "CAP REACHED"
  - gear (item level 31 → 34)
  - new sightings, with "See them drop in on the map" (WEB-26)
- Motion: staggered rise, bars grow, LEVEL UP shine (§6); static with reduced motion. "Replay" and "Upload another".

### WEB-21 Roster: cards
- Board: `roster-cards`.
- Header "6 friends · 10 characters · Sanne has no addon yet", Cards/Table switch, search, filters (class, role, level, profession), sort (last played).
- "Who is around which level": level spread with dungeon bands and fits.
- Quick answers: healers, tanks, level 30–40, level 60.
- Friend panels: avatar, name, BattleTag, character count, data age badge ("Data 2 days ago · via Bob").
- Character rows: class disc with level, name, race, class, main tree, role, faction tag, top professions, last played, last seen zone, item level ("ilvl —" when missing). A row opens the character.

### WEB-22 Roster: table
- Board: `roster-table`. Sortable (`aria-sort`) by character, player, level, race and class, role, talents, item level, last played, last seen; "Group by friend"; same filters as the cards.
- On a phone the table becomes the card list, and sort and filters move into a sheet.

### WEB-23 Character detail
- Board: `character`.
- Header: name, level, race, class, faction, ruleset (WEB-13), played by, last played, data age and source ("own addon" / "via X").
- Level block with "21 levels to 60" and dungeon fit; at a glance (item level, role, main tree, faction, ruleset); talents bars; professions with "Compare with the group"; quest log (titles only, "as the addon recorded them 2 h ago"); last-seen mini map ("Lia is here too", "On the map"); the owner's other characters.

### WEB-24 Professions
- Board: `professions`.
- Summary: covered / thin / gaps with the professions named.
- Cards per profession: best in the group, everyone's skill bars on the 300 scale with the cap shaded and ticks at 75/150/225, status badge; secondary professions marked.
- Character × profession matrix (brighter cell = higher skill); "No professions yet".
- Recipe search placeholder: "Recipe search arrives when the addon shares known recipes."

### WEB-25 World map
- Boards: `map`, `map-states`. The map page is the home page.
- Server-rendered SVG from `zones.json` with the layers of `docs/DESIGN.md` §5; HTML overlay for markers.
- Zone states: idle, occupied (gold tint by recency), hover (bright edge, name in the corner), terrain (no hover).
- Markers per freshness state (§4), hover/focus card (name, level, race, class, spec, zone, seen, player, item level, "Open character"), selected state.
- Clusters: count and class ring; 2–5 fan out (spring, 30 ms stagger), 6 or more open a list; dungeon badge.
- Continent switch (Azeroth, Kalimdor, Eastern Kingdoms) in the top bar.

### WEB-26 Map zoom, pan and motion
- Pan, zoom and pinch (`react-zoom-pan-pinch`); zoom levels per §5: world 1× (capitals), continent 2× (towns, fans by default), zone 4× (dungeons, name tags on all markers, zone name in the top bar, other zones dimmed).
- Fly to a character (600 ms pan + zoom; jump with reduced motion).
- New sightings after an upload: drop + one ripple (from the session report link).

### WEB-27 Roll call panel
- Board: `map`. Desktop panel next to the map: "Roll call · 9 of 10 located".
- Filters: everyone or one friend, last 24 h, faction, level range; legend (live, days, week+).
- Rows grouped by age with zone, owner, "via", age; picking one flies the map to the character.
- Unknown whereabouts tray and the no-addon line.

### WEB-28 Phone map
- Boards: `phone-map`, `phone-character`, `phone-roll-call`. Bottom sheet with `vaul`: peek → half → full.
- Peek: the first roll call rows; edge hint "4 in Kalimdor". Tapping a marker zooms in and opens the character half sheet (level, seen, player, item level, role, spec, talents, professions, "Open character", next character in the zone). The full sheet is the roll call with its filters.

### WEB-29 Empty site, loading and stale data
- Boards: `empty-site`, `loading`.
- Before the first upload: "The map is still empty", "Upload the first file" for admin and members; for guests: "Nico hasn't uploaded any data yet. Check back after the next session."; the guest list shown in the roll call.
- Loading: zones paint at once, markers fade in, a thin gold line only after 300 ms; skeletons that keep the layout still.
- Stale: the site-wide banner (last upload 7 days or more), a friend's amber badge after 7 days.

## E6 Later

### WEB-12 Automatic uploader
- A small program on an uploader's PC that watches the SavedVariables file and uploads it after the game writes it, with an upload-scoped API token (new API route). Language and packaging decided in the story.

### Backlog (unordered, not yet stories)
- Recipe search, once addon CF-38 ships ("who can craft Bolt of Silk Cloth?").
- Activity feed (level ups, profession gains, dungeon runs per day).
- Dungeons: who has which dungeon quests.
- Final emblem and logo for the site.
