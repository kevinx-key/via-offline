import re, os, urllib.request

base = r"K:\library\DOCUMENTS\DSH待办\via-study"
css = open(os.path.join(base, "gfonts.css"), encoding="utf-8").read()
outdir = os.path.join(base, "app", "public", "fonts", "fira")
os.makedirs(outdir, exist_ok=True)

blocks = re.findall(r"/\*\s*([a-z\-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S)
print("blocks:", len(blocks))

out = []
for subset, block in blocks:
    m = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", block)
    if not m:
        continue
    url = m.group(1)
    name = url.rsplit("/", 1)[-1]
    local = f"{subset}-{name}"
    path = os.path.join(outdir, local)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    newblock = block.replace(url, f"/fonts/fira/{local}")
    out.append(newblock)

with open(os.path.join(outdir, "fira.css"), "w", encoding="utf-8", newline="\n") as f:
    f.write("/* Local copy of Google Fonts: Fira Sans + Fira Sans Condensed (offline build) */\n")
    f.write("\n".join(out))
print("written faces:", len(out))
