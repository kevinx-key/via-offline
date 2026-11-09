"""Generate all VIA icon assets from the K-star logo (green on deep black)."""
import base64
import io
import os

from PIL import Image

SRC = r"K:\library\DOCUMENTS\DSH待办\via-study\build-assets\logo-pink.png"
APP = r"K:\library\DOCUMENTS\DSH待办\via-study\app"
PUB = os.path.join(APP, "public")
OUT = r"K:\library\DOCUMENTS\DSH待办\via-study\build-assets"

im = Image.open(SRC).convert("RGBA")
print("source:", im.size, im.mode)


def save_png(size, path, pad=False):
    if pad:
        # keep the square logo inside a wider canvas (Windows tile 310x150)
        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        side = min(size)
        icon = im.resize((side, side), Image.LANCZOS)
        canvas.paste(icon, ((size[0] - side) // 2, (size[1] - side) // 2), icon)
        canvas.save(path)
    else:
        im.resize(size, Image.LANCZOS).save(path)
    print("  ->", os.path.relpath(path, APP))


os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(PUB, "images"), exist_ok=True)

save_png((16, 16), os.path.join(PUB, "favicon-16x16.png"))
save_png((32, 32), os.path.join(PUB, "favicon-32x32.png"))
save_png((180, 180), os.path.join(PUB, "apple-touch-icon.png"))
save_png((192, 192), os.path.join(PUB, "android-chrome-192x192.png"))
save_png((512, 512), os.path.join(PUB, "android-chrome-512x512.png"))
save_png((70, 70), os.path.join(PUB, "mstile-70x70.png"))
save_png((144, 144), os.path.join(PUB, "mstile-144x144.png"))
save_png((150, 150), os.path.join(PUB, "mstile-150x150.png"))
save_png((310, 310), os.path.join(PUB, "mstile-310x310.png"))
save_png((310, 150), os.path.join(PUB, "mstile-310x150.png"), pad=True)
save_png((512, 512), os.path.join(PUB, "images", "logo.png"))

# multi-resolution .ico for the browser tab
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
im.save(os.path.join(PUB, "favicon.ico"), sizes=ico_sizes)
print("  -> public/favicon.ico")

# .ico + png for the Electron/Windows shell
im.save(os.path.join(OUT, "app.ico"), sizes=ico_sizes)
save_png((256, 256), os.path.join(OUT, "app-icon.png"))
print("  -> build-assets/app.ico, app-icon.png")

# safari pinned tab: keep the filename, embed the raster logo
buf = io.BytesIO()
im.resize((512, 512), Image.LANCZOS).save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode("ascii")
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
    'viewBox="0 0 512 512" width="512" height="512">'
    '<image width="512" height="512" xlink:href="data:image/png;base64,' + b64 + '"/>'
    "</svg>\n"
)
with open(os.path.join(PUB, "safari-pinned-tab.svg"), "w", encoding="utf-8") as f:
    f.write(svg)
print("  -> public/safari-pinned-tab.svg")

