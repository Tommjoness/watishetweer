"""Genereer de offline vakantieregiokaart uit de gedocumenteerde bronbestanden."""
import argparse
import gzip
import json
from pathlib import Path
import numpy as np
from osgeo import gdal, ogr, osr

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("bronnen", type=Path)
parser.add_argument("uitvoer", type=Path)
args = parser.parse_args()
root = args.bronnen
base = json.loads((root / "brk-gemeenten-350.geojson").read_bytes())["features"]
west, north, width, height = 3000, 53800, 4301, 3201
shape = (height, width)
gdal.UseExceptions()
ogr.UseExceptions()

def geom(feature):
    g = ogr.CreateGeometryFromJson(json.dumps(feature["geometry"]))
    return g if g.IsValid() else g.MakeValid()

def srs(code):
    ref = osr.SpatialReference()
    ref.ImportFromEPSG(code)
    ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return ref

geo, rd = srs(4326), srs(28992)
to_rd, to_geo = osr.CoordinateTransformation(geo, rd), osr.CoordinateTransformation(rd, geo)

def raster(items, all_touched=False):
    output = gdal.GetDriverByName("MEM").Create("",width,height,1,gdal.GDT_UInt16)
    output.SetGeoTransform(((west-.5)/1000,.001,0,(north+.5)/1000,0,-.001))
    output.SetProjection(geo.ExportToWkt())
    vectors = ogr.GetDriverByName("Memory").CreateDataSource("")
    layer = vectors.CreateLayer("grenzen",geo)
    layer.CreateField(ogr.FieldDefn("code",ogr.OFTInteger))
    for code,g in items:
        if g.IsEmpty():
            continue
        feature = ogr.Feature(layer.GetLayerDefn())
        feature.SetField("code",code)
        feature.SetGeometry(g)
        layer.CreateFeature(feature)
    opts = ["ATTRIBUTE=code"]
    if all_touched:
        opts.append("ALL_TOUCHED=TRUE")
    gdal.RasterizeLayer(output,[1],layer,options=opts)
    return output.ReadAsArray()

def veilig_geldig(g):
    if g.IsEmpty() or g.IsValid():
        return g
    return g.MakeValid()

def meterbuffer(g, meters):
    poly = g.Clone()
    poly.Transform(to_rd)
    poly = poly.Buffer(meters)
    poly.Transform(to_geo)
    return veilig_geldig(poly)

mid = set("""0197 0200 0203 1859 1876 0213 0214 0216 0222 0228 0230 0232
0233 0243 0246 0262 1955 1740 0267 0302 0269 1586 1509 0273 0279 0281
0285 0289 1960 0294 0301""".split())
south = set("""0202 1945 0209 0221 0225 0226 0252 1705 0263 0268 1734 0274
0275 0277 0668 0293 0296 0297 0299""".split())

def main_region(p):
    province, code = p["ligt_in_provincie_naam"],p["code"]
    if province in {"Drenthe","Fryslân","Groningen","Noord-Holland","Overijssel"} or code in {"0317","0244"}:
        return 1
    if province == "Flevoland":
        return 2 if code=="0050" else 1
    if province in {"Utrecht","Zuid-Holland"} or code=="1959":
        return 2
    if province in {"Noord-Brabant","Limburg","Zeeland"}:
        return 3
    if province=="Gelderland" and code in mid|south:
        return 2 if code in mid else 3
    raise ValueError(p)

def dissolve(items):
    all_parts = ogr.Geometry(ogr.wkbMultiPolygon)
    def add(g):
        if g.GetGeometryName()=="POLYGON":
            all_parts.AddGeometry(g)
        else:
            for i in range(g.GetGeometryCount()):
                add(g.GetGeometryRef(i))
    for g in items:
        add(g)
    return veilig_geldig(all_parts.UnionCascaded())

splits = [
    ("0736","cbs-abcoude-2010.geojson",1,35),
    ("1955","cbs-didam-2004.geojson",3,200),
    ("1740","nlgis-dodewaard-1997.geojson",3,550),
    ("1959","cbs-aalburg-2018.geojson",3,50),
    ("1959","bag-hank-dussen.json",3,50),
]
codes = {f["properties"]["code"]:f for f in base}
assert len(base)==len(codes)==342
current = {code:geom(f) for code,f in codes.items()}
groups = {1:[],2:[],3:[]}
border_uncertainty = []
for code,f in codes.items():
    area = current[code]
    for owner,file,regio,meters in splits:
        if code!=owner:
            continue
        candidates = json.loads((root/file).read_bytes())["features"]
        if file.startswith("bag-"):
            candidates = [f for f in candidates if f["properties"]["identificatie"] in {"2214","2215"}]
            assert len(candidates)==2
        district = dissolve([geom(f) for f in candidates])
        clipped = veilig_geldig(area.Intersection(district))
        groups[regio].append(clipped)
        area = veilig_geldig(area.Difference(district))
        # Meters rond de historische grens, ook waar deze de huidige gemeentegrens kruist.
        border_uncertainty.append(meterbuffer(district.Boundary(),meters))
    groups[main_region(f["properties"])].append(area)

regions = {n:dissolve(parts) for n,parts in groups.items()}
centres = raster(list(regions.items()))
uncertain = raster([(1,g.Boundary()) for g in regions.values()]+[(1,g) for g in border_uncertainty],True)
centres[uncertain!=0]=0

def at(lat,lon):
    return int(centres[north-round(lat*1000), round(lon*1000)-west])

cases=[
    ("Almere",52.3508,5.2647,1),("Groningen",53.2194,6.5665,1),
    ("Zeewolde",52.3308,5.5431,2),("Utrecht",52.0907,5.1214,2),
    ("Eindhoven",51.4416,5.4697,3),("Maastricht",50.8514,5.6910,3),
    ("Abcoude",52.2725,4.9726,1),("Mijdrecht",52.2065,4.8637,2),
    ("Didam",51.9394,6.1319,3),("'s-Heerenberg",51.8772,6.2583,2),
    ("Dodewaard",51.9118,5.6564,3),("Kesteren",51.9331,5.5704,2),
    ("Hank",51.7343,4.9028,3),("Dussen",51.7316,4.9649,3),
    ("Wijk en Aalburg",51.7536,5.1291,3),("Werkendam",51.8097,4.8936,2),
    ("Woudrichem",51.8154,5.0010,2),("Baarle-Hertog",51.44009,4.92708,0),
    ("Baarle-Nassau, gemeentehuis",51.44339019,4.93058728,0),
    ("Baarle-Nassau, Oordeelsestraat",51.44641579,4.93830117,3),
]
for name,lat,lon,expected in cases:
    got=at(lat,lon)
    print(name,expected,got)
    assert got==expected, (name,expected,got)

excluded = []
for code,f in codes.items():
    if code in {x[0] for x in splits}:
        continue
    p = current[code].PointOnSurface()
    lat,lon=p.GetY(),p.GetX()
    if not (0<=north-round(lat*1000)<height and 0<=round(lon*1000)-west<width):
        excluded.append((code,f["properties"]["naam"],"buiten raster"))
        continue
    found=at(lat,lon)
    expected=main_region(f["properties"])
    assert found in {0,expected},(code,expected,found)
    if not found:
        excluded.append((code,f["properties"]["naam"],"grenscel"))
print("Gemeenterepresentanten zonder regio:",excluded)
assert not excluded, excluded
rows=[]
for row in centres:
    edges=np.r_[0,np.flatnonzero(row[:-1]!=row[1:])+1,row.size]
    rows.append([int(x) for a,b in zip(edges[:-1],edges[1:]) if row[a] for x in (a,b,int(row[a]))])
data=json.dumps({"west":west,"noord":north,"rijen":rows},separators=(",",":")).encode()
args.uitvoer.write_bytes(data)
print("Cells, bytes, gzip:",int(np.count_nonzero(centres)),len(data),len(gzip.compress(data)))
