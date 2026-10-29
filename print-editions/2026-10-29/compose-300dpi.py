# PROPORTION PIECE A3 print assembly. Source PNGs are native 3x renderer outputs.
# The canvas is NEVER resized: 1 rendered pixel = 1 printed pixel at 300 dpi.
import json, os, io, zipfile
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import qrcode
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT=Path("print-editions/2026-10-29/300dpi")
manifest=json.loads((ROOT/"source-manifest.json").read_text())
items=manifest["artworks"]
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def font(sz,bold=False):
    try:return ImageFont.truetype(BOLD if bold else FONT,sz)
    except:return ImageFont.load_default()
A3_W,A3_H=4961,3508 # 420x297 mm at 300 pixels per inch, rounded
pdfs=[]
pages=[]
for art in items:
    slug=art["slug"]
    original=ROOT/(slug+"-engine-3x.png")
    with Image.open(original) as image:
        im=image.convert("RGB")
    portrait=art["export"]["orientation"]=="portrait"
    expected=(3000,4200) if portrait else (4200,3000)
    if im.size!=expected:raise RuntimeError(f"{slug}: native render {im.size}, expected {expected}; no resizing permitted")
    size=(A3_H,A3_W) if portrait else (A3_W,A3_H)
    sheet=Image.new("RGB",size,"#ffffff")
    left=(size[0]-im.width)//2
    top=110 if portrait else 95
    sheet.paste(im,(left,top))
    draw=ImageDraw.Draw(sheet)
    caption_y=top+im.height+62
    draw.text((left,caption_y), "PROPORTION PIECE",fill="#242424",font=font(43,True),stroke_width=0)
    draw.text((left,caption_y+62),art["label"]+"  /  "+art["engine"],fill="#555555",font=font(32))
    draw.text((left,caption_y+110),art["seed"]+"   •   "+art["day"],fill="#777777",font=font(25))
    qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,border=2,box_size=8)
    qr.add_data(art["imageUrl"])
    qr.make(fit=True)
    qr_img=qr.make_image(fill_color="black",back_color="white").convert("RGB")
    # A small but scannable 16 mm QR in the bottom-right sheet margin.
    qr_img=qr_img.resize((190,190),resample=Image.Resampling.NEAREST)
    sheet.paste(qr_img,(size[0]-227,size[1]-226))
    final=ROOT/(slug+"-A3-300dpi.png")
    sheet.save(final,format="PNG",dpi=(300,300),compress_level=6)
    with Image.open(final) as check:
        if check.size!=size:raise RuntimeError("Wrong A3 pixel extent")
        if check.info.get("dpi",(0,0))[0]<299:raise RuntimeError("DPI metadata missing")
    # JPEG is used only as an internal high-quality PDF embedding format.
    # The separate exported print PNG remains mathematically lossless.
    jpg=ROOT/(slug+"-pdf-embed.jpg")
    sheet.save(jpg,format="JPEG",quality=96,subsampling=0,optimize=True,dpi=(300,300))
    pdf=ROOT/(slug+"-A3-300dpi.pdf")
    pw,ph=size[0]/300*72,size[1]/300*72
    c=canvas.Canvas(str(pdf),pagesize=(pw,ph),pageCompression=1)
    c.setTitle("PROPORTION PIECE | "+art["label"]+" | "+art["engine"])
    c.drawImage(str(jpg),0,0,width=pw,height=ph)
    c.showPage();c.save()
    pdfs.append(pdf);pages.append((jpg,pw,ph,art))
    art["print"]={"px":list(size),"dpi":300,"artwork_px":list(expected),"file":final.name,"pdf":pdf.name,"native":True,"upscaled":False}
    print(f"VERIFIED {slug}: source {im.width}x{im.height}; A3 {size[0]}x{size[1]} @ 300dpi; QR {art['imageUrl']}",flush=True)
combined=ROOT/"PROPORTION-PIECE-five-editions-A3-300dpi.pdf"
c=canvas.Canvas(str(combined),pageCompression=1)
c.setTitle("PROPORTION PIECE - Five 300 dpi A3 print editions")
for image,pw,ph,art in pages:
    c.setPageSize((pw,ph))
    c.drawImage(str(image),0,0,width=pw,height=ph)
    c.showPage()
c.save()
# Remove intermediate lossy PDF-only embeds, never final PNGs.
for image,*rest in pages:image.unlink(missing_ok=True)
manifest["quality_control"]={"all_native_engine_renders":True,"upscaling":False,"print_dpi":300,"a3_millimetres":[420,297],"page_pixels_landscape":[4961,3508],"page_pixels_portrait":[3508,4961]}
(ROOT/"print-manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n")
readme="""# PROPORTION PIECE — five A3 print editions, 300 dpi

These are genuine new high-resolution renders from the original seeded JavaScript engines, NOT resized gallery JPEGs.

Each artwork is rendered at 3x its original native logical drawing dimensions: 4200x3000 or 3000x4200. An unscaled image is placed on a true A3 sheet 4961x3508 or 3508x4961 pixels at 300 dpi, leaving white space for the title and QR code. No stretching, resampling, or cropping of any composition occurs. Each QR code links directly to that artwork's archived gallery image.

Use the -A3-300dpi.png files for maximum quality or the -A3-300dpi.pdf files for printers. The combined PDF includes all five pages. See print-manifest.json for the exact seed, renderer version, original share URL and technical verification.
"""
(ROOT/"README.md").write_text(readme)
zip_path=ROOT/"PROPORTION-PIECE-five-A3-300dpi-print-pack.zip"
with zipfile.ZipFile(zip_path,"w",zipfile.ZIP_DEFLATED,compresslevel=1) as z:
    for f in sorted(ROOT.glob("*-A3-300dpi.png"))+sorted(ROOT.glob("*-A3-300dpi.pdf"))+[combined,ROOT/"print-manifest.json",ROOT/"README.md"]:
        z.write(f,f.name)
if zip_path.stat().st_size>95000000:
    print(f"Full ZIP is too large to commit to GitHub ({zip_path.stat().st_size} bytes). Keeping as CI artifact, not source branch.",flush=True)
    (ROOT/"LARGE-ZIP-NOT-IN-GIT.txt").write_text("The full ZIP is in the workflow's GitHub Actions downloadable artifacts. All individual prints remain on this branch.\n")
    # The upload-artifact step runs before the workflow's commit step.
else:print(f"Full ZIP {zip_path.stat().st_size:,} bytes",flush=True)
