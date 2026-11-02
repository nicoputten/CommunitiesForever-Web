#!/usr/bin/env python3
"""
build_zones.py: turn the two Wikimedia Commons zone maps and WoW: Forever's continent maps into zones.json for the
Doombringers map.

Input : Eastern_Kingdoms.svg, Kalimdor_english.svg (Illustrator exports, one flat colour per zone; Cataclysm-era) and
        Forever's continent maps WorldMap-Kalimdor_c60.jpg, WorldMap-EasternKingdoms_c60.jpg (README: where to get them)
Output: zones.json in world coordinates (1440 x 900): zones (path, label/anchor point, label lines, size), coastlines,
        capitals/towns, dungeons.

Requirements:
    pip install -r tools/map/requirements.txt
    playwright install chromium

Usage:
    python tools/map/build_zones.py --ek tools/map/source/Eastern_Kingdoms.svg --kal tools/map/source/Kalimdor_english.svg --forever-maps tools/map/forever --out src/core/map/zones.json
    python tools/map/build_zones.py --dungeons-only --out src/core/map/zones.json

--dungeons-only rewrites only the "dungeons" list of an existing zones.json and keeps everything else byte for byte:
a full rebuild moves outline points by fractions of a pixel (browser sampling), which would rewrite every path for a
change that only adds dungeons.

How it works:
    1. A headless browser renders each SVG and samples every path outline (getPointAtLength), so curves,
       transforms and compound paths are handled exactly as the SVG draws them.
    2. Paths are grouped by fill colour; each colour is one zone (islands included). Holes (lakes)
       are detected with the even-odd rule.
    3. Zones are merged/renamed for Vanilla, both continents are scaled to the same height and
       placed side by side: the world frame (WEB-02).
    4. WoW: Forever (WEB-77, fit_forever_maps()): the SVGs' shapes are Cataclysm's, so the zones are traced from
       Forever's continent maps instead: land from sea by colour, each zone grown from its SEEDS to the border lines
       the map draws, then laid into the world frame by a least-squares fit of the traced zones' centroids to the
       SVG zones' centroids. Zephras Isle (not on a continent map) is drawn by hand.
    5. Outlines are simplified and label points are found with polylabel.

To change the map, edit COLOURS / SEEDS / LINES / LABEL_OVERRIDES / CITIES / DUNGEONS below and run it again.
"""
import argparse
import base64
import heapq
import json
import math
from collections import deque
from pathlib import Path

import numpy as np
import shapely
from playwright.sync_api import sync_playwright
from shapely import affinity
from shapely.geometry import LineString, Polygon
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
    ("hyjal",       "Mount Hyjal",           "zone",    ["#00A750"]),   # playable in WoW: Forever (WEB-31)
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
    ("uldum",       "Uldum",                 "terrain", ["#7D5AA6"]),   # not on Forever's map; kept for the world frame
]
MOONGLADE_MIN_X = 200   # source units: separates Moonglade from Bloodmyst Isle (same colour)

EASTERN_KINGDOMS = [
    ("tirisfal",    "Tirisfal Glades",       "zone",    ["#7E499D"]),
    ("wpl",         "Western Plaguelands",   "zone",    ["#5582B0"]),
    ("epl",         "Eastern Plaguelands",   "zone",    ["#7E92B7"]),
    ("silverpine",  "Silverpine Forest",     "zone",    ["#B72467"]),
    ("hillsbrad",   "Hillsbrad Foothills",   "zone",    ["#F05A94"]),   # includes Alterac Mountains (SEEDS)
    ("hinterlands", "The Hinterlands",       "zone",    ["#A587BE"]),
    ("arathi",      "Arathi Highlands",      "zone",    ["#A767AA"]),
    ("gilneas",     "Gilneas",               "terrain", ["#A20069"]),
    ("wetlands",    "Wetlands",              "zone",    ["#00A76D"]),
    ("grimbatol",   "Grim Batol",            "terrain", ["#007F49"]),   # not on Forever's map; kept for the world frame
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
    "riverglades": ["The", "Riverglades"], "zephras": ["Zephras", "Isle"],
}

# hand-placed label / marker anchor points in world px (to avoid capitals and keep room for markers)
LABEL_OVERRIDES = {
    "teldrassil": (191.5, 117.2), "tirisfal": (661.8, 151.6), "mulgore": (247.1, 569.7), "elwynn": (717.9, 655.5),
    "stv": (769.3, 804.5), "durotar": (376.4, 492.8), "barrens": (313.8, 514), "hillsbrad": (732.8, 274.8),
    "stonetalon": (183.3, 440), "westfall": (661.2, 742.9), "epl": (905, 168), "wpl": (782, 176),
}

# Zephras Isle (WEB-31): in Skywall, the elemental plane of air, not on Azeroth (warcraft.wiki.gg "Zephras Isle"), so on
# no continent map: an outline in world px, placed by hand (Claude, approved by Nico 2026-10-25), roughened like the
# coastlines (rough()). An inset island in the open sea between the continents, south of the Maelstrom (the map's
# compass rose takes the gap's north end).
EXTRA_ZONES = [
    {"id": "zephras", "name": "Zephras Isle", "cont": "K", "carves": [], "points": [
        (492, 783), (502, 773), (518, 769), (534, 772), (546, 781), (548, 793), (540, 804), (524, 810), (507, 808),
        (495, 799)]},
]
ROUGH_STEP = 2.5     # px between the points rough() adds
ROUGH_AMP = 1.2      # px: how far rough() moves them sideways

# WoW: Forever's own continent maps (WEB-77): the in-game maps as on warcraft.wiki.gg's "Forever map comparison"
# (Blizzard's images, read from a local folder, never committed: README). Coast and zone borders are traced from them.
FOREVER_MAPS = {"K": "WorldMap-Kalimdor_c60.jpg", "E": "WorldMap-EasternKingdoms_c60.jpg"}
LAND_SAT = 0.6        # land is more saturated than this ((max - min) / max of R, G, B), the sea less
GREEN = 1.4           # also land: green forest less saturated than LAND_SAT (green >= red, green > GREEN x blue)
LAKE_SAT, LAKE_LUM = 0.4, 115   # water in a hole in the land: less saturated and lighter than this (light grey)
MIN_LAND_PX = 40      # image px²: smaller land is a speck on the sea, a smaller hole a speck on the land
NEAR_LAND = 40        # image px: islands farther than this from the continent are ornaments on the sea
# Image px, per map: the part of the image that can be land (the rest is parchment frame), a pixel on the continent,
# and cuts drawn by hand (along the coast's grey band) where the land touches the frame's burnt edge: Kalimdor's south
# coast, and the strait between Eastern Plaguelands and Quel'Thalas (no zone, as on the 2004 map).
LAND_BOX = {"K": (60, 25, 940, 668), "E": (60, 0, 940, 668)}
LAND_SEED = {"K": (470, 450), "E": (560, 150)}
SEA_CUTS = {
    "K": [[(376, 610), (385, 630), (395, 638), (420, 640), (445, 639), (458, 634), (466, 624), (474, 610), (482, 603),
           (500, 603), (520, 609), (540, 614), (560, 620), (572, 628), (580, 628), (587, 618), (592, 598)]],
    "E": [[(566, 34), (580, 27), (600, 22), (620, 26), (632, 31), (650, 37), (670, 30), (682, 24), (702, 15)]],
}
LINE_LUM, LINE_SOFT = 130, 12   # cost of a pixel on the way to its zone: exp((LINE_LUM - luminance) / LINE_SOFT)
# The continent's name is lettered over the land, in strokes thicker than the border lines: inside these boxes (image
# px: x0, y0, x1, y1) dark pixels that survive a 1 px erosion are lettering, which costs nothing to cross
LETTER_LUM = 95
TEXT_BOXES = {"K": [(355, 328, 640, 357)], "E": [(350, 368, 537, 398), (415, 399, 650, 430)]}
UPSAMPLE = 4          # zone borders are smoothed on a grid this many times finer than the image

# Zones only Forever's maps have (docs/WOW-FOREVER.md "Zones"), after the SVG ones: (id, name, continent, kind).
NEW_ZONES = [
    ("riverglades", "The Riverglades",       "E", "zone"),
    ("shendralas",  "Shen'dralas",           "K", "zone"),
]
# Traced so their neighbours stop at their border, then left off the map: Quel'Thalas, the land north of Eastern
# Plaguelands, with a border of its own and no zone (as on the 2004 map; the map never drew it).
UNDRAWN = {"quelthalas": "E"}

# Where each zone is on Forever's maps: points in image px inside the zone, read off the maps (Claude, WEB-77) with
# the SVG zones laid over them as a check. A zone grows from them to the map's border lines (grow()); land no
# zone reaches (islands) goes to the nearest one. Zones not listed are not on Forever's maps (Uldum; Grim Batol, which
# Forever's map gives to the Wetlands and Loch Modan) and are dropped. Alterac Mountains has a border of its own on
# Forever's map but stays part of Hillsbrad Foothills, as the game's zone text is mapped (src/core/gamedata/zones.ts).
SEEDS = {
    "teldrassil": [(425, 75)], "darkshore": [(462, 186), (456, 205), (452, 220), (455, 231), (455, 240)], "moonglade": [(522, 125), (550, 140)], "winterspring": [(586, 145)],
    "felwood": [(514, 174), (481, 177), (480, 200), (482, 227)], "hyjal": [(534, 219)], "azshara": [(601, 262)], "ashenvale": [(508, 267), (451, 275)],
    "stonetalon": [(431, 284), (482, 345)], "durotar": [(586, 321), (586, 342), (591, 358)],
    "barrens": [(526, 399), (547, 342)], "mulgore": [(467, 376), (468, 428)], "desolace": [(422, 382)], "shendralas": [(444, 429)],
    "feralas": [(456, 476)], "dustwallow": [(550, 461)], "needles": [(495, 484), (560, 507)], "silithus": [(428, 599)],
    "ungoro": [(493, 544)], "tanaris": [(557, 572)],
    "quelthalas": [(643, 70), (540, 102)], "tirisfal": [(439, 150)], "wpl": [(505, 146)], "epl": [(575, 148), (577, 181)],
    "silverpine": [(415, 195), (409, 174)], "hillsbrad": [(471, 201), (498, 232), (453, 224)], "gilneas": [(405, 269)],
    "hinterlands": [(537, 216)], "arathi": [(547, 250)], "wetlands": [(530, 318)], "dunmorogh": [(502, 355)],
    "lochmodan": [(575, 368), (589, 357)], "searing": [(502, 401)], "badlands": [(556, 405)],
    "riverglades": [(566, 442)], "burning": [(518, 441)], "elwynn": [(455, 467), (443, 431)], "redridge": [(537, 480)],
    "westfall": [(415, 519)], "duskwood": [(479, 521)], "deadwind": [(510, 516)], "swamp": [(540, 512)],
    "blasted": [(532, 551)], "stv": [(492, 561), (466, 580)],
}

# cities: (name, x, y, capital?) in world px. Placed at the source SVG's label (Darnassus by hand, on the island), then
# moved with their zone onto Forever's shapes (WEB-77).
CITIES = [
    ("Orgrimmar", 375.8, 433, 1), ("Thunder Bluff", 224.5, 534.9, 1), ("Darnassus", 146.9, 147.5, 1),
    ("Crossroads", 320.4, 497, 0), ("Ratchet", 358.1, 533.4, 0), ("Gadgetzan", 342.4, 728.5, 0),
    ("Everlook", 393.4, 246.1, 0), ("Theramore", 384.6, 619.4, 0), ("Astranaar", 231.8, 400.7, 0),
    ("Undercity", 701.4, 183.2, 1), ("Ironforge", 759, 473.6, 1), ("Stormwind", 684, 623.5, 1),
    ("Booty Bay", 690.3, 873.5, 0), ("Stratholme", 858.5, 124.5, 0), ("Karazhan", 794.1, 731.2, 0),
]

# Dungeons and raids (WEB-13, docs/WOW-FOREVER.md): marker positions in world px, placed by hand inside the zone. Where the source
# SVG marks the entrance with a dot (Uldaman, Gnomeregan, Blackrock Mountain, Zul'Farrak, Dire Maul, Maraudon,
# Stratholme) the marker sat on that dot, the Blackrock Mountain instances around it; Zul'Gurub by its label;
# the rest where the entrance is in the game. Since WEB-77 they are moved with their zone onto Forever's shapes (scaled
# about the zone's centroid, kept 3 px inside it); then by hand: Scarlet Monastery north-east of Undercity, as in the
# game, clear of the header on the Eastern Kingdoms view; Shadowfang Keep in southern Silverpine, clear of the phone's
# "in Kalimdor" button when Scarlet Monastery's sheet is open. Names match src/core/gamedata/dungeons.ts.
DUNGEONS = [
    {"name": "The Deadmines", "zone": "westfall", "x": 654.1, "y": 750.5},
    {"name": "Ragefire Chasm", "zone": "durotar", "x": 381.2, "y": 432},
    {"name": "Wailing Caverns", "zone": "barrens", "x": 304.8, "y": 503.2},
    {"name": "Shadowfang Keep", "zone": "silverpine", "x": 678, "y": 279},
    {"name": "Blackfathom Deeps", "zone": "ashenvale", "x": 188.6, "y": 367.7},
    {"name": "The Stockade", "zone": "elwynn", "x": 690.2, "y": 630.1},
    {"name": "Gnomeregan", "zone": "dunmorogh", "x": 689.9, "y": 480.4},
    {"name": "Razorfen Kraul", "zone": "barrens", "x": 294.8, "y": 602.9},
    {"name": "Scarlet Monastery", "zone": "tirisfal", "x": 752, "y": 158},
    {"name": "Razorfen Downs", "zone": "barrens", "x": 312.9, "y": 639.1},
    {"name": "Uldaman", "zone": "badlands", "x": 848.8, "y": 514.2},
    {"name": "Zul'Farrak", "zone": "tanaris", "x": 317.7, "y": 694.7},
    {"name": "Maraudon", "zone": "desolace", "x": 120.4, "y": 512.7},
    {"name": "Sunken Temple", "zone": "swamp", "x": 868.4, "y": 698.5},
    {"name": "Blackrock Depths", "zone": "burning", "x": 752, "y": 575.6},
    {"name": "Blackrock Spire", "zone": "burning", "x": 753.9, "y": 573.8},
    {"name": "Dire Maul", "zone": "feralas", "x": 179.9, "y": 602.6},
    {"name": "Scholomance", "zone": "wpl", "x": 820.6, "y": 185.2},
    {"name": "Stratholme", "zone": "epl", "x": 860.4, "y": 117.5},
    {"name": "Onyxia's Lair", "zone": "dustwallow", "x": 347.7, "y": 652.1},
    # WoW: Forever's new dungeons and raids (docs/WOW-FOREVER.md). Placed by Blizzard's location text: beneath Ironforge,
    # above the Undercity, western Wetlands, Alterac Mountains, the islet off Stranglethorn's west coast, Alcaz Island,
    # Azshara (no exact spot published), northern Un'Goro, Mount Hyjal (Hyjal Summit by the source's Nordrassil label),
    # The Riverglades (no exact spot published).
    {"name": "Hall of Thanes", "zone": "dunmorogh", "x": 764.5, "y": 478.8},
    {"name": "Ruins of Lordaeron", "zone": "tirisfal", "x": 707.9, "y": 185.8},
    {"name": "Excavation Site", "zone": "wetlands", "x": 796.8, "y": 385.8},
    {"name": "City of Dalaran", "zone": "hillsbrad", "x": 742.4, "y": 219.6},
    {"name": "The Drowned City", "zone": "stv", "x": 701.4, "y": 803.5},
    {"name": "Alcaz Prison", "zone": "dustwallow", "x": 394.3, "y": 579.1},
    {"name": "Blackmaw Hold", "zone": "azshara", "x": 405.7, "y": 384.4},
    {"name": "Shaper's Terrace", "zone": "ungoro", "x": 261.2, "y": 701.1},
    {"name": "The Barrow Deeps", "zone": "hyjal", "x": 302.5, "y": 335.8},
    {"name": "Hyjal Summit", "zone": "hyjal", "x": 333.1, "y": 277.7},
    {"name": "Krol'dok Stronghold", "zone": "riverglades", "x": 922.7, "y": 613.7},
]

SOURCE_NOTE = ("Zone outlines traced from WoW: Forever's continent maps, laid into the frame of Wikimedia Commons "
               "Kalimdor_english.svg / Eastern_Kingdoms.svg")

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
  return { paths };
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
            g = unary_union([p for p in parts(g) if p.centroid.x > MOONGLADE_MIN_X])
        zones.append({"id": zid, "name": name, "cont": cont, "kind": kind, "geom": g})
    return zones


# ---------------------------------------------------------------- 3. helpers

def parts(g):
    return list(g.geoms) if hasattr(g, "geoms") else [g]


def rough(points, seed):
    """The closed outline with a point every ROUGH_STEP px, moved sideways by smooth deterministic noise."""
    out = []
    for i, (xa, ya) in enumerate(points):
        xb, yb = points[(i + 1) % len(points)]
        length = math.hypot(xb - xa, yb - ya)
        n = max(1, round(length / ROUGH_STEP))
        nx, ny = (ya - yb) / length, (xb - xa) / length
        for k in range(n):
            t = len(out) + seed * 97
            off = ROUGH_AMP * (0.6 * math.sin(t * 0.9) + 0.4 * math.sin(t * 2.3 + 1.7))
            out.append((xa + (xb - xa) * k / n + nx * off, ya + (yb - ya) * k / n + ny * off))
    return Polygon(out).buffer(0)


def inset_zones():
    """EXTRA_ZONES in world px: {id: geometry}."""
    return {z["id"]: rough(z["points"], i) for i, z in enumerate(EXTRA_ZONES)}


# ---------------------------------------------------------------- 4. Forever's continent maps

READ_JS = """
async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
  return [c.width, c.height, btoa(s)];
}
"""


def read_image(page, path: Path):
    """The image's pixels (h x w x 3, float), decoded by the browser: no image library needed."""
    page.set_content("<html><body></body></html>")
    w, h, b = page.evaluate(READ_JS, "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode())
    return np.frombuffer(base64.b64decode(b), np.uint8).reshape(h, w, 4)[:, :, :3].astype(np.float32)


def shift(m, dy, dx):
    out = np.zeros_like(m)
    h, w = m.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r:
                out |= shift(m, dy, dx)
    return out


def erode(m, r):
    return ~dilate(~m, r)


def components(mask):
    """4-connected components of mask: (label image, 0 = background; sizes, index = label)."""
    h, w = mask.shape
    lab = np.zeros(mask.shape, np.int32)
    sizes = [0]
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n = len(sizes)
        lab[y0, x0] = n
        q, size = deque([(y0, x0)]), 0
        while q:
            y, x = q.popleft()
            size += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    q.append((ny, nx))
        sizes.append(size)
    return lab, np.array(sizes)


def land_mask(rgb, c):
    """Land on Forever's map of continent c: the painted land is saturated, the sea greyish blue. Saturated specks and
    hatching on the sea are opened away; the land is the continent (LAND_SEED's piece) and the islands near it that
    don't touch the frame; holes in it are land except their light grey water (lakes)."""
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    h, w = sat.shape
    x0, y0, x1, y1 = LAND_BOX[c]
    inside = np.zeros((h, w), bool)
    inside[y0:y1, x0:x1] = True
    ys, xs = np.mgrid[0:h, 0:w]
    for line in SEA_CUTS[c]:
        inside &= ~shapely.contains_xy(LineString(line).buffer(1.6), xs + 0.5, ys + 0.5)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    land = dilate(erode(((sat > LAND_SAT) | ((g >= r) & (g > GREEN * b))) & inside, 2), 2) & inside
    lab, sizes = components(land)
    main = lab[LAND_SEED[c][1], LAND_SEED[c][0]]
    edge = set(np.unique(np.concatenate([lab[y0], lab[y1 - 1], lab[:, x0], lab[:, x1 - 1]])))
    near = dilate(lab == main, NEAR_LAND)
    keep = [main] + [i for i in range(1, len(sizes)) if i != main and i not in edge and sizes[i] >= MIN_LAND_PX
                     and (near & (lab == i)).any()]
    land = erode(dilate(np.isin(lab, keep), 2), 2)
    sea, _ = components(~land)
    holes = ~land & (sea != sea[y0 + 1, x0 + 1])
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    water = dilate(erode(holes & (sat < LAKE_SAT) & (lum > LAKE_LUM), 1), 1)
    lakes, sizes = components(water)
    return land | (holes & ~np.isin(lakes, [i for i in range(1, len(sizes)) if sizes[i] >= MIN_LAND_PX]))


def raster_poly(mask, f=1):
    """The pixels of mask as a polygon in image px (pixel i spans [i, i + 1)); f > 1: mask is upsampled f times."""
    boxes = []
    for y in np.nonzero(mask.any(1))[0]:
        d = np.diff(np.concatenate([[0], mask[y].astype(np.int8), [0]]))
        for a, b in zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]):
            boxes.append((a, y, b, y + 1))
    if not boxes:
        return Polygon()
    b = np.array(boxes, float) / f
    return shapely.union_all(shapely.box(b[:, 0], b[:, 1], b[:, 2], b[:, 3])).buffer(0)


def apply(g, m):
    """g moved by the affine m (2 x 3: x' = m00 x + m01 y + m02, y' = m10 x + m11 y + m12)."""
    return affinity.affine_transform(g, [m[0, 0], m[0, 1], m[1, 0], m[1, 1], m[0, 2], m[1, 2]])


def grow(cost, land, seeds):
    """Every land pixel gets the label of the seed nearest to it, measured along the land with cost per pixel (Dijkstra):
    the border lines are dark, so expensive to cross, and the zones meet on them. Land no seed reaches (islands) gets
    the nearest label, through the sea."""
    h, w = land.shape
    lab = seeds.copy()
    dist = np.where(seeds > 0, 0.0, np.inf)
    heap = [(0.0, y, x) for y, x in zip(*np.nonzero(seeds))]
    nb = [(dy, dx, math.hypot(dy, dx)) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
    while heap:
        d, y, x = heapq.heappop(heap)
        if d > dist[y, x]:
            continue
        for dy, dx, step in nb:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and land[ny, nx]:
                nd = d + step * (cost[y, x] + cost[ny, nx]) / 2
                if nd < dist[ny, nx]:
                    dist[ny, nx], lab[ny, nx] = nd, lab[y, x]
                    heapq.heappush(heap, (nd, ny, nx))
    q = deque(zip(*np.nonzero(lab)))
    near = lab.copy()
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not near[ny, nx]:
                near[ny, nx] = near[y, x]
                q.append((ny, nx))
    return np.where(land, near, 0)


def blur(a):
    for _ in range(2):
        a = (shift(a, 0, -1) + 2 * a + shift(a, 0, 1)) / 4
        a = (shift(a, -1, 0) + 2 * a + shift(a, 1, 0)) / 4
    return a


def upsample(a, f):
    """a bilinearly resampled to f times its size (pixel centres kept)."""
    h, w = a.shape
    def axis(n):
        t = (np.arange(n * f) + 0.5) / f - 0.5
        i = np.clip(np.floor(t).astype(int), 0, n - 2)
        return i, np.clip(t - i, 0, 1)
    yi, ty = axis(h)
    xi, tx = axis(w)
    rows = a[yi] * (1 - ty)[:, None] + a[yi + 1] * ty[:, None]
    return rows[:, xi] * (1 - tx) + rows[:, xi + 1] * tx


def trace_continent(rgb, c):
    """The zones of continent c traced from Forever's map rgb, in image px (pixel i spans [i, i + 1)): {id: geometry}."""
    land = land_mask(rgb, c)
    h, w = land.shape
    ids = [k for k, (cont, _) in zone_specs().items() if cont == c and k in SEEDS] +           [k for k, cont in UNDRAWN.items() if cont == c]
    seeds = np.zeros((h, w), np.int32)
    for i, k in enumerate(ids, 1):
        for x, y in SEEDS[k]:
            if not land[y, x]:
                raise SystemExit(f"{k}: seed ({x}, {y}) is not on land")
            seeds[max(0, y - 2):y + 3, max(0, x - 2):x + 3] = i
    seeds[~land] = 0
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    cost = np.exp((LINE_LUM - lum) / LINE_SOFT)
    letters = dilate(erode(lum < LETTER_LUM, 1), 2)
    for bx0, by0, bx1, by1 in TEXT_BOXES[c]:
        box = (slice(by0, by1), slice(bx0, bx1))
        cost[box] = np.where(letters[box], 1, cost[box])
    labels = grow(cost, land, seeds)

    # smooth the borders: the argmax of the blurred, upsampled one-hot maps, in a crop around the land
    rows, cols = np.nonzero(land.any(1))[0], np.nonzero(land.any(0))[0]
    y0, y1, x0, x1 = max(0, rows[0] - 3), min(h, rows[-1] + 4), max(0, cols[0] - 3), min(w, cols[-1] + 4)
    crop = labels[y0:y1, x0:x1]
    best = upsample(blur((crop == 0).astype(np.float32)), UPSAMPLE)
    arg = np.zeros(best.shape, np.int32)
    for i in range(1, len(ids) + 1):
        p = upsample(blur((crop == i).astype(np.float32)), UPSAMPLE)
        better = p > best
        arg[better], best[better] = i, p[better]
    return {k: affinity.translate(raster_poly(arg == i, UPSAMPLE), x0, y0) for i, k in enumerate(ids, 1)
            if k not in UNDRAWN}


def fit_forever_maps(images, svg):
    """The zones traced from Forever's maps (images: {"K"/"E": rgb}) in world px: each continent is laid over the SVG
    zones (svg: {id: geometry in world px}) by the affine that best maps the traced zones' centroids onto theirs."""
    out = {}
    for c, rgb in images.items():
        print(f"tracing {c} …")
        traced = trace_continent(rgb, c)
        shared = [k for k in traced if k in svg and not traced[k].is_empty and zone_specs()[k][1] == "zone"]
        src = np.array([[traced[k].centroid.x, traced[k].centroid.y, 1] for k in shared])
        dst = np.array([[svg[k].centroid.x, svg[k].centroid.y] for k in shared])
        wts = np.sqrt([svg[k].area for k in shared])[:, None]
        m = np.linalg.lstsq(src * wts, dst * wts, rcond=None)[0].T
        err = np.hypot(*(src @ m.T - dst).T)
        print(f"  fit on {len(shared)} zones: median centroid error {np.median(err):.1f} px, worst "
              f"{shared[int(np.argmax(err))]} {err.max():.1f} px")
        out.update({k: apply(g, m) for k, g in traced.items()})
    return out


# ---------------------------------------------------------------- 5. simplify, label

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


def zone_entry(z, g):
    """The zones.json entry of zone z ({id, name, cont, kind}) with its simplified geometry g."""
    lp = polylabel(max(parts(g), key=lambda p: p.area), 0.5)
    lx, ly = LABEL_OVERRIDES.get(z["id"], (round(lp.x, 1), round(lp.y, 1)))
    area = round(g.area)
    return {
        "id": z["id"], "name": z["name"], "cont": z["cont"], "kind": z["kind"],
        "d": geom_d(g), "lx": lx, "ly": ly, "area": area,
        "lines": LINES.get(z["id"], [z["name"]]),
        "size": 11 if area > 7000 else (10 if area > 3500 else 9),
    }


def zone_specs():
    """{id: (continent, kind)} of every zone the map can draw, in output order."""
    specs = {zid: ("K", kind) for zid, _, kind, _ in KALIMDOR}
    specs.update({zid: ("E", kind) for zid, _, kind, _ in EASTERN_KINGDOMS})
    specs.update({zid: (cont, kind) for zid, _, cont, kind in NEW_ZONES})
    specs.update({z["id"]: (z["cont"], "zone") for z in EXTRA_ZONES})
    return specs


def zone_names():
    return {zid: name for zid, name, *_ in KALIMDOR + EASTERN_KINGDOMS + NEW_ZONES} | {z["id"]: z["name"] for z in EXTRA_ZONES}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ek", type=Path, help="Eastern_Kingdoms.svg")
    ap.add_argument("--kal", type=Path, help="Kalimdor_english.svg")
    ap.add_argument("--forever-maps", type=Path, help="folder with Forever's continent maps (README)")
    ap.add_argument("--out", default=Path("zones.json"), type=Path)
    ap.add_argument("--dungeons-only", action="store_true", help="only rewrite the dungeons of an existing --out file")
    args = ap.parse_args()

    if args.dungeons_only:
        text = args.out.read_text(encoding="utf-8")
        data = json.loads(text)
        old = json.dumps(data["dungeons"], separators=(",", ":"))
        if text.count(old) != 1:
            raise SystemExit(f"{args.out}: dungeons list not found as written by this script")
        args.out.write_text(text.replace(old, json.dumps(DUNGEONS, separators=(",", ":"))), encoding="utf-8")
        print(f"wrote {args.out} · {len(DUNGEONS)} dungeons")
        return
    if not args.ek or not args.kal or not args.forever_maps:
        ap.error("--ek, --kal and --forever-maps are required for a full build")

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page()
        print("sampling Kalimdor …")
        kal = sample_svg(page, args.kal)
        print("sampling Eastern Kingdoms …")
        ek = sample_svg(page, args.ek)
        images = {c: read_image(page, args.forever_maps / f) for c, f in FOREVER_MAPS.items()}
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

    placed = fit_forever_maps(images, {z["id"]: place(z["geom"], z["cont"]) for z in zones})
    placed.update(inset_zones())
    names = zone_names()
    zones = [{"id": k, "name": names[k], "cont": c, "kind": kind} for k, (c, kind) in zone_specs().items()
             if k in placed and not placed[k].is_empty]
    dropped = [k for k in zone_specs() if k not in {z["id"] for z in zones}]
    if dropped:
        print(f"not on Forever's maps, dropped: {', '.join(dropped)}")
    out_zones = [zone_entry(z, placed[z["id"]].simplify(SIMPLIFY, preserve_topology=True)) for z in zones]

    coast = {}
    for c in "KE":
        u = unary_union([placed[z["id"]] for z in zones if z["cont"] == c])
        coast[c] = geom_d(u.buffer(0.8).buffer(-0.8).simplify(0.5))

    cities = [{"name": name, "cap": cap, "x": x, "y": y} for name, x, y, cap in CITIES]

    data = {"v": 1, "width": WORLD_W, "height": WORLD_H, "source": SOURCE_NOTE,
            "zones": out_zones, "coast": coast, "cities": cities, "dungeons": DUNGEONS}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {args.out} · {len(out_zones)} zones · {args.out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
