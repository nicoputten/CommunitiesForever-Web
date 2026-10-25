# Map build (`zones.json`)

`build_zones.py` turns the two source SVGs into `src/core/map/zones.json`: Vanilla zones in world coordinates (1440 × 900), coastlines, cities and dungeons. Written by Claude Design during the WEB-02 workshop; see its docstring for how it works and what to edit.

```bash
python -m venv .venv-map
.venv-map/Scripts/python -m pip install -r tools/map/requirements.txt   # Playwright's Chromium is shared with npm's
.venv-map/Scripts/python -I tools/map/build_zones.py --ek tools/map/source/Eastern_Kingdoms.svg --kal tools/map/source/Kalimdor_english.svg --out src/core/map/zones.json
```

A full rebuild reproduces the committed file only within sub-pixel differences: the browser's outline sampling and text measurement differ slightly between machines and Chromium versions, so path points move by fractions of a pixel, the simplifier then keeps a few more or fewer points, and city positions move by about 0.5 px. That rewrites every path, so commit a full rebuild only when the outlines are meant to change.

When only `DUNGEONS` changed (WEB-13), rewrite just that list and keep the rest of the file byte for byte:

```bash
.venv-map/Scripts/python -I tools/map/build_zones.py --dungeons-only --out src/core/map/zones.json
```

When only the WoW: Forever changes (`NEEDLES_EAST_COAST`, `EXTRA_ZONES`, a zone's kind) or `DUNGEONS` changed (WEB-31), apply them to the committed file; zones they do not touch keep their entry byte for byte, coastline rings they do not touch keep their text:

```bash
.venv-map/Scripts/python -I tools/map/build_zones.py --forever-only --out src/core/map/zones.json
```

`EXTRA_ZONES` are hand-drawn (the source SVGs have no shape for Forever's new zones): an outline in world px, roughened like the source coastlines, minus the zones of its continent except those it `carves`. Where they sit: `docs/WOW-FOREVER.md` "Zones".

Dungeon names in `DUNGEONS` match `src/core/gamedata/dungeons.ts`; `tests/unit/gamedata.test.ts` checks that every marker lies inside its zone.

## Sources and licence
| File | Source | Author | Licence |
|---|---|---|---|
| `source/Kalimdor_english.svg` | https://commons.wikimedia.org/wiki/File:Kalimdor_english.svg | Syrio | CC BY-SA 4.0 |
| `source/Eastern_Kingdoms.svg` | https://commons.wikimedia.org/wiki/File:Eastern_Kingdoms.svg | Syrio | CC BY-SA 4.0 |

`zones.json` is an adaptation (recoloured, merged and trimmed to Vanilla zones, Thousand Needles dried, Forever's new zones added by hand), so it is CC BY-SA 4.0 as well (https://creativecommons.org/licenses/by-sa/4.0/). The site credits it in the footer: "Zone outlines: Syrio, Wikimedia Commons (CC BY-SA 4.0), adapted".
