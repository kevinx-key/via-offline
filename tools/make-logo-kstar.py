"""Re-letter the K-STAR logo: remove the old lettering, draw 'K-STAR'.

Only interior holes (i.e. dark shapes fully enclosed by the pink star) inside the
old text band are repainted, so the star silhouette, the hat and the two eyes are
untouched.
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE = r"K:\library\DOCUMENTS\DSH待办\via-study\build-assets"
SRC = os.path.join(BASE, "logo-pink.png")
OUT = os.path.join(BASE, "logo-kstar.png")
FONT = os.path.join(os.environ["TEMP"], "fonts", "Poppins-Bold.ttf")

PINK = (0xE8, 0xC4, 0xB8)
DARK = (0x1D, 0x1B, 0x1B)
TEXT_BAND = (300, 520)  # rows that contain only the old lettering

img = Image.open(SRC).convert("RGBA")
arr = np.array(img).astype(int)
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

pink = (abs(r - PINK[0]) + abs(g - PINK[1]) + abs(b - PINK[2]) < 60) & (a > 128)

# "outside" = background reachable from the border; anything dark and enclosed is a hole
outside = np.zeros_like(pink)
outside[0, :] = outside[-1, :] = True
outside[:, 0] = outside[:, -1] = True
outside &= ~pink


def dilate(m):
    o = m.copy()
    o[1:, :] |= m[:-1, :]
    o[:-1, :] |= m[1:, :]
    o[:, 1:] |= m[:, :-1]
    o[:, :-1] |= m[:, 1:]
    return o


for _ in range(2000):
    grown = dilate(outside) & ~pink
    if (grown == outside).all():
        break
    outside = grown

holes = ~pink & ~outside
solid = pink | holes

# repaint the whole text band that lies inside the star: kills the lettering and
# every anti-aliased fringe pixel left behind by it
band = np.zeros_like(pink)
band[TEXT_BAND[0] : TEXT_BAND[1], :] = solid[TEXT_BAND[0] : TEXT_BAND[1], :]

px = arr.astype(np.uint8)
px[band] = (*PINK, 255)
img = Image.fromarray(px, "RGBA")
d = ImageDraw.Draw(img)


def draw_fitted(text, max_width, center, tracking_ratio=0.05):
    size = 160
    while size > 40:
        font = ImageFont.truetype(FONT, size)
        widths = [d.textlength(ch, font=font) for ch in text]
        track = size * tracking_ratio
        total = sum(widths) + track * (len(text) - 1)
        if total <= max_width:
            break
        size -= 2
    x = center[0] - total / 2
    asc, desc = font.getmetrics()
    y = center[1] - (asc + desc) / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=DARK + (255,))
        x += w + track
    return size, total


size, width = draw_fitted("K-STAR", 470, (400, 410))
print(f"font size {size}px, width {width:.0f}px")
img.save(OUT)
print("wrote", OUT, img.size)
