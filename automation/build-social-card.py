#!/usr/bin/env python3
"""Build the social preview using a real archived marker-engine drawing."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'gallery/2026-10-18/2026-10-18-01-burst-AA-20261018-01-52639.jpg'
FONT = ROOT / 'fonts/AlgoArt-Marker-Regular.ttf'
OUTPUT = ROOT / 'social-card.png'
paper = '#ece7d9'
ink = '#403931'
red = '#b65368'
im = Image.new('RGB', (1200, 630), paper)
d = ImageDraw.Draw(im)
font = lambda n: ImageFont.truetype(str(FONT), n)
# A real ALGO/ART marker output, presented as an artwork rather than a diagram.
art = Image.open(ART).convert('RGB')
area = (472, 42, 1160, 568)
aw, ah = area[2]-area[0], area[3]-area[1]
scale = min(aw/art.width, ah/art.height)
art = art.resize((round(art.width*scale), round(art.height*scale)), Image.Resampling.LANCZOS)
x = area[0] + (aw-art.width)//2
y = area[1] + (ah-art.height)//2
im.paste(art, (x,y))
# Plain exhibition-label layout; text is set in the project's real font.
d.text((43, 100), 'PROPORTION', font=font(52), fill=ink)
d.text((43, 166), 'PIECE', font=font(75), fill=ink)
d.line((45,267,428,267), fill=red, width=4)
d.text((43, 295), 'AN ONGOING', font=font(26), fill=ink)
d.text((43, 333), 'DRAWING EXPERIMENT', font=font(26), fill=ink)
d.text((43, 436), 'ONE NUMBER PROPOSES', font=font(23), fill=ink)
d.text((43, 471), 'THE COMPOSITION.', font=font(23), fill=ink)
d.text((43, 563), '1.6180339887  /  137.507764°', font=font(17), fill=ink)
im.save(OUTPUT, optimize=True)
print(f'Built {OUTPUT.name}: {im.width}x{im.height}, real marker artwork {ART.name}')
