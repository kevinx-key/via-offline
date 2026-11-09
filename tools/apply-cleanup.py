import glob
import io
import os

app = r"K:\library\DOCUMENTS\DSH待办\via-study\app"

# 1. drop Gotham @font-face blocks
css = os.path.join(app, "src", "app.global.css")
t = io.open(css, encoding="utf-8").read()
for fam, src in [
    ("GothamRoundedBold", "GothamRoundedBold_21016.ttf"),
    ("GothamRounded", "GothamRoundedBook_21018.ttf"),
]:
    block = (
        "@font-face {\n  font-family: " + fam + ";\n  src: url(/fonts/" + src + ") format('opentype');\n}\n"
    )
    if block not in t:
        print("WARN block not found:", fam)
    t = t.replace(block, "")
io.open(css, "w", encoding="utf-8", newline="\n").write(t)
print("gotham faces left in css:", t.count("Gotham"))

# 2. menu.tsx font stack
mp = os.path.join(
    app, "src", "components", "panes", "configure-panes", "custom", "satisfaction75", "menu.tsx"
)
m = io.open(mp, encoding="utf-8").read()
m = m.replace(
    "font-family: GothamRounded;",
    "font-family: 'Fira Sans', Helvetica, Arial, sans-serif;",
)
io.open(mp, "w", encoding="utf-8", newline="\n").write(m)
print("menu has gotham:", "Gotham" in m)

# 3. delete Gotham font files
removed = 0
for f in glob.glob(os.path.join(app, "public", "fonts", "GothamRounded*")):
    os.remove(f)
    removed += 1
print("removed font files:", removed)

# 4. delete gist oauth code + page
for rel in [os.path.join("src", "utils", "github.ts"), os.path.join("public", "github_oauth.html")]:
    p = os.path.join(app, rel)
    if os.path.exists(p):
        os.remove(p)
        print("removed", rel)
