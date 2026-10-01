"""Build neighbouring countries and a local-only reverse lookup from official boundaries.
Generation dependencies only: pyshp, shapely, pyproj, openpyxl.
"""
import sys, pathlib, tempfile, urllib.request, json, zipfile, io, hashlib, re
sys.path.insert(0,str(pathlib.Path(tempfile.gettempdir())/'coverview-health-geo-python'))
import shapefile, openpyxl
from shapely import force_2d, make_valid
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union, transform
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data/health-insurance/2027'
URL='https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_03M_2024_4326.geojson'
cache=pathlib.Path(tempfile.gettempdir())/'coverview-countries-2024.json'
if not cache.exists():
    payload=urllib.request.urlopen(URL,timeout=60).read(70_000_001)
    assert len(payload)<=70_000_000
    cache.write_bytes(payload)
world=json.loads(cache.read_bytes())
w=openpyxl.load_workbook(DATA/'regions.xlsx',read_only=True,data_only=True)
communes={int(r[0]):str(r[1])+'-'+str(int(r[3])) for r in list(w['A_COM'].values)[5:] if isinstance(r[0],(int,float))}
mutations={}
for r in w['COM-MUT'].values:
    if isinstance(r[0],(int,float)) and int(r[0])<=2027:
        m=re.match(r'fus\s+(\d+)\b',str(r[4]))
        if m: mutations[int(r[1])]=int(m[1])
groups={}
archive=pathlib.Path(tempfile.gettempdir())/'coverview-swissboundaries3d-2026.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='a467d7eec8395d746253c68095c75a2540b52064bc83a6b35cf101efb625733d'
with zipfile.ZipFile(archive) as z:
    base='swissBOUNDARIES3D_1_5_TLM_HOHEITSGEBIET'
    reader=shapefile.Reader(shp=io.BytesIO(z.read(base+'.shp')),shx=io.BytesIO(z.read(base+'.shx')),dbf=io.BytesIO(z.read(base+'.dbf')),encoding='utf-8')
    for f in reader.iterShapeRecords():
        a=f.record.as_dict()
        if a['ICC']!='CH' or a['OBJEKTART']!='Gemeindegebiet':continue
        bfs=mutations.get(int(a['BFS_NUMMER']),int(a['BFS_NUMMER']))
        assert bfs in communes
        groups.setdefault(bfs,[]).append(make_valid(force_2d(shape(f.shape.__geo_interface__))))
geometries={bfs:unary_union(items) for bfs,items in groups.items()}
assert len(geometries)==2104
swiss=unary_union(list(geometries.values()))
minx,miny,maxx,maxy=swiss.bounds
scale=min(952/(maxx-minx),602/(maxy-miny))
ox=(1000-(maxx-minx)*scale)/2;oy=(650-(maxy-miny)*scale)/2
def point(x,y):return [round(ox+(x-minx)*scale,2),round(oy+(maxy-y)*scale,2)]
def polygons(g):return [g] if g.geom_type=='Polygon' else [p for p in g.geoms if p.geom_type=='Polygon']
def path(g):
    return ''.join('M'+'L'.join(f'{x:g},{y:g}' for x,y in [point(x,y) for x,y in ring.coords][:-1])+'Z' for p in polygons(g) for ring in [p.exterior,*p.interiors])

def border_path(g):
    lines=[g] if g.geom_type=='LineString' else list(g.geoms)
    return ''.join('M'+'L'.join(f'{x:g},{y:g}' for x,y in [point(x,y) for x,y in line.coords]) for line in lines if line.geom_type=='LineString')
def compact(g):
    return [[[[round(x,1),round(y,1)] for x,y in ring.coords] for ring in [p.exterior,*p.interiors]] for p in polygons(g)]
project=Transformer.from_crs(4326,2056,always_xy=True).transform
neighbors=[];foreign=[]
clip=box(minx-90000,miny-90000,maxx+90000,maxy+90000)
map_clip=box(minx-300000,miny-300000,maxx+300000,maxy+300000)
labels={'FR':(6.0,47.1),'DE':(8.5,48.0),'IT':(8.7,45.6),'AT':(10.55,47.35),'LI':(9.55,47.13)}
for f in world['features']:
    code=f['properties']['CNTR_ID']
    if code not in labels:continue
    whole=make_valid(transform(project,shape(f['geometry'])))
    geometry=whole.intersection(clip).simplify(200,preserve_topology=True)
    display_geometry=whole.intersection(map_clip).simplify(200,preserve_topology=True)
    neighbors.append(dict(id='EU-'+code,country=code,path=path(display_geometry),borderPath=border_path(whole.boundary.intersection(map_clip).simplify(200)),labelPoint=point(*project(*labels[code]))))
    foreign.append(dict(country=code,bounds=list(geometry.bounds),polygons=compact(geometry)))
meta=dict(url=URL,sha256=hashlib.sha256(cache.read_bytes()).hexdigest(),year=2024,attribution='© EuroGeographics pour les limites administratives · Eurostat/GISCO 2024',licenseUrl='https://ec.europa.eu/eurostat/web/gisco/geodata/administrative-units/countries')
(DATA/'neighbors-map.json').write_text(json.dumps(dict(source=meta,regions=neighbors),ensure_ascii=False,separators=(',',':')),encoding='utf-8')
lookup=dict(source=meta,municipalities=[dict(id=bfs,regionId=communes[bfs],bounds=list(geom.bounds),polygons=compact(geom.simplify(25,preserve_topology=True))) for bfs,geom in geometries.items()],countries=foreign)
(ROOT/'apps/api/src/modules/health-insurance/health.geo.json').write_text(json.dumps(lookup,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(municipalities=len(geometries),neighbors=len(neighbors),source=meta)))
