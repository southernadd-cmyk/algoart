#!/usr/bin/env python3
"""Build the PROPORTION PIECE editorial PDF and illustrated ZIP from tracked files.
Run: python scripts/build_press_pack.py
Dependencies: reportlab (pip install reportlab)
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
from datetime import date
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'press'
PDF=OUT/'PROPORTION_PIECE_Press_Kit.pdf'
ZIP=OUT/'PROPORTION_PIECE_Media_Pack.zip'
TOWER='gallery/visit/walk-the-tower-golden.png'
ARTS=[
('Action painting — landscape','gallery/2026-10-28/2026-10-28-action-landscape-01-organic-ACL-20261028-01-14286.jpg'),
('Oil paint — landscape','gallery/2026-10-28/2026-10-28-oil-landscape-01-geometric-OL-20261028-01-51497.jpg'),
('Watercolour — landscape','gallery/2026-10-28/2026-10-28-watercolour-landscape-01-burst-CWL-20261028-01-47666.jpg'),
('Marker — portrait system','gallery/2026-10-28/2026-10-28-portrait-01-scribble-AP-20261028-01-04299.jpg'),
('Action painting — portrait','gallery/2026-10-28/2026-10-28-action-portrait-01-field-ACP-20261028-01-14806.jpg'),
('Oil paint — portrait','gallery/2026-10-28/2026-10-28-oil-portrait-02-organic-OP-20261028-02-27634.jpg'),
]
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleCustom',parent=styles['Title'],fontSize=27,leading=32,textColor=HexColor('#403931'),spaceAfter=15))
styles.add(ParagraphStyle(name='HeadingCustom',parent=styles['Heading2'],fontSize=16,textColor=HexColor('#403931'),spaceBefore=18,spaceAfter=9))
styles.add(ParagraphStyle(name='BodyCustom',parent=styles['BodyText'],fontSize=10.5,leading=15,spaceAfter=11))
styles.add(ParagraphStyle(name='CaptionCustom',parent=styles['BodyText'],fontSize=9,leading=12,textColor=HexColor('#75685d'),spaceAfter=15))
story=[]
def para(s,sty='BodyCustom'): story.append(Paragraph(s,styles[sty]))
def heading(s):para(s,'HeadingCustom')
def picture(path,width=475,maxheight=315):
    f=ROOT/path
    if not f.is_file(): raise FileNotFoundError(f'Press pack cannot omit image: {f}')
    w,h=ImageReader(str(f)).getSize()
    scale=min(width/w,maxheight/h)
    story.append(Image(str(f),width=w*scale,height=h*scale))
para('PROPORTION PIECE','TitleCustom')
para('Press and editorial resources | Updated 28 October 2026')
para('<b>An algorithmically generated gallery exhibiting algorithmically generated art.</b>')
para('PROPORTION PIECE (formerly ALGO/ART) is an ongoing open-source browser artwork by Adam Clement. Eight generative drawing systems explore the golden ratio through repeatable composition and five simulations of human-looking materials: marker, tissue and graphite, watercolour, oil paint and action painting.')
picture(TOWER)
para('The growing 3D gallery tower — an exhibition that gains a floor each day.','CaptionCustom')
heading('The work')
para('The project asks: “How far can the golden ratio govern a composition while its marks remain visibly human?” The viewer can change seeds and controls, examine compositions, and export their own results. These are seeded JavaScript-generated drawings, not AI-image-model outputs.')
heading('The growing gallery')
para('Every day, new studies are generated and a new floor is added to a walkable 3D tower. Visitors enter the building, travel between dated floors in a lift and explore galleries. A selection of portrait studies becomes sculptures. Golden-ratio relationships shape the gallery plan as well as the 2D compositions. The building is part of the artwork.')
heading('About the artist')
para('Adam Clement is a UK-based computing educator and creative coder. His browser-based experiments bring programming, mathematical structures and drawing together. PROPORTION PIECE explores the tension between exact compositional rules and the appearance of imperfect human marks.')
heading('Project links')
para('Interactive drawing editor: https://southernadd-cmyk.github.io/algoart/')
para('3D tower: https://southernadd-cmyk.github.io/algoart/gallery/visit/')
para('Daily archive: https://southernadd-cmyk.github.io/algoart/gallery/')
para('Source: https://github.com/southernadd-cmyk/algoart')
heading('Editorial and reproduction')
para('Official title: PROPORTION PIECE (formerly ALGO/ART). Suggested credit: PROPORTION PIECE / Adam Clement. Please confirm reproduction permission and final image choice before publication. Contact: southernadd@googlemail.com.')
story.append(PageBreak())
heading('Selected artwork — archive of 28 October 2026')
para('The six works below are a curated archival selection, not the latest daily output. Current works appear in the linked daily gallery.')
for caption,path in ARTS:
    picture(path,width=400,maxheight=250)
    para(escape(caption)+' — PROPORTION PIECE / Adam Clement','CaptionCustom')
SimpleDocTemplate(str(PDF),pagesize=(595.28,841.89),rightMargin=55,leftMargin=55,topMargin=50,bottomMargin=50,title='PROPORTION PIECE Press Kit').build(story)
with ZipFile(ZIP,'w',ZIP_DEFLATED,compresslevel=8) as z:
    z.write(PDF,PDF.name)
    z.write(ROOT/TOWER,'images/'+Path(TOWER).name)
    for _,path in ARTS:z.write(ROOT/path,'images/'+Path(path).name)
    z.writestr('README.txt','PROPORTION PIECE / Adam Clement — press assets\nUpdated 28 October 2026\n\nImage files: one current 3D tower image and six curated studies from 28 October 2026.\nThe daily archive provides newer works.\n\nEditor: https://southernadd-cmyk.github.io/algoart/\nTower: https://southernadd-cmyk.github.io/algoart/gallery/visit/\nDaily archive: https://southernadd-cmyk.github.io/algoart/gallery/\nCredit: PROPORTION PIECE / Adam Clement\nContact to confirm reproduction permission: southernadd@googlemail.com\n')
print(f'Built {PDF} and {ZIP}')
