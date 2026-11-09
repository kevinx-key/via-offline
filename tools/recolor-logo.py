"""Recolor the K-star logo from green-on-blueblack to the VIA UI pink-on-black.

Maps every pixel along the axis between the two source colours (background ->
star), so antialiased edges stay smooth, then re-paints with the target colours.
Target colours are the VIA UI defaults: background = --color_jet #1d1b1b,
star/accents = OLIVIA_DARK accent #E8C4B8.
"""
import os

from PIL import Image

SRC = r"L:\k星工作室\文件\设计图纸\vi\g&bT.png"
OUT = r"K:\library\DOCUMENTS\DSH待办\via-study\build-assets\logo-pink.png"

BG = (0x10, 0x17, 0x1F)      # source background (deep blue-black)
STAR = (0xD9, 0xFD, 0x22)    # source star (neon green)
NEW_BG = (0x1D, 0x1B, 0x1B)  # VIA dark background
NEW_STAR = (0xE8, 0xC4, 0xB8)  # VIA pink accent

axis = [STAR[i] - BG[i] for i in range(3)]
denom = sum(c * c for c in axis)

src = Image.open(SRC).convert("RGBA")
out = Image.new("RGBA", src.size)
src_px = src.load()
out_px = out.load()

for y in range(src.height):
    for x in range(src.width):
        r, g, b, a = src_px[x, y]
        d = (r - BG[0]) * axis[0] + (g - BG[1]) * axis[1] + (b - BG[2]) * axis[2]
        t = max(0.0, min(1.0, d / denom))
        nr = round(NEW_BG[0] + t * (NEW_STAR[0] - NEW_BG[0]))
        ng = round(NEW_BG[1] + t * (NEW_STAR[1] - NEW_BG[1]))
        nb = round(NEW_BG[2] + t * (NEW_STAR[2] - NEW_BG[2]))
        out_px[x, y] = (nr, ng, nb, a)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.save(OUT)
print("wrote", OUT, out.size)
