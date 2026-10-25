# Map build (`zones.json`)

`build_zones.py` turns the two source SVGs into `src/core/map/zones.json`: Vanilla zones in world coordinates (1440 × 900), coastlines, cities and dungeons. Written by Claude Design during the WEB-02 workshop; see its docstring for how it works and what to edit.

```bash
python -m venv .venv-map
.venv-map/Scripts/python -m pip install -r tools/map/requirements.txt   # Playwright's Chromium is shared with npm's
.venv-map/Scripts/python -I tools/map/build_zones.py --ek tools/map/source/Eastern_Kingdoms.svg --kal tools/map/source/Kalimdor_english.svg --out src/core/map/zones.json
```

A rebuild reproduces the committed file within sub-pixel differences (0.3–0.6 px in some path points and city positions, from sampling and text measurement in the browser). Commit the output only when the map is meant to change.

## Sources and licence
| File | Source | Author | Licence |
|---|---|---|---|
| `source/Kalimdor_english.svg` | https://commons.wikimedia.org/wiki/File:Kalimdor_english.svg | Syrio | CC BY-SA 4.0 |
| `source/Eastern_Kingdoms.svg` | https://commons.wikimedia.org/wiki/File:Eastern_Kingdoms.svg | Syrio | CC BY-SA 4.0 |

`zones.json` is an adaptation (recoloured, merged and trimmed to Vanilla zones), so it is CC BY-SA 4.0 as well (https://creativecommons.org/licenses/by-sa/4.0/). The site credits it in the footer: "Zone outlines: Syrio, Wikimedia Commons (CC BY-SA 4.0), adapted".
