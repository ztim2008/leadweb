#!/usr/bin/env python3
"""Portfolio page includes the two new sites; the homepage showcase is gone."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
home = (ROOT / "index.html").read_text(encoding="utf-8")
port = (ROOT / "portfolio" / "index.html").read_text(encoding="utf-8")
errors = 0

def fail(msg):
    global errors
    errors += 1
    print("FAIL:", msg)

if 'id="cases"' in home or "case-dkbani" in home or "Все проекты" in home:
    fail("homepage still has the work showcase")
for label, block_name in (("desktop", '<nav class="nav"'), ("mobile", "Мобильное меню")):
    block = home.split(block_name, 1)[1].split("</nav>", 1)[0]
    if 'href="/leadweb/portfolio/"' not in block:
        fail(f"homepage {label} menu missing portfolio")
if "tel:" in home or "mailto:" in home or "Позвонить Алексею" in home:
    fail("homepage contact action returned")

for needle in (
    "Семейная клиника ДНК",
    "Обновление оформления и адаптивных страниц сайта клиники.",
    "https://dnk-med.ru/",
    "Валдай — Первый километр",
    "Сайт коммерческой техники.",
    "https://valdai.onekm-stt.ru/",
    "Фабричные бани",
    "https://dkbani.ru/",
    "https://reverans.online/",
    'width="782" height="1588"',
    "case-dnk-782.webp",
    "case-valdai-782.webp",
):
    if needle not in port:
        fail(f"portfolio missing {needle}")
if "tel:" in port or "mailto:" in port or "max.ru" in port:
    fail("portfolio has a contact action")
for name in (
    "case-dnk.jpg",
    "case-dnk-782.webp",
    "case-dnk-400.webp",
    "case-valdai.jpg",
    "case-valdai-782.webp",
    "case-valdai-400.webp",
):
    if not (ROOT / "img" / name).exists():
        fail(f"missing image {name}")

if errors:
    print(f"{errors} failed")
    sys.exit(1)
print("ok: portfolio has DNA and Valdai; homepage showcase removed")
