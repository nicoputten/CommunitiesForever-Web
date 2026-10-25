#!/usr/bin/env python3
"""
build_zones.py: turn the two Wikimedia Commons zone maps into zones.json for the Doombringers map.

Input : Eastern_Kingdoms.svg, Kalimdor_english.svg (Illustrator exports, one flat colour per zone)
Output: zones.json in world coordinates (1440 x 900), trimmed to Vanilla:
        zones (path, label/anchor point, label lines, size), coastlines, capitals/towns, dungeons.

Requirements:
    pip install -r tools/map/requirements.txt
    playwright install chromium

Usage:
    python tools/map/build_zones.py --ek tools/map/source/Eastern_Kingdoms.svg --kal tools/map/source/Kalimdor_english.svg --out src/core/map/zones.json

How it works:
    1. A headless browser renders each SVG and samples every path outline (getPointAtLength), so curves,
       transforms and compound paths are handled exactly as the SVG draws them.
    2. Paths are grouped by fill colour; each colour is one zone (islands included). Holes (lakes)
       are detected with the even-odd rule.
    3. Zones are merged/renamed for Vanilla, both continents are scaled to the same height and
       placed side by side, outlines are simplified, and label points are found with polylabel.

To change the map, edit COLOURS / LINES / LABEL_OVERRIDES / CITIES below and run it again.
"""
import argparse
import json
import math
from pathlib import Path

from playwright.sync_api import sync_playwright
from shapely import affinity
from shapely.geometry import Polygon
from shapely.ops import polylabel, unary_union

# ---------------------------------------------------------------- configuration

WORLD_W, WORLD_H = 1440, 900
MAP_BOX = (30, 78, 1070, 888)   # x0, y0, x1, y1 area the two continents are fitted into
CONTINENT_GAP = 70              # px between Kalimdor and the Eastern Kingdoms
SAMPLE_STEP = 0.4               # SVG units between sampled outline points (smaller = slower, more exact)
SIMPLIFY = 0.45                 # px tolerance for zone outlines
MIN_AREA = 1.5                  # px² — drop specks smaller than this

# fill colour(s) in the source SVG -> (id, name, kind). kind: "zone" (interactive) or "terrain" (dark, no hover)
# A list of colours means the zones are merged. Colours not listed are dropped (Cataclysm-only areas).
KALIMDOR = [
    ("teldrassil",  "Teldrassil",            "zone",    ["#00AEEF"]),
    ("darkshore",   "Darkshore",             "zone",    ["#57BF93"]),
    ("moonglade",   "Moonglade",             "zone",    ["#81D4F7"]),   # same colour as Bloodmyst; filtered by x below
    ("winterspring","Winterspring",          "zone",    ["#B6D98B"]),
    ("felwood",     "Felwood",               "zone",    ["#759341"]),
    ("hyjal",       "Mount Hyjal",           "terrain", ["#00A750"]),
    ("azshara",     "Azshara",               "zone",    ["#62BD5E"]),
    ("ashenvale",   "Ashenvale",             "zone",    ["#87BC40"]),
    ("stonetalon",  "Stonetalon Mountains",  "zone",    ["#B47565"]),
    ("durotar",     "Durotar",               "zone",    ["#FFF200"]),
    ("barrens",     "The Barrens",           "zone",    ["#FDB714", "#B36928"]),   # Northern + Southern Barrens
    ("mulgore",     "Mulgore",               "zone",    ["#F79226"]),
    ("desolace",    "Desolace",              "zone",    ["#E27423"]),
    ("feralas",     "Feralas",               "zone",    ["#C161A5"]),
    ("dustwallow",  "Dustwallow Marsh",      "zone",    ["#C8A760"]),
    ("needles",     "Thousand Needles",      "zone",    ["#F175AD"]),
    ("ungoro",      "Un'Goro Crater",        "zone",    ["#817FBC"]),
    ("tanaris",     "Tanaris",               "zone",    ["#737A9D"]),
    ("silithus",    "Silithus",              "zone",    ["#A05DA5", "#8850A0"]),   # + Ahn'Qiraj
    ("uldum",       "Uldum",                 "terrain", ["#7D5AA6"]),
]
MOONGLADE_MIN_X = 200   # source units: separates Moonglade from Bloodmyst Isle (same colour)

EASTERN_KINGDOMS = [
    ("tirisfal",    "Tirisfal Glades",       "zone",    ["#7E499D"]),
    ("wpl",         "Western Plaguelands",   "zone",    ["#5582B0"]),
    ("epl",         "Eastern Plaguelands",   "zone",    ["#7E92B7"]),
    ("silverpine",  "Silverpine Forest",     "zone",    ["#B72467"]),
    ("hillsbrad",   "Hillsbrad Foothills",   "zone",    ["#F05A94"]),   # includes Alterac Mountains
    ("hinterlands", "The Hinterlands",       "zone",    ["#A587BE"]),
    ("arathi",      "Arathi Highlands",      "zone",    ["#A767AA"]),
    ("gilneas",     "Gilneas",               "terrain", ["#A20069"]),
    ("wetlands",    "Wetlands",              "zone",    ["#00A76D"]),
    ("grimbatol",   "Grim Batol",            "terrain", ["#007F49"]),
    ("dunmorogh",   "Dun Morogh",            "zone",    ["#A3CF62"]),
    ("lochmodan",   "Loch Modan",            "zone",    ["#50B848"]),
    ("searing",     "Searing Gorge",         "zone",    ["#6FA143"]),
    ("badlands",    "Badlands",              "zone",    ["#408742"]),
    ("burning",     "Burning Steppes",       "zone",    ["#A84821"]),
    ("elwynn",      "Elwynn Forest",         "zone",    ["#CC7B16"]),
    ("redridge",    "Redridge Mountains",    "zone",    ["#F7941E"]),
    ("westfall",    "Westfall",              "zone",    ["#FFF200"]),
    ("duskwood",    "Duskwood",              "zone",    ["#A3620A"]),
    ("deadwind",    "Deadwind Pass",         "zone",    ["#BA4D16"]),
    ("swamp",       "Swamp of Sorrows",      "zone",    ["#BB8A32"]),
    ("blasted",     "Blasted Lands",         "zone",    ["#F26522"]),
    ("stv",         "Stranglethorn Vale",    "zone",    ["#FDB714", "#FFF579"]),   # Northern STV + Cape
]

# label split into lines (default: the name on one line)
LINES = {
    "wpl": ["Western", "Plaguelands"], "epl": ["Eastern Plaguelands"], "silverpine": ["Silverpine", "Forest"],
    "hillsbrad": ["Hillsbrad", "Foothills"], "stonetalon": ["Stonetalon", "Mountains"], "dustwallow": ["Dustwallow", "Marsh"],
    "needles": ["Thousand", "Needles"], "ungoro": ["Un'Goro", "Crater"], "burning": ["Burning", "Steppes"],
    "redridge": ["Redridge", "Mountains"], "swamp": ["Swamp of", "Sorrows"], "deadwind": ["Deadwind", "Pass"],
    "searing": ["Searing", "Gorge"], "blasted": ["Blasted", "Lands"], "stv": ["Stranglethorn", "Vale"],
    "tirisfal": ["Tirisfal", "Glades"], "arathi": ["Arathi", "Highlands"], "elwynn": ["Elwynn", "Forest"],
    "lochmodan": ["Loch", "Modan"], "hyjal": ["Mount", "Hyjal"], "hinterlands": ["The Hinterlands"], "grimbatol": ["Grim", "Batol"],
}

# hand-placed label / marker anchor points in world px (to avoid capitals and keep room for markers)
LABEL_OVERRIDES = {
    "teldrassil": (195, 114), "tirisfal": (668, 152), "mulgore": (246, 572), "elwynn": (724, 656), "stv": (772, 800),
    "durotar": (382, 488), "barrens": (306, 512), "hillsbrad": (728, 282), "stonetalon": (180, 452), "westfall": (656, 726),
    "epl": (882, 152),
}

# cities: (name, continent, label text in the source SVG, capital?) — position taken from that label
CITIES = [
    ("Orgrimmar", "K", "Orgrimmar", 1), ("Thunder Bluff", "K", "Thunder Bluff", 1), ("Darnassus", "K", "Darnassus", 1),
    ("Crossroads", "K", "The Crossroads", 0), ("Ratchet", "K", "Ratchet", 0), ("Gadgetzan", "K", "Gadgetzan", 0),
    ("Everlook", "K", "Everlook", 0), ("Theramore", "K", "Theramore", 0), ("Astranaar", "K", "Astranaar", 0),
    ("Undercity", "E", "Undercity", 1), ("Ironforge", "E", "Ironforge", 1), ("Stormwind", "E", "Stormwind", 1),
    ("Booty Bay", "E", "Booty Bay", 0), ("Stratholme", "E", "Stratholme", 0), ("Karazhan", "E", "Karazhan", 0),
]
CITY_OVERRIDES = {"Darnassus": (148, 146)}   # world px; the source label sits off the island

DUNGEONS = [
    {"name": "The Deadmines", "zone": "westfall", "x": 648, "y": 742},
]

SOURCE_NOTE = ("Zone outlines: Wikimedia Commons Kalimdor_english.svg / Eastern_Kingdoms.svg, "
               "recoloured and trimmed to Vanilla zones")

# ---------------------------------------------------------------- 1. sample outlines in a browser

SAMPLER_JS = """
(step) => {
  const root = document.querySelector('svg');
  const inv = root.getScreenCTM().inverse();
  const tr = (el, x, y) => { const m = inv.multiply(el.getScreenCTM()); return [m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f]; };
  const paths = [...document.querySelectorAll('path')].map(el => {
    const fill = el.getAttribute('fill');
    if (!fill || fill === 'none') return null;
    const L = el.getTotalLength();
    const n = Math.max(20, Math.ceil(L / step));
    const rings = []; let cur = []; let prev = null;
    for (let i = 0; i <= n; i++) {
      const pt = el.getPointAtLength(L * i / n);
      const q = tr(el, pt.x, pt.y);
      if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) > 2) { if (cur.length > 2) rings.push(cur); cur = []; }
      cur.push(q); prev = q;
    }
    if (cur.length > 2) rings.push(cur);
    return { fill: fill.toUpperCase(), rings };
  }).filter(Boolean);
  const texts = [...document.querySelectorAll('text')].map(el => {
    const bb = el.getBBox(); const c = tr(el, bb.x + bb.width / 2, bb.y + bb.height / 2);
    return { t: el.textContent.replace(/\\s+/g, ' ').trim(), x: c[0], y: c[1] };
  });
  return { paths, texts };
}
"""


def sample_svg(page, svg_path: Path):
    svg = svg_path.read_text(encoding="utf-8")
    for tag in ("<?xml", "<!DOCTYPE"):
        while tag in svg:
            start = svg.index(tag)
            svg = svg[:start] + svg[svg.index(">", start) + 1:]
    page.set_content(f"<html><body style='margin:0'>{svg}</body></html>")
    return page.evaluate(SAMPLER_JS, SAMPLE_STEP)


# ---------------------------------------------------------------- 2. polygons per colour (even-odd holes)

def geometry_by_colour(sampled):
    by_colour = {}
    for p in sampled["paths"]:
        rings = [Polygon(r).buffer(0) for r in p["rings"] if len(r) > 3]
        rings = [r for r in rings if r.area > 0.01]
        outer, holes = [], []
        for i, r in enumerate(rings):
            pt = r.representative_point()
            depth = sum(1 for j, o in enumerate(rings) if j != i and o.area > r.area and o.contains(pt))
            (holes if depth % 2 else outer).append(r)
        g = unary_union(outer)
        if holes:
            g = g.difference(unary_union(holes))
        by_colour.setdefault(p["fill"], []).append(g)
    return {c: unary_union(v) for c, v in by_colour.items()}


def build_zones(spec, colours, cont):
    zones = []
    for zid, name, kind, cols in spec:
        missing = [c for c in cols if c not in colours]
        if missing:
            raise SystemExit(f"{zid}: colour(s) {missing} not found in the source SVG")
        g = unary_union([colours[c] for c in cols])
        if len(cols) > 1:   # close hairline gaps between merged zones
            g = g.buffer(0.6).buffer(-0.6)
        if zid == "moonglade":
            parts = list(g.geoms) if hasattr(g, "geoms") else [g]
            g = unary_union([p for p in parts if p.centroid.x > MOONGLADE_MIN_X])
        zones.append({"id": zid, "name": name, "cont": cont, "kind": kind, "geom": g})
    return zones


# ---------------------------------------------------------------- 3. place, simplify, label

def ring_d(coords):
    pts = list(coords)[:-1]
    return "M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z"


def geom_d(g):
    polys = list(g.geoms) if hasattr(g, "geoms") else [g]
    out = []
    for p in polys:
        if p.is_empty or p.area < MIN_AREA:
            continue
        out.append(ring_d(p.exterior.coords))
        out += [ring_d(h.coords) for h in p.interiors if Polygon(h).area > MIN_AREA]
    return "".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ek", required=True, type=Path, help="Eastern_Kingdoms.svg")
    ap.add_argument("--kal", required=True, type=Path, help="Kalimdor_english.svg")
    ap.add_argument("--out", default=Path("zones.json"), type=Path)
    args = ap.parse_args()

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page()
        print("sampling Kalimdor …")
        kal = sample_svg(page, args.kal)
        print("sampling Eastern Kingdoms …")
        ek = sample_svg(page, args.ek)
        browser.close()

    zones = build_zones(KALIMDOR, geometry_by_colour(kal), "K") + build_zones(EASTERN_KINGDOMS, geometry_by_colour(ek), "E")

    # fit both continents to the same height, side by side inside MAP_BOX
    def bounds(c):
        return unary_union([z["geom"] for z in zones if z["cont"] == c]).bounds
    bk, be = bounds("K"), bounds("E")
    x0, y0, x1, y1 = MAP_BOX
    h = y1 - y0
    sk, se = h / (bk[3] - bk[1]), h / (be[3] - be[1])
    wk, we = (bk[2] - bk[0]) * sk, (be[2] - be[0]) * se
    total = wk + we + CONTINENT_GAP
    if total > x1 - x0:
        f = (x1 - x0) / total
        sk, se, wk, we, h = sk * f, se * f, wk * f, we * f, h * f
    ox = x0 + ((x1 - x0) - (wk + we + CONTINENT_GAP)) / 2
    oy = y0 + ((y1 - y0) - h) / 2
    T = {"K": (sk, ox - bk[0] * sk, oy - bk[1] * sk),
         "E": (se, ox + wk + CONTINENT_GAP - be[0] * se, oy - be[1] * se)}

    def place(g, c):
        s, dx, dy = T[c]
        return affinity.affine_transform(g, [s, 0, 0, s, dx, dy])

    out_zones = []
    for z in zones:
        g = place(z["geom"], z["cont"]).simplify(SIMPLIFY, preserve_topology=True)
        main_part = max(g.geoms, key=lambda p: p.area) if hasattr(g, "geoms") else g
        lp = polylabel(main_part, 0.5)
        lx, ly = LABEL_OVERRIDES.get(z["id"], (round(lp.x, 1), round(lp.y, 1)))
        area = round(g.area)
        out_zones.append({
            "id": z["id"], "name": z["name"], "cont": z["cont"], "kind": z["kind"],
            "d": geom_d(g), "lx": lx, "ly": ly, "area": area,
            "lines": LINES.get(z["id"], [z["name"]]),
            "size": 11 if area > 7000 else (10 if area > 3500 else 9),
        })

    coast = {}
    for c in "KE":
        u = unary_union([place(z["geom"], c) for z in zones if z["cont"] == c])
        coast[c] = geom_d(u.buffer(0.8).buffer(-0.8).simplify(0.5))

    texts = {"K": kal["texts"], "E": ek["texts"]}
    cities = []
    for name, c, label, cap in CITIES:
        hit = next((t for t in texts[c] if t["t"].replace("•", "").strip() == label), None)
        if name in CITY_OVERRIDES:
            x, y = CITY_OVERRIDES[name]
        elif hit:
            s, dx, dy = T[c]
            x, y = round(hit["x"] * s + dx, 1), round(hit["y"] * s + dy, 1)
        else:
            print(f"warning: city label '{label}' not found, skipped")
            continue
        cities.append({"name": name, "cap": cap, "x": x, "y": y})

    data = {"v": 1, "width": WORLD_W, "height": WORLD_H, "source": SOURCE_NOTE,
            "zones": out_zones, "coast": coast, "cities": cities, "dungeons": DUNGEONS}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {args.out} · {len(out_zones)} zones · {args.out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
