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
    python tools/map/build_zones.py --dungeons-only --out src/core/map/zones.json
    python tools/map/build_zones.py --forever-only --out src/core/map/zones.json

--dungeons-only rewrites only the "dungeons" list of an existing zones.json and keeps everything else byte for byte:
a full rebuild moves outline points and city positions by fractions of a pixel (browser sampling and text measurement),
which would rewrite every path for a change that only adds dungeons.
--forever-only applies the WoW: Forever changes (dry Thousand Needles, EXTRA_ZONES, the zone kinds) and the dungeons to
an existing zones.json: only the zones they touch and the coastline rings next to them are rewritten.

How it works:
    1. A headless browser renders each SVG and samples every path outline (getPointAtLength), so curves,
       transforms and compound paths are handled exactly as the SVG draws them.
    2. Paths are grouped by fill colour; each colour is one zone (islands included). Holes (lakes)
       are detected with the even-odd rule.
    3. Zones are merged/renamed for Vanilla, both continents are scaled to the same height and
       placed side by side.
    4. WoW: Forever (forever()): Thousand Needles is dried and the EXTRA_ZONES are added; then outlines are
       simplified and label points are found with polylabel.

To change the map, edit COLOURS / LINES / LABEL_OVERRIDES / CITIES / EXTRA_ZONES below and run it again.
"""
import argparse
import json
import math
import re
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
SLIVER = 10                     # px²: --forever-only drops new coastline holes smaller than this

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
    ("uldum",       "Uldum",                 "terrain", ["#7D5AA6"]),
]
MOONGLADE_MIN_X = 200   # source units: separates Moonglade from Bloodmyst Isle (same colour)

EASTERN_KINGDOMS = [
    ("tirisfal",    "Tirisfal Glades",       "zone",    ["#7E499D"]),
    ("wpl",         "Western Plaguelands",   "zone",    ["#5582B0"]),
    ("epl",         "Eastern Plaguelands",   "zone",    ["#7E92B7"]),
    ("silverpine",  "Silverpine Forest",     "zone",    ["#B72467"]),
    ("hillsbrad",   "Hillsbrad Foothills",   "zone",    ["#F05A94"]),   # includes Alterac Mountains: the source has no shape of its own
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
    "riverglades": ["The", "Riverglades"], "zephras": ["Zephras", "Isle"],
}

# hand-placed label / marker anchor points in world px (to avoid capitals and keep room for markers)
LABEL_OVERRIDES = {
    "teldrassil": (195, 114), "tirisfal": (668, 152), "mulgore": (246, 572), "elwynn": (724, 656), "stv": (772, 800),
    "durotar": (382, 488), "barrens": (306, 512), "hillsbrad": (728, 282), "stonetalon": (180, 452), "westfall": (656, 726),
    "epl": (882, 152),
}

# WoW: Forever (WEB-31, docs/WOW-FOREVER.md "Zones"). The source SVGs are Cataclysm-era; these make the map Forever's.
# Thousand Needles: the source floods it (a sea inlet cut out of the zone, the mesas as islands); in classic it is dry
# canyon. The zone is filled up to its convex hull (grown by 4 px) minus its neighbours, the inlet's mouth closed along this line (world
# px, north to south, following the coast on either side of the mouth).
NEEDLES_EAST_COAST = [(393.6, 655), (392.6, 668), (391.4, 676), (388.8, 681), (389.4, 686), (392.4, 690), (394.6, 700),
                      (395.2, 730)]

# New zones the source SVGs have no shape for: outlines in world px, placed by hand (Claude, approved by Nico 2026-10-25)
# and roughened like the source coastlines (rough()). A zone is its outline minus the other zones of its continent,
# except those it "carves", which lose the outline instead. Locations: docs/WOW-FOREVER.md, all unverified.
EXTRA_ZONES = [
    # East coast of the Eastern Kingdoms between Burning Steppes, Redridge, Swamp of Sorrows and Badlands, about the size
    # of Stranglethorn Vale; land the classic map never had, so new coast (lfcarry, wowguide.net).
    {"id": "riverglades", "name": "The Riverglades", "cont": "E", "carves": [], "points": [
        (858, 590), (880, 582), (905, 580), (916, 571), (926, 566), (934, 558), (942, 561), (949, 568), (957, 571),
        (961, 580), (966, 590), (974, 596), (978, 606), (973, 613), (980, 622), (986, 633), (982, 641), (977, 652),
        (969, 657), (964, 667), (957, 676), (949, 683), (940, 686), (931, 683), (921, 680), (911, 679), (898, 677),
        (886, 671), (876, 652), (862, 615)]},
    # South-east of Desolace between Feralas and Mulgore, entered through the Valley of Bones, where retail's Lake Dumont
    # is (warcraft.wiki.gg "Shen'dralas", lfcarry): carved from northern Feralas, the lake filled.
    {"id": "shendralas", "name": "Shen'dralas", "cont": "K", "carves": ["feralas"], "points": [
        (150, 571), (178, 568), (207, 569), (210, 585), (208, 604), (190, 612), (168, 610), (152, 600), (146, 586)]},
    # In Skywall, the elemental plane of air, not on Azeroth (warcraft.wiki.gg "Zephras Isle"): an inset island in the
    # open sea between the continents, south of the Maelstrom (the map's compass rose takes the gap's north end).
    {"id": "zephras", "name": "Zephras Isle", "cont": "K", "carves": [], "points": [
        (492, 783), (502, 773), (518, 769), (534, 772), (546, 781), (548, 793), (540, 804), (524, 810), (507, 808),
        (495, 799)]},
]
ROUGH_STEP = 2.5     # px between the points rough() adds
ROUGH_AMP = 1.2      # px: how far rough() moves them sideways

# cities: (name, continent, label text in the source SVG, capital?) — position taken from that label
CITIES = [
    ("Orgrimmar", "K", "Orgrimmar", 1), ("Thunder Bluff", "K", "Thunder Bluff", 1), ("Darnassus", "K", "Darnassus", 1),
    ("Crossroads", "K", "The Crossroads", 0), ("Ratchet", "K", "Ratchet", 0), ("Gadgetzan", "K", "Gadgetzan", 0),
    ("Everlook", "K", "Everlook", 0), ("Theramore", "K", "Theramore", 0), ("Astranaar", "K", "Astranaar", 0),
    ("Undercity", "E", "Undercity", 1), ("Ironforge", "E", "Ironforge", 1), ("Stormwind", "E", "Stormwind", 1),
    ("Booty Bay", "E", "Booty Bay", 0), ("Stratholme", "E", "Stratholme", 0), ("Karazhan", "E", "Karazhan", 0),
]
CITY_OVERRIDES = {"Darnassus": (148, 146)}   # world px; the source label sits off the island

# Dungeons and raids (WEB-13, docs/WOW-FOREVER.md): marker positions in world px, placed by hand inside the zone. Where the source
# SVG marks the entrance with a dot (Uldaman, Gnomeregan, Blackrock Mountain, Zul'Farrak, Dire Maul, Maraudon,
# Stratholme) the marker sits on that dot, the Blackrock Mountain instances around it; Zul'Gurub sits by its label;
# the rest are placed where the entrance is in the game. Names match src/core/gamedata/dungeons.ts.
DUNGEONS = [
    {"name": "The Deadmines", "zone": "westfall", "x": 648, "y": 742},
    {"name": "Ragefire Chasm", "zone": "durotar", "x": 386, "y": 428},
    {"name": "Wailing Caverns", "zone": "barrens", "x": 296, "y": 500},
    {"name": "Shadowfang Keep", "zone": "silverpine", "x": 668, "y": 272},
    {"name": "Blackfathom Deeps", "zone": "ashenvale", "x": 196, "y": 362},
    {"name": "The Stockade", "zone": "elwynn", "x": 699, "y": 633},
    {"name": "Gnomeregan", "zone": "dunmorogh", "x": 684.9, "y": 477.4},
    {"name": "Razorfen Kraul", "zone": "barrens", "x": 285, "y": 610},
    {"name": "Scarlet Monastery", "zone": "tirisfal", "x": 752, "y": 140},
    {"name": "Razorfen Downs", "zone": "barrens", "x": 305, "y": 650},
    {"name": "Uldaman", "zone": "badlands", "x": 855.6, "y": 522},
    {"name": "Zul'Farrak", "zone": "tanaris", "x": 317.4, "y": 699},
    {"name": "Maraudon", "zone": "desolace", "x": 122.9, "y": 525.2},
    {"name": "Sunken Temple", "zone": "swamp", "x": 870, "y": 700},
    {"name": "Blackrock Depths", "zone": "burning", "x": 767.4, "y": 582.4},
    {"name": "Blackrock Spire", "zone": "burning", "x": 773, "y": 579},
    {"name": "Dire Maul", "zone": "feralas", "x": 186.3, "y": 614.1},
    {"name": "Scholomance", "zone": "wpl", "x": 828, "y": 206},
    {"name": "Stratholme", "zone": "epl", "x": 862.7, "y": 103.9},
    {"name": "Onyxia's Lair", "zone": "dustwallow", "x": 350, "y": 655},
    # WoW: Forever's new dungeons and raids (docs/WOW-FOREVER.md). Placed by Blizzard's location text: beneath Ironforge,
    # above the Undercity, western Wetlands, Alterac Mountains, the islet off Stranglethorn's west coast, Alcaz Island,
    # Azshara (no exact spot published), northern Un'Goro, Mount Hyjal (Hyjal Summit by the source's Nordrassil label),
    # The Riverglades (no exact spot published).
    {"name": "Hall of Thanes", "zone": "dunmorogh", "x": 752, "y": 476},
    {"name": "Ruins of Lordaeron", "zone": "tirisfal", "x": 711, "y": 184},
    {"name": "Excavation Site", "zone": "wetlands", "x": 780, "y": 392},
    {"name": "City of Dalaran", "zone": "hillsbrad", "x": 736, "y": 236},
    {"name": "The Drowned City", "zone": "stv", "x": 679.5, "y": 773.5},
    {"name": "Alcaz Prison", "zone": "dustwallow", "x": 394, "y": 575},
    {"name": "Blackmaw Hold", "zone": "azshara", "x": 420, "y": 380},
    {"name": "Shaper's Terrace", "zone": "ungoro", "x": 270, "y": 700},
    {"name": "The Barrow Deeps", "zone": "hyjal", "x": 310, "y": 345},
    {"name": "Hyjal Summit", "zone": "hyjal", "x": 340, "y": 288},
    {"name": "Krol'dok Stronghold", "zone": "riverglades", "x": 940, "y": 645},
]

SOURCE_NOTE = ("Wikimedia Commons Kalimdor_english.svg / Eastern_Kingdoms.svg (zone outlines), "
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
            g = unary_union([p for p in parts(g) if p.centroid.x > MOONGLADE_MIN_X])
        zones.append({"id": zid, "name": name, "cont": cont, "kind": kind, "geom": g})
    return zones


# ---------------------------------------------------------------- 3. WoW: Forever (world px)

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


def forever(geoms, conts):
    """Dry Thousand Needles and add EXTRA_ZONES. geoms (zone id -> geometry in world px) and conts (id -> "K"/"E") are
    changed in place. Returns the ids of the zones it changed and of those that grew (the others only lost land)."""
    def others(cont, skip):
        return unary_union([g for k, g in geoms.items() if conts[k] == cont and k not in skip])

    needles, rest = geoms["needles"], others("K", {"needles"})
    west = Polygon([(0, 0), (NEEDLES_EAST_COAST[0][0], 0), *NEEDLES_EAST_COAST, (NEEDLES_EAST_COAST[-1][0], WORLD_H),
                    (0, WORLD_H)])
    filled = unary_union([needles, needles.buffer(4).convex_hull.intersection(west)]).difference(rest)
    geoms["needles"] = Polygon(max(parts(filled), key=lambda p: p.area).exterior).difference(rest)
    changed, grown = ["needles"], ["needles"]

    for i, z in enumerate(EXTRA_ZONES):
        conts[z["id"]] = z["cont"]
        geoms[z["id"]] = rough(z["points"], i).difference(others(z["cont"], {z["id"], *z["carves"]}))
        for c in z["carves"]:
            geoms[c] = geoms[c].difference(geoms[z["id"]])
        changed += [z["id"], *z["carves"]]
        grown.append(z["id"])
    return changed, grown


# ---------------------------------------------------------------- 4. place, simplify, label

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


def parse_d(d):
    """A geometry from a "M x,y x,y …Z" path as geom_d writes it (even-odd)."""
    g = Polygon()
    for ring in re.findall(r"M([^Z]*)Z", d):
        g = g.symmetric_difference(Polygon([tuple(map(float, p.split(","))) for p in ring.split(" ")]).buffer(0))
    return g


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


def extra_specs():
    return [{"id": e["id"], "name": e["name"], "cont": e["cont"], "kind": "zone"} for e in EXTRA_ZONES]


def forever_only(path):
    """Apply forever(), the zone kinds and DUNGEONS to an existing zones.json. Zones forever() does not change keep their
    entry byte for byte, coastline rings it does not touch keep their text."""
    data = json.loads(path.read_text(encoding="utf-8"))
    kinds = {zid: kind for zid, _, kind, _ in KALIMDOR + EASTERN_KINGDOMS}
    for z in data["zones"]:
        z["kind"] = kinds.get(z["id"], z["kind"])
    geoms = {z["id"]: parse_d(z["d"]) for z in data["zones"]}
    conts = {z["id"]: z["cont"] for z in data["zones"]}
    changed, grown = forever(geoms, conts)

    specs = {z["id"]: z for z in data["zones"] + extra_specs()}
    entries = {zid: zone_entry(specs[zid], geoms[zid].simplify(SIMPLIFY, preserve_topology=True)) for zid in changed}
    data["zones"] = [entries.pop(z["id"], z) for z in data["zones"]] + [entries[z["id"]] for z in extra_specs() if z["id"] in entries]

    for c in "KE":
        old = data["coast"][c]
        land = unary_union([g for zid, g in geoms.items() if conts[zid] == c])
        added = unary_union([geoms[zid] for zid in grown if conts[zid] == c])
        # the new land grown a little over the old land, to close seams with the old coastline, not out to sea
        coast = unary_union([parse_d(old), added, added.buffer(0.8).intersection(land)])
        keep = {r: i for i, r in enumerate(re.findall(r"M[^Z]*Z", old))}
        kept, new = set(), []
        for p in parts(coast):
            if p.area < MIN_AREA:
                continue
            for ring in [p.exterior, *p.interiors]:
                d = ring_d(ring.coords)
                same = next((r for r in keep if set(r[1:-1].split(" ")) == set(d[1:-1].split(" "))), None)
                if same:
                    kept.add(same)
                elif ring is p.exterior or Polygon(ring).area > SLIVER:   # seams between old coast and new land
                    new.append(d)
        data["coast"][c] = "".join(sorted(kept, key=keep.get)) + "".join(new)

    data["dungeons"] = DUNGEONS
    path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {path} · changed {', '.join(changed)} · {len(data['zones'])} zones")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ek", type=Path, help="Eastern_Kingdoms.svg")
    ap.add_argument("--kal", type=Path, help="Kalimdor_english.svg")
    ap.add_argument("--out", default=Path("zones.json"), type=Path)
    ap.add_argument("--dungeons-only", action="store_true", help="only rewrite the dungeons of an existing --out file")
    ap.add_argument("--forever-only", action="store_true", help="only apply the Forever changes to an existing --out file")
    args = ap.parse_args()

    if args.forever_only:
        forever_only(args.out)
        return
    if args.dungeons_only:
        text = args.out.read_text(encoding="utf-8")
        data = json.loads(text)
        old = json.dumps(data["dungeons"], separators=(",", ":"))
        if text.count(old) != 1:
            raise SystemExit(f"{args.out}: dungeons list not found as written by this script")
        args.out.write_text(text.replace(old, json.dumps(DUNGEONS, separators=(",", ":"))), encoding="utf-8")
        print(f"wrote {args.out} · {len(DUNGEONS)} dungeons")
        return
    if not args.ek or not args.kal:
        ap.error("--ek and --kal are required for a full build")

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

    placed = {z["id"]: place(z["geom"], z["cont"]) for z in zones}
    forever(placed, {z["id"]: z["cont"] for z in zones})
    zones += extra_specs()
    out_zones = [zone_entry(z, placed[z["id"]].simplify(SIMPLIFY, preserve_topology=True)) for z in zones]

    coast = {}
    for c in "KE":
        u = unary_union([placed[z["id"]] for z in zones if z["cont"] == c])
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
