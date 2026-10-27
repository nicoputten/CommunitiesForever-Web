# Design prompt for Claude Design (WEB-02)

Paste everything below the line into Claude Design. It is self-contained. Decisions from the workshop go into `docs/DESIGN.md`.

---

## Who you are working with

I'm Nico, an experienced developer who knows React. I'm building a private website for my friend group, and I want to work with you on its UX and visual design until it is close to ideal. Don't jump straight to a final design: propose, show options, ask me questions, and iterate. When something is a trade-off, show both sides.

## The product

**wow.vestras.nl** is a companion site for **World of Warcraft: Forever** (Blizzard's re-release of original "Vanilla" WoW: level cap 60, two continents, Eastern Kingdoms and Kalimdor). Our group of 4 to 8 friends uses an in-game addon called *CommunitiesForever*. It records every friend's characters and shares them between us. I upload the addon's saved data file to this site, so we can look at it **when we are not in the game**.

The site answers three questions:
1. **Where is everyone?** The last known zone of every character, on a big map of Azeroth. This is the hero of the site.
2. **Who plays what?** Every friend's characters (alts) with class, race, level, item level, role and talents.
3. **Who can craft what?** Professions and skill levels across the group, and which professions nobody has.

## Users and moments

- **Nico (admin):** uploads the data file after a play session, checks what changed.
- **Friends (viewers):** sign in with Battle.net. They open the site at work, on the couch or on their phone to plan the evening: "who's near Stranglethorn?", "who has a level 40 for Scarlet Monastery?", "who can make me a Silk bag?", "how far is Bob's warlock?".
- Visits are short and frequent, so the answer must be visible within seconds. It's also a bit of a showpiece: people should *enjoy* opening it.

## Visual direction

**Vanilla WoW, made with modern techniques.** The bar is "really cool looking": a premium fan site, not a spreadsheet and not a generic admin dashboard.

- **Vanilla roots:** aged parchment and dark leather, gold and bronze trim, carved stone and wood frames like the 2004 UI, the game's class colors, a serif display face in the spirit of Friz Quadrata (pick a free web font that captures it), hand-drawn map feel.
- **Modern craft:** drifting volumetric fog over the map, soft light shafts, parallax depth layers, subtle ember or dust particles, smooth view transitions, glass and blur panels over the art, crisp typography for data.
- Dark by default, mood at night in Azeroth. Data must stay highly readable on top of all of this: atmosphere goes around the data, never over it.
- Motion is ambient and slow. It respects `prefers-reduced-motion` (static fog, no particles).
- **The map art is ours:** draw an original, illustrated, Vanilla-style map of Eastern Kingdoms and Kalimdor with recognisable zone shapes and names. Do not use or trace Blizzard's in-game map textures (copyright).

Please start by proposing **3 distinct visual directions**, each shown on the map screen (see below), so we can pick one before going deeper. For example: "parchment atlas" (light, ink and watercolor), "night over Azeroth" (dark, fog, glowing markers), "carved UI" (stone and gold frames, closest to the 2004 game).

## Screens, in priority order

### 1. World map (home)
- A big map of Azeroth, both continents, filling the screen.
- A small marker per character at its **last known zone**. A zone is all we know, so place markers in the zone area, not at an exact spot. Marker: class color, maybe a class or race icon or initials. Online-recently characters feel "alive" (soft glow or pulse), old sightings fade out with age.
- Several characters in one zone: cluster with a count and expand on hover/tap.
- Hover or tap a marker: name, level, class, owner (friend), zone, "seen 3 h ago". Click goes to the character.
- A sighting inside a dungeon (e.g. "The Deadmines") shows at the dungeon's zone with a dungeon indicator.
- Characters without a known location: an "Unknown whereabouts" tray or list, never silently dropped.
- Filters: friend, faction, level range, "seen in the last 24 h". Pan and zoom, switch between continents, both on mouse and touch.
- Important nuance: a location is recorded only when the addon saw the character while I was online. So "last seen" means "last seen by the addon", and it can be days old. The design must make data age obvious without being noisy.

### 2. Alts / roster
- Per friend: a group of their characters. Per character: name, class (color), race, faction, level (with progress feel toward 60), item level, role (tank, healer, damage), main talent tree, professions with skill, last played.
- Sort and filter (class, level, role, profession). A compact table view and a richer card view.
- Group-wide questions at a glance: "who has a character in level range 30 to 40", "who has a healer".

### 3. Professions
- Who has which profession at what skill: matrix of characters by profession, with skill bars (`rank / max`, e.g. 187 / 225).
- Professions in Vanilla: Alchemy, Blacksmithing, Enchanting, Engineering, Herbalism, Leatherworking, Mining, Skinning, Tailoring, plus the secondary skills Cooking, First Aid and Fishing. Max skill grows in steps (75, 150, 225, 300).
- Highlight gaps ("nobody has Alchemy") and the best crafter per profession.
- Later the addon will also share each character's known **recipes**, so this screen should grow into "who can craft Bolt of Silk Cloth?" with search. Leave room for that.

### 4. Character detail
- Everything about one character: header with class art or color, level, race, faction, realm, item level, role, talent points per tree (e.g. 31 / 20 / 0; a character has level minus 9 points), professions, last known location (mini map), last played, quests in the log (titles only), owner, and how old the data is.

### 5. Friend detail (maybe merged into the roster)
- A friend with all their characters, when their data was last received, and "via" (whose addon relayed it).

### 6. Upload (admin only)
- Drag and drop the `CommunitiesForever.lua` file (also a file picker for phones).
- Result: a "what changed" summary in a satisfying, game-like way: new characters, level ups ("Ves Doombringer 37 → 39"), profession gains ("Tailoring 150 → 182"), new sightings. Errors: wrong file, file from a newer addon version.
- Upload history list.

### 7. Sign in
- "Sign in with Battle.net" on a strong atmospheric screen. State for "your BattleTag is not on the list".

### Global states
- Empty site before the first upload.
- A friend whose data is old ("data from 9 days ago").
- Loading (fast server-rendered pages, so keep it subtle).

## Data you can design with

Characters are keyed by an internal ID. Names **always contain a space** (first and last name) in WoW: Forever, e.g. "Ves Doombringer"; never split them. Realm names will change at launch, so treat the realm as text. Item level can be missing. A friend can have 1 to 12 characters. Time stamps below are relative to "now".

```json
{
  "group": "Thursday Raiders",
  "uploadedAt": "now",
  "friends": [
    { "name": "Nico", "battleTag": "Nico#2201", "dataAge": "now", "characters": [
      { "name": "Ves Doombringer", "class": "Warlock", "race": "Undead", "faction": "Horde", "level": 39, "ilvl": 34, "role": "damage", "talents": [10, 0, 20], "mainTree": "Destruction",
        "professions": [["Tailoring", 187, 225], ["Enchanting", 160, 225], ["Cooking", 75, 150]], "lastPlayed": "2 h ago", "location": ["Stranglethorn Vale", "2 h ago"] },
      { "name": "Grom Ashfeller", "class": "Warrior", "race": "Orc", "faction": "Horde", "level": 24, "ilvl": 21, "role": "tank", "talents": [5, 0, 10], "mainTree": "Protection",
        "professions": [["Mining", 142, 150], ["Blacksmithing", 120, 150]], "lastPlayed": "3 days ago", "location": ["The Barrens", "3 days ago"] },
      { "name": "Sela Moonbrook", "class": "Druid", "race": "Night Elf", "faction": "Alliance", "level": 12, "ilvl": null, "role": "heal", "talents": [0, 0, 3], "mainTree": "Restoration",
        "professions": [["Herbalism", 61, 75]], "lastPlayed": "2 weeks ago", "location": null }
    ]},
    { "name": "Bob", "battleTag": "Bob#2002", "dataAge": "5 h ago", "via": null, "characters": [
      { "name": "Bob Example", "class": "Rogue", "race": "Troll", "faction": "Horde", "level": 41, "ilvl": 36, "role": "damage", "talents": [4, 28, 0], "mainTree": "Combat",
        "professions": [["Skinning", 210, 225], ["Leatherworking", 201, 225]], "lastPlayed": "5 h ago", "location": ["The Deadmines", "5 h ago", "dungeon in Westfall"] },
      { "name": "Tok Ironhide", "class": "Shaman", "race": "Tauren", "faction": "Horde", "level": 33, "ilvl": 29, "role": "heal", "talents": [0, 5, 19], "mainTree": "Restoration",
        "professions": [["Alchemy", 160, 225], ["Herbalism", 175, 225], ["First Aid", 225, 225]], "lastPlayed": "yesterday", "location": ["Hillsbrad Foothills", "yesterday"] }
    ]},
    { "name": "Mira", "battleTag": "Mira#1188", "dataAge": "2 days ago", "via": "Bob", "characters": [
      { "name": "Mira Sunstrider", "class": "Mage", "race": "Undead", "faction": "Horde", "level": 60, "ilvl": 58, "role": "damage", "talents": [10, 0, 41], "mainTree": "Frost",
        "professions": [["Tailoring", 300, 300], ["Enchanting", 285, 300], ["Fishing", 240, 300]], "lastPlayed": "2 days ago", "location": ["Orgrimmar", "2 days ago"] },
      { "name": "Kel Dawnhammer", "class": "Paladin", "race": "Human", "faction": "Alliance", "level": 18, "ilvl": 16, "role": "tank", "talents": [0, 9, 0], "mainTree": "Protection",
        "professions": [["Mining", 88, 150], ["Engineering", 70, 150]], "lastPlayed": "a week ago", "location": ["Westfall", "a week ago"] }
    ]},
    { "name": "Jorrit", "battleTag": "Jorrit#4410", "dataAge": "9 days ago", "via": "Mira", "characters": [
      { "name": "Ruk Bloodhoof", "class": "Hunter", "race": "Tauren", "faction": "Horde", "level": 27, "ilvl": 24, "role": "damage", "talents": [18, 0, 0], "mainTree": "Beast Mastery",
        "professions": [["Skinning", 150, 150], ["Mining", 131, 150]], "lastPlayed": "9 days ago", "location": ["Stonetalon Mountains", "9 days ago"] }
    ]},
    { "name": "Femke", "battleTag": "Femke#3307", "dataAge": "1 h ago", "characters": [
      { "name": "Lia Thornwhisper", "class": "Priest", "race": "Troll", "faction": "Horde", "level": 37, "ilvl": 32, "role": "heal", "talents": [21, 7, 0], "mainTree": "Discipline",
        "professions": [["Tailoring", 205, 225], ["Cooking", 150, 225]], "lastPlayed": "1 h ago", "location": ["Stranglethorn Vale", "1 h ago"] },
      { "name": "Zul Kazrek", "class": "Warlock", "race": "Orc", "faction": "Horde", "level": 15, "ilvl": 12, "role": "damage", "talents": [6, 0, 0], "mainTree": "Affliction",
        "professions": [], "lastPlayed": "4 days ago", "location": ["Durotar", "4 days ago"] }
    ]},
    { "name": "Sanne", "battleTag": "Sanne#5150", "dataAge": null, "noAddon": true, "characters": [] }
  ]
}
```

Notes on the sample: Stranglethorn Vale has two characters (cluster). Sela Moonbrook has no location. Bob's rogue is in a dungeon. Jorrit's data is old. Sanne is in the group but doesn't run the addon, so we know nothing about her characters. Nobody has Alchemy above 160 and nobody has Engineering at a useful level (gaps).

**Class colors** (the game's standard values): Warrior #C69B6D, Paladin #F48CBA, Hunter #AAD372, Rogue #FFF468, Priest #FFFFFF, Shaman #0070DD, Mage #3FC7EB, Warlock #8788EE, Druid #FF7C0A. They are used on dark backgrounds in the game, so check contrast if you use them on parchment.

## Layout and devices

- **Desktop first** (1440 px wide is the main canvas), but **fully usable on a phone at 375 px**: the map works with touch (pan, pinch, tap markers), tables turn into cards or scroll in a sensible way, nothing important hides behind hover alone.
- Navigation that's quick to switch between Map, Roster, Professions, with upload tucked away for the admin.

## Technical constraints

- Built in **React** (Next.js), TypeScript. Server-rendered pages with client-side interactivity where needed (the map).
- Please propose and justify any libraries your design relies on: map rendering (e.g. an SVG map, a canvas or WebGL layer, or a tile library), fog and particle effects (CSS, canvas, WebGL shaders), animation, styling approach. I decide; prefer few and well-maintained dependencies, and keep the first load light.
- Accessible: readable contrast for all data, keyboard navigation, focus states, reduced motion.
- Give me design tokens (colors, type scale, spacing, radii, shadows, motion durations) and a component list, so this can be implemented consistently.

## Open UX questions to work through with me

1. Navigation: top bar, side rail, or the map as the permanent background with panels sliding over it?
2. Map interaction: how markers behave at different zoom levels, clustering, and how a character's card opens without losing the map.
3. How much motion and atmosphere before it gets in the way? Where does it stop (data screens calmer than the map)?
4. Showing data age and "via" (data relayed by another friend) everywhere without clutter.
5. Roster density: table vs cards, and how to compare across friends.
6. Phone layout of the map: full screen with a bottom sheet?
7. Professions: matrix by character, by friend, or by profession? How do recipes fit in later?
8. The upload "what changed" moment: how game-like can it be?

## How I'd like to work

1. Three visual directions on the map screen. I pick one (or a mix).
2. The map screen in high fidelity, desktop and phone, including hover and cluster states.
3. Roster, professions and character detail in that direction.
4. Upload, sign in, empty and error states.
5. Final: tokens, components and the screens, ready to implement.

Ask me questions at any step where my answer changes the design.
