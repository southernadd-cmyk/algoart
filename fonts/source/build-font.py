from pathlib import Path
import json
from shapely.geometry import LineString
from shapely.ops import unary_union
from shapely.geometry.polygon import orient
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.ttLib import TTFont

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'source/glyph-strokes.json').read_text())
fb=FontBuilder(1000,isTTF=True)
names=['.notdef','space']; cmap={32:'space'}; glyphs={}; metrics={'.notdef':(550,0),'space':(280,0)}
pen=TTGlyphPen(None)
for points in [[(50,0),(50,700),(470,700),(470,0)],[(110,60),(410,60),(410,640),(110,640)]]:
    pen.moveTo(points[0])
    for p in points[1:]:pen.lineTo(p)
    pen.closePath()
glyphs['.notdef']=pen.glyph();glyphs['space']=TTGlyphPen(None).glyph()
classes=[[],[],[]]
for record in data:
    char=record['ch'];variant=record['variant']; name=f'uni{ord(char):04X}'+('' if variant==0 else f'.alt{variant}')
    names.append(name);classes[variant].append(name)
    if variant==0:
        cmap[ord(char)]=name
        if 'A'<=char<='Z':cmap[ord(char.lower())]=name
    shapes=[]
    for stroke in record['paths']:
        nums=stroke['d'].replace('M','').replace('L','').split()
        coords=[(float(nums[i]),float(nums[i+1])) for i in range(0,len(nums),2)]
        shapes.append(LineString(coords).buffer(stroke['width']/2,quad_segs=6,cap_style='round',join_style='round'))
    ink=unary_union(shapes).simplify(.07,preserve_topology=True)
    polygons=[ink] if ink.geom_type=='Polygon' else list(ink.geoms)
    pen=TTGlyphPen(None)
    for polygon in polygons:
        # Y reversal turns clockwise canvas rings into clockwise font rings.
        polygon=orient(polygon,sign=1)
        for ring in [polygon.exterior,*polygon.interiors]:
            points=[(round((x-8)*7),round((115-y)*7)) for x,y in list(ring.coords)[:-1]]
            if len(set(points))<3:continue
            pen.moveTo(points[0])
            for p in points[1:]:pen.lineTo(p)
            pen.closePath()
    glyphs[name]=pen.glyph()
    # Shared advance across variants prevents contextual substitutions changing layout.
    metrics[name]=(round((record['width']+8)*7),0)
fb.setupGlyphOrder(names);fb.setupCharacterMap(cmap);fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=850,descent=-250)
fb.setupNameTable({'familyName':'AlgoArt Marker','styleName':'Regular','uniqueFontIdentifier':'AlgoArtMarker-0.1','fullName':'AlgoArt Marker Regular','psName':'AlgoArtMarker-Regular','version':'Version 0.100','manufacturer':'AlgoArt','designer':'Adam Clement / AlgoArt','description':'Original uppercase skeletons drawn through AlgoArt marker.js. Three seeded glyph versions; contextual cycling. Lowercase maps to uppercase.'})
fb.setupOS2(sTypoAscender=850,sTypoDescender=-250,sTypoLineGap=0,usWinAscent=850,usWinDescent=250,sCapHeight=700,sxHeight=700,usWeightClass=400,fsType=0)
fb.setupPost();fb.setupMaxp()
fea='languagesystem DFLT dflt;\nlanguagesystem latn dflt;\n'
for i,cl in enumerate(classes):fea+=f'@v{i} = ['+' '.join(cl)+'];\n'
fea+='feature calt {\n sub @v0 @v0\' by @v1;\n sub @v1 @v0\' by @v2;\n} calt;\n'
fea+='feature ss01 { sub @v0 by @v1; } ss01;\nfeature ss02 { sub @v0 by @v2; } ss02;\n'
addOpenTypeFeaturesFromString(fb.font,fea)
(root/'source/alternates.fea').write_text(fea)
fb.save(root/'AlgoArt-Marker-Regular.ttf')
font=TTFont(root/'AlgoArt-Marker-Regular.ttf');font.flavor='woff2';font.save(root/'AlgoArt-Marker-Regular.woff2')
print(f'Built {len(names)} glyphs, {len(cmap)} mapped characters, calt / ss01 / ss02')
