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

## 4. Data age (one scale everywhere)

| State | Age | Marker | Elsewhere |
|---|---|---|---|
| Live | < 6 h | class fill, glow, pulse | bright dot with glow |
| Today | 6–24 h | class fill, no glow | solid dot |
| Days | 1–6 d | dark fill, class ring, 70%, age tag | ring dot |
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
| Ambient | always (map, sign-in) | pulse 2.6 s · waves 7/9 s · surf 6 s · foam 40 s · Maelstrom 50 s · moonlight 18 s · fog 40–56 s | loops | all off, static fog |

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
- Dungeon level bands on the roster are typical ranges, labelled as such.
- Error copy: wrong file, newer data format, nothing new, not on the guest list, Battle.net unreachable (see UploadStates / SignInStates).

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
- Exact addon data-format versioning (the "format 2 / 3" copy is a placeholder).
- ~~Stale thresholds to confirm.~~ Decided: 7 days for both the site banner and a friend's data (§11).
- Recipe search UI once the addon shares recipes.
- ~~Confirm the licence and attribution text of the source map SVGs.~~ Done: CC BY-SA 4.0, Syrio.

## 11. Deviations

Approved departures from this design (CLAUDE.md rule 12). Only Nico approves one; add it here in the PR that builds it.

| Date | What | Why | Approved |
|---|---|---|---|
| 2026-10-25 | Stale-site banner after 7 days (the `loading` board says 3) | One threshold for site and friend data | Nico |
| 2026-10-25 | Map (WEB-31): Thousand Needles dry; Mount Hyjal a zone, not terrain; three new zones (The Riverglades, Shen'dralas carved from Feralas, Zephras Isle as an inset island) in the normal zone style. The boards still show the Cataclysm lake and no new zones | The map shows WoW: Forever, not Cataclysm; nothing else about the map changes | Nico |
