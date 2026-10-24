"""Convert the premium-region and neighbouring-country maps to WGS84 for the 3D map.

Reads the generated SVG maps (regions-map.json, neighbors-map.json) and the API's
municipality lookup, whose LV95 bounds give back the exact SVG projection. Nothing is
downloaded: the 150 m shared-border simplification of the SVG map is kept as is.
Generation dependencies only: shapely (>=2.1), pyproj, as for health-geo-build.py:
  python scripts/health-region-geo.py
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import re
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(tempfile.gettempdir()) / "coverview-health-geo-python"))
from pyproj import Transformer  # noqa: E402
from shapely import (  # noqa: E402
    line_merge,
    make_valid,
    symmetric_difference_all,
    union_all,
    voronoi_polygons,
)
from shapely.geometry import MultiPoint, Point, Polygon, box  # noqa: E402
from shapely.geometry.polygon import orient  # noqa: E402
from shapely.ops import transform  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data/health-insurance/2027"
REGIONS = DATA / "regions-map.json"
NEIGHBORS = DATA / "neighbors-map.json"
LOOKUP = ROOT / "apps/api/src/modules/health-insurance/health.geo.json"
OUTPUT = DATA / "regions-geo.json"

regions_bytes = REGIONS.read_bytes()
neighbors_bytes = NEIGHBORS.read_bytes()
regions_map = json.loads(regions_bytes)
neighbors_map = json.loads(neighbors_bytes)
lookup = json.loads(LOOKUP.read_bytes())

# Same projection as both generators: the Swiss union's LV95 bounds fitted in 1000 x 650
# with 24 px of padding.
bounds = [item["bounds"] for item in lookup["municipalities"]]
minx = min(b[0] for b in bounds)
miny = min(b[1] for b in bounds)
maxx = max(b[2] for b in bounds)
maxy = max(b[3] for b in bounds)
scale = min(952 / (maxx - minx), 602 / (maxy - miny))
ox = (1000 - (maxx - minx) * scale) / 2
oy = (650 - (maxy - miny) * scale) / 2
to_wgs84 = Transformer.from_crs(2056, 4326, always_xy=True).transform
to_lv95 = Transformer.from_crs(4326, 2056, always_xy=True).transform


def lv95(x: float, y: float) -> tuple[float, float]:
    return minx + (x - ox) / scale, maxy - (y - oy) / scale


def rings(path: str) -> list[list[tuple[float, float]]]:
    result = []
    for chunk in re.findall(r"M([^MZ]+)Z?", path):
        points = [lv95(*map(float, pair.split(","))) for pair in chunk.split("L")]
        if len(points) >= 3:
            result.append(points)
    return result


def area(path: str):
    # Even-odd fill: each ring toggles inside and outside, which a symmetric difference
    # of the rings reproduces whatever their nesting.
    shapes = [make_valid(Polygon(ring)) for ring in rings(path)]
    return make_valid(symmetric_difference_all(shapes))


def polygons(geometry) -> list[Polygon]:
    if geometry.geom_type == "Polygon":
        return [geometry]
    return [g for part in getattr(geometry, "geoms", []) for g in polygons(part)]


def wgs84(geometry) -> dict:
    parts = []
    for polygon in polygons(geometry):
        if polygon.area < 1:
            continue
        polygon = orient(polygon, sign=1.0)
        parts.append(
            [
                [[round(c, 4) for c in to_wgs84(x, y)] for x, y in ring.coords]
                for ring in [polygon.exterior, *polygon.interiors]
            ]
        )
    return {"type": "MultiPolygon", "coordinates": parts}


def lines(geometry) -> dict:
    parts = [g for g in getattr(geometry, "geoms", [geometry]) if g.geom_type == "LineString"]
    merged = line_merge(union_all(parts)) if parts else geometry
    return {
        "type": "MultiLineString",
        "coordinates": [
            [[round(c, 4) for c in to_wgs84(x, y)] for x, y in line.coords]
            for line in getattr(merged, "geoms", [merged])
            if line.geom_type == "LineString" and line.length > 1
        ],
    }


def lonlat(point: list[float]) -> list[float]:
    return [round(c, 4) for c in to_wgs84(*lv95(point[0], point[1]))]


regions = [(item, area(item["path"])) for item in regions_map["regions"]]
if len(regions) != 42 or not all(geom.is_valid and not geom.is_empty for _, geom in regions):
    raise ValueError("Expected 42 valid premium regions")
swiss = union_all([geom for _, geom in regions])

# The large lakes belong to no municipality (Neuchâtel, Zurich, Thun…): holes in the
# regions, filled in Switzerland's outline. Only the foreign enclaves stay holes:
# Büsingen am Hochrhein (DE) and Campione d'Italia (IT).
enclaves = [Point(*to_lv95(8.6911, 47.6969)), Point(*to_lv95(8.9711, 45.9686))]
kept = []
outlines = []
for polygon in polygons(swiss):
    holes = [ring for ring in polygon.interiors if any(Polygon(ring).contains(p) for p in enclaves)]
    kept += holes
    outlines.append(Polygon(polygon.exterior, holes))
if len(kept) != len(enclaves):
    raise ValueError(f"Expected {len(enclaves)} foreign enclaves, found {len(kept)}")
switzerland = union_all(outlines)
shores = switzerland.difference(swiss).boundary.buffer(1)

# Each border drawn once, by rank: the borders between cantons, then those between regions
# of one canton, never along a lake shore. The national border is Switzerland's own
# polygon, which also raises the relief and keeps the ground's labels inside.
national = switzerland.boundary
cantons: dict[str, list] = {}
for item, geometry in regions:
    cantons.setdefault(item["canton"], []).append(geometry)
canton_lines = union_all([union_all(parts).boundary for parts in cantons.values()])
region_lines = union_all([geometry.boundary for _, geometry in regions])
borders = [
    ("canton", canton_lines.difference(national.buffer(1)).difference(shores)),
    ("region", region_lines.difference(canton_lines.buffer(1)).difference(shores)),
]

# Neighbours as plain shapes (user request, 24 October 2026: « juste une forme géométrique
# basique de couleur uniforme légèrement espacé de la suisse »): the 1:3 million outline
# simplified and rounded over 3 km, kept 4 km from Switzerland and 2 km from each other.
# Liechtenstein, not selectable, only keeps Austria away; it is not drawn.
claimed = switzerland.buffer(4000)
shapes = []
for item in sorted(neighbors_map["regions"], key=lambda x: x["country"] != "LI"):
    shape = area(item["path"]).simplify(1500).buffer(3000, quad_segs=4)
    shape = shape.buffer(-6000, quad_segs=4).buffer(3000, quad_segs=4)
    geometry = make_valid(shape.difference(claimed))
    claimed = union_all([claimed, geometry.buffer(2000)])
    shapes.append((item, geometry))

# The world the map can show, in degrees: the ground of every map tile that reaches it.
world = box(-10, 35, 30, 60)
# Then each neighbour grows to the world's edge, so that no background shows at the canvas'
# ends (user request, 24 October 2026: « Agrandit les zones limitrophes pour qu'elle couvre
# tout le canvas »): every place beyond the outlines, sea and other countries, goes to the
# nearest neighbour. The Voronoi cells of points every 500 m along each outline give the
# places nearest to it; their union reaches the middle of each gap, 1 km back restores the
# 2 km between neighbours.
sites: dict[tuple[float, float], int] = {}
for index, (_, geometry) in enumerate(shapes):
    for polygon in polygons(geometry):
        for ring in [polygon.exterior, *polygon.interiors]:
            for point in ring.segmentize(500).coords[:-1]:
                sites.setdefault(point, index)
reach = transform(to_lv95, world.segmentize(0.25))
cells = voronoi_polygons(MultiPoint(list(sites)), extend_to=reach, ordered=True).geoms
if len(cells) != len(sites):
    raise ValueError(f"Expected {len(sites)} Voronoi cells, found {len(cells)}")
apart = switzerland.buffer(4000)
countries = []
for index, (item, _) in enumerate(shapes):
    if item["country"] == "LI":
        continue
    # Points in a straight line give thin cells, hundreds of kilometres long, that may cross
    # themselves: repaired, then merged on a 1 m grid.
    owned = [
        make_valid(cell, method="structure", keep_collapsed=False)
        for cell, owner in zip(cells, sites.values())
        if owner == index
    ]
    nearest = union_all(owned, grid_size=1)
    # The merge leaves specks between cells, which the retreat would widen into holes.
    nearest = union_all(
        [
            Polygon(part.exterior, [ring for ring in part.interiors if Polygon(ring).area > 1e6])
            for part in polygons(nearest)
        ]
    )
    grown = nearest.intersection(reach).buffer(-1000, quad_segs=4).difference(apart)
    # Slivers the retreat cuts off along the gaps are dropped.
    parts = [part for part in polygons(grown.simplify(200)) if part.area > 5e6]
    countries.append((item, make_valid(union_all(parts))))

# What the map hides around Switzerland, the foreign enclaves included.
outside = world.difference(transform(to_wgs84, switzerland))


def degrees(geometry) -> dict:
    return {
        "type": "MultiPolygon",
        "coordinates": [
            [
                [[round(x, 4), round(y, 4)] for x, y in ring.coords]
                for ring in [polygon.exterior, *polygon.interiors]
            ]
            for polygon in (orient(part, sign=1.0) for part in polygons(geometry))
        ],
    }

features = [
    {
        "type": "Feature",
        "properties": {"id": item["id"], "kind": "region", "canton": item["canton"]},
        "geometry": wgs84(geometry),
    }
    for item, geometry in regions
] + [
    {
        "type": "Feature",
        "properties": {"id": item["id"], "kind": "country", "country": item["country"]},
        "geometry": wgs84(geometry),
    }
    for item, geometry in countries
]
labels = [
    {
        "type": "Feature",
        "properties": {"id": item["id"], "kind": "region", "text": item["canton"]},
        "geometry": {"type": "Point", "coordinates": lonlat(item["labelPoint"])},
    }
    for item in regions_map["regions"]
    if item["region"] in (0, 1)
] + [
    {
        "type": "Feature",
        "properties": {"id": item["id"], "kind": "country", "country": item["country"]},
        "geometry": {"type": "Point", "coordinates": lonlat(item["labelPoint"])},
    }
    for item, _ in countries
]
# Where the popover points for keyboard focus: the SVG map's label point.
anchors = {item["id"]: lonlat(item["labelPoint"]) for item in regions_map["regions"]}
anchors.update({item["id"]: lonlat(item["labelPoint"]) for item, _ in countries})
west, south, east, north = swiss.bounds
output = {
    "year": regions_map["year"],
    "attribution": f"{regions_map['attribution']} · {neighbors_map['source']['attribution']}",
    "method": "Contours de regions-map.json et neighbors-map.json reprojetés de LV95 en WGS84 (pyproj), arrondis à 4 décimales ; simplification de 150 m conservée ; pays voisins simplifiés et arrondis sur 3 km, à 4 km de la Suisse et 2 km les uns des autres, étendus jusqu’aux bords de la carte (chaque lieu au voisin le plus proche) ; frontières nationale, cantonales et régionales tracées une seule fois chacune ; lacs hors communes inclus dans le contour suisse, hors enclaves étrangères.",
    "sources": [
        {"file": "regions-map.json", "sha256": hashlib.sha256(regions_bytes).hexdigest()},
        {"file": "neighbors-map.json", "sha256": hashlib.sha256(neighbors_bytes).hexdigest()},
    ],
    "switzerland": [
        [round(c, 4) for c in to_wgs84(west, south)],
        [round(c, 4) for c in to_wgs84(east, north)],
    ],
    "anchors": anchors,
    "areas": {"type": "FeatureCollection", "features": features},
    "labels": {"type": "FeatureCollection", "features": labels},
    "outside": {"type": "Feature", "properties": {}, "geometry": degrees(outside)},
    "borders": {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"kind": "national"}, "geometry": wgs84(switzerland)},
            *(
                {"type": "Feature", "properties": {"kind": kind}, "geometry": lines(geometry)}
                for kind, geometry in borders
            ),
        ],
    },
}
# Line feeds on every system: the bytes hashed by the relief's provenance are the versioned ones.
OUTPUT.write_text(
    json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
    encoding="utf-8",
    newline="\n",
)
print(json.dumps({"output": str(OUTPUT), "bytes": OUTPUT.stat().st_size, "areas": len(features), "labels": len(labels)}))
