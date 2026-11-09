import io, os, re

app = r"K:\library\DOCUMENTS\DSH待办\via-study\app"

css_path = os.path.join(app, "src", "app.global.css")
css = io.open(css_path, encoding="utf-8").read()
fira = io.open(os.path.join(app, "public", "fonts", "fira", "fira.css"), encoding="utf-8").read()

marker = "/* offline build: Fira Sans is vendored locally in public/fonts/fira */"
css2, n = re.subn(r"@import url\('https://fonts\.googleapis\.com[^']*'\);\s*", "", css)
assert n == 2, f"expected 2 imports, replaced {n}"
css2 = marker + "\n" + fira + "\n" + css2
io.open(css_path, "w", encoding="utf-8", newline="\n").write(css2)
print("css patched, imports removed:", n, "len", len(css2))

html_path = os.path.join(app, "index.html")
h = io.open(html_path, encoding="utf-8").read()
h2, n = re.subn(r"\s*<link rel=\"preconnect\" href=\"https://fonts\.[^\"]+\"[^>]*>", "", h)
h2, n2 = re.subn(r"\s*<link\s+href=\"https://fonts\.googleapis\.com[^\"]*\"[^>]*>", "", h2, flags=re.S)
print("preconnect removed:", n, "stylesheet removed:", n2, "googleapis left:", "fonts.googleapis" in h2)
io.open(html_path, "w", encoding="utf-8", newline="\n").write(h2)
