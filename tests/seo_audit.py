#!/usr/bin/env python3
"""Technical SEO checks for the static Lead.web pages."""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "https://ztim2008.github.io/leadweb"


class Doc(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.in_title = False
        self.title = []
        self.metas = []
        self.links = []
        self.h = []
        self.imgs = []
        self.hrefs = []
        self.lang = None
        self.stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in {"script", "style"}:
            self.skip += 1
        self.stack.append(tag)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "title":
            self.in_title = True
        if tag == "meta":
            self.metas.append(a)
        if tag == "link":
            self.links.append(a)
        if tag in {"h1", "h2", "h3", "h4"} and self.skip == 0:
            self.h.append([tag, ""])
        if tag == "img":
            self.imgs.append(a)
        if tag == "a" and a.get("href"):
            self.hrefs.append(a["href"])

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1
        if tag == "title":
            self.in_title = False
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.h and self.skip == 0 and self.stack and self.stack[-1] == self.h[-1][0]:
            self.h[-1][1] += data


def meta(doc, name=None, prop=None):
    for item in doc.metas:
        if name and item.get("name") == name:
            return item.get("content", "")
        if prop and item.get("property") == prop:
            return item.get("content", "")
    return ""


def main():
    errors = 0

    def fail(msg):
        nonlocal errors
        errors += 1
        print("FAIL:", msg)

    titles = {}
    descs = {}
    indexable = []
    for path in sorted(ROOT.rglob("*.html")):
        rel = str(path.relative_to(ROOT))
        raw = path.read_text(encoding="utf-8")
        doc = Doc()
        doc.feed(raw)
        title = " ".join(doc.title).strip()
        desc = meta(doc, name="description")
        robots = meta(doc, name="robots")
        canon = next((l.get("href", "") for l in doc.links if l.get("rel") == "canonical"), "")
        noindex = "noindex" in robots
        titles.setdefault(title, []).append(rel)
        if desc and not noindex:
            descs.setdefault(desc, []).append(rel)
        if doc.lang != "ru":
            fail(f"{rel} lang={doc.lang}")
        h1 = [h for h in doc.h if h[0] == "h1"]
        if len(h1) != 1:
            fail(f"{rel} h1 count {len(h1)}")
        if not noindex:
            indexable.append(rel)
            if not (20 <= len(title) <= 75):
                fail(f"{rel} title length {len(title)}: {title}")
            if not (50 <= len(desc) <= 170):
                fail(f"{rel} description length {len(desc)}")
            if not canon.startswith(PREFIX):
                fail(f"{rel} canonical {canon}")
            if meta(doc, prop="og:url").rstrip("/") != canon.rstrip("/"):
                fail(f"{rel} og:url differs from canonical")
            for key in ("og:title", "og:description", "og:image"):
                if not meta(doc, prop=key):
                    fail(f"{rel} missing {key}")
            if meta(doc, name="twitter:card") != "summary_large_image":
                fail(f"{rel} twitter card")
            if meta(doc, name="twitter:description") != desc:
                fail(f"{rel} twitter:description differs from meta description")
        for img in doc.imgs:
            if not (img.get("alt") or "").strip():
                fail(f"{rel} image without alt {img.get('src')}")
            if not img.get("width") or not img.get("height"):
                fail(f"{rel} image without dimensions {img.get('src')}")
        for match in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', raw, re.S):
            try:
                data = json.loads(match.group(1))
            except json.JSONDecodeError as exc:
                fail(f"{rel} JSON-LD {exc}")
                continue
            blob = json.dumps(data, ensure_ascii=False)
            for bad in ("telephone", "email", "contactPoint", "aggregateRating", "review", "max.ru", "t.me", "tel:", "mailto:"):
                if bad in blob:
                    fail(f"{rel} JSON-LD contains {bad}")
        for href in doc.hrefs:
            path = href.split("#", 1)[0].split("?", 1)[0]
            if not path.startswith("/leadweb/"):
                continue
            local = path[len("/leadweb/"):]
            target = ROOT / local
            if local.endswith("/"):
                target = ROOT / local / "index.html"
            if not target.exists():
                fail(f"{rel} broken link {href}")

    for title, pages in titles.items():
        if len(pages) > 1 and "kontakty/index.html" not in pages:
            fail(f"duplicate title {pages}: {title}")
    for desc, pages in descs.items():
        if len(pages) > 1:
            fail(f"duplicate description {pages}")

    sm = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    locs = re.findall(r"<loc>(.*?)</loc>", sm)
    if any("kontakty" in loc for loc in locs):
        fail("sitemap lists the contacts redirect")
    if f"{PREFIX}/o-nas/" not in locs:
        fail("sitemap missing About")
    for rel in indexable:
        if rel in {"404.html", "kontakty/index.html"}:
            continue
        if rel == "index.html":
            url = PREFIX + "/"
        elif rel.endswith("/index.html"):
            url = PREFIX + "/" + rel[: -len("index.html")]
        else:
            url = PREFIX + "/" + rel
        if url not in locs:
            fail(f"sitemap missing {url}")
    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    if "Sitemap: https://ztim2008.github.io/leadweb/sitemap.xml" not in robots:
        fail("robots.txt sitemap")
    if "Disallow: /" in robots:
        fail("robots.txt blocks the site")

    if errors:
        print(f"{errors} failed")
        return 1
    print("ok: titles, descriptions, canonicals, headings, images, JSON-LD, sitemap")
    return 0


if __name__ == "__main__":
    sys.exit(main())
