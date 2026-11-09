"""Vendor Noto Sans Symbols / Noto Sans Symbols 2 (OFL) as woff2 subsets."""
import os
import re
import urllib.request

CSS = os.path.join(os.environ["TEMP"], "sym", "noto-symbols.css")
APP = r"K:\library\DOCUMENTS\DSH待办\via-study\app"
OUTDIR = os.path.join(APP, "public", "fonts", "noto-symbols")
os.makedirs(OUTDIR, exist_ok=True)

css = open(CSS, encoding="utf-8").read()
blocks = re.findall(r"/\*\s*([a-z0-9\-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S)
print("blocks:", len(blocks))

out = []
for subset, block in blocks:
    m = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", block)
    if not m:
        continue
    url = m.group(1)
    family = re.search(r"font-family:\s*'([^']+)'", block).group(1)
    slug = "nss2" if family.endswith("2") else "nss"
    name = f"{slug}-{subset}.woff2"
    path = os.path.join(OUTDIR, name)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    out.append(block.replace(url, f"/fonts/noto-symbols/{name}"))

with open(os.path.join(OUTDIR, "noto-symbols.css"), "w", encoding="utf-8", newline="\n") as f:
    f.write("/* Noto Sans Symbols + Noto Sans Symbols 2 (SIL OFL 1.1), self-hosted */\n")
    f.write("\n".join(out))

total = sum(os.path.getsize(os.path.join(OUTDIR, n)) for n in os.listdir(OUTDIR) if n.endswith(".woff2"))
print("files:", len([n for n in os.listdir(OUTDIR) if n.endswith('.woff2')]), f"total {total/1024:.0f} KB")
