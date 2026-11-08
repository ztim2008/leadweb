#!/usr/bin/env python3
"""Contact touchpoints may appear only inside the About page main body."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARK = re.compile(r"tel:|mailto:|max\.ru|t\.me/|wa\.me|Позвонить Алексею|Позвонить Игорю", re.I)
ABOUT = ROOT / "o-nas" / "index.html"
ok = True

def main_span(text):
    a = text.find("<main")
    b = text.find("</main>")
    return a, b

for path in sorted(ROOT.rglob("*")):
    if path.suffix not in {".html", ".txt", ".xml", ".js"}:
        continue
    text = path.read_text(encoding="utf-8")
    hits = list(MARK.finditer(text))
    if not hits:
        continue
    if path.resolve() != ABOUT.resolve():
        print(f"FAIL {path.relative_to(ROOT)} has {len(hits)} contact markers")
        ok = False
        continue
    a, b = main_span(text)
    outside = [m for m in hits if not (a <= m.start() < b)]
    if outside:
        print(f"FAIL about has {len(outside)} contact markers outside <main>")
        ok = False
    needed = ["tel:+79212013252", "tel:+79238240461", "mailto:bilariuss@yandex.ru", "max.ru", "t.me/bilarius"]
    main = text[a:b]
    for item in needed:
        if item not in main:
            print(f"FAIL about main missing {item}")
            ok = False

home = (ROOT / "index.html").read_text(encoding="utf-8")
for gone in ("Позвонить Алексею", "Позвонить Игорю", "tel:+79212013252", "tel:+79238240461"):
    if gone in home:
        print(f"FAIL homepage still contains {gone}")
        ok = False
if 'id="calc"' not in home or "<output>" not in home:
    print("FAIL homepage calculator markup missing")
    ok = False
calc = home[home.find('id="calc"'):home.find("</form>", home.find('id="calc"'))]
if MARK.search(calc):
    print("FAIL calculator still has a contact action")
    ok = False
if "Калькулятор ничего не отправляет" not in home and "ничего не отправляет" not in home:
    print("FAIL calculator does not state that it does not submit")
    ok = False

nav = home.split('<nav class="nav"', 1)[1].split("</nav>", 1)[0]
mob = home.split('Мобильное меню">', 1)[1].split("</nav>", 1)[0]
for label, block in (("desktop", nav), ("mobile", mob)):
    if "automation.html" not in block or "bitrix.html" not in block:
        print(f"FAIL {label} menu missing service pages")
        ok = False
    if "kontakty" in block:
        print(f"FAIL {label} menu still links to contacts")
        ok = False

if "kontakty/" in (ROOT / "sitemap.xml").read_text(encoding="utf-8"):
    print("FAIL sitemap still lists contacts")
    ok = False
if not (ROOT / "kontakty" / "index.html").read_text(encoding="utf-8").startswith("<!doctype html>"):
    print("FAIL contacts redirect missing")
    ok = False

if ok:
    print("ok: contacts only in About main; homepage calls gone; calculator has no send action")
    sys.exit(0)
sys.exit(1)
