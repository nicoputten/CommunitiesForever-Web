# Map build (`zones.json`)

`build_zones.py` builds `src/core/map/zones.json`: the zones of WoW: Forever in world coordinates (1440 × 900), coastlines, cities and dungeons. Written by Claude Design during the WEB-02 workshop, reworked for Forever's own maps in WEB-77; see its docstring for how it works and what to edit.

The coast and every zone border are traced from Forever's in-game continent maps (WEB-77): land is told from sea by colour, and each zone grows from its `SEEDS` (points read off the maps) to the border lines the map draws. The two Wikimedia Commons SVGs are Cataclysm-era; they only give the world frame: their zones, placed as in WEB-02, are what the traced zones are laid onto (a least-squares fit of the zones' centroids), so the map keeps its size and place. Zephras Isle is on no continent map and stays hand-drawn (`EXTRA_ZONES`). Everything is clipped to the world: Quel'Thalas reaches past its top (Forever's map draws the Eastern Kingdoms taller than the frame) and is cut there. Where the new zones sit: `docs/WOW-FOREVER.md` "Zones".

Forever's maps are Blizzard's images, so they stay out of git (`tools/map/forever/` is gitignored). Before a full build, open these in a browser and save them under these names into `tools/map/forever/`:

- https://warcraft.wiki.gg/images/WorldMap-Kalimdor_c60.jpg?format=original → `WorldMap-Kalimdor_c60.jpg`
- https://warcraft.wiki.gg/images/WorldMap-EasternKingdoms_c60.jpg?format=original → `WorldMap-EasternKingdoms_c60.jpg`

Both are on Warcraft Wiki's [Forever map comparison](https://warcraft.wiki.gg/wiki/Forever_map_comparison) (1002 × 668). The tool reads them through the browser, so it needs no image library.

```bash
python -m venv .venv-map
.venv-map/Scripts/python -m pip install -r tools/map/requirements.txt   # Playwright's Chromium is shared with npm's
.venv-map/Scripts/python -I tools/map/build_zones.py --ek tools/map/source/Eastern_Kingdoms.svg --kal tools/map/source/Kalimdor_english.svg --forever-maps tools/map/forever --out src/core/map/zones.json
```

A full rebuild reproduces the committed file only within sub-pixel differences: the browser's outline sampling differs slightly between machines and Chromium versions, so the world frame moves by fractions of a pixel, and with it every traced path. Commit a full rebuild only when the outlines are meant to change.

When only `DUNGEONS` changed (WEB-13), rewrite just that list and keep the rest of the file byte for byte:

```bash
.venv-map/Scripts/python -I tools/map/build_zones.py --dungeons-only --out src/core/map/zones.json
```

Dungeon names in `DUNGEONS` match `src/core/gamedata/dungeons.ts`; `tests/unit/gamedata.test.ts` checks that every marker lies inside its zone. Markers, cities and `LABEL_OVERRIDES` are world px: when a full build moves a zone, check they still sit where they should.

## Sources and licence
| File | Source | Author | Licence | Used for |
|---|---|---|---|---|
| `source/Kalimdor_english.svg` | https://commons.wikimedia.org/wiki/File:Kalimdor_english.svg | Syrio | CC BY-SA 4.0 | the world frame (WEB-02, WEB-77) |
| `source/Eastern_Kingdoms.svg` | https://commons.wikimedia.org/wiki/File:Eastern_Kingdoms.svg | Syrio | CC BY-SA 4.0 | the world frame (WEB-02, WEB-77) |
| `forever/WorldMap-Kalimdor_c60.jpg` (not committed) | https://warcraft.wiki.gg/wiki/File:WorldMap-Kalimdor_c60.jpg | Blizzard Entertainment (World of Warcraft: Forever) | © Blizzard Entertainment | coast and zone borders (WEB-77) |
| `forever/WorldMap-EasternKingdoms_c60.jpg` (not committed) | https://warcraft.wiki.gg/wiki/File:WorldMap-EasternKingdoms_c60.jpg | Blizzard Entertainment (World of Warcraft: Forever) | © Blizzard Entertainment | coast and zone borders (WEB-77) |

Until WEB-77, `zones.json` was an adaptation of Syrio's SVGs (recoloured, merged and trimmed to Vanilla zones), CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Since WEB-77 its outlines are traced from Forever's maps, and Syrio's SVGs place them. The site keeps its credit "Zone outlines: Syrio, Wikimedia Commons (CC BY-SA 4.0), adapted" and the cards' "Map: Syrio, CC BY-SA 4.0" for now; a credit for Forever's maps is a backlog item in `docs/STORIES.md` (Nico, 2026-11-02).
