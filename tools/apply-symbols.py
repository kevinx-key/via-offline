import io
import os

app = r"K:\library\DOCUMENTS\DSH待办\via-study\app"
css_path = os.path.join(app, "src", "app.global.css")
noto_css = io.open(
    os.path.join(app, "public", "fonts", "noto-symbols", "noto-symbols.css"), encoding="utf-8"
).read()

t = io.open(css_path, encoding="utf-8").read()

# 1. swap the Symbola @font-face for the vendored Noto Symbols faces
old_face = "@font-face {\n  font-family: Symbola;\n  src: url(/fonts/Symbola.ttf) format('opentype');\n}\n"
assert old_face in t, "Symbola face not found"
t = t.replace(old_face, noto_css + "\n")

# 2. make the symbol fonts the fallback for the UI stacks
old_stack = "font-family: 'Fira Sans', Helvetica, Helvetica Neue, Arial, serif;"
new_stack = "font-family: 'Fira Sans', 'Noto Sans Symbols', 'Noto Sans Symbols 2', Helvetica, Arial, serif;"
n = t.count(old_stack)
t = t.replace(old_stack, new_stack)

io.open(css_path, "w", encoding="utf-8", newline="\n").write(t)
print("faces swapped, stacks updated:", n)

# 3. drop the old font file
old_font = os.path.join(app, "public", "fonts", "Symbola.ttf")
if os.path.exists(old_font):
    os.remove(old_font)
    print("removed Symbola.ttf")
print("Symbola references left:", t.count("Symbola"))
