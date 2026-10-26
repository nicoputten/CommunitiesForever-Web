# Doombringers — design (wow.vestras.nl)

Decisions from the design workshop (WEB-02). The canvas "Doombringers — wow.vestras.nl design" holds every screen (exports in `design/boards/`, index in `design/README.md`); this file is the source of truth for implementation.

## 1. Direction

**A · Night over Azeroth.** Dark night-blue map, gold trim, Vanilla-inspired type, modern atmosphere (fog, light shafts, animated sea, embers, glow on live markers).

- Atmosphere goes **around** the data, never over it.
- The **map** is alive (ambient motion). **Data screens** (roster, professions, character, upload) are calm: same palette, no ambient motion except small accents.
- Name: **Doombringers**. Emblem: shield with cross (placeholder, original).
- Footer credit: *Private fan site · not affiliated with Blizzard Entertainment · Zone outlines: Syrio, Wikimedia Commons (CC BY-SA 4.0), adapted*. Licence checked: both source SVGs are CC BY-SA 4.0 by Syrio (`tools/map/README.md`).

## 2. Screens (canvas boards)

| Board | Content |
|---|---|
| Main | World map, desktop: top bar, continent switch, markers, clusters, hover card, roll call panel with filters |
| PhoneMap / PhoneCharacter / PhoneRoll | Phone map with roll-call peek → tapped character (half sheet, zoomed map) → full roll call sheet |
| MapStates | Marker freshness, clusters, zone states, zoom levels, motion table |
| Roster / RosterTable | Cards grouped by friend (level spread + quick answers) and compact sortable table |
| Professions | Recipe search (future), covered/thin/gap summary, cards per profession, character × profession matrix |
| Character | Ves Doombringer detail: level, talents, professions, quest log, last-seen mini map, other characters |
| Upload / UploadResult / UploadStates | Dropzone + history, "Session report", drag/reading/wrong file/newer format/nothing new |
| SignIn / SignInStates | Battle.net sign-in over drifting map; not on the list, Battle.net error, signing in |
| EmptyMap / Loading | Before first upload; skeletons; stale-site banner; old friend data |
| DesignSystem | Tokens and components (this document, visual) |

B (Parchment) and C (Carved) remain on the canvas as rejected directions.

## 3. Tokens

```css
:root {
  /* surfaces */
  --bg-abyss: #050A12;        /* map pages */
  --bg-night: #070C15;        /* data pages */
  --surface: rgba(12,18,30,.78);   /* + backdrop-filter: blur(14px) */
  --surface-strong: rgba(12,18,30,.84);
  --surface-raised: #121B2A;
  --track: #1F2837;
  --line: rgba(212,175,106,.20);
  --line-strong: rgba(212,175,106,.35);

  /* sea & land */
  --sea-light: #10233A; --sea: #0A172A; --sea-deep: #040811;
  --land-top: #26354D; --land-bottom: #151E2E;
  --terrain: #0C121B;                   /* Uldum, Gilneas, Grim Batol */
  --zone-line: rgba(201,164,92,.36);
  --coast: #A9C8EA;  /* @55% */
  --surf: #5E93C9; --wave: #7FA9D6; --foam: #CFE3F7;

  /* gold */
  --gold: #D4AF6A; --gold-bright: #F0D08E; --gold-pale: #F3DFAE;

  /* text */
  --text-strong: #F3EBDA; --text: #E6E1D6;
  --text-muted: #AEB6C3; --text-dim: #8E98A8; --text-faint: #7E8898;
  --on-gold: #0B0F14;

  /* status */
  --fresh: #7FD99A;  --fresh-text: #9BE3B0;
  --stale: #E08A4A;  --stale-text: #F0A774;
  --horde: #B5302A;  --horde-text: #F08A80;
  --alliance: #3A6BD6; --alliance-text: #8DB0FF;
  --bnet-top: #1A8CFF; --bnet-bottom: #0B66D6;
  --ember: #F2B866;

  /* class: fill / text on dark */
  --warrior: #C69B6D; --paladin: #F48CBA; --hunter: #AAD372; --rogue: #FFF468;
  --priest: #FFFFFF;  --shaman: #0070DD; --shaman-text: #4DA3FF;
  --mage: #3FC7EB;    --warlock: #8788EE; --warlock-text: #A9AAF5;
  --druid: #FF7C0A;   --druid-text: #FF9A45;

  /* type */
  --font-display: "Marcellus SC", serif;   /* titles, nav brand, map labels */
  --font-name: "Marcellus", serif;         /* character names, big numbers */
  --font-ui: "Inter", system-ui, sans-serif; /* all data, tabular-nums */

  /* space, radius */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-12: 48px;
  --r-tag: 6px; --r-btn: 10px; --r-panel: 14px; --r-sheet: 18px; --r-modal: 20px; --r-pill: 999px;

  /* elevation */
  --shadow-card: 0 18px 40px rgba(0,0,0,.5);
  --shadow-modal: 0 30px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(240,208,142,.15);
  --shadow-sheet: 0 -12px 30px rgba(0,0,0,.45);

  /* motion */
  --dur-instant: 80ms; --dur-fast: 120ms; --dur-card: 160ms; --dur-fan: 220ms;
  --dur-zone: 250ms; --dur-sheet: 280ms; --dur-drop: 400ms; --dur-fly: 600ms;
  --ease-out: cubic-bezier(.2,.8,.2,1);
  --ease-spring: cubic-bezier(.34,1.56,.64,1);
}
```

Initials on a class fill use `--on-gold` (#0B0F14), except Shaman (white). Use the `-text` variants for names on dark.

### Type scale

| Token | Size | Font | Use |
|---|---|---|---|
| display-xl | 48 | Marcellus SC, +.06em | Session report, sign-in |
| display | 34 | Marcellus SC | Page titles |
| title | 20–22 | Marcellus SC | Panels, brand |
| section | 16 | Marcellus SC, +.08em | Card headers |
| name | 15–21 | Marcellus | Character names |
| map-label | 9–11 | Marcellus SC, 3px dark halo | Zone labels (terrain: Marcellus italic, dim) |
| body | 13–14 | Inter 400/500 | Data |
| meta | 11–12 | Inter, muted | Secondary lines |
| overline | 11 | Inter 500, caps, +.12em | Group headings |

Layout: page max-width 1280, gutter 24 (16 on phone), touch targets ≥ 44px, desktop canvas 1440, phone 375–390.

### Derived from the boards (WEB-15)

`src/styles/tokens.css` has the tokens above as written (part 1) and, in part 2, values the boards use that this section has no token for, each with the board it comes from (decided with Nico, 2026-10-26). They change nothing visually; they give the WEB-30 token lint a name for every value. Groups:
- **Type scale:** `--fs-*` sizes (the sizes inside a range above are the ones the boards use), `--fw-*`, `--lh-*`, `--ls-*` letter spacing.
- **Tints and lines:** `--tint-active` (current nav link, gold 14%), `--tint-pressed` (16%), `--tint-selected` (20%), `--tint-hover`, `--line-bar`, `--line-control`, `--line-neutral` (chip, neutral badge), `--text-chip`, fresh/stale badge lines, banner tint, faction tag tints.
- **Surfaces:** `--control-bg`, `--surface-modal`, `--surface-panel`, `--surface-aside`, row surface, top-bar fades (map and phone), `--avatar` (#2A3446), `--avatar-muted`, skeleton shimmer, `--on-shaman`.
- **Space and radius:** extra steps `--s-px`, `--s-0-5`, `--s-0-75`, `--s-1-5`, `--s-2-5`, `--s-3-5`, `--s-7`, `--s-10`; radii `--r-badge` 4, `--r-nav` 8, `--r-control` 9, `--r-card` 12.
- **Glow, blur, sizes, motion:** disc/avatar glow, `--glow-disc-mix` (live disc glow at 45% of the class colour, WEB-30), `--blur-surface` 14 / `--blur-modal` 16, `--shadow-current` (nav underline), component sizes (`--size-*`: bars, avatar, disc, touch 44, page max 1280, gutters), focus ring, `--dur-shimmer`, `--dur-pulse`.
- **Atmosphere (WEB-16):** ambient loop durations (`--dur-wave-a` … `--dur-drift`), fog, light-shaft and vignette tints, glint and Maelstrom colours, sign-in sea edge and land, fog blurs, ember size and glow, `--size-map-w/h` (world 1440 × 900), `--page-glow-bg` (data pages).
- **Roster (WEB-21):** friend name `--fs-friend` 19, friend avatar, search field, character row columns (`--size-row-*`), level bar, track dots, label and band rows, `--line-quick`, `--line-hover`, `--stale-note`, `--opacity-old`, `--s-4-5` 18, `--s-5-5` 22, `--track-line`.
- **Roster table (WEB-22):** header surface and line, `--tint-row` (hover and the viewer's own rows), profession pill (`--surface-pill`, `--r-pill-sm`, `--s-1-75`), `--ls-th`, `--size-disc-xs` 26, table level bar, `--sheet-backdrop` (phone filter sheet, no board).
- **Upload (WEB-19):** dropzone and state frames (`--size-dropzone`, drop line and glow, dragging glow, `--state-fill`, `--alert-line` / `--alert-tint`), their icon sizes, `--fs-drop` 24 / `--fs-state` 20, the accent loops (`--dur-breathe` 5 s, `--dur-over` 2.4 s, `--dur-bob` 1.6 s, `--dur-spin` 1.4 s), outline button lines, the `/reload` hint box, history Done / Rejected tints, `--s-4-5` 18.

A value a screen needs and no token has goes into part 2 with its source, never inline.

## 4. Data age (one scale everywhere)

| State | Age | Marker | Elsewhere |
|---|---|---|---|
| New (`live`) | < 32 h | class fill, glow, pulse | bright dot with glow, green badge |
| Recent | 32 h–3 d | class fill, no glow | solid dot |
| Days | 3–6 d | dark fill, class ring, 70%, age tag | ring dot |
| Week+ | ≥ 7 d | dashed ring, 50%, amber age tag | amber "Data N days old" badge |
| Unknown | no location | not on map | "Unknown whereabouts" tray |

- "Seen" always means *seen by the addon*. Show "via X" when data was relayed.
- Site-wide banner when the last upload is **7 days** old or more (decided; same as a friend's amber badge).

## 5. Map

- Source: `src/core/map/zones.json` (derived from the Wikimedia Commons SVGs, trimmed to Vanilla, rebuilt with `tools/map/build_zones.py`): 46 shapes (43 zones + 3 terrain) with `id, name, cont (K|E), kind (zone|terrain), d (SVG path, evenodd), lx/ly (label + marker anchor), lines, size`; `coast.K/E`; `cities` (capitals `cap: 1`, towns `cap: 0`); `dungeons`. World coordinates = 1440 × 900.
- Merged for Vanilla: Northern + Southern Barrens → The Barrens; Northern Stranglethorn + Cape → Stranglethorn Vale; Ahn'Qiraj → Silithus. Terrain (no hover): Uldum, Gilneas, Grim Batol. Removed: Quel'Thalas, Kul Tiras, Tol Barad, Azuremyst/Bloodmyst. Alterac shares the Hillsbrad shape.
- WoW: Forever (WEB-31): Thousand Needles is dry (the source's Cataclysm lake filled in); Mount Hyjal is a zone; The Riverglades (new land on the Eastern Kingdoms' east coast), Shen'dralas (carved from northern Feralas) and Zephras Isle (an inset island between the continents, south of the Maelstrom, as Skywall is not on Azeroth) are hand-drawn zones (`EXTRA_ZONES` in `tools/map/build_zones.py`), styled like every other zone.
- Layers (bottom → top): sea gradient · moonlight glint · wave strokes (2 groups) · Maelstrom · surf (blurred coast stroke) · foam (dashed coast) · zone fills · grain · occupied tint + borders · coast line · capitals · labels · markers (HTML overlay) · cards.
- Zone states: idle (gold line 36%) · occupied (gold tint 3–20% by recency) · hover (bright gold stroke 1.6, name in corner) · terrain (dark, no hover).
- Zoom: **World 1×** markers + clusters per zone, capitals only · **Continent 2×** towns, clusters ≤ 5 fan out · **Zone 4×** dungeons, name tags on all markers.
- Clusters: 2–5 fan out (spring, 30 ms stagger), ≥ 6 open a list. Dungeon sightings show at the dungeon's zone with a badge.
- Phone: full-screen map, bottom sheet (peek → half → full), edge hint "4 in Kalimdor", tap marker → zoom + half sheet.

## 6. Motion

| Element | Trigger | Duration | Easing | Reduced motion |
|---|---|---|---|---|
| Marker | hover/focus | 120 ms, scale 1.15 | ease-out | outline only |
| Cluster fan | hover/tap | 220 ms, 30 ms stagger | spring | instant |
| Hover card | marker | 160 ms, fade + rise 8px | ease-out | fade 80 ms |
| Zone highlight | hover | 250 ms | ease | colour only |
| Bottom sheet | drag/tap | 280 ms, follows finger | ease-out | 120 ms fade |
| Fly to character | roll call pick | 600 ms pan + zoom | ease-in-out | jump |
| New sighting | after upload | 400 ms drop + 1 ripple | spring | appear |
| Session report | page load | staggered rise 0.55 s, bars grow 1.1 s, LEVEL UP shine | ease-out/spring | static |
| Upload accents (WEB-19) | idle dropzone; dragging; reading | glow breathes and ledger floats 5 s; dragging glow 2.4 s, ledger bobs 1.6 s; spinner 1.4 s, bar 2.4 s | ease-in-out / linear | static |
| Ambient | always (map, sign-in) | pulse 2.6 s · waves 7/9 s · surf 6 s · foam 40 s · Maelstrom 50 s · moonlight 18 s · fog 40–56 s | loops | all off, static fog |

Ambient details (WEB-16, Nico 2026-10-26):
- **Motion setting:** the user menu's "Motion" switch follows the system's `prefers-reduced-motion` until the user flips it; the choice is stored per browser (`localStorage`) and applied before first paint as `<html data-motion="on|off">`. Off works as reduced motion everywhere; an explicit On animates even when the system asks for reduced motion.
- **Where:** desktop map: fog (3 banks) and two light shafts over the sea (no embers); phone map: one fog bank; sign-in: the drifting map, fog and embers, phone too; data pages: the static top glow only.
- **Loops from the boards** that the table does not list: light shafts 14 s, embers 16 s (gone without motion), sign-in fog 46 s, sign-in map drift 60 s.
- Loops pause while the tab is hidden; they animate only transform and opacity (the foam's dash offset moves in steps).

## 7. Components

| Component | Notes |
|---|---|
| `TopBar`, `TabBar` | Desktop top bar (brand, Map/Roster/Professions, continent switch on map, data age, upload for admin, user). Phone tab bar. |
| `WorldMap` | SVG from `zones.json` + HTML overlay; pan/zoom wrapper |
| `MapZone` | idle / occupied / hover / terrain |
| `CharacterMarker` | class, initials, age state, selected; 44px hit area |
| `ZoneCluster` | count, split class ring, dungeon badge, fan or list |
| `CharacterCard` | desktop hover card; phone half sheet |
| `RollCallPanel`, `RollCallRow` | grouped by age, filters on top, unknown tray, no-addon line |
| `FilterChip`, `Segmented` | `aria-pressed` |
| `BottomSheet` | peek / half / full |
| `FriendPanel`, `CharacterRow`, `DataAgeBadge`, `FactionTag` | roster cards |
| `RosterTable` | sortable, `aria-sort`; becomes cards on phone |
| `LevelSpread` | 1–60 track with dungeon bands |
| `ProfessionCard`, `SkillBar`, `StatusBadge` | 300 scale, cap shading, ticks 75/150/225 |
| `ProfessionMatrix` | characters × professions |
| `TalentBars`, `QuestLog`, `MiniMap` | character detail |
| `Dropzone`, `UploadHistory`, `SessionReport` | admin upload flow |
| `Banner`, `EmptyState`, `Skeleton` | global states |
| `Atmosphere` | fog, light shafts, embers, sea; reads reduced-motion + a user toggle |

## 8. Decisions and rules

- Covered / thin / gap professions: covered ≥ 225, thin 175–224, gap < 175 (to refine during implementation).
- WoW: Forever has no realms: show the **ruleset** (PvP or PvE) instead, through the rulesets table (WEB-13).
- Character names always contain a space; never split.
- Item level may be missing → "—".
- Talent points = level − 9; tree bars out of 31.
- Dungeon level bands on the roster are typical ranges, labelled as such. A band shows for every dungeon (not raids) where at least two characters fit; the one with the most fits gets the "fits ..." line (WEB-14, Nico 2026-10-25).
- Character dungeon fit: other friends' characters in the typical range (not the owner's alts), any data age; the dungeon with the most of them, ties to the narrower range (WEB-14, Nico 2026-10-25).
- Error copy: wrong file, newer data format, nothing new, not on the guest list, Battle.net unreachable (see UploadStates / SignInStates).
- Upload states without a board (WEB-19, Nico 2026-10-26) use the amber frame of "wrong file" with "Choose another file" or "Try again": not your file ("This is someone else's ledger · It belongs to Bob#2002. Sign in as Bob#2002 to upload it. Nothing was changed."), other community ("This ledger is for another community · … Pick <site name> in the addon, /reload and upload again."), no community yet ("The ledger isn't open yet"), damaged ("We couldn't read this ledger"), too large ("That file is too big", checked in the browser), no answer ("The upload didn't go through · Nothing was changed. Try again."). The screen never shows raw error text. "Wrong file" names the file when its name isn't `CommunitiesForever.lua`. "Newer addon version": "Update the site first" for the admin, "Ask the admin to update the site" for others; its button opens the addon's GitHub releases. "Nothing new" also covers a new file that changes nothing (time of the uploader's previous upload).
- Upload history (WEB-19, Nico 2026-10-26): everyone's uploads, last 20, newest first, the uploader's display name under the time. Summary: the site's first accepted upload "First upload · N characters"; then up to three of "N levels gained · N skill gains · N new characters · N sightings · N item level gains" in that order, zeros left out; "Nothing new" otherwise. Rejected: a short reason ("Wrong file: another addon's data", "Damaged file", "Newer addon: format N", "Not your file", "Another community", "Before the admin's first upload"). The board's "Mira reached 60" highlight is dropped.
- Clock times ("Today 21:14", "Yesterday 22:05", "Thu 23 Oct, 23:40") are the viewer's local time, formatted in the browser, 24-hour (WEB-19, Nico 2026-10-26).
- While a file is read, the browser reads it with the same core parser for "N characters from M friends" (characters with a record and their owners); the server decides (WEB-19).

## 9. Suggested libraries (proposal — you decide)

- **Map:** inline SVG rendered on the server from `zones.json` (no tiles, no WebGL). Pan/zoom/pinch: `react-zoom-pan-pinch`, or a small pointer-events hook.
- **Popovers:** `@floating-ui/react` for marker cards and filter menus.
- **Bottom sheet:** `vaul`.
- **Styling:** CSS custom properties above + CSS Modules (no runtime CSS-in-JS).
- **Motion:** CSS keyframes/transitions for everything above; add `motion` only if the sheet drag or cluster fan need physics.
- **Fonts:** `next/font/google` for Marcellus, Marcellus SC, Inter (self-hosted, no layout shift).
- First load: map SVG is about 90 KB of path data; inline it once on the map page and cache `zones.json`.

## 10. Open items

- Final emblem/logo for Doombringers.
- ~~Exact addon data-format versioning.~~ The "data format" in the upload copy is the addon's `schemaVersion` (WEB-19).
- ~~Stale thresholds to confirm.~~ Decided: 7 days for both the site banner and a friend's data (§11).
- Recipe search UI once the addon shares recipes.
- ~~Confirm the licence and attribution text of the source map SVGs.~~ Done: CC BY-SA 4.0, Syrio.

## 11. Deviations

Approved departures from this design (CLAUDE.md rule 12). Only Nico approves one; add it here in the PR that builds it.

| Date | What | Why | Approved |
|---|---|---|---|
| 2026-10-25 | Stale-site banner after 7 days (the `loading` board says 3) | One threshold for site and friend data | Nico |
| 2026-10-25 | Map (WEB-31): Thousand Needles dry; Mount Hyjal a zone, not terrain; three new zones (The Riverglades, Shen'dralas carved from Feralas, Zephras Isle as an inset island) in the normal zone style. The boards still show the Cataclysm lake and no new zones | The map shows WoW: Forever, not Cataclysm; nothing else about the map changes | Nico |
| 2026-10-25 | Full character names wherever the boards show a first word ("with Lia, Tok and Bob", "Tok ★", "Ves item level 31 → 34") | Names are never split (CLAUDE.md rule 3) | Nico |
| 2026-10-26 | Top bar Upload is an icon plus "Upload" on every page (the map board has a 36 px icon-only button; the upload board has the labelled link) | Clearer, one control everywhere, 44 px target without tricks | Nico |
| 2026-10-26 | Phone app bar (no board): data age as a short meta line before the avatar ("Updated 2 h ago", as on the phone map); Upload moves into the user menu | No board shows them on phone | Nico |
| 2026-10-26 | Class disc initials: first letter of the first and last word of the name ("VD"), display only, never a key | The boards show initials; the one exception to "never split names" | Nico |
| 2026-10-26 | Footer credit in `--text-faint` (#7E8898), not the sign-in board's #6E7888 | #6E7888 is under 4.5 : 1 on the page; every text pairing must pass (design-system board) | Nico |
| 2026-10-26 | Stale-site banner without the loading board's second line ("Nico uploads after a play session.") | Members upload too, so the line is no longer true | Nico |
| 2026-10-26 | Surf (WEB-16): a static 9-wide stroke under a 15-wide one that fades in and out, instead of the board's stroke-width 9 → 15 swell | Ambient loops animate only transform and opacity; it looks nearly the same | Nico |
| 2026-10-26 | Foam (WEB-16): the dash offset moves in 220 steps per 40 s loop, not continuously | A dash march has no transform equivalent; steps repaint about 5× a second instead of every frame | Nico |
| 2026-10-26 | Motion switch in the user menu (WEB-16, no board): a two-wave line icon, "Motion" and an On/Off meta text, gold when on | No board draws the item | Nico |
| 2026-10-26 | Without motion every ambient layer rests on its first keyframe (fog and shafts still, embers gone) | The boards only show the moving state; their still state drops the animation | Nico |
| 2026-10-26 | Upload history footnote "Everyone in the community can upload their own file. Friends see the result on the map and roster." (the board says "Only you can upload.") | Members upload too | Nico |
| 2026-10-26 | Upload: the dropzone's breathing glow and floating ledger, the dragging glow and the reading spinner stay as on the boards on this data page, as its small accents (§1); off with reduced motion or the Motion switch | They show the page is ready, dragging and busy | Nico |
| 2026-10-26 | Upload "Dragging over" (WEB-19) shows only "Let go to upload", without the board's second line ("CommunitiesForever.lua · 48 KB") | Browsers don't expose a dragged file's name or size until it is dropped | Nico |
| 2026-10-25 | The roll call also lists sighted characters of friends without the addon (no name, class or level: the owner and the zone), counted in "N of M located" | The real beta file has them; a sighting is never dropped | Nico |
| 2026-10-26 | Roster level spread (WEB-21): every dungeon band with two fits, stacked in as many rows as needed (best band first, gold; the others in one neutral style instead of the board's arbitrary tints); full names on the track in as many label rows as needed. Phone (no board): dots only, names in level order under the track, bands as a list | The real data gives up to 14 overlapping bands; names are never split | Nico |
| 2026-10-26 | Roster no-addon box (WEB-21): "Once Sanne installs CommunitiesForever, their characters show up after the next upload." (the board says "she") | We never infer pronouns | Nico |
| 2026-10-26 | Roster (WEB-21, no board): filter menus, "N of M characters · Clear filters", "1 of 3 characters", "No characters match", the empty and error states, the old-data note without a relay, phone rows (professions and "when · where · ilvl" on full-width lines) | Not on the board | Nico |
| 2026-10-26 | Roster rows of old friend data (WEB-21): only the disc and level bar fade to 80%, not the whole row | At 80% the row's dim text drops under 4.5 : 1; every text pairing must pass | Nico |
| 2026-10-26 | Data age scale for daily uploads: new < 32 h, recent 32 h–3 d, days 3–6 d (boards: live < 6 h, today 6–24 h, days 1–6 d); the roll call's "Last 24 hours" group and chip become "New" | Nico uploads about once a day, so the last session should stay new | Nico |
| 2026-10-26 | Session report (WEB-20): the hero's rays, halo and embers and the LEVEL UP / CAP REACHED shine stay as on the board, as this data page's accent; they pause with the tab and stop without motion. The shine is a bright band that moves across the badge, and the bars grow with a transform, instead of the board's moving background and growing width | Only transform and opacity animate; it looks the same | Nico |
| 2026-10-26 | Session report "Who sent data" dots follow the data age scale (§4) at upload time, not the board's dots (Mira's filled gold dot at 2 days) | One data age scale everywhere | Nico |
| 2026-10-26 | Session report (WEB-20, no board): zero counters in `--text-dim`, empty sections hidden; lists show 6 rows, then "Show N more"; "First upload by Nico · N characters from M friends"; "New faces" for several; "No longer on the roster: …" (or a "Left the roster" section); "Sanne's character" for a character without a record; "Show fewer" once a list is open; a stored "not your file" rejection says "It belongs to another BattleTag. Nothing was changed." (the file's owner isn't kept); "Roster →" opens the character; "Replay" hidden without motion; a rejected or nothing-new upload shows its upload screen state; phone: title at display size, counters 2 × 2, one column (Level ups, Skill gains, New faces, Gear, Who sent data, New sightings), stacked buttons | Not on the board | Nico |
| 2026-10-26 | Roster table (WEB-22, no board): on phone the card list and a "Filters & sort" bottom sheet (native dialog, no drag); "Location unknown" in `--text-faint` (the board shows "Unknown" in the druid colour); Professions is sortable (the board's header is plain text); the board's "Stonetalon Mts" is the full zone text | Not on the board; the story asks for the sheet and for sorting the same way as the cards | Nico |
| 2026-10-26 | Roster table (WEB-22): the professions and last-seen cells wrap (pills on two lines, "Stonetalon Mountains" over two lines) instead of the board's one line per row | From 1200 px there is no scroll frame so the headers stick to the window; the board's own rows don't fit 1280 either | Nico |
