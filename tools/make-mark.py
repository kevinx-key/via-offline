"""Build a simplified, legible star mark (no lettering) for tiny sizes.

Keeps the exact outer silhouette and fills every interior hole (lettering, eyes)
by propagating the "outside" region inwards from the borders, then paints the
result in solid accent pink.
"""
import numpy as np
from PIL import Image

SRC = r"K:\library\DOCUMENTS\DSH待办\via-study\build-assets\logo-pink.png"
OUT = r"K:\library\DOCUMENTS\DSH待办\via-study\app\public\images\logo-mark.png"

PINK = (0xE8, 0xC4, 0xB8)
im = Image.open(SRC).convert("RGBA")
px = np.array(im).astype(np.int16)

dist = (
    np.abs(px[:, :, 0] - PINK[0])
    + np.abs(px[:, :, 1] - PINK[1])
    + np.abs(px[:, :, 2] - PINK[2])
)
body = (px[:, :, 3] > 128) & (dist < 120)


def dilate(m):
    out = m.copy()
    out[1:, :] |= m[:-1, :]
    out[:-1, :] |= m[1:, :]
    out[:, 1:] |= m[:, :-1]
    out[:, :-1] |= m[:, 1:]
    return out


outside = np.zeros_like(body)
outside[0, :] = outside[-1, :] = True
outside[:, 0] = outside[:, -1] = True
outside &= ~body

for _ in range(2000):
    grown = dilate(outside) & ~body
    if (grown == outside).all():
        break
    outside = grown

holes = ~body & ~outside
solid = body | holes

rgba = np.zeros((*solid.shape, 4), dtype=np.uint8)
rgba[solid] = (*PINK, 255)
out = Image.fromarray(rgba, "RGBA").crop(Image.fromarray((solid * 255).astype(np.uint8)).getbbox())
out.save(OUT)
print("wrote", OUT, out.size, "holes filled:", int(holes.sum()))
