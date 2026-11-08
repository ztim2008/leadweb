#!/usr/bin/env python3
"""The studio preview stays off the homepage, sitemap, and contact surfaces."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "studio-preview.html").read_text(encoding="utf-8")
script = (ROOT / "js" / "studio-preview.js").read_text(encoding="utf-8")
home = (ROOT / "index.html").read_text(encoding="utf-8")
sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
license_text = (ROOT / "js" / "vendor" / "PHASER-LICENSE.txt").read_text(encoding="utf-8")
phaser = ROOT / "js" / "vendor" / "phaser.min.js"
errors = 0


def fail(msg):
    global errors
    errors += 1
    print("FAIL:", msg)


if "noindex" not in page:
    fail("studio preview is indexable")
if page.count("<h1") != 1:
    fail("studio preview h1 count")
if 'lang="ru"' not in page:
    fail("studio preview lang")
for href in (
    'href="/leadweb/automation.html"',
    'href="/leadweb/bitrix.html"',
    'href="/leadweb/o-nas/"',
    'href="/leadweb/portfolio/"',
):
    if href not in page:
        fail(f"missing {href}")
if "studio-preview.html" in home or "studio-preview" in sitemap:
    fail("studio preview page linked from homepage or sitemap")
for bad in ("tel:", "mailto:", "max.ru", "t.me/", "Позвонить"):
    if bad in page or bad in script:
        fail(f"contact marker in studio preview: {bad}")
if "http://" in page or "https://" in page:
    fail("studio preview loads a remote URL")
if 'src="js/vendor/phaser.min.js"' not in page or 'src="js/studio-preview.js"' not in page:
    fail("local scripts missing")
if not phaser.exists() or phaser.stat().st_size < 100000:
    fail("vendored phaser missing")
if "MIT" not in license_text or "Phaser 3.88.2" not in license_text:
    fail("phaser license note")
for token in ("prefers-reduced-motion", "Phaser.CANVAS", "Пауза", "Алексей", "Игорь"):
    blob = page + "\n" + script
    if token not in blob:
        fail(f"missing {token}")
if "id=\"pause\"" not in page or "data-zone=\"talk\"" not in page:
    fail("pause or zone controls missing")
if "claude-office" in script or "PMF-game" in script:
    fail("prototype should not embed the reference projects")
if "Выберите место" in page or "Выберите место" in script:
    fail("topic picker dialog is still present")
for token in ("ALEX_PATH", "IGOR_PATH", "function cat", "/leadweb/o-nas/", "setVisible"):
    if token not in script:
        fail(f"studio script missing {token}")
if 'id="studio"' not in home:
    fail("homepage missing studio anchor")
if home.count("<h1") != 1:
    fail("homepage h1 count")
hero_end = home.find("</section>")
if 'id="studio"' not in home[hero_end:hero_end + 500]:
    fail("studio is not directly after the hero")
if "phaser.min.js" in home.split("</head>", 1)[0]:
    fail("phaser is loaded from the document head")
if "studio-preview" in (ROOT / "sitemap.xml").read_text(encoding="utf-8"):
    fail("sitemap lists the studio preview")

if errors:
    print(f"{errors} failed")
    sys.exit(1)
print("ok: studio preview is local, noindex, unlinked, and has no contact actions")
