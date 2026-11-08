#!/usr/bin/env python3
"""Static checks for the two new service pages. Does not deploy anything."""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "automation.html": {
        "h1": "Меньше ручной работы.",
        "cta": ["Обсудить мою задачу", "Обсудить задачу"],
        "phrases": [
            "Это обследование рабочих процессов, не финансовый аудит и не проверка бухгалтерской отчётности.",
            "Демонстрационные сценарии, не выполненные клиентские проекты",
            "Демонстрационные данные, не результаты клиентов",
            "бесплатный аудит не обещаем",
            "Не берёмся за непроверенную регламентированную бухгалтерию",
            "ИИ подключаем только для конкретной задачи",
            "Доступы остаются у вас",
            "поэтапную оплату",
            "закрывающие документы",
            "Подписываем NDA",
        ],
    },
    "bitrix.html": {
        "h1": "Сайт на 1С-Битрикс",
        "cta": ["Обсудить сайт", "Обсудить сайт на 1С-Битрикс"],
        "phrases": [
            "не Битрикс24",
            "Демонстрационные сценарии, не выполненные клиентские проекты",
            "не включаются автоматически в стоимость работ",
            "Доступы остаются у вас",
            "NDA — по согласованию",
            "порядок восстановления",
            "без выдуманных товаров и характеристик",
        ],
    },
}
SECTION_IDS = ["hero", "problems", "services", "process", "scenarios", "safety", "contact"]
CONTACTS = {
    "tel:+79212013252",
    "tel:+79238240461",
    "mailto:bilariuss@yandex.ru",
    "https://max.ru/u/f9LHodD0cOIJWZ3SG6HSah5nE5eGzo3SkpqV2lSE0r7gfVHZOXhLky75kNE",
    "https://max.ru/u/f9LHodD0cOK55o6e_zKUXThShyOsJBmK1dqaZ_lAbwhu54d4FK9g_T-SkGE",
    "/leadweb/kontakty/",
}
LOCAL = {
    "/leadweb/": ROOT / "index.html",
    "/leadweb/automation.html": ROOT / "automation.html",
    "/leadweb/bitrix.html": ROOT / "bitrix.html",
    "/leadweb/kontakty/": ROOT / "kontakty" / "index.html",
    "/leadweb/avtomatizaciya/": ROOT / "avtomatizaciya" / "index.html",
    "/leadweb/uslugi/": ROOT / "uslugi" / "index.html",
    "/leadweb/uslugi/landing/": ROOT / "uslugi" / "landing" / "index.html",
    "/leadweb/uslugi/mnogostranichnyj-sajt/": ROOT / "uslugi" / "mnogostranichnyj-sajt" / "index.html",
    "/leadweb/uslugi/internet-magazin/": ROOT / "uslugi" / "internet-magazin" / "index.html",
    "/leadweb/uslugi/dizajn/": ROOT / "uslugi" / "dizajn" / "index.html",
    "/leadweb/uslugi/seo-i-reklama/": ROOT / "uslugi" / "seo-i-reklama" / "index.html",
    "/leadweb/uslugi/kalkulyatory-i-integracii/": ROOT / "uslugi" / "kalkulyatory-i-integracii" / "index.html",
    "/leadweb/portfolio/": ROOT / "portfolio" / "index.html",
    "/leadweb/sayt-za-0/": ROOT / "sayt-za-0" / "index.html",
    "/leadweb/o-nas/": ROOT / "o-nas" / "index.html",
    "/leadweb/llms.txt": ROOT / "llms.txt",
    "/leadweb/css/site.css": ROOT / "css" / "site.css",
    "/leadweb/css/service-pages.css": ROOT / "css" / "service-pages.css",
    "/leadweb/js/main.js": ROOT / "js" / "main.js",
    "/leadweb/js/magic-rings.js": ROOT / "js" / "magic-rings.js",
    "/leadweb/js/gradient-blinds.js": ROOT / "js" / "gradient-blinds.js",
    "/leadweb/img/favicon.svg": ROOT / "img" / "favicon.svg",
    "/leadweb/img/og.jpg": ROOT / "img" / "og.jpg",
    "/leadweb/img/og-avto.jpg": ROOT / "img" / "og-avto.jpg",
    "/leadweb/img/logo-1c.png": ROOT / "img" / "logo-1c.png",
    "/leadweb/img/logo-1c-bitrix.svg": ROOT / "img" / "logo-1c-bitrix.svg",
    "/leadweb/img/mascot-automation.jpg": ROOT / "img" / "mascot-automation.jpg",
    "/leadweb/img/mascot-automation-640.webp": ROOT / "img" / "mascot-automation-640.webp",
    "/leadweb/img/mascot-automation-960.webp": ROOT / "img" / "mascot-automation-960.webp",
    "/leadweb/img/mascot-automation-1280.webp": ROOT / "img" / "mascot-automation-1280.webp",
    "/leadweb/img/mascot-bitrix.jpg": ROOT / "img" / "mascot-bitrix.jpg",
    "/leadweb/img/mascot-bitrix-640.webp": ROOT / "img" / "mascot-bitrix-640.webp",
    "/leadweb/img/mascot-bitrix-960.webp": ROOT / "img" / "mascot-bitrix-960.webp",
    "/leadweb/img/mascot-bitrix-1280.webp": ROOT / "img" / "mascot-bitrix-1280.webp",
}
FORBIDDEN = [
    r"Cursor",
    r"агент",
    r"ROI",
    r"сертифик",
    r"отзыв",
    r"\d+\s*лет",
    r"140\+",
    r"бесплатн\w*\s+аудит(?! не)",
]


VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Doc(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ids = []
        self.h1 = []
        self.hrefs = []
        self.main_sections = 0
        self.in_main = 0
        self.forms = 0
        self.imgs = []
        self.buttons = []
        self.svgs = 0
        self.text = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.stack.append(tag)
        if tag == "main":
            self.in_main += 1
        if tag == "section" and self.in_main:
            self.main_sections += 1
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "a" and a.get("href"):
            self.hrefs.append(a["href"])
        if tag == "form":
            self.forms += 1
        if tag == "img":
            self.imgs.append(a)
        if tag == "button":
            self.buttons.append(a)
        if tag == "svg":
            self.svgs += 1
        if tag in {"script", "style"}:
            self.skip += 1
        if tag in VOID and self.stack and self.stack[-1] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1
        if tag == "main" and self.in_main:
            self.in_main -= 1
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.skip:
            return
        if "h1" in self.stack:
            self.h1.append(data)
        self.text.append(data)


def fail(msg):
    print("FAIL:", msg)
    return 1


def main():
    errors = 0
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    main = home.split("<main", 1)[1].split("</main>", 1)[0]
    if "automation.html" in main or "bitrix.html" in main:
        errors += fail("homepage main content links to the new pages")
    if "Lead.web" not in home.split("<h1", 1)[1][:400]:
        errors += fail("homepage h1 changed")
    if home.count('href="/leadweb/automation.html"') < 1 or home.count('href="/leadweb/bitrix.html"') < 1:
        errors += fail("homepage menu or footer missing the new routes")
    for name, spec in PAGES.items():
        raw = (ROOT / name).read_text(encoding="utf-8")
        doc = Doc()
        doc.feed(raw)
        text = " ".join(doc.text)
        if doc.stack:
            errors += fail(f"{name} unclosed tags: {doc.stack}")
        if doc.main_sections != 7:
            errors += fail(f"{name} has {doc.main_sections} main sections, expected 7")
        for sid in SECTION_IDS:
            if sid not in doc.ids:
                errors += fail(f"{name} missing section id #{sid}")
        if "team" in doc.ids or re.search(r">\s*Команда\s*<", raw):
            errors += fail(f"{name} has a team section")
        h1 = " ".join(doc.h1)
        if spec["h1"] not in h1:
            errors += fail(f"{name} h1 is {h1!r}")
        for phrase in spec["phrases"]:
            if phrase not in raw:
                errors += fail(f"{name} missing phrase: {phrase}")
        for label in spec["cta"]:
            if label not in text:
                errors += fail(f"{name} missing CTA label: {label}")
        if doc.forms:
            errors += fail(f"{name} contains a form")
        for img in doc.imgs:
            if not img.get("alt"):
                errors += fail(f"{name} img without alt: {img}")
        for button in doc.buttons:
            label = (button.get("aria-label") or "").strip()
            if not label and button.get("type") != "submit":
                # visible text is not in attrs; burger and close have aria-label
                if not button.get("aria-label"):
                    errors += fail(f"{name} button without aria-label: {button}")
        if doc.svgs < 10:
            errors += fail(f"{name} has too few inline icons: {doc.svgs}")
        if "emoji" in raw or re.search(r"[\U0001F300-\U0001FAFF]", raw):
            errors += fail(f"{name} contains emoji")
        for pat in FORBIDDEN:
            if re.search(pat, text, re.I):
                errors += fail(f"{name} forbidden pattern {pat}")
        if name == "bitrix.html":
            for m in re.finditer(r".{0,12}Битрикс24", text):
                if "не Битрикс24" not in m.group(0) and "не Битрикс24" not in text[max(0, m.start() - 20):m.end()]:
                    errors += fail(f"Bitrix24 mention without negation: {m.group(0)!r}")
        for href in doc.hrefs:
            base = href.split("#")[0]
            if not base or base.startswith("#"):
                continue
            if base.startswith(("tel:", "mailto:")):
                if base not in CONTACTS and not base.startswith("mailto:bilariuss@yandex.ru"):
                    errors += fail(f"{name} unexpected contact {base}")
                continue
            if base.startswith("http"):
                allowed = base in CONTACTS or base in {
                    "https://1c.ru/",
                    "https://www.1c-bitrix.ru/products/cms/",
                } or "fonts.googleapis.com" in base or "fonts.gstatic.com" in base or "ztim2008.github.io/leadweb/" in base
                if not allowed:
                    errors += fail(f"{name} unexpected external link {base}")
                continue
            path = base.split("?")[0]
            if path not in LOCAL:
                errors += fail(f"{name} unknown local link {path}")
            elif not LOCAL[path].exists():
                errors += fail(f"{name} missing file for {path}")
        for contact in ("tel:+79212013252", "tel:+79238240461", "mailto:bilariuss@yandex.ru"):
            if contact not in doc.hrefs:
                errors += fail(f"{name} missing {contact}")
        other = "/leadweb/bitrix.html" if name == "automation.html" else "/leadweb/automation.html"
        if other not in [h.split("#")[0] for h in doc.hrefs]:
            errors += fail(f"{name} does not link to {other}")
        imgs = [i for i in doc.imgs]
        alts = " ".join(i.get("alt", "") for i in imgs)
        if alts.count("вымышленный") != 1:
            errors += fail(f"{name} mascot alt count {alts.count('вымышленный')}")
        if "Это не сотрудник" not in alts:
            errors += fail(f"{name} mascot alt does not say it is not an employee")
        if name == "automation.html" and "Товарный знак «1С»" not in alts:
            errors += fail("automation page missing 1C logo alt")
        if name == "bitrix.html" and "Товарный знак «1С-Битрикс»" not in alts:
            errors += fail("bitrix page missing Bitrix logo alt")
        if "франчайзи" in text and "не франчайзи" not in text:
            errors += fail(f"{name} franchise claim")
        if re.search(r"(?<!не )партн[её]р", text, re.I):
            errors += fail(f"{name} partnership claim")
        if "/leadweb/" not in [h.split("#")[0] for h in doc.hrefs]:
            errors += fail(f"{name} does not link home")
        try:
            json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', raw).group(1))
        except Exception as exc:
            errors += fail(f"{name} JSON-LD: {exc}")
    sm = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    for url in ("automation.html", "bitrix.html"):
        if f"https://ztim2008.github.io/leadweb/{url}" not in sm:
            errors += fail(f"sitemap missing {url}")
    llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
    for url in ("automation.html", "bitrix.html"):
        if url not in llms:
            errors += fail(f"llms.txt missing {url}")
    css = (ROOT / "css" / "service-pages.css").read_text(encoding="utf-8")
    if "prefers-reduced-motion" not in css:
        errors += fail("service css missing reduced motion")
    if ":focus-visible" not in css:
        errors += fail("service css missing focus-visible")
    if errors:
        print(f"{errors} failed")
        return 1
    print("ok: structure, copy caveats, contacts, links, seven sections")
    return 0


if __name__ == "__main__":
    sys.exit(main())
